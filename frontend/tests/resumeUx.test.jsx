import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ResumeView from '../components/views/ResumeView';

describe('Phase 3.7 — Resume Builder & Document Editor Rebuild', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders resume title, section tabs, and initial profile data', () => {
    render(<ResumeView />);
    expect(screen.getByText(/Resume & CV Editor/i)).toBeInTheDocument();
    expect(screen.getByText('Profile & Contact Information')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Alex Morgan')).toBeInTheDocument();
  });

  it('switches sections and updates form values', () => {
    render(<ResumeView />);
    const summaryBtn = screen.getByRole('button', { name: /Summary/i });
    fireEvent.click(summaryBtn);

    const textarea = screen.getByDisplayValue(/Full-stack developer with 6\+ years/i);
    expect(textarea).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: 'Senior AI Engineer specializing in autonomous systems.' } });
    expect(screen.getByDisplayValue('Senior AI Engineer specializing in autonomous systems.')).toBeInTheDocument();
  });

  it('handles template selection and triggers export to artifact shelf', () => {
    const onToast = jest.fn();
    render(<ResumeView onToast={onToast} />);

    // Mock createObjectURL
    window.URL.createObjectURL = jest.fn(() => 'blob:mock-url');

    const exportBtn = screen.getByText('Export Document');
    fireEvent.click(exportBtn);

    expect(onToast).toHaveBeenCalledWith(
      expect.stringContaining('Resume exported & archived to Artifact Shelf'),
      'success'
    );

    // Verify artifact saved into localStorage
    const saved = JSON.parse(localStorage.getItem('ai_dost_generated_artifacts') || '[]');
    expect(saved.length).toBeGreaterThan(0);
    expect(saved[0].type).toBe('HTML');
  });
});
