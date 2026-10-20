/**
 * TEST-ENV-05a (REQ-ENV-005): the formula a tool's details offer to start from.
 */
import { describe, expect, it } from 'vitest';
import type { Environment, EnvironmentTool } from '../services/api';
import { boundTool, exampleFormula, py, usersOf, type ResourceRow } from './environment';

const tool = (over: Partial<EnvironmentTool>): EnvironmentTool => ({
  id: 't', label: 'T', category: 'C', origin: 'declared', kind: 'map', description: '',
  params: [], returns: null, ...over,
});
const ENV: Environment = {
  tools: [
    tool({ id: 'summarize', params: [{ name: 'llm', type: 'LLM', required: true, resource: ['FakeLLM'] }] }),
    tool({ id: 'scale', params: [{ name: 'n', type: 'int', required: true }] }),
  ],
  resource_types: {
    LLM: { type: 'LLM', settings: [], tools: {}, bases: ['LLM'] },
    FakeLLM: {
      type: 'FakeLLM', settings: [], bases: ['FakeLLM', 'LLM'],
      tools: { 'FakeLLM.complete': { tool_id: 'FakeLLM.complete', params: [{ name: 'prompt', type: 'str', required: true }], returns: 'str' } },
    },
  },
  resources: {},
};
const house: ResourceRow = { name: 'house_llm', type: 'FakeLLM', source: 'ready-made', settings: {} };

describe('TEST-ENV-05a · a formula to start from (REQ-ENV-005)', () => {
  it('reads a step, verb inferred, for a per-row tool', () => {
    expect(exampleFormula(ENV.tools[1], [], ENV)).toBe('scale(wf["…"])');
  });

  it('names a resource of a type that fits, or leaves a gap', () => {
    expect(exampleFormula(ENV.tools[0], [house], ENV)).toBe('summarize(wf["…"], llm=res["house_llm"])');
    expect(exampleFormula(ENV.tools[0], [], ENV)).toBe('summarize(wf["…"], llm=res["…"])');
  });

  it('writes a source with its required arguments and no input', () => {
    const src = tool({ id: 'load', kind: 'source', params: [
      { name: 'path', type: 'str', required: true }, { name: 'sep', type: 'str', required: false, default: ',' },
    ] });
    expect(exampleFormula(src, [], ENV)).toBe('load[mod.source()](path=…)');
  });

  it('writes a built-in with the verb it goes with', () => {
    expect(exampleFormula(tool({ id: 'count', origin: 'builtin' }), [], ENV)).toBe('count[mod.collapse()](wf["…"])');
    expect(exampleFormula(tool({ id: 'identity', origin: 'builtin' }), [], ENV)).toBe('identity[mod.select(columns=["…"])](wf["…"])');
  });

  it('writes a bound tool on a resource of its type', () => {
    const complete = boundTool('FakeLLM', 'FakeLLM.complete', ENV.resource_types.FakeLLM.tools['FakeLLM.complete']);
    expect(complete).toMatchObject({ label: 'complete', origin: 'bound', returns: 'str' });
    expect(exampleFormula(complete, [house], ENV)).toBe('res["house_llm"].complete[mod.map()](wf["…"])');
  });
});

describe('the tools a resource type can be passed to', () => {
  it('finds tools whose input takes the type or one of its bases', () => {
    expect(usersOf(ENV, ['FakeLLM', 'LLM']).map((t) => t.id)).toEqual(['summarize']);
    expect(usersOf(ENV, ['FakeDB'])).toEqual([]);
  });
  it('writes values as Python does', () => {
    expect([py(null), py(true), py('a'), py([1, 2])]).toEqual(['None', 'True', '"a"', '[1,2]']);
  });
});
