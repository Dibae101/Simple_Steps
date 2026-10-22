/**
 * TEST-ENV-07c (REQ-ENV-007): the User Docs panel lists the bundled usage
 * docs, opens a page, follows a link to another page, and draws tables.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DocsPanel from './DocsPanel';
import type { DocPage } from '../utils/docs';

const PAGES: DocPage[] = [
  { file: 'README.md', section: 'start', title: 'Using it', summary: 'Start here.', content: '# Using it\n\n| page | when |\n|---|---|\n| [Concepts](user/01-concepts.md) | first |\n\nSee [the repo](../../src/x.md).' },
  { file: 'user/01-concepts.md', section: 'user', title: '01 — Concepts', summary: 'The ideas.', content: '# 01 — Concepts\n\n## Tool\n\nA function. Building one: [the developer page](../developer/01-build.md).' },
  { file: 'developer/01-build.md', section: 'developer', title: '01 — Build', summary: 'For developers.', content: '# 01 — Build\n\nWrite a tool.' },
];

describe('TEST-ENV-07c · the User Docs panel (REQ-ENV-007)', () => {
  it('lists the real bundled docs: Start here, then the User guide, the Developer guide folded', () => {
    render(<DocsPanel />);
    const rows = screen.getAllByRole('button');
    expect(rows[0].textContent).toMatch(/^Start here/);
    const userGuide = screen.getByRole('region', { name: 'User guide' });
    expect(within(userGuide).getByText('01 — Concepts')).toBeTruthy();
    expect(within(userGuide).getByText('03 — Define a step')).toBeTruthy();
    expect(within(userGuide).getByText(/^04 — Expressions/)).toBeTruthy();
    // The Developer guide is folded until asked for.
    const toggle = screen.getByRole('button', { name: /Developer guide/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('01 — Build an application')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByText('01 — Build an application')).toBeTruthy();
  });

  it('opens a page, draws its table, and follows links between the guides', () => {
    render(<DocsPanel pages={PAGES} />);
    fireEvent.click(screen.getByText(/Start here — Using it/));
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'page' })).toBeTruthy();
    expect(screen.getByText('the repo').tagName).toBe('SPAN');          // not in the installed app
    fireEvent.click(screen.getByRole('link', { name: 'Concepts' }));
    expect(screen.getByRole('heading', { name: '01 — Concepts' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Tool' }).id).toBe('tool');
    // A link relative to the page it's on, into the other guide.
    fireEvent.click(screen.getByRole('link', { name: 'the developer page' }));
    expect(screen.getByRole('heading', { name: '01 — Build' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /All docs/ }));
    expect(screen.getByText(/Start here — Using it/)).toBeTruthy();
  });
});
