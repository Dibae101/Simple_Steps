/**
 * TEST-ENV-07c (REQ-ENV-007): the User Docs panel lists the bundled usage
 * docs, opens a page, follows a link to another page, and draws tables.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DocsPanel from './DocsPanel';
import type { DocPage } from '../utils/docs';

const PAGES: DocPage[] = [
  { file: 'README.md', title: 'Using it', summary: 'Start here.', content: '# Using it\n\n| page | when |\n|---|---|\n| [Concepts](01-concepts.md) | first |\n\nSee [the repo](../../src/x.md).' },
  { file: '01-concepts.md', title: '01 — Concepts', summary: 'The ideas.', content: '# 01 — Concepts\n\n## Tool\n\nA function.' },
];

describe('TEST-ENV-07c · the User Docs panel (REQ-ENV-007)', () => {
  it('lists the real bundled docs, README first', () => {
    render(<DocsPanel />);
    const rows = screen.getAllByRole('button');
    expect(rows[0].textContent).toMatch(/^Start here/);
    expect(screen.getByText(/01 — Concepts/)).toBeTruthy();
    expect(screen.getByText(/05 — The agent/)).toBeTruthy();
  });

  it('opens a page, draws its table, and follows a link to another page', () => {
    render(<DocsPanel pages={PAGES} />);
    fireEvent.click(screen.getByText(/Start here — Using it/));
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'page' })).toBeTruthy();
    expect(screen.getByText('the repo').tagName).toBe('SPAN');          // not in the installed app
    fireEvent.click(screen.getByRole('link', { name: 'Concepts' }));
    expect(screen.getByRole('heading', { name: '01 — Concepts' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Tool' }).id).toBe('tool');
    fireEvent.click(screen.getByRole('button', { name: /All docs/ }));
    expect(screen.getByText(/Start here — Using it/)).toBeTruthy();
  });
});
