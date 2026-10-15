import Icon from './Icon';
import SessionStatus from './SessionStatus';
import type { Connection } from '../hooks/useConnection';
import type { LogEntry } from './ExecutionLog';
import './UnifiedToolbar.css';

export interface PipelineMeta {
  counts: {
    running: number;
    errors: number;
  };
}

interface UnifiedToolbarProps {
  onRunAll: () => void;
  onPauseAll: () => void;
  onStopAll: () => void;
  pipelineStatus: 'idle' | 'running' | 'paused';
  logCount?: number;
  logErrorCount?: number;
  isLogOpen?: boolean;
  onToggleLogs?: () => void;
  pipelineMeta?: PipelineMeta;
  /** The workflow's Resources menu, placed after the execution controls. */
  resourcesMenu?: React.ReactNode;
  /** Whether this tab's session is live; shown as the session pill. */
  connection: Connection;
  /** The most recent log line, shown in the activity pill while running. */
  latestLog?: LogEntry;
}

export default function UnifiedToolbar({
  onRunAll,
  onPauseAll,
  onStopAll,
  pipelineStatus,
  logCount = 0,
  logErrorCount = 0,
  isLogOpen = false,
  onToggleLogs,
  pipelineMeta,
  resourcesMenu,
  connection,
  latestLog,
}: UnifiedToolbarProps) {
  const running = pipelineMeta?.counts.running ?? 0;
  const errors = pipelineMeta?.counts.errors ?? 0;
  const isBusy = pipelineStatus === 'running' || running > 0;

  return (
    <div className="unified-toolbar" data-testid="unified-toolbar">

      {/* ── Left: Execution controls ─────────────────────────────────── */}
      <div className="ut-group ut-execution">
        {pipelineStatus === 'running' ? (
          <button className="ut-btn ut-btn-pause" onClick={onPauseAll} title="Pause Pipeline">
            <Icon name="debug-pause" size={14} />
            <span className="ut-label">Pause</span>
          </button>
        ) : (
          <button
            className={`ut-btn ut-btn-run ${pipelineStatus === 'paused' ? 'ut-btn-resume' : ''}`}
            onClick={onRunAll}
            title={pipelineStatus === 'paused' ? 'Resume Pipeline' : 'Run Pipeline'}
          >
            <Icon name="play" size={14} />
            <span className="ut-label">{pipelineStatus === 'paused' ? 'Resume' : 'Run'}</span>
          </button>
        )}

        <button
          className="ut-btn ut-btn-stop"
          onClick={onStopAll}
          title="Stop Pipeline"
          disabled={pipelineStatus === 'idle'}
        >
          <Icon name="debug-stop" size={14} />
        </button>
      </div>

      <div className="ut-divider" />

      {/* ── Workflow: its resources ──────────────────────────────────── */}
      {resourcesMenu && (
        <>
          {resourcesMenu}
          <div className="ut-divider" />
        </>
      )}

      {/* ── Session, then what is happening right now ────────────────── */}
      <div className="ut-group ut-meta-group">
        <SessionStatus connection={connection} />

        {isBusy && (
          <span
            className="ut-meta-count ut-count-running ut-activity"
            title={latestLog ? `${latestLog.timestamp}  ${latestLog.message}` : 'Running'}
          >
            {running > 0 ? `${running} running` : 'Running'}
            {latestLog && <span className="ut-activity-line">· {latestLog.message}</span>}
          </span>
        )}
        {errors > 0 && (
          <span className="ut-meta-count ut-count-errors" title="Steps with errors">
            {errors} {errors === 1 ? 'error' : 'errors'}
          </span>
        )}
      </div>

      {/* ── Right: Logs ──────────────────────────────────────────────── */}
      <div className="ut-spacer" />

      <div className="ut-group ut-status-group">
        {onToggleLogs && (
          <button
            className={`ut-btn ut-btn-logs ${isLogOpen ? 'active' : ''} ${logErrorCount > 0 ? 'has-errors' : ''}`}
            onClick={onToggleLogs}
            title={isLogOpen ? 'Close Logs' : 'Open Logs'}
          >
            <Icon name="output" size={14} />
            {logCount > 0 && <span className="ut-log-count">{logCount}</span>}
            {logErrorCount > 0 && <span className="ut-error-dot" />}
          </button>
        )}
      </div>
    </div>
  );
}
