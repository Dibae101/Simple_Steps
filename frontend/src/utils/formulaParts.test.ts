import { describe, it, expect } from 'vitest';
import { fromFieldText, moveModifier, partsForTool, toFieldText, withEntry } from './formulaParts';

describe('step editor field values', () => {
  it('round-trips references, resources and literals through field text', () => {
    for (const [v, type] of [
      [{ $ref: 'readings' }, 'string'],
      [{ $res: 'house_llm' }, 'string'],
      [2, 'number'],
      [2.5, 'int | float'],
      [true, 'bool'],
      [[1, 2, 3], 'list | tuple | dict'],
      [{ a: 1 }, 'list | tuple | dict'],
      ['score', 'str'],
    ] as const) {
      expect(fromFieldText(toFieldText(v), type)).toEqual(v);
    }
  });

  it('treats an empty field as "not passed"', () => {
    expect(fromFieldText('  ', 'number')).toBeUndefined();
    expect(toFieldText(undefined)).toBe('');
  });

  it('keeps digits as text for a text parameter', () => {
    expect(fromFieldText('2', 'str')).toBe('2');
    expect(fromFieldText('2', 'number')).toBe(2);
  });

  it('accepts either quote style in a reference', () => {
    expect(fromFieldText("wf['x']")).toEqual({ $ref: 'x' });
  });

  it('removes an entry set to undefined', () => {
    expect(withEntry({ a: 1, b: 2 }, 'a', undefined)).toEqual({ b: 2 });
    expect(withEntry({ a: 1 }, 'b', 3)).toEqual({ a: 1, b: 3 });
  });
});

describe('modifier order', () => {
  const mods = [{ kind: 'map', params: {} }, { kind: 'retry', params: { times: 2 } }];
  it('moves a modifier up and down, and stops at the ends', () => {
    expect(moveModifier(mods, 1, -1).map((m) => m.kind)).toEqual(['retry', 'map']);
    expect(moveModifier(mods, 0, -1)).toBe(mods);
    expect(moveModifier(mods, 1, 1)).toBe(mods);
  });
});

describe('choosing a tool', () => {
  it('reads the previous step, verb inferred', () => {
    expect(partsForTool('scale', 'map', 'readings')).toMatchObject({ tool: 'scale', modifiers: null, input: 'readings' });
  });
  it('makes a source read nothing', () => {
    expect(partsForTool('to_rows', 'source', 'readings')).toMatchObject({ modifiers: [{ kind: 'source' }], input: null });
  });
});
