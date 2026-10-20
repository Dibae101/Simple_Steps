/**
 * The usage docs the User Docs panel shows (spec 013, REQ-ENV-007): every
 * page of docs/usage_docs/, inlined into the bundle at build time.
 */

/** The docs, by file name. Vite inlines them; build_frontend hashes them (REQ-ENV-008). */
const RAW = import.meta.glob('../../../docs/usage_docs/*.md', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;

export interface DocPage {
  file: string;
  title: string;
  summary: string;
  content: string;
}

/** The pages in reading order: README first, then by file name (01-, 02-, …). */
export function docPages(raw: Record<string, string> = RAW): DocPage[] {
  const pages = Object.entries(raw).map(([path, content]) => {
    const file = path.split('/').pop()!;
    const lines = content.split('\n');
    const heading = lines.find((l) => /^#\s/.test(l));
    const title = heading ? heading.replace(/^#\s+/, '').trim() : file.replace(/\.md$/, '');
    // The first paragraph after the heading, as the list's one-line summary.
    const start = heading ? lines.indexOf(heading) + 1 : 0;
    const para: string[] = [];
    for (const line of lines.slice(start)) {
      if (!line.trim()) { if (para.length) break; continue; }
      if (/^(#|\||```|-\s|\d+\.\s)/.test(line)) { if (para.length) break; continue; }
      para.push(line.trim());
    }
    const summary = para.join(' ').replace(/[*`[\]]/g, '').replace(/\(([^)]*\.md[^)]*)\)/g, '');
    return { file, title, summary, content };
  });
  return pages.sort((a, b) =>
    (a.file === 'README.md' ? -1 : b.file === 'README.md' ? 1 : a.file.localeCompare(b.file)));
}

export type Block = { kind: 'md'; text: string } | { kind: 'table'; header: string[]; rows: string[][] };

const cells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const isSeparator = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

/** Markdown split into plain blocks and GitHub tables. Code fences are left alone. */
export function splitTables(text: string): Block[] {
  const lines = text.split('\n');
  const blocks: Block[] = [];
  let md: string[] = [];
  let fenced = false;
  const flush = () => { if (md.length) blocks.push({ kind: 'md', text: md.join('\n') }); md = []; };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) fenced = !fenced;
    if (!fenced && line.trim().startsWith('|') && i + 1 < lines.length && isSeparator(lines[i + 1])) {
      flush();
      const header = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(cells(lines[i++]));
      i -= 1;
      blocks.push({ kind: 'table', header, rows });
      continue;
    }
    md.push(line);
  }
  flush();
  return blocks;
}
