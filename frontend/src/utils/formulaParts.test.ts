import { describe, it, expect } from 'vitest';
import { autoForWiring, explicitModifiers, fromFieldText, moveModifier, partsForTool, toFieldText, wiringChanged, withEntry, withShapeVerb } from './formulaParts';

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

describe('auto verb', () => {
  const isShape = (k: string) => !['retry', 'timeout'].includes(k);
  it('puts the verb first when there is none, keeping execution modifiers', () => {
    expect(withShapeVerb([{ kind: 'retry', params: { times: 2 } }], 'filter', isShape).map((m) => m.kind))
      .toEqual(['filter', 'retry']);
    expect(withShapeVerb(null, 'map', isShape)).toEqual([{ kind: 'map', params: {} }]);
  });
  it('replaces the shape verb in place, dropping the old verb\'s settings', () => {
    const mods = [{ kind: 'map', params: { name: 'x' } }, { kind: 'timeout', params: { seconds: 5 } }];
    expect(withShapeVerb(mods, 'expand', isShape)).toEqual([{ kind: 'expand', params: {} }, mods[1]]);
    expect(withShapeVerb(mods, 'map', isShape)).toBe(mods);
  });
  it('re-infers on wiring changes, not on modifier edits', () => {
    const p = partsForTool('scale', 'map', 'readings');
    expect(wiringChanged(p, { ...p, input: 'records' })).toBe(true);
    expect(wiringChanged(p, { ...p, arguments: { weight: 2 } })).toBe(true);
    expect(wiringChanged(p, { ...p, modifiers: [{ kind: 'filter', params: {} }] })).toBe(false);
  });
});

describe('mod.auto()', () => {
  const isShape = (k: string) => !['retry', 'timeout'].includes(k);
  const base = partsForTool('scale', 'map', 'readings');
  it('is written when a reference is passed and no verb is chosen', () => {
    expect(autoForWiring(base, isShape)).toEqual([{ kind: 'auto', params: {} }]);
    expect(autoForWiring({ ...base, modifiers: [{ kind: 'retry', params: { times: 2 } }] }, isShape)!.map((m) => m.kind))
      .toEqual(['auto', 'retry']);
  });
  it('leaves a verb the user chose alone', () => {
    const chosen = [{ kind: 'filter', params: {} }];
    expect(autoForWiring({ ...base, modifiers: chosen }, isShape)).toBe(chosen);
  });
  it('turns into a source when the step stops reading anything', () => {
    expect(autoForWiring({ ...base, input: null, modifiers: [{ kind: 'auto', params: {} }] }, isShape))
      .toEqual([{ kind: 'source', params: {} }]);
  });
  it('becomes the verb it resolves to once the modifiers are edited', () => {
    expect(explicitModifiers([{ kind: 'auto', params: {} }, { kind: 'retry', params: { times: 2 } }], 'filter'))
      .toEqual([{ kind: 'filter', params: {} }, { kind: 'retry', params: { times: 2 } }]);
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
