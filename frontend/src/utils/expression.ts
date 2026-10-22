/**
 * A formula, short, for the selection popover's header (spec 014 §8.2):
 * the tool and what it is given, without the orchestration or the
 * references' detail.
 *
 *   score[mod.map()](wf["readings"], weight=wf["w"][0][cols["w"]])  →  score(readings, weight)
 *   zip_(wf["a"], wf["b"])                                            →  zip_(a, b)
 *   res["db"].lookup[mod.map()](wf["keys"])                           →  res["db"].lookup(keys)
 *
 * Arguments are named, never shown by value, so nothing in the header can be
 * mistaken for the output (spec 014 principle 5). A literal passed by
 * position is shown as `…`.
 */

/** Index of the bracket that closes the one opening at *open*, skipping strings. */
function closing(text: string, open: number): number {
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const stack: string[] = [];
  let quote: string | null = null;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (pairs[ch]) stack.push(pairs[ch]);
    else if (ch === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) return i;
    }
  }
  return -1;
}

/** Split *text* on the commas that aren't inside brackets or strings. */
function topLevelParts(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

const KEYWORD = /^([A-Za-z_]\w*)\s*=(?!=)/;
const STEP_REF = /^wf\[\s*(["'])(.+?)\1\s*\]/;
const RESOURCE_REF = /^res\[\s*(["'])(.+?)\1\s*\]$/;

export function shortExpression(formula: string | null | undefined): string {
  const text = (formula ?? '').trim().replace(/^=/, '').trim();
  if (!text) return '';
  // The head is everything before the call's "(": the tool, maybe bound to a
  // resource, maybe followed by its [modifiers].
  let head = '';
  let call = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '[' || ch === '"' || ch === "'") {
      const end = ch === '[' ? closing(text, i) : text.indexOf(ch, i + 1);
      if (end < 0) return text;
      i = end;
      continue;
    }
    if (ch === '(') { call = i; break; }
  }
  if (call < 0) return text;                       // a literal, or a bare reference
  head = text.slice(0, call);
  if (head.endsWith(']')) {
    // drop the trailing [mod.…] stack, keeping res["db"] in res["db"].lookup
    let depth = 0;
    for (let i = head.length - 1; i >= 0; i--) {
      if (head[i] === ']') depth++;
      else if (head[i] === '[' && --depth === 0) { head = head.slice(0, i); break; }
    }
  }
  const end = closing(text, call);
  const inner = end < 0 ? text.slice(call + 1) : text.slice(call + 1, end);
  const args = topLevelParts(inner).map((arg) => {
    const kw = KEYWORD.exec(arg);
    if (kw) return kw[1];
    const step = STEP_REF.exec(arg);
    if (step) return arg.length > step[0].length ? `${step[2]}[…]` : step[2];
    const res = RESOURCE_REF.exec(arg);
    if (res) return res[2];
    return '…';
  });
  return `${head.trim()}(${args.join(', ')})`;
}
