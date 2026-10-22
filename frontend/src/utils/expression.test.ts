import { describe, expect, it } from 'vitest';
import { shortExpression } from './expression';

// Spec 014 REQ-VIS-046: the popover header's short expression names arguments, never values.
describe('shortExpression', () => {
  it('keeps the tool and what it reads, drops the orchestration', () => {
    expect(shortExpression('=score[mod.map()](wf["readings"], weight=wf["w"][0][cols["w"]])'))
      .toBe('score(readings, weight)');
    expect(shortExpression('scale[mod.map(name="score"), mod.retry(times=2)](wf["r"])')).toBe('scale(r)');
  });

  it('names keyword arguments without their values', () => {
    expect(shortExpression('is_dark[mod.filter()](wf["named"], threshold=80)')).toBe('is_dark(named, threshold)');
    expect(shortExpression('to_rows[mod.source()](data=\'{"a": [1, 2]}\')')).toBe('to_rows(data)');
  });

  it('marks a narrowed reference and a positional literal', () => {
    expect(shortExpression('identity[mod.select(columns=["n"])](wf["p"][1:3])')).toBe('identity(p[…])');
    expect(shortExpression('f(wf["a"], 3)')).toBe('f(a, …)');
  });

  it('handles combines, bound tools and resources', () => {
    expect(shortExpression('zip_(wf["a"], wf["b"])')).toBe('zip_(a, b)');
    expect(shortExpression('res["db"].lookup[mod.map()](wf["keys"])')).toBe('res["db"].lookup(keys)');
    expect(shortExpression('summarize[mod.map()](wf["notes"], llm=res["house_llm"])')).toBe('summarize(notes, llm)');
  });

  it('leaves what isn\'t a call as it is', () => {
    expect(shortExpression('[1, 2, 3]')).toBe('[1, 2, 3]');
    expect(shortExpression('')).toBe('');
    expect(shortExpression(undefined)).toBe('');
  });
});
