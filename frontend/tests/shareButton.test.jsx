/**
 * P7 — ShareButton: public share link UX.
 * Contract with backend routes/share.js: GET status on mount, POST to start,
 * DELETE to stop. A failed tunnel must show the honest hint — never a URL.
 * Zero network: global.fetch mocked.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ShareButton from '../components/ide/ShareButton';

const ACTIVE = {
  success: true,
  url: 'https://x-y-z.trycloudflare.com/?key=k1',
  key: 'k1',
  provider: 'cloudflared',
  localPort: 4100,
  active: true,
  hint: null,
};

const INACTIVE = { success: false, url: null, active: false, key: null, provider: null };

function mockFetch({ status = INACTIVE, start = ACTIVE, stopOk = true } = {}) {
  global.fetch = jest.fn((url, opts = {}) => {
    const method = (opts.method || 'GET').toUpperCase();
    let body;
    if (method === 'POST') body = start;
    else if (method === 'DELETE') body = { success: stopOk };
    else body = status;
    return Promise.resolve({ json: () => Promise.resolve(body) });
  });
}

function callsWith(method) {
  return (global.fetch.mock.calls || []).filter(([, o]) => o && o.method === method);
}

describe('P7 ShareButton (public share link)', () => {
  afterEach(() => {
    delete global.fetch;
  });

  it('checks share status on mount and starts closed', async () => {
    mockFetch();
    render(<ShareButton projectId="proj-1" />);
    await waitFor(() => expect(global.fetch.mock.calls.length).toBeGreaterThan(0));
    expect(global.fetch.mock.calls.some(([u]) => u === '/api/share/proj-1')).toBe(true);
    expect(screen.getByTestId('share-button').getAttribute('aria-expanded')).toBe('false');
  });

  it('opening the popover auto-creates a share and shows the URL', async () => {
    mockFetch();
    render(<ShareButton projectId="proj A" showToast={jest.fn()} />);
    fireEvent.click(screen.getByTestId('share-button'));
    expect(screen.getByTestId('share-popover')).toBeTruthy();

    await waitFor(() => expect(screen.getByTestId('share-url')).toBeTruthy());
    expect(screen.getByTestId('share-url').value).toBe(ACTIVE.url);
    expect(screen.getByTestId('share-open').getAttribute('href')).toBe(ACTIVE.url);
    expect(screen.getByTestId('share-stop')).toBeTruthy();

    const posts = callsWith('POST');
    expect(posts.length).toBe(1);
    expect(posts[0][0]).toBe('/api/share/proj%20A'); // project id is URL-encoded
    expect(screen.getByTestId('share-note').textContent).toMatch(/preview only/i);
  });

  it('copies the link to the clipboard', async () => {
    mockFetch();
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    render(<ShareButton projectId="p" />);
    fireEvent.click(screen.getByTestId('share-button'));
    await waitFor(() => expect(screen.getByTestId('share-copy')).toBeTruthy());
    fireEvent.click(screen.getByTestId('share-copy'));
    expect(writeText).toHaveBeenCalledWith(ACTIVE.url);
  });

  it('stop deletes the share and falls back to the start button', async () => {
    mockFetch();
    render(<ShareButton projectId="p" showToast={jest.fn()} />);
    fireEvent.click(screen.getByTestId('share-button'));
    await waitFor(() => expect(screen.getByTestId('share-stop')).toBeTruthy());

    fireEvent.click(screen.getByTestId('share-stop'));
    await waitFor(() => expect(screen.getByTestId('share-start')).toBeTruthy());
    const dels = callsWith('DELETE');
    expect(dels.length).toBe(1);
    expect(dels[0][0]).toBe('/api/share/p');
    expect(screen.queryByTestId('share-url')).toBeNull();
  });

  it('failed tunnel shows the honest hint and NEVER a fake URL', async () => {
    mockFetch({
      start: { success: false, url: null, active: false, hint: 'Tunnel unavailable. Share over LAN instead.' },
    });
    const toast = jest.fn();
    render(<ShareButton projectId="p" showToast={toast} />);
    fireEvent.click(screen.getByTestId('share-button'));

    await waitFor(() => expect(screen.getByTestId('share-hint')).toBeTruthy());
    expect(screen.getByTestId('share-hint').textContent).toMatch(/Tunnel unavailable/);
    expect(screen.queryByTestId('share-url')).toBeNull();
    expect(screen.queryByTestId('share-open')).toBeNull();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('restores an already-active share without re-POSTing', async () => {
    mockFetch({ status: ACTIVE });
    render(<ShareButton projectId="p" />);
    await waitFor(() => expect(screen.getByTestId('share-button').title).toMatch(/active/i));

    fireEvent.click(screen.getByTestId('share-button'));
    await waitFor(() => expect(screen.getByTestId('share-url')).toBeTruthy());
    expect(callsWith('POST').length).toBe(0); // no duplicate POST when already sharing
  });
});
