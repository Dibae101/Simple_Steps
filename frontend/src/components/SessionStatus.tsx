import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';
import type { Connection } from '../hooks/useConnection';

const LABEL = { connecting: 'Connecting…', connected: 'Connected', disconnected: 'Disconnected' } as const;

const timeOf = (d?: Date) => (d ? d.toLocaleTimeString() : '—');

/**
 * The session pill: green while the backend answers, red with a cross when
 * it doesn't. Click for the details. The popover is portalled out of the
 * header, whose pane clips anything below the toolbar.
 */
export default function SessionStatus({ connection }: { connection: Connection }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ top: 0, left: 0 });
  const rootRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { status } = connection;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!rootRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <>
      <button
        ref={rootRef}
        className={`ut-status-pill ut-session-${status}`}
        title="Session connection — click for details"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAnchor({ top: r.bottom + 6, left: r.left });
          setOpen((v) => !v);
        }}
      >
        {status === 'disconnected'
          ? <Icon name="close" size={12} className="ut-session-x" />
          : <span className={`ut-status-dot ${status === 'connected' ? 'online' : 'running'}`} />}
        <span className="ut-status-text">{LABEL[status]}</span>
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          className="ut-dropdown-panel ut-session-panel"
          style={{ position: 'fixed', top: anchor.top, left: anchor.left }}
        >
          <div className="ut-panel-title">Session</div>
          <dl className="ut-session-fields">
            <dt>Status</dt><dd className={`ut-session-${status}`}>{LABEL[status]}</dd>
            <dt>Backend</dt><dd className="ut-resource-mono">{connection.apiBase}</dd>
            <dt>Session</dt><dd className="ut-resource-mono">{connection.sessionToken ?? '—'}</dd>
            {status === 'connected' && (<><dt>Latency</dt><dd>{connection.latencyMs} ms</dd></>)}
            <dt>Last checked</dt><dd>{timeOf(connection.lastCheckedAt)}</dd>
            {status === 'disconnected' && (
              <>
                <dt>Last connected</dt><dd>{timeOf(connection.lastConnectedAt)}</dd>
                <dt>Error</dt><dd className="ut-session-error">{connection.error}</dd>
              </>
            )}
          </dl>
          {status === 'disconnected' && (
            <div className="ut-session-hint">
              Is the server still running? Steps can't run until it answers.
            </div>
          )}
          <div className="ut-resource-actions">
            <button className="ut-btn" onClick={connection.retry}>Check now</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
