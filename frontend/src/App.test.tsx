import { render, screen } from '@testing-library/react';
import App from './App';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the api module so useWorkflow doesn't try to fetch from a real server
vi.mock('./services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./services/api')>()),
  getOperations: vi.fn().mockResolvedValue([]),
  runStep: vi.fn().mockResolvedValue({ ref_id: 'mock-ref', metrics: {} }),
  fetchDataView: vi.fn().mockResolvedValue({ cells: [] }),
  checkBackendStatus: vi.fn().mockResolvedValue(true),
  saveWorkflow: vi.fn().mockResolvedValue({ id: 'mock-id' }),
  loadWorkflow: vi.fn().mockResolvedValue({ id: 'wf', name: 'Test', steps: [] }),
  listProjects: vi.fn().mockResolvedValue([]),
  createProject: vi.fn().mockResolvedValue({ project_id: 'p1' }),
  deleteProject: vi.fn().mockResolvedValue({}),
  listPipelines: vi.fn().mockResolvedValue([]),
  deletePipeline: vi.fn().mockResolvedValue({}),
}));

describe('App', () => {
  beforeEach(() => {
    // No backend here: api calls not mocked above stay pending rather than
    // rejecting with nobody listening.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders main layout', () => {
    render(<App />);
    expect(screen.getByTestId('main-layout')).toBeInTheDocument();
  });
});
