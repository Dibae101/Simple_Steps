// Workflow naming: unique Untitled-N tabs and collision-free save names.
import { describe, it, expect } from 'vitest';
import { nextUntitledName, uniqueWorkflowName, workflowNameTaken, workflowSlug } from './workflowNames';

describe('workflowSlug', () => {
  it('matches the backend file-name rule', () => {
    expect(workflowSlug('My Flow')).toBe('my-flow');
    expect(workflowSlug('01_intro.json')).toBe('01-intro');
    expect(workflowSlug('???')).toBe('pipeline');
  });
});

describe('nextUntitledName', () => {
  it('numbers from 1 and fills the lowest gap', () => {
    expect(nextUntitledName([])).toBe('Untitled-1');
    expect(nextUntitledName(['Untitled-1', 'Untitled-2'])).toBe('Untitled-3');
    expect(nextUntitledName(['Untitled-1', 'untitled-3'])).toBe('Untitled-2');
  });
});

describe('uniqueWorkflowName', () => {
  it('keeps a free name as typed', () => {
    expect(uniqueWorkflowName('My Flow', ['other'])).toBe('My Flow');
  });

  it('treats names with the same file name as taken', () => {
    expect(workflowNameTaken('My Flow', ['my-flow'])).toBe(true);
    expect(workflowNameTaken('my flow', ['01_intro'])).toBe(false);
  });

  it('suffixes -2, -3, … past existing files', () => {
    expect(uniqueWorkflowName('My Flow', ['my-flow'])).toBe('My Flow-2');
    expect(uniqueWorkflowName('report', ['report', 'report-2'])).toBe('report-3');
  });

  it('bumps an existing suffix instead of stacking one', () => {
    expect(uniqueWorkflowName('report-2', ['report-2'])).toBe('report-3');
    expect(uniqueWorkflowName('Untitled-1', ['untitled-1'])).toBe('Untitled-2');
  });
});
