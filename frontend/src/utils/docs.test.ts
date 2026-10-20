/**
 * TEST-ENV-07a (REQ-ENV-007): the User Docs panel's pages are docs/usage_docs,
 * bundled — README first, each titled by its heading — and their tables are
 * found for drawing.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { docPages, splitTables } from './docs';

const DOCS_DIR = resolve(__dirname, '../../../docs/usage_docs');

describe('TEST-ENV-07a · the bundled usage docs (REQ-ENV-007)', () => {
  it('lists every page of docs/usage_docs, README first, then in file order', () => {
    const onDisk = readdirSync(DOCS_DIR).filter((f) => f.endsWith('.md'));
    const pages = docPages();
    expect(pages.map((p) => p.file).sort()).toEqual(onDisk.sort());
    expect(pages[0].file).toBe('README.md');
    const rest = pages.slice(1).map((p) => p.file);
    expect(rest).toEqual([...rest].sort());
  });

  it('titles each page by its first heading, with a one-line summary', () => {
    const concepts = docPages().find((p) => p.file === '01-concepts.md')!;
    expect(concepts.title).toMatch(/Concepts/);
    expect(concepts.summary.length).toBeGreaterThan(10);
    expect(concepts.summary).not.toMatch(/[`*]/);
  });

  it('reads titles and summaries from any set of pages', () => {
    const pages = docPages({
      'x/02-b.md': '# Two\n\nSecond page.\n',
      'x/README.md': '# Start\n\nRead me *first*.\n\n## More\n',
      'x/01-a.md': 'no heading\n',
    });
    expect(pages.map((p) => [p.file, p.title, p.summary])).toEqual([
      ['README.md', 'Start', 'Read me first.'],
      ['01-a.md', '01-a', 'no heading'],
      ['02-b.md', 'Two', 'Second page.'],
    ]);
  });
});

describe('TEST-ENV-07b · tables in the docs (REQ-ENV-007)', () => {
  it('splits a GitHub table out of the surrounding markdown', () => {
    const blocks = splitTables('Intro.\n\n| a | b |\n|---|:--|\n| `x` | 1 |\n| y | 2 |\n\nAfter.');
    expect(blocks.map((b) => b.kind)).toEqual(['md', 'table', 'md']);
    expect(blocks[1]).toEqual({ kind: 'table', header: ['a', 'b'], rows: [['`x`', '1'], ['y', '2']] });
  });

  it('leaves pipes inside a code fence alone', () => {
    const blocks = splitTables('```\n| a | b |\n|---|---|\n```');
    expect(blocks).toEqual([{ kind: 'md', text: '```\n| a | b |\n|---|---|\n```' }]);
  });

  it('finds the tables in the real docs', () => {
    const readme = docPages().find((p) => p.file === 'README.md')!;
    expect(splitTables(readme.content).some((b) => b.kind === 'table')).toBe(true);
  });
});
