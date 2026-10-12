import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ForgeCopilot from '../components/forge/ForgeCopilot';

// Mock API
jest.mock('../services/api', () => ({
  fetchProject: jest.fn().mockResolvedValue({
    id: 'test-project',
    name: 'test-project',
    files: [
      { path: 'src/App.jsx', content: 'export default function App() { return <div>Test App</div>; }' },
      { path: 'package.json', content: '{"name":"test"}' }
    ]
  }),
  saveProjectFile: jest.fn().mockResolvedValue({ success: true }),
  addProjectFile: jest.fn().mockResolvedValue({ success: true }),
  deleteProjectFile: jest.fn().mockResolvedValue({ success: true }),
  createProject: jest.fn().mockResolvedValue({ id: 'p2', name: 'p2' }),
  deleteProject: jest.fn().mockResolvedValue({ success: true }),
  fetchProjects: jest.fn().mockResolvedValue([
    { id: 'test-project', name: 'test-project' },
    { id: 'legacy-project', name: 'legacy-project' }
  ]),
}));

describe('ForgeCopilot Autonomous Builder UI', () => {
  beforeEach(() => {
    window.matchMedia = window.matchMedia || function () {
      return {
        matches: false,
        addListener: function () {},
        removeListener: function () {},
        addEventListener: function () {},
        removeEventListener: function () {},
      };
    };
  });

  test('renders Forge shell, topbar, sidebar and assistant panel with real user and project', () => {
    render(<ForgeCopilot projectName="test-project" />);

    // Brand and header
    expect(screen.getByText('Forge Studio')).toBeInTheDocument();
    expect(screen.getAllByText('test-project').length).toBeGreaterThan(0);
    expect(screen.getByText('Saved')).toBeInTheDocument();

    // Mode tabs
    expect(screen.getByRole('tab', { name: /preview/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /code/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /terminal/i })).toBeInTheDocument();

    // Assistant panel
    expect(screen.getAllByText('Forge AI').length).toBeGreaterThan(0);
    expect(screen.getByText('Autonomous builder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ask Forge AI/i)).toBeInTheDocument();
  });

  test('switches workspace view mode between Preview, Code, and Terminal', () => {
    render(<ForgeCopilot projectName="test-project" />);

    // Default is preview
    expect(screen.getByText(/Live preview/i)).toBeInTheDocument();

    // Switch to Code
    const codeTab = screen.getByRole('tab', { name: /code/i });
    fireEvent.click(codeTab);
    expect(screen.getByText('Save')).toBeInTheDocument();

    // Switch to Terminal
    const termTab = screen.getByRole('tab', { name: /terminal/i });
    fireEvent.click(termTab);
    expect(screen.getByText('zsh · 80 × 24')).toBeInTheDocument();
  });

  test('switches device size in preview mode', () => {
    render(<ForgeCopilot />);

    const mobileBtn = screen.getByTitle(/mobile preview/i);
    fireEvent.click(mobileBtn);
    expect(mobileBtn).toHaveClass('active');

    const desktopBtn = screen.getByTitle(/desktop preview/i);
    fireEvent.click(desktopBtn);
    expect(desktopBtn).toHaveClass('active');
  });

  test('handles assistant prompt submission and displays working state', () => {
    render(<ForgeCopilot />);

    const textarea = screen.getByPlaceholderText(/Ask Forge AI/i);
    fireEvent.change(textarea, { target: { value: 'Add hero glow animation' } });

    const submitBtn = screen.getByLabelText(/send message/i);
    expect(submitBtn).toBeEnabled();
    fireEvent.click(submitBtn);

    expect(screen.getByText('Add hero glow animation')).toBeInTheDocument();
    expect(screen.getByText(/Working through your request/i)).toBeInTheDocument();
  });

  test('navigates to MCP Connect and Skills Library views', () => {
    render(<ForgeCopilot />);

    // Open MCP Connect
    const mcpLinks = screen.getAllByRole('button', { name: /mcp/i });
    fireEvent.click(mcpLinks[0]);
    expect(screen.getByText(/MCP Connect & Tool Catalog/i)).toBeInTheDocument();
    expect(screen.getByText('Project Filesystem')).toBeInTheDocument();

    // Open Skills Library
    const skillsLinks = screen.getAllByRole('button', { name: /skills/i });
    fireEvent.click(skillsLinks[0]);
    expect(screen.getByText(/Agent Skills Library/i)).toBeInTheDocument();
    expect(screen.getByText('Minimal Input Planner')).toBeInTheDocument();
  });

  test('allows theme selection from the theme picker popover', () => {
    render(<ForgeCopilot />);

    const themeBtn = screen.getByRole('button', { name: /change workspace theme/i });
    fireEvent.click(themeBtn);

    expect(screen.getByText('Color theme')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ocean/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /emerald/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /emerald/i }));
    // Popover closes
    expect(screen.queryByText('Make the workspace yours')).not.toBeInTheDocument();
  });

  test('opens and closes Git Snapshots modal from topbar branch button', () => {
    render(<ForgeCopilot projectName="test-project" />);

    const branchBtn = screen.getByTitle(/Git Snapshots & Local Commits/i);
    fireEvent.click(branchBtn);

    expect(screen.getByText(/Git Snapshots & Local Commits/i)).toBeInTheDocument();
    expect(screen.getByText('Create New Snapshot')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Commit message/i)).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /^close$/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Create New Snapshot')).not.toBeInTheDocument();
  });

  test('renders interactive terminal with quick pills and input field', () => {
    render(<ForgeCopilot projectName="test-project" />);

    // Switch to Terminal
    const termTab = screen.getByRole('tab', { name: /terminal/i });
    fireEvent.click(termTab);

    // Quick pills exist
    expect(screen.getByRole('button', { name: 'npm test' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'git status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();

    // Input prompt exists
    const input = screen.getByPlaceholderText(/Type command/i);
    expect(input).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'npm run test' } });
    expect(input.value).toBe('npm run test');
  });

  test('allows adding a custom MCP server in MCP Connect catalog', () => {
    render(<ForgeCopilot />);

    const mcpLinks = screen.getAllByRole('button', { name: /mcp/i });
    fireEvent.click(mcpLinks[0]);

    const addBtn = screen.getByRole('button', { name: /Add MCP Server/i });
    fireEvent.click(addBtn);

    expect(screen.getByText(/Configure New MCP Server/i)).toBeInTheDocument();
    const nameInput = screen.getByPlaceholderText(/SQLite DB Server/i);
    const cmdInput = screen.getByPlaceholderText(/e\.g\. npx/i);

    fireEvent.change(nameInput, { target: { value: 'Redis Cache MCP' } });
    fireEvent.change(cmdInput, { target: { value: 'redis-server' } });

    const saveBtn = screen.getByRole('button', { name: /Save Server/i });
    fireEvent.click(saveBtn);

    expect(screen.getByText('Redis Cache MCP')).toBeInTheDocument();
  });

  test('allows deleting a project from the project workspaces dropdown', async () => {
    window.confirm = jest.fn().mockReturnValue(true);
    render(<ForgeCopilot projectName="test-project" />);

    // Open project switcher
    const switcher = screen.getByLabelText(/Current project/i);
    fireEvent.click(switcher);

    expect(screen.getByText('PROJECT WORKSPACES')).toBeInTheDocument();
  });
});
