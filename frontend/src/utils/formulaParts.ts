/**
 * How the step editor shows a formula value in a text field, and reads it
 * back. A field holds what the user would type: plain text for a string,
 * `2` for a number, `True`, `[1, 2]`, or `wf["step"]` / `res["name"]` for a
 * reference — the same spellings as the formula, minus quotes on plain text.
 */
import type { ArgValue, FormulaParts, ModifierPart } from './formulaParser';

const REF = /^(wf|res)\[\s*(["'])(.*)\2\s*\]$/;

const isRef = (v: unknown): v is { $ref: string } =>
  typeof v === 'object' && v !== null && Object.keys(v).length === 1 && '$ref' in v;
const isRes = (v: unknown): v is { $res: string } =>
  typeof v === 'object' && v !== null && Object.keys(v).length === 1 && '$res' in v;

/** A value as its field text. `undefined` (not passed) is an empty field. */
export function toFieldText(v: ArgValue): string {
  if (v === undefined) return '';
  if (isRef(v)) return `wf["${v.$ref}"]`;
  if (isRes(v)) return `res["${v.$res}"]`;
  if (typeof v === 'string') return v;
  if (v === true) return 'True';
  if (v === false) return 'False';
  if (v === null) return 'None';
  return JSON.stringify(v);
}

/**
 * Field text as a value. *type* is the parameter's or setting's declared type
 * (`number`, `int | float`, `bool`, `list | tuple | dict`, …) and decides
 * whether `2` is a number or the text "2". Empty means "not passed".
 */
export function fromFieldText(text: string, type?: string | null): ArgValue | undefined {
  const t = text.trim();
  if (t === '') return undefined;
  const ref = REF.exec(t);
  if (ref) return ref[1] === 'wf' ? { $ref: ref[3] } : { $res: ref[3] };
  const declared = (type ?? '').toLowerCase();
  if (/(number|int|float)/.test(declared) && t !== '' && Number.isFinite(Number(t))) return Number(t);
  if (/bool/.test(declared)) {
    if (/^true$/i.test(t)) return true;
    if (/^false$/i.test(t)) return false;
  }
  if (t === 'None') return null;
  if (/(list|tuple|dict|object)/.test(declared) || !declared) {
    if (/^[[{]/.test(t)) {
      try { return JSON.parse(t.replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null')); }
      catch { /* not JSON: keep it as text, the backend says why */ }
    }
  }
  return text;
}

/** *args* with *name* set to *value*, or removed when *value* is `undefined`. */
export function withEntry<T>(args: Record<string, T>, name: string, value: T | undefined): Record<string, T> {
  const next = { ...args };
  if (value === undefined) delete next[name];
  else next[name] = value;
  return next;
}

/** Move the modifier at *index* by *delta* (−1 up, +1 down), clamped. */
export function moveModifier(mods: ModifierPart[], index: number, delta: number): ModifierPart[] {
  const to = index + delta;
  if (to < 0 || to >= mods.length) return mods;
  const next = [...mods];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/**
 * Parts for a step that has just been given *tool*: the verb is inferred, and
 * it reads the step before it — unless the tool is a source, which reads none.
 */
export function partsForTool(tool: string, toolType: string | undefined, previousStep: string | null): FormulaParts {
  const isSource = toolType === 'source';
  return {
    tool,
    bound_to: null,
    modifiers: isSource ? [{ kind: 'source', params: {} }] : null,
    input: isSource ? null : previousStep,
    resources: [],
    arguments: {},
    inputs: [],
  };
}
