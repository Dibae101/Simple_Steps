/**
 * Spec 013, the Environment explorer. TEST-ENV-04 covers REQ-ENV-004 (tools
 * and resources listed, one filter), TEST-ENV-05b REQ-ENV-005 (a tool's
 * details), TEST-ENV-06 REQ-ENV-006 (a resource's and a type's details, and
 * their bound tools).
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Environment } from '../services/api';

const ENV: Environment = {
  tools: [
    {
      id: 'scale', label: 'Scale', category: 'Basic', origin: 'declared', kind: 'map',
      description: 'Scale a reading.', returns: 'float',
      params: [
        { name: 'n', type: 'int', required: true, description: 'the reading.' },
        { name: 'weight', type: 'float', required: false, default: 1, description: 'multiplies it.' },
        { name: 'mode', type: 'str', required: false, default: 'up', choices: ['up', 'down'] },
        { name: 'raw', type: null, required: false, default: null },
      ],
    },
    {
      id: 'summarize', label: 'Summarize', category: 'LLM', origin: 'declared', kind: 'map',
      description: 'One line from the model.', returns: 'str',
      params: [
        { name: 'text', type: 'str', required: true },
        { name: 'llm', type: 'LLM', required: true, description: 'the model to ask.', resource: ['FakeLLM'] },
      ],
    },
    { id: 'count', label: 'count', category: 'Built-in', origin: 'builtin', kind: null, description: 'How many.', returns: 'int', params: [] },
  ],
  resource_types: {
    FakeLLM: {
      type: 'FakeLLM', description: 'A fake model.', bases: ['FakeLLM', 'LLM'],
      settings: [{ name: 'model', type: 'str', required: false, default: 'fake-1' }],
      tools: {
        'FakeLLM.complete': {
          tool_id: 'FakeLLM.complete', description: 'One completion.', returns: 'str',
          params: [{ name: 'prompt', type: 'str', required: true, description: 'the text to complete.' }],
        },
      },
    },
  },
  resources: { house_llm: { type: 'FakeLLM', settings: { model: 'house-1' }, from_env: {}, locked: ['model'] } },
};

vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/api')>()),
  fetchEnvironment: vi.fn(async () => ENV),
}));

import EnvironmentExplorer from './EnvironmentExplorer';

const explorer = () => render(
  <EnvironmentExplorer workflowResources={{ mine: { source: 'defined', type: 'FakeLLM', settings: { model: 'mine-2' } } }} />,
);
const openCategory = async (name: string) => fireEvent.click((await screen.findByText(name)).closest('button')!);
/** The resource type's row, not the rows of resources of that type. */
const typeRow = async () => (await screen.findByText('1 tool')).closest('button')!;

describe('TEST-ENV-04 · the explorer lists the environment (REQ-ENV-004)', () => {
  it('lists tools by category, built-ins included, and every kind of resource', async () => {
    explorer();
    expect(await screen.findByText('Basic')).toBeTruthy();
    expect(screen.getByText('Built-in')).toBeTruthy();
    expect(screen.getByText('res["mine"]')).toBeTruthy();            // this workflow's
    expect(screen.getByText('res["house_llm"]')).toBeTruthy();       // ready-made
    expect(screen.getByText('In this workflow')).toBeTruthy();
    expect(screen.getByText('Ready-made')).toBeTruthy();
    expect(await typeRow()).toBeTruthy();                             // the type
  });

  it('narrows tools and resources with one filter', async () => {
    explorer();
    await screen.findByText('Basic');
    fireEvent.change(screen.getByLabelText('Filter tools and resources'), { target: { value: 'model' } });
    expect(screen.getByText('Summarize')).toBeTruthy();               // by description
    expect(screen.queryByText('Scale')).toBeNull();
    expect(await typeRow()).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Filter tools and resources'), { target: { value: 'zzz' } });
    expect(screen.getByText(/No tools match/)).toBeTruthy();
  });
});

describe('TEST-ENV-05b · a tool\'s details (REQ-ENV-005)', () => {
  it('shows every input with its type, required or default, and description, and the output', async () => {
    explorer();
    await openCategory('Basic');
    fireEvent.click(screen.getByText('Scale'));
    expect(screen.getByText('Scale a reading.')).toBeTruthy();
    const n = screen.getByTestId('param-n');
    expect(within(n).getByText('int')).toBeTruthy();
    expect(within(n).getByText('required')).toBeTruthy();
    expect(within(n).getByText('the reading.')).toBeTruthy();
    const weight = screen.getByTestId('param-weight');
    expect(within(weight).getByText('float')).toBeTruthy();
    expect(within(weight).getByText('= 1')).toBeTruthy();
    expect(within(screen.getByTestId('param-mode')).getByText(/One of/)).toBeTruthy();
    expect(within(screen.getByTestId('param-raw')).getByText('untyped')).toBeTruthy();
    expect(screen.getByText('Output')).toBeTruthy();
    expect(screen.getAllByText('float').length).toBeGreaterThan(1);    // weight's type, and the output
    expect(screen.getByText('=scale(wf["…"])')).toBeTruthy();
  });

  it('says which resource types fill a resource input, and links to them', async () => {
    explorer();
    await openCategory('LLM');
    fireEvent.click(screen.getByText('Summarize'));
    const llm = screen.getByTestId('param-llm');
    expect(within(llm).getByText(/A resource/)).toBeTruthy();
    expect(screen.getByText('=summarize(wf["…"], llm=res["mine"])')).toBeTruthy();
    fireEvent.click(within(llm).getByRole('button', { name: 'FakeLLM' }));
    expect(screen.getByText('A fake model.')).toBeTruthy();            // the type's details
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(screen.getByTestId('param-llm')).toBeTruthy();              // back to the tool
  });
});

describe('TEST-ENV-06 · a resource\'s details (REQ-ENV-006)', () => {
  it('shows a ready-made resource\'s settings, its type, and its tools', async () => {
    explorer();
    fireEvent.click(await screen.findByText('res["house_llm"]'));
    expect(screen.getByText('= "house-1"')).toBeTruthy();
    expect(screen.getByText('set by the deployment')).toBeTruthy();
    expect(screen.getByText('=res["house_llm"].complete[mod.map()](wf["…"])')).toBeTruthy();
    expect(screen.getByText(/Also passed to: summarize/)).toBeTruthy();
  });

  it('shows a type\'s settings and bound tools, which open like any tool', async () => {
    explorer();
    fireEvent.click(await typeRow());
    expect(screen.getByText('Is a: LLM')).toBeTruthy();
    expect(screen.getByText('= "fake-1"')).toBeTruthy();
    expect(screen.getByText('res["mine"]')).toBeTruthy();              // instances in this app
    fireEvent.click(screen.getByRole('button', { name: /complete/ }));
    expect(screen.getByText('One completion.')).toBeTruthy();
    expect(within(screen.getByTestId('param-prompt')).getByText('str')).toBeTruthy();
  });
});
