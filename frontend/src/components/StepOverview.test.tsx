// TEST: the Analytics widget shows a step's notes, rendered from Markdown.
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StepOverview from './StepOverview';
import type { Step } from '../types/models';

const step = (extra: Partial<Step> = {}): Step => ({
  id: 's1', sequence_index: 0, label: 'Load', formula: '', process_type: 'noop',
  configuration: {}, status: 'pending', ...extra,
});

describe('StepOverview notes', () => {
  it('renders the notes as Markdown', () => {
    render(<StepOverview step={step({ notes: 'Keeps **only** scored rows' })} availableOperations={[]} />);
    expect(screen.getByTestId('step-notes')).toHaveTextContent('Keeps only scored rows');
    expect(screen.getByText('only').tagName).toBe('STRONG');
  });

  it('does not render raw HTML from a note', () => {
    render(<StepOverview step={step({ notes: '<img src=x onerror="alert(1)">' })} availableOperations={[]} />);
    expect(document.querySelector('.sop-notes img')).toBeNull();
  });

  it('shows no notes section without notes', () => {
    render(<StepOverview step={step({ notes: '   ' })} availableOperations={[]} />);
    expect(screen.queryByTestId('step-notes')).toBeNull();
  });
});
