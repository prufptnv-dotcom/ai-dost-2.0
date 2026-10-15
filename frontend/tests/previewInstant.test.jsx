/**
 * P6 — Instant mode (WebContainer wrapper) wiring in PreviewPane.
 *
 * Contract:
 *  - mode cycle reaches 'instant': Auto -> Proxy -> Instant -> In-Browser -> Auto
 *  - instant iframe loads the BACKEND wrapper directly (its COOP/COEP headers
 *    must reach the browser — Next rewrites can't be trusted to forward them)
 *  - the phase chip follows aidost-instant postMessage events from the wrapper
 *  - non-instant modes never render the chip, foreign projects are ignored
 *
 * Zero network: PreviewPane itself fetches nothing (wrapper does its own IO).
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PreviewPane } from '../components/ide/PreviewPane';
import { ToastProvider } from '../context/ToastContext';

const PROJECT = 'p6-ui-proj';

function Pane({ mode = 'auto', setPreviewSourceMode, ...rest }) {
  return (
    <ToastProvider>
      <PreviewPane
        projectId={PROJECT}
        previewSourceMode={mode}
        setPreviewSourceMode={setPreviewSourceMode}
        files={[]}
        contents={{}}
        devServerStatus={{ state: 'IDLE' }}
        {...rest}
      />
    </ToastProvider>
  );
}

function CycleHarness() {
  const [mode, setMode] = React.useState('auto');
  return <Pane mode={mode} setPreviewSourceMode={setMode} />;
}

function sendInstant(data) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data }));
  });
}

describe('P6 — PreviewPane Instant mode', () => {
  it('cycles Auto -> Proxy -> Instant -> In-Browser -> Auto', () => {
    render(<CycleHarness />);
    const btn = screen.getByText('Mode: Auto');
    fireEvent.click(btn);
    expect(screen.getByText('Mode: Proxy')).toBeTruthy();
    fireEvent.click(screen.getByText('Mode: Proxy'));
    expect(screen.getByText('Mode: Instant')).toBeTruthy();
    fireEvent.click(screen.getByText('Mode: Instant'));
    expect(screen.getByText('Mode: In-Browser')).toBeTruthy();
    fireEvent.click(screen.getByText('Mode: In-Browser'));
    expect(screen.getByText('Mode: Auto')).toBeTruthy();
  });

  it('loads the backend wrapper directly (COOP/COEP origin), no srcdoc', () => {
    const { container } = render(<Pane mode="instant" />);
    const frame = container.querySelector('iframe');
    expect(frame).toBeTruthy();
    expect(frame.getAttribute('src')).toBe('http://localhost:5000/instant/p6-ui-proj');
    expect(frame.getAttribute('srcdoc')).toBeNull();
    expect(screen.getByTestId('instant-chip')).toBeTruthy();
  });

  it('auto modes keep the existing proxy/in-browser behavior (no wrapper)', () => {
    const { container } = render(<Pane mode="live" />);
    const frame = container.querySelector('iframe');
    expect(frame.getAttribute('src')).toBe(`/api/preview/${PROJECT}`);
    expect(screen.queryByTestId('instant-chip')).toBeNull();
  });

  it('phase chip starts at "starting" and follows wrapper postMessage phases', () => {
    render(<Pane mode="instant" />);
    const chip = screen.getByTestId('instant-chip');
    expect(chip.textContent).toMatch(/starting/);

    sendInstant({ source: 'aidost-instant', phase: 'install', project: PROJECT });
    expect(screen.getByTestId('instant-chip').textContent).toMatch(/install/);

    sendInstant({ source: 'aidost-instant', phase: 'ready', project: PROJECT });
    expect(screen.getByTestId('instant-chip').textContent).toMatch(/ready/);
  });

  it('ignores events from other projects and unknown sources', () => {
    render(<Pane mode="instant" />);
    sendInstant({ source: 'aidost-instant', phase: 'error', project: 'someone-else' });
    expect(screen.getByTestId('instant-chip').textContent).toMatch(/starting/);
    sendInstant({ source: 'not-ours', phase: 'error', project: PROJECT });
    expect(screen.getByTestId('instant-chip').textContent).toMatch(/starting/);
  });

  it('clears the chip when leaving instant mode', () => {
    const { rerender } = render(<Pane mode="instant" />);
    expect(screen.getByTestId('instant-chip')).toBeTruthy();
    rerender(
      <ToastProvider>
        <PreviewPane
          projectId={PROJECT}
          previewSourceMode="live"
          files={[]}
          contents={{}}
          devServerStatus={{ state: 'IDLE' }}
        />
      </ToastProvider>
    );
    expect(screen.queryByTestId('instant-chip')).toBeNull();
  });
});
