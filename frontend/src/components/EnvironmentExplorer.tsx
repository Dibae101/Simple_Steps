/**
 * EnvironmentExplorer — the sidebar's Environment panel (spec 013).
 *
 * Everything a workflow in this app can use: its tools (the app's and core's
 * built-ins) and its resources (this workflow's, the deployment's ready-made
 * ones, and the resource types). Click any of them for all that is known
 * about it: inputs with their Python types, defaults and descriptions, the
 * output type, settings, bound tools, and a formula to start from.
 *
 * The data is core's own catalog, served by GET /api/environment, so a tool
 * reads the same here as in the step editor and in core.
 */

import React, { useEffect, useState } from 'react';
import Icon from './Icon';
import {
  fetchEnvironment,
  type Environment, type EnvironmentParam, type EnvironmentTool, type ResourceDeclaration,
} from '../services/api';
import { boundTool, exampleFormula, py, usersOf, type ResourceRow } from '../utils/environment';
import './EnvironmentExplorer.css';

interface Props {
  /** This workflow's `resources` section. */
  workflowResources?: Record<string, ResourceDeclaration>;
}

/** What the details view shows. A stack, so a bound tool opened from its type goes back to it. */
type Selection =
  | { kind: 'tool'; tool: EnvironmentTool }
  | { kind: 'type'; name: string }
  | { kind: 'resource'; name: string; source: 'workflow' | 'ready-made' };

/** Colour per palette kind — matches the formula-bar autocomplete. */
const KIND_COLORS: Record<string, string> = {
  source: '#4ec9b0', map: '#569cd6', filter: '#ce9178', dataframe: '#b5cea8',
  expand: '#d7ba7d', raw_output: '#c586c0', builtin: '#808080', bound: '#9cdcfe',
};

export default function EnvironmentExplorer({ workflowResources = {} }: Props) {
  const [env, setEnv] = useState<Environment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set(['tools', 'resources']));
  const [stack, setStack] = useState<Selection[]>([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchEnvironment()
      .then((e) => { if (!cancelled) setEnv(e); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [attempt]);
  const retry = () => { setError(null); setAttempt((n) => n + 1); };

  const resources: ResourceRow[] = [
    ...Object.entries(workflowResources).map(([name, d]) => ({
      name, type: d.type, source: 'workflow' as const, settings: (d.settings ?? {}) as Record<string, unknown>,
    })),
    ...Object.entries(env?.resources ?? {})
      .filter(([name]) => !(name in workflowResources))
      .map(([name, r]) => ({ name, type: r.type, source: 'ready-made' as const, settings: r.settings })),
  ];

  const q = filter.trim().toLowerCase();
  const matches = (...texts: (string | null | undefined)[]) => !q || texts.some((t) => t?.toLowerCase().includes(q));

  const tools = (env?.tools ?? []).filter((t) =>
    matches(t.id, t.label, t.category, t.description, t.kind, t.returns));
  const toolGroups = new Map<string, EnvironmentTool[]>();      // the server's order: built-ins last
  for (const t of tools) toolGroups.set(t.category, [...(toolGroups.get(t.category) ?? []), t]);
  const shownResources = resources.filter((r) => matches(r.name, r.type));
  const types = Object.values(env?.resource_types ?? {}).filter((t) =>
    matches(t.type, t.description, ...(t.bases ?? [])));

  const toggle = (key: string) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const isOpen = (key: string) => (q ? true : open.has(key));
  const show = (s: Selection) => setStack((prev) => [...prev, s]);
  const back = () => setStack((prev) => prev.slice(0, -1));

  if (error) {
    return (
      <div className="env-explorer">
        <div className="env-empty">Could not load the environment: {error}</div>
        <button type="button" className="env-link" onClick={retry}>Try again</button>
      </div>
    );
  }
  if (!env) return <div className="env-explorer"><div className="env-empty">Loading…</div></div>;

  const current = stack[stack.length - 1];
  if (current) {
    return (
      <div className="env-explorer" data-testid="environment-explorer">
        <div className="env-detail-bar">
          <button type="button" className="env-back" onClick={back} title="Back">
            <Icon name="arrow-left" size={14} /> Back
          </button>
        </div>
        <div className="env-detail">
          {current.kind === 'tool' && (
            <ToolDetail tool={current.tool} env={env} resources={resources} onShow={show} />
          )}
          {current.kind === 'type' && (
            <TypeDetail name={current.name} env={env} resources={resources} onShow={show} />
          )}
          {current.kind === 'resource' && (
            <ResourceDetail row={resources.find((r) => r.name === current.name && r.source === current.source)}
              env={env} resources={resources} onShow={show} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="env-explorer" data-testid="environment-explorer">
      <div className="env-filter">
        <input
          type="text"
          className="env-filter-input"
          placeholder="Filter tools and resources…"
          aria-label="Filter tools and resources"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {filter && (
          <button type="button" className="env-filter-clear" onClick={() => setFilter('')} aria-label="Clear filter">×</button>
        )}
      </div>

      <div className="env-scroll">
        <SectionHeader label="Tools" count={tools.length} open={isOpen('tools')} onToggle={() => toggle('tools')} />
        {isOpen('tools') && (
          <div className="env-section">
            {toolGroups.size === 0 && <div className="env-empty">{q ? `No tools match “${filter}”.` : 'No tools registered.'}</div>}
            {[...toolGroups].map(([category, list]) => (
              <div key={category}>
                <button type="button" className="env-group-row" onClick={() => toggle(`cat:${category}`)}
                  aria-expanded={isOpen(`cat:${category}`)}>
                  <Icon name={isOpen(`cat:${category}`) ? 'chevron-down' : 'chevron-right'} size={11} />
                  <span className="env-group-label">{category}</span>
                  <span className="env-group-count">{list.length}</span>
                </button>
                {isOpen(`cat:${category}`) && list.map((t) => (
                  <button type="button" key={t.id} className="env-item" title={t.description || t.id}
                    onClick={() => show({ kind: 'tool', tool: t })}>
                    <span className="env-item-icon">ƒ</span>
                    <span className="env-item-name">{t.label}</span>
                    <KindBadge tool={t} />
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        <SectionHeader label="Resources" count={shownResources.length + types.length}
          open={isOpen('resources')} onToggle={() => toggle('resources')} />
        {isOpen('resources') && (
          <div className="env-section">
            {(['workflow', 'ready-made'] as const).map((source) => {
              const rows = shownResources.filter((r) => r.source === source);
              if (!rows.length) return null;
              return (
                <div key={source}>
                  <div className="env-subhead">{source === 'workflow' ? 'In this workflow' : 'Ready-made'}</div>
                  {rows.map((r) => (
                    <button type="button" key={r.name} className="env-item" onClick={() => show({ kind: 'resource', name: r.name, source })}>
                      <span className="env-item-icon env-res-icon">◆</span>
                      <span className="env-item-name">res["{r.name}"]</span>
                      <span className="env-item-type">{r.type}</span>
                    </button>
                  ))}
                </div>
              );
            })}
            <div className="env-subhead">Types</div>
            {types.length === 0 && <div className="env-empty">{q ? 'No resource types match.' : 'This app declares no resource types.'}</div>}
            {types.map((t) => (
              <button type="button" key={t.type} className="env-item" title={t.description ?? t.type}
                onClick={() => show({ kind: 'type', name: t.type })}>
                <span className="env-item-icon env-type-icon">◇</span>
                <span className="env-item-name">{t.type}</span>
                <span className="env-item-type">{Object.keys(t.tools).length} tool{Object.keys(t.tools).length === 1 ? '' : 's'}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Details ──────────────────────────────────────────────────────────────────

interface DetailProps {
  env: Environment;
  resources: ResourceRow[];
  onShow: (s: Selection) => void;
}

function ToolDetail({ tool, env, resources, onShow }: DetailProps & { tool: EnvironmentTool }) {
  const formula = exampleFormula(tool, resources, env);
  return (
    <>
      <div className="env-title">{tool.label}</div>
      <div className="env-chips">
        <code className="env-id">{tool.id}</code>
        <KindBadge tool={tool} />
      </div>
      <div className="env-meta">
        {tool.origin === 'builtin' ? 'Built into simple-steps-core'
          : tool.origin === 'bound' ? <>A tool of the resource type <TypeLink name={tool.category} onShow={onShow} /></>
            : <>Category: {tool.category}</>}
      </div>
      {tool.description
        ? <p className="env-description">{tool.description}</p>
        : <p className="env-description env-muted">No description. A docstring on the tool adds one.</p>}

      <h4 className="env-h">Inputs <span className="env-h-count">{tool.params.length}</span></h4>
      {tool.params.length === 0 && <div className="env-muted">Takes no inputs.</div>}
      {tool.params.map((p) => <ParamRow key={p.name} param={p} onShow={onShow} />)}

      <h4 className="env-h">Output</h4>
      <div className="env-param">
        <TypeName type={tool.returns} />
        {tool.returns_form && <span className="env-muted"> · a {tool.returns_form === 'grid' ? 'table' : tool.returns_form}</span>}
      </div>

      <h4 className="env-h">Use it</h4>
      <Formula text={formula} />
      {tool.origin === 'declared' && tool.kind !== 'source' && (
        <div className="env-muted env-hint">
          Inputs not written in the formula are read, per row, from the input step's column of the same name.
          The verb (map, filter, …) is inferred unless you write it in brackets.
        </div>
      )}
    </>
  );
}

function TypeDetail({ name, env, resources, onShow }: DetailProps & { name: string }) {
  const t = env.resource_types[name];
  if (!t) return <div className="env-empty">No resource type named {name}.</div>;
  const instances = resources.filter((r) => r.type === name);
  const bases = (t.bases ?? []).filter((b) => b !== name);
  const users = usersOf(env, [name, ...bases]);
  return (
    <>
      <div className="env-title">{t.type}</div>
      <div className="env-chips"><span className="env-badge" style={{ background: KIND_COLORS.bound }}>resource type</span></div>
      {bases.length > 0 && <div className="env-meta">Is a: {bases.join(', ')}</div>}
      {t.description
        ? <p className="env-description">{t.description}</p>
        : <p className="env-description env-muted">No description.</p>}

      <h4 className="env-h">Settings <span className="env-h-count">{t.settings.length}</span></h4>
      {t.settings.length === 0 && <div className="env-muted">No settings.</div>}
      {t.settings.map((s) => (
        <div key={s.name} className="env-param">
          <div className="env-param-head">
            <code className="env-param-name">{s.name}</code>
            <TypeName type={s.type} />
            {s.required ? <span className="env-required">required</span>
              : <span className="env-default">= {py(s.default)}</span>}
          </div>
        </div>
      ))}

      <h4 className="env-h">Tools <span className="env-h-count">{Object.keys(t.tools).length}</span></h4>
      {Object.keys(t.tools).length === 0 && <div className="env-muted">No methods marked @simple_step_tool.</div>}
      {Object.entries(t.tools).map(([id, entry]) => (
        <button type="button" key={id} className="env-item env-item-inset" title={entry.description ?? id}
          onClick={() => onShow({ kind: 'tool', tool: boundTool(name, id, entry) })}>
          <span className="env-item-icon">ƒ</span>
          <span className="env-item-name">{id.split('.').pop()}</span>
          <span className="env-item-type">→ {entry.returns ?? '?'}</span>
        </button>
      ))}

      {users.length > 0 && <>
        <h4 className="env-h">Tools that take one</h4>
        {users.map((u) => (
          <button type="button" key={u.id} className="env-item env-item-inset" onClick={() => onShow({ kind: 'tool', tool: u })}>
            <span className="env-item-icon">ƒ</span>
            <span className="env-item-name">{u.label}</span>
            <span className="env-item-type">{u.category}</span>
          </button>
        ))}
      </>}

      <h4 className="env-h">In this app</h4>
      {instances.length === 0 && <div className="env-muted">None yet. Add one from Resources in the toolbar.</div>}
      {instances.map((r) => (
        <button type="button" key={`${r.source}:${r.name}`} className="env-item env-item-inset"
          onClick={() => onShow({ kind: 'resource', name: r.name, source: r.source })}>
          <span className="env-item-icon env-res-icon">◆</span>
          <span className="env-item-name">res["{r.name}"]</span>
          <span className="env-item-type">{r.source}</span>
        </button>
      ))}
    </>
  );
}

function ResourceDetail({ row, env, resources, onShow }: DetailProps & { row: ResourceRow | undefined }) {
  if (!row) return <div className="env-empty">This resource is no longer in the workflow.</div>;
  const t = env.resource_types[row.type];
  const loaded = row.source === 'ready-made' ? env.resources[row.name] : undefined;
  const locked = new Set(loaded?.locked ?? []);
  const values: Record<string, unknown> = { ...Object.fromEntries((t?.settings ?? []).map((s) => [s.name, s.default])), ...row.settings };
  const firstTool = Object.entries(t?.tools ?? {})[0];
  return (
    <>
      <div className="env-title">res["{row.name}"]</div>
      <div className="env-chips">
        <span className="env-badge" style={{ background: KIND_COLORS.bound }}>{row.source === 'workflow' ? 'this workflow' : 'ready-made'}</span>
      </div>
      <div className="env-meta">Type: <TypeLink name={row.type} onShow={onShow} /></div>
      {t?.description && <p className="env-description">{t.description}</p>}

      <h4 className="env-h">Settings</h4>
      {Object.keys(values).length === 0 && <div className="env-muted">No settings.</div>}
      {Object.entries(values).map(([k, v]) => (
        <div key={k} className="env-param">
          <div className="env-param-head">
            <code className="env-param-name">{k}</code>
            <span className="env-default">= {loaded?.from_env[k] ? `env:${loaded.from_env[k]}` : py(v)}</span>
            {locked.has(k) && <span className="env-required">set by the deployment</span>}
          </div>
        </div>
      ))}

      <h4 className="env-h">Tools</h4>
      {!t || Object.keys(t.tools).length === 0
        ? <div className="env-muted">Its type has no tools of its own; pass it to a tool that takes a {row.type}.</div>
        : Object.entries(t.tools).map(([id, entry]) => (
          <button type="button" key={id} className="env-item env-item-inset"
            onClick={() => onShow({ kind: 'tool', tool: boundTool(row.type, id, entry) })}>
            <span className="env-item-icon">ƒ</span>
            <span className="env-item-name">{id.split('.').pop()}</span>
            <span className="env-item-type">→ {entry.returns ?? '?'}</span>
          </button>
        ))}

      <h4 className="env-h">Use it</h4>
      {firstTool
        ? <Formula text={exampleFormula(boundTool(row.type, firstTool[0], firstTool[1]), [row, ...resources], env)} />
        : <Formula text={`tool[mod.map()](wf["…"], ${row.name}=res["${row.name}"])`} />}
      {usersOf(env, [row.type, ...(t?.bases ?? [])]).length > 0 && (
        <div className="env-muted env-hint">
          Also passed to: {usersOf(env, [row.type, ...(t?.bases ?? [])]).map((u) => u.id).join(', ')}.
        </div>
      )}
    </>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────────

function SectionHeader({ label, count, open, onToggle }: { label: string; count: number; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="env-section-header" onClick={onToggle} aria-expanded={open}>
      <Icon name={open ? 'chevron-down' : 'chevron-right'} size={12} />
      <span className="env-section-label">{label}</span>
      <span className="env-section-count">{count}</span>
    </button>
  );
}

function KindBadge({ tool }: { tool: EnvironmentTool }) {
  const word = tool.origin === 'builtin' ? 'built-in' : tool.origin === 'bound' ? 'bound' : tool.kind;
  if (!word) return null;
  const color = KIND_COLORS[tool.origin === 'builtin' ? 'builtin' : tool.origin === 'bound' ? 'bound' : tool.kind ?? ''] ?? '#666';
  return <span className="env-badge" style={{ background: color }}>{word}</span>;
}

function TypeName({ type }: { type: string | null | undefined }) {
  return type
    ? <code className="env-type">{type}</code>
    : <span className="env-type env-untyped" title="No type annotation: any value is accepted">untyped</span>;
}

function TypeLink({ name, onShow }: { name: string; onShow: (s: Selection) => void }) {
  return <button type="button" className="env-link" onClick={() => onShow({ kind: 'type', name })}>{name}</button>;
}

function ParamRow({ param: p, onShow }: { param: EnvironmentParam; onShow: (s: Selection) => void }) {
  return (
    <div className="env-param" data-testid={`param-${p.name}`}>
      <div className="env-param-head">
        <code className="env-param-name">{p.name}</code>
        <TypeName type={p.type} />
        {p.nullable && <span className="env-muted">or None</span>}
        {p.required ? <span className="env-required">required</span>
          : <span className="env-default">= {py(p.default)}</span>}
      </div>
      {p.description && <div className="env-param-desc">{p.description}</div>}
      {p.choices && p.choices.length > 0 && (
        <div className="env-param-desc">One of: {p.choices.map((c) => <code key={String(c)} className="env-choice">{py(c)}</code>)}</div>
      )}
      {p.resource && (
        <div className="env-param-desc">
          A resource: <code>res["…"]</code> of type{' '}
          {p.resource.map((r, i) => <React.Fragment key={r}>{i > 0 && ', '}<TypeLink name={r} onShow={onShow} /></React.Fragment>)}
        </div>
      )}
    </div>
  );
}

function Formula({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(`=${text}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }).catch(() => undefined);
  };
  return (
    <div className="env-formula">
      <code>={text}</code>
      <button type="button" className="env-copy" onClick={copy} title="Copy the formula">{copied ? 'Copied' : 'Copy'}</button>
    </div>
  );
}
