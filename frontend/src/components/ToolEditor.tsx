import { useEffect, useRef, useState } from 'react';
import { getModifiers, type ModifierInfo, type OperationDefinition } from '../services/api';
import { formatFormula, parseFormula, type FormulaParts, type ParsedFormula } from '../utils/formulaParser';
import { fromFieldText, moveModifier, partsForTool, toFieldText, withEntry } from '../utils/formulaParts';
import './ToolEditor.css';

/**
 * The step's formula as a form: the tool, then its parameters and its
 * modifiers as nested expanders. Modifiers list top to bottom in the order the
 * formula writes them left to right.
 *
 * The formula is the only state. The editor shows *formula* (the last one
 * committed — Enter in the formula bar, or the editor's own last write), and
 * every edit here is written back as a formula through the backend, which
 * refuses anything that wouldn't compile. A formula that doesn't parse keeps
 * the editor on the last good one and shows why. An edit that doesn't make a
 * valid step yet (a retry with no `times`) stays in the editor, with the
 * reason, and reaches the formula once it does.
 *
 * The Parameters section is the seam for tools that bring their own input UI
 * later: it is the one part chosen per tool.
 */

/** `over` is the input itself, written in the call, never as a setting. */
const HIDDEN_SETTINGS = new Set(['over']);

interface Props {
  formula: string;
  availableOperations: OperationDefinition[];
  /** Names of the steps before this one: what the input can read. */
  previousSteps: string[];
  /** The editor wrote a new formula. */
  onChange: (formula: string, parsed: ParsedFormula) => void;
}

export default function ToolEditor({ formula, availableOperations, previousSteps, onChange }: Props) {
  const [parts, setParts] = useState<FormulaParts | null>(null);
  /** The committed formula is valid but isn't a tool call (a literal, a legacy formula). */
  const [notATool, setNotATool] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Record<string, ModifierInfo>>({});

  useEffect(() => { getModifiers().then(setCatalog).catch(() => setCatalog({})); }, []);

  // Redraw from the committed formula. An invalid one keeps the last good parts.
  useEffect(() => {
    let cancelled = false;
    const empty = !formula.trim();
    (empty ? Promise.resolve(null) : parseFormula(formula)).then((p) => {
      if (cancelled) return;
      if (!p) { setParts(null); setNotATool(false); setWarning(null); return; }
      if (!p.isValid) { setWarning(p.error ?? 'This formula has a syntax error.'); return; }
      setWarning(null);
      setParts(p.parts ?? null);
      setNotATool(!p.parts);
    }).catch(() => { if (!cancelled) setWarning('Could not reach the server to check this formula.'); });
    return () => { cancelled = true; };
  }, [formula]);

  // Edits arrive faster than the server answers; only the latest one counts.
  const writeSeq = useRef(0);
  const write = async (next: FormulaParts) => {
    const seq = ++writeSeq.current;
    try {
      const res = await formatFormula(next);
      if (seq !== writeSeq.current) return;
      setParts(res.parsed.parts ?? next);
      setWarning(null);
      // The app writes formulas with a leading '=' (docs/dev_plan/104).
      onChange(res.formula.startsWith('=') ? res.formula : `=${res.formula}`, res.parsed);
    } catch (e) {
      if (seq !== writeSeq.current) return;
      setParts(next);
      setWarning(`${e instanceof Error ? e.message : String(e)} — not in the formula yet.`);
    }
  };

  const op = parts ? availableOperations.find((o) => o.id === parts.tool) : undefined;
  const previous = previousSteps.length ? previousSteps[previousSteps.length - 1] : null;
  const isCombine = !!parts && parts.inputs.length > 0;

  const chooseTool = (id: string) => {
    if (!id) return;
    const chosen = availableOperations.find((o) => o.id === id);
    void write(partsForTool(id, chosen?.type, parts?.input ?? previous));
  };

  return (
    <div className="tool-editor" onClick={(e) => e.stopPropagation()}>
      {warning && (
        <div className="te-warning" role="status" title={warning}>
          <span aria-hidden="true">⚠</span> {warning}
        </div>
      )}

      <Section title="Tool" summary={parts?.tool} defaultOpen>
        <div className="te-row">
          <select
            className="te-tool-select"
            value={parts?.tool ?? ''}
            onChange={(e) => chooseTool(e.target.value)}
            disabled={isCombine}
            title={op?.description}
          >
            <option value="">Choose a tool…</option>
            {parts && !op && <option value={parts.tool}>{parts.tool}</option>}
            {groupByCategory(availableOperations).map(([category, ops]) => (
              <optgroup key={category} label={category}>
                {ops.map((o) => <option key={o.id} value={o.id}>{o.label || o.id}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        {parts?.bound_to && (
          <div className="te-note">Runs on <code>res["{parts.bound_to}"]</code></div>
        )}
        {notATool && (
          <div className="te-note">This step is a value or a reference, not a tool call. Edit it in the formula bar, or choose a tool to replace it.</div>
        )}

        {parts && isCombine && (
          <div className="te-note">
            A <code>{parts.tool}</code> of {parts.inputs.map((n) => `wf["${n}"]`).join(', ')} — edit it in the formula bar.
          </div>
        )}

        {parts && !isCombine && (
          <>
            <div className="te-row">
              <label className="te-label" title="The step this one reads, wf[…]">Input</label>
              <select
                value={parts.input ?? ''}
                onChange={(e) => void write({ ...parts, input: e.target.value || null })}
              >
                <option value="">None (source)</option>
                {parts.input && !previousSteps.includes(parts.input) && <option value={parts.input}>{parts.input}</option>}
                {previousSteps.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <Section title="Parameters" summary={countLabel(Object.keys(parts.arguments).length, 'set')} defaultOpen nested>
              <ParametersForm parts={parts} op={op} onWrite={write} />
            </Section>

            <Section title="Modifiers" summary={parts.modifiers ? countLabel(parts.modifiers.length) : 'inferred'} defaultOpen nested>
              <ModifierList parts={parts} op={op} catalog={catalog} onWrite={write} />
            </Section>
          </>
        )}
      </Section>
    </div>
  );
}

// ── Parameters ───────────────────────────────────────────────────────────────

function ParametersForm({ parts, op, onWrite }: {
  parts: FormulaParts;
  op: OperationDefinition | undefined;
  onWrite: (p: FormulaParts) => void;
}) {
  const declared = (op?.params ?? []).filter((p) => p.kind !== 'resource' || p.name in parts.arguments);
  // Arguments the formula passes that the tool doesn't declare still show, so nothing is hidden.
  const extra = Object.keys(parts.arguments).filter((n) => !declared.some((p) => p.name === n));
  if (!declared.length && !extra.length) return <div className="te-note">This tool takes no parameters.</div>;

  const set = (name: string, text: string, type?: string) =>
    onWrite({ ...parts, arguments: withEntry(parts.arguments, name, fromFieldText(text, type)) });
  // An unannotated parameter reports as "string"; its default says what it holds.
  const typeOf = (p: { type?: string; default?: unknown }) =>
    typeof p.default === 'number' ? 'number'
      : typeof p.default === 'boolean' ? 'bool'
        : Array.isArray(p.default) ? 'list' : p.type;

  return (
    <div className="te-fields">
      {declared.map((p) => (
        <Field
          key={p.name}
          name={p.name}
          required={p.required}
          description={p.description}
          value={toFieldText(parts.arguments[p.name])}
          placeholder={p.default != null ? toFieldText(p.default) : p.required ? 'from the input row' : ''}
          options={p.options ?? undefined}
          onCommit={(text) => set(p.name, text, typeOf(p))}
        />
      ))}
      {extra.map((name) => (
        <Field key={name} name={name} value={toFieldText(parts.arguments[name])}
          description="Passed by the formula; the tool doesn't declare it."
          onCommit={(text) => set(name, text)} />
      ))}
    </div>
  );
}

// ── Modifiers ────────────────────────────────────────────────────────────────

function ModifierList({ parts, op, catalog, onWrite }: {
  parts: FormulaParts;
  op: OperationDefinition | undefined;
  catalog: Record<string, ModifierInfo>;
  onWrite: (p: FormulaParts) => void;
}) {
  const mods = parts.modifiers ?? [];
  const setMods = (next: typeof mods) => onWrite({ ...parts, modifiers: next });

  const add = (kind: string) => {
    if (!kind) return;
    // Brackets need a shape verb, so adding retry/timeout to an inferred step
    // first writes down the verb that was being inferred.
    const inferred = op?.type && catalog[op.type]?.class === 'shape' ? op.type : 'map';
    const base = parts.modifiers ?? (catalog[kind]?.class === 'execution' ? [{ kind: inferred, params: {} }] : []);
    setMods([...base, { kind, params: {} }]);
  };

  return (
    <div className="te-modifiers">
      {parts.modifiers === null && (
        <div className="te-note">
          None written: the verb is inferred from the tool{op?.type && op.type in catalog ? <> (<code>{op.type}</code>)</> : ''}.
        </div>
      )}
      {mods.map((m, i) => {
        const info = catalog[m.kind];
        const settings = (info?.settings ?? []).filter((s) => !HIDDEN_SETTINGS.has(s.name));
        return (
          <Section
            key={`${i}-${m.kind}`}
            title={`${i + 1}. ${m.kind}`}
            summary={info?.class}
            defaultOpen
            nested
            actions={
              <>
                <button className="te-icon-btn" title="Move up (earlier in the formula)" disabled={i === 0}
                  onClick={() => setMods(moveModifier(mods, i, -1))}>↑</button>
                <button className="te-icon-btn" title="Move down (later in the formula)" disabled={i === mods.length - 1}
                  onClick={() => setMods(moveModifier(mods, i, 1))}>↓</button>
                <button className="te-icon-btn te-remove" title="Remove this modifier"
                  onClick={() => {
                    const next = mods.filter((_, j) => j !== i);
                    onWrite({ ...parts, modifiers: next.length ? next : null });
                  }}>×</button>
              </>
            }
          >
            {settings.length === 0 && <div className="te-note">No settings.</div>}
            <div className="te-fields">
              {settings.map((s) => (
                <Field
                  key={s.name}
                  name={s.name}
                  required={s.required}
                  description={s.description ?? (s.type ? `type: ${s.type}` : undefined)}
                  value={toFieldText(m.params[s.name])}
                  placeholder={s.default != null ? toFieldText(s.default) : s.required ? 'required' : ''}
                  onCommit={(text) => setMods(mods.map((x, j) => j === i
                    ? { ...x, params: withEntry(x.params, s.name, fromFieldText(text, s.type)) } : x))}
                />
              ))}
            </div>
          </Section>
        );
      })}
      <select className="te-add" value="" onChange={(e) => add(e.target.value)} title="Add a modifier at the end of the brackets">
        <option value="">+ Add modifier…</option>
        {(['shape', 'execution'] as const).map((cls) => (
          <optgroup key={cls} label={cls === 'shape' ? 'Shape' : 'Execution'}>
            {Object.values(catalog).filter((c) => c.class === cls).map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────────

function Section({ title, summary, defaultOpen = false, nested = false, actions, children }: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  nested?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`te-section ${nested ? 'te-nested' : ''}`}>
      <div className="te-section-header">
        <button className="te-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <span className="te-chevron">{open ? '▾' : '▸'}</span>
          <span className="te-title">{title}</span>
          {summary && <span className="te-summary">{summary}</span>}
        </button>
        {actions && <span className="te-actions">{actions}</span>}
      </div>
      {open && <div className="te-section-body">{children}</div>}
    </div>
  );
}

/** A text field that writes on Enter or blur, not on every keystroke. */
function Field({ name, value, placeholder, description, required, options, onCommit }: {
  name: string;
  value: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  options?: (string | number | boolean)[];
  onCommit: (text: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  const commit = () => { if (draft !== value) onCommit(draft); };
  const isRef = /^(wf|res)\[/.test(value);

  return (
    <label className="te-field" title={description}>
      <span className="te-field-name">{name}{required && <span className="te-required">*</span>}</span>
      {options && options.length > 0 ? (
        <select value={value} onChange={(e) => onCommit(e.target.value)}>
          <option value="">{placeholder || '— default —'}</option>
          {options.map((o) => <option key={String(o)} value={String(o)}>{String(o)}</option>)}
        </select>
      ) : (
        <input
          className={isRef ? 'te-ref' : ''}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setDraft(value); }}
        />
      )}
    </label>
  );
}

function groupByCategory(ops: OperationDefinition[]): [string, OperationDefinition[]][] {
  const groups = new Map<string, OperationDefinition[]>();
  for (const o of ops) {
    const c = o.category || 'Other';
    groups.set(c, [...(groups.get(c) ?? []), o]);
  }
  return [...groups.entries()];
}

function countLabel(n: number, word = ''): string {
  return n === 0 ? (word ? `none ${word}` : 'none') : `${n}${word ? ` ${word}` : ''}`;
}
