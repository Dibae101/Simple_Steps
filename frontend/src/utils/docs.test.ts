/**
 * TEST-ENV-07a (REQ-ENV-007): the User Docs panel's pages are docs/usage_docs,
 * bundled — README first, each titled by its heading — and their tables are
 * found for drawing.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { docPages, resolveDocLink, splitTables } from './docs';

const DOCS_DIR = resolve(__dirname, '../../../docs/usage_docs');

describe('TEST-ENV-07a · the bundled usage docs (REQ-ENV-007)', () => {
  it('lists every page of docs/usage_docs, the User guide before the Developer guide', () => {
    const onDisk = (readdirSync(DOCS_DIR, { recursive: true }) as string[])
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.split('\\').join('/'));
    const pages = docPages();
    expect(pages.map((p) => p.file).sort()).toEqual(onDisk.sort());
    expect(pages[0].file).toBe('README.md');
    const sections = pages.map((p) => p.section);
    expect(sections.lastIndexOf('user')).toBeLessThan(sections.indexOf('developer'));
    // Within a guide: its README first, then in file order.
    const dev = pages.filter((p) => p.section === 'developer').map((p) => p.file);
    expect(dev[0]).toBe('developer/README.md');
    expect(dev.slice(1)).toEqual([...dev.slice(1)].sort());
  });

  it('has the User guide pages on expressions and on defining a step', () => {
    const user = docPages().filter((p) => p.section === 'user');
    expect(user.find((p) => /Expressions/.test(p.title))).toBeTruthy();
    expect(user.find((p) => /Define a step/.test(p.title))).toBeTruthy();
  });

  it('titles each page by its first heading, with a one-line summary', () => {
    const concepts = docPages().find((p) => p.file === 'user/01-concepts.md')!;
    expect(concepts.title).toMatch(/Concepts/);
    expect(concepts.summary.length).toBeGreaterThan(10);
    expect(concepts.summary).not.toMatch(/[`*]/);
  });

  it('reads titles, summaries and sections from any set of pages', () => {
    const pages = docPages({
      '../docs/usage_docs/developer/01-c.md': '# Dev\n\nFor developers.\n',
      '../docs/usage_docs/user/02-b.md': '# Two\n\nSecond page.\n',
      '../docs/usage_docs/README.md': '# Start\n\nRead me *first*.\n\n## More\n',
      '../docs/usage_docs/user/01-a.md': 'no heading\n',
    });
    expect(pages.map((p) => [p.file, p.section, p.title, p.summary])).toEqual([
      ['README.md', 'start', 'Start', 'Read me first.'],
      ['user/01-a.md', 'user', '01-a', 'no heading'],
      ['user/02-b.md', 'user', 'Two', 'Second page.'],
      ['developer/01-c.md', 'developer', 'Dev', 'For developers.'],
    ]);
  });

  it('resolves a link relative to the page it is on', () => {
    expect(resolveDocLink('user/03-a.md', '04-b.md')).toBe('user/04-b.md');
    expect(resolveDocLink('user/03-a.md', '../developer/01-c.md')).toBe('developer/01-c.md');
    expect(resolveDocLink('README.md', 'user/01-a.md')).toBe('user/01-a.md');
    expect(resolveDocLink('user/03-a.md', './04-b.md')).toBe('user/04-b.md');
    // Leaves the docs: a file in the repository, not a page here.
    expect(resolveDocLink('user/03-a.md', '../../../src/x.md')).toBeNull();
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
