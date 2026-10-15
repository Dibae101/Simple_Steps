import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE, bootstrapSession } from '../services/api';

/**
 * Whether this tab's session is live: the backend answers `GET /api/session`.
 *
 * That endpoint is what mints the `ss_session` cookie, so a 200 means both
 * "the server is reachable" and "this tab has a session" — and the first check
 * is also the app's session bootstrap.
 */

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface Connection {
  status: ConnectionStatus;
  /** Where the API lives, as this build resolved it. */
  apiBase: string;
  /** First 8 hex chars of the session id, for diagnostics. */
  sessionToken?: string;
  /** Round trip of the last successful check. */
  latencyMs?: number;
  lastCheckedAt?: Date;
  /** When the session was last seen live. */
  lastConnectedAt?: Date;
  /** Why the last check failed. */
  error?: string;
  /** Check now instead of waiting for the next poll. */
  retry: () => void;
}

const POLL_MS = 5000;
const TIMEOUT_MS = 4000;

export function useConnection(): Connection {
  const [state, setState] = useState<Omit<Connection, 'retry' | 'apiBase'>>({ status: 'connecting' });
  const inFlight = useRef(false);

  const check = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const started = performance.now();
    try {
      // A hung server never rejects; without a deadline the pill stays green.
      const info = await Promise.race([
        bootstrapSession(),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error(`no answer in ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS)),
      ]);
      const now = new Date();
      setState({
        status: 'connected',
        sessionToken: info.session_token,
        latencyMs: Math.round(performance.now() - started),
        lastCheckedAt: now,
        lastConnectedAt: now,
      });
    } catch (e) {
      setState((prev) => ({
        ...prev,
        status: 'disconnected',
        lastCheckedAt: new Date(),
        error: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void check();
    const timer = window.setInterval(() => void check(), POLL_MS);
    // The browser knows about these before a poll would.
    const now = () => void check();
    window.addEventListener('online', now);
    window.addEventListener('offline', now);
    window.addEventListener('focus', now);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', now);
      window.removeEventListener('offline', now);
      window.removeEventListener('focus', now);
    };
  }, [check]);

  return { ...state, apiBase: API_BASE, retry: () => void check() };
}
