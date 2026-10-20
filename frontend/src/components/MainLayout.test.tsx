import { render, screen, fireEvent, within } from '@testing-library/react';
import MainLayout from './MainLayout';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the api module so useWorkflow doesn't try to fetch from a real server
vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/api')>()),
  getOperations: vi.fn().mockResolvedValue([]),
  runStep: vi.fn().mockResolvedValue({ ref_id: 'mock-ref', metrics: {} }),
  fetchDataView: vi.fn().mockResolvedValue({ cells: [] }),
  saveWorkflow: vi.fn().mockResolvedValue({ id: 'mock-id' }),
  loadWorkflow: vi.fn().mockResolvedValue({ id: 'wf', name: 'Test', steps: [] }),
  listProjects: vi.fn().mockResolvedValue([]),
  createProject: vi.fn().mockResolvedValue({ project_id: 'p1' }),
  deleteProject: vi.fn().mockResolvedValue({}),
  listPipelines: vi.fn().mockResolvedValue([]),
  deletePipeline: vi.fn().mockResolvedValue({}),
}));

describe('MainLayout', () => {
  beforeEach(() => {
    // No backend here: api calls not mocked above stay pending rather than
    // rejecting with nobody listening.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    // Suppress console.error from unhandled fetch calls in sub-components
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders header and dynamic columns', () => {
    render(<MainLayout />);
    expect(screen.getByTestId('main-layout')).toBeInTheDocument();

    // Check for the columns container
    expect(screen.getByTestId('columns-container')).toBeInTheDocument();

    // The initial workflow has a single step with id 'step-000'
    const first = screen.getByTestId('operation-column-step-000');
    expect(first).toBeInTheDocument();
  });

  // The step viewer's footer: the steps' bottom bar and the handle between
  // them and the console, present whether or not the console is open.
  const footer = () => screen.getByRole('separator', { name: 'Resize steps and console' });
  // The console opens from the workflow toolbar's log button.
  const openConsole = () => fireEvent.click(screen.getByTitle('Open Logs'));
  // Each bar's ⌃/⌄ pair, by position: their labels change with the state.
  const stepsUp = () => within(footer()).getAllByRole('button')[0];
  const stepsDown = () => within(footer()).getAllByRole('button')[1];
  const consoleUp = () => screen.getByRole('button', { name: 'Expand console' });
  const consoleDown = () => screen.getByRole('button', { name: 'Minimize console' });

  it('puts the footer under the steps, background below while the console is closed', () => {
    const { container } = render(<MainLayout />);
    const steps = container.querySelector('.steps-region');
    expect(steps?.compareDocumentPosition(footer())).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(container.querySelector('.execution-log-docked')).toBeNull();
    expect(container.querySelector('.center-filler')).not.toBeNull();
  });

  it('does not open the console on a plain click of the footer', () => {
    const { container } = render(<MainLayout />);
    fireEvent.pointerDown(footer(), { button: 0, clientY: 500, pointerId: 1 });
    fireEvent.pointerUp(footer(), { button: 0, clientY: 500, pointerId: 1 });
    expect(container.querySelector('.execution-log-docked')).toBeNull();
  });

  it('opens the console flush under the footer from the toolbar log button', () => {
    const { container } = render(<MainLayout />);
    // The footer has only its chevrons — no console toggle of its own.
    expect(within(footer()).getAllByRole('button')).toHaveLength(2);
    openConsole();

    const log = container.querySelector('.execution-log-docked');
    expect(log).not.toBeNull();
    expect(footer().compareDocumentPosition(log!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    // An expanded console fills the space itself.
    expect(container.querySelector('.center-filler')).toBeNull();
  });

  it('collapses the steps and the console independently', () => {
    const { container } = render(<MainLayout />);
    openConsole();
    expect(consoleUp()).toBeDisabled();

    fireEvent.click(stepsUp());
    expect(stepsUp()).toBeDisabled();
    expect(stepsDown()).toHaveAccessibleName('Expand steps');
    // Collapsing the steps leaves the console as it was...
    expect(consoleDown()).toBeEnabled();

    // ...and both can be collapsed at once, background showing below.
    fireEvent.click(consoleDown());
    expect(consoleDown()).toBeDisabled();
    expect(stepsUp()).toBeDisabled();
    expect(container.querySelector('.center-filler')).not.toBeNull();

    fireEvent.click(stepsDown());
    expect(stepsUp()).toBeEnabled();
    fireEvent.click(consoleUp());
    expect(consoleDown()).toBeEnabled();
  });

  it('steps ⌄ maximizes the steps onto the console title bar, ⌃ steps back one stop', () => {
    render(<MainLayout />);
    openConsole();

    expect(stepsDown()).toHaveAccessibleName('Maximize steps');
    fireEvent.click(stepsDown());
    // Maximized: no further down; the console is minimized to its title bar.
    expect(stepsDown()).toBeDisabled();
    expect(consoleDown()).toBeDisabled();
    expect(stepsUp()).toHaveAccessibleName('Restore steps');

    // Expanding the console ends the maximize, so it has room.
    fireEvent.click(consoleUp());
    expect(stepsDown()).toBeEnabled();
    expect(stepsUp()).toHaveAccessibleName('Collapse steps');

    // Maximize, then ⌃ restores rather than collapsing.
    fireEvent.click(stepsDown());
    fireEvent.click(stepsUp());
    expect(stepsUp()).toHaveAccessibleName('Collapse steps');
    expect(stepsUp()).toBeEnabled();
  });
});
