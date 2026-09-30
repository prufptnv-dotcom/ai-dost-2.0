import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SelfHealingDiagnosticsBanner from '../components/canvas/SelfHealingDiagnosticsBanner';

describe('Pillar 4: Autonomous Self-Healing Sandbox Components', () => {
  describe('SelfHealingDiagnosticsBanner', () => {
    test('returns null when state is idle', () => {
      const { container } = render(<SelfHealingDiagnosticsBanner state="idle" />);
      expect(container.firstChild).toBeNull();
    });

    test('renders diagnosing state with loading spinner and message', () => {
      render(
        <SelfHealingDiagnosticsBanner
          state="diagnosing"
          error="ReferenceError: THREE is not defined"
        />
      );

      expect(
        screen.getByText(/Self-Healing Active: Diagnosing runtime error/i)
      ).toBeInTheDocument();
    });

    test('renders healed state with confidence score, explanation, and undo button', () => {
      const onUndo = jest.fn();
      render(
        <SelfHealingDiagnosticsBanner
          state="healed"
          explanation="Injected missing Three.js CDN script"
          confidence={0.98}
          onUndo={onUndo}
        />
      );

      expect(screen.getByText(/Autonomous Self-Healing Complete/i)).toBeInTheDocument();
      expect(screen.getByText(/Injected missing Three.js CDN script/i)).toBeInTheDocument();
      expect(screen.getByText('98% Confidence')).toBeInTheDocument();

      const undoBtn = screen.getByTitle(/Roll back to code before self-healing/i);
      fireEvent.click(undoBtn);
      expect(onUndo).toHaveBeenCalledTimes(1);
    });

    test('renders manual review state with Apply Fix button and diff viewer', () => {
      const onApplyFix = jest.fn();
      const diff = {
        search: 'const x = undefinedVar;',
        replace: 'const x = "safe_fallback";',
      };

      render(
        <SelfHealingDiagnosticsBanner
          state="manual_review"
          explanation="Safe fallback for undefined variable"
          confidence={0.75}
          diff={diff}
          onApplyFix={onApplyFix}
        />
      );

      expect(screen.getByText(/Fix Suggested \(75%\)/i)).toBeInTheDocument();
      const applyBtn = screen.getByRole('button', { name: /Apply Fix/i });
      fireEvent.click(applyBtn);
      expect(onApplyFix).toHaveBeenCalledTimes(1);

      // Toggle diff view
      const diffToggleBtn = screen.getByRole('button', { name: /Diff/i });
      fireEvent.click(diffToggleBtn);
      expect(screen.getByText('REPLACED:')).toBeInTheDocument();
      expect(screen.getByText('SURGICAL PATCH:')).toBeInTheDocument();
      expect(screen.getByText(/const x = undefinedVar;/i)).toBeInTheDocument();
      expect(screen.getByText(/const x = "safe_fallback";/i)).toBeInTheDocument();
    });
  });
});
