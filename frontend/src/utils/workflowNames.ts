/**
 * Workflow naming, VS Code style: new workflows are `Untitled-1`,
 * `Untitled-2`, …, and a suggested save name never collides with a file
 * already in the target folder.
 */

/** The file stem a workflow named `name` is saved under — mirrors the
 *  backend's `pipeline_slug`, so "My Flow" and "my-flow" are one file. */
export function workflowSlug(name: string): string {
  const base = name.replace(/\.(simple-steps-workflow|json)$/i, '');
  if (!/[A-Za-z0-9]/.test(base)) return 'pipeline';
  return base.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Whether saving as `name` would land on one of `existingIds` (file stems). */
export function workflowNameTaken(name: string, existingIds: readonly string[]): boolean {
  const slug = workflowSlug(name);
  return existingIds.some(id => workflowSlug(id) === slug);
}

/** The lowest free `Untitled-N` among names already in use (open tab titles). */
export function nextUntitledName(takenNames: readonly string[]): string {
  const taken = new Set(takenNames.map(n => n.trim().toLowerCase()));
  let n = 1;
  while (taken.has(`untitled-${n}`)) n++;
  return `Untitled-${n}`;
}

/**
 * `name` if it is free in the folder, else the first of `name-2`, `name-3`, …
 * that is. A trailing `-N` on `name` is replaced rather than stacked, so a
 * suggestion for `report-2` is `report-3`, not `report-2-2`.
 */
export function uniqueWorkflowName(name: string, existingIds: readonly string[]): string {
  const trimmed = name.trim() || 'Untitled';
  if (!workflowNameTaken(trimmed, existingIds)) return trimmed;
  const match = trimmed.match(/^(.*?)-(\d+)$/);
  const base = match ? match[1] : trimmed;
  let n = match ? Number(match[2]) + 1 : 2;
  while (workflowNameTaken(`${base}-${n}`, existingIds)) n++;
  return `${base}-${n}`;
}
