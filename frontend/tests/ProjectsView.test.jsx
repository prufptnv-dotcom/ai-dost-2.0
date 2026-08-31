import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProjectsView from '../components/views/ProjectsView';
import api from '../services/api';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

const MOCK_PROJECTS = [
  { project_id: 'p1', project_name: 'Bihar Portal', description: 'Travel guide', created_at: '2026-01-01' },
  { project_id: 'p2', project_name: 'AI Chatbot', description: 'Personal assistant', created_at: '2026-02-01' },
];

describe('ProjectsView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockResolvedValue({ data: MOCK_PROJECTS });
  });

  it('loads and renders projects from the API', async () => {
    render(<ProjectsView onOpenProject={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Bihar Portal')).toBeInTheDocument();
      expect(screen.getByText('AI Chatbot')).toBeInTheDocument();
    });
    expect(api.get).toHaveBeenCalledWith('/memory/projects');
  });

  it('shows empty state on API failure without crashing', async () => {
    api.get.mockRejectedValue(new Error('network down'));
    render(<ProjectsView onOpenProject={() => {}} />);
    await waitFor(() => expect(screen.getByText(/No projects found/i)).toBeInTheDocument());
  });

  it('creates a project via POST and refreshes the list', async () => {
    api.post.mockResolvedValue({ data: { project_id: 'p3' } });
    const onOpenProject = jest.fn();

    render(<ProjectsView onOpenProject={onOpenProject} />);
    await waitFor(() => expect(screen.getByText('Bihar Portal')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /New Project/i }));
    fireEvent.change(screen.getByPlaceholderText(/Project name/i), { target: { value: 'My App' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/memory/project', expect.objectContaining({ project_name: 'My App' }));
    });
    expect(onOpenProject).toHaveBeenCalledWith('p3');
  });

  it('does not create when name is empty', async () => {
    render(<ProjectsView onOpenProject={() => {}} />);
    await waitFor(() => expect(screen.getByText('Bihar Portal')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /New Project/i }));
    const createBtn = screen.getByRole('button', { name: 'Create Project' });
    expect(createBtn).toBeDisabled();
    fireEvent.click(createBtn);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('fires onOpenProject when clicking a project card', async () => {
    const onOpenProject = jest.fn();
    render(<ProjectsView onOpenProject={onOpenProject} />);
    await waitFor(() => expect(screen.getByText('Bihar Portal')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Bihar Portal'));
    expect(onOpenProject).toHaveBeenCalledWith('p1');
  });
});