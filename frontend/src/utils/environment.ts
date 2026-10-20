/**
 * Helpers for the Environment explorer (spec 013): resources a workflow can
 * name, bound tools as tools, and a formula to start from.
 */
import type { Environment, EnvironmentResourceType, EnvironmentTool } from '../services/api';

/** A resource the workflow can name: declared in it, or provided ready-made. */
export interface ResourceRow {
  name: string;
  type: string;
  source: 'workflow' | 'ready-made';
  settings: Record<string, unknown>;
}

const BUILTIN_COLLAPSE = new Set(['gather', 'count', 'total', 'first', 'last']);

/** A value as Python writes it, for defaults and settings. */
export function py(v: unknown): string {
  if (v === null || v === undefined) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  return JSON.stringify(v);
}

/** A bound tool (a resource type's marked method) as a tool, for the same details view. */
export function boundTool(typeName: string, toolId: string, entry: EnvironmentResourceType['tools'][string]): EnvironmentTool {
  return {
    id: toolId,
    label: toolId.split('.').pop() ?? toolId,
    category: typeName,
    origin: 'bound',
    kind: null,
    description: entry.description ?? '',
    params: entry.params ?? [],
    returns: entry.returns ?? null,
  };
}

/** The app's tools with an input a resource of one of *types* fills. */
export function usersOf(env: Environment, types: string[]): EnvironmentTool[] {
  return env.tools.filter((tool) => tool.params.some((p) => p.resource?.some((r) => types.includes(r))
    || (p.type != null && types.includes(p.type))));
}

/**
 * A formula to start from: the tool, the step it reads, and any resource it
 * needs — named after one of *resources* of a type that fits, or `…`.
 */
export function exampleFormula(tool: EnvironmentTool, resources: ResourceRow[], env: Environment | null): string {
  const resourceFor = (types: string[] = []) => resources.find((r) => types.includes(r.type))?.name ?? '…';
  if (tool.origin === 'bound') {
    // A bound tool runs on a resource of its type, or of a type derived from it.
    const typeName = tool.category;
    const derived = Object.entries(env?.resource_types ?? {})
      .filter(([, t]) => (t.bases ?? []).includes(typeName)).map(([n]) => n);
    const name = resourceFor([typeName, ...derived]);
    return tool.params.length > 0
      ? `res["${name}"].${tool.label}[mod.map()](wf["…"])`
      : `res["${name}"].${tool.label}[mod.source()]()`;
  }
  if (tool.origin === 'builtin') {
    if (BUILTIN_COLLAPSE.has(tool.id)) return `${tool.id}[mod.collapse()](wf["…"])`;
    return `${tool.id}[mod.select(columns=["…"])](wf["…"])`;
  }
  const resourceArgs = tool.params.filter((p) => p.resource).map((p) => `${p.name}=res["${resourceFor(p.resource)}"]`);
  if (tool.kind === 'source') {
    const args = tool.params.filter((p) => p.required && !p.resource).map((p) => `${p.name}=…`);
    return `${tool.id}[mod.source()](${[...args, ...resourceArgs].join(', ')})`;
  }
  return `${tool.id}(${['wf["…"]', ...resourceArgs].join(', ')})`;
}
