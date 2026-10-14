const { parseScaffoldWizardSse } = require('../lib/scaffoldWizardSse');

describe('parseScaffoldWizardSse', () => {
  test('recognizes a successful completion and its written files', () => {
    const raw = [
      'data: {"type":"wizard_status","step":"writing"}',
      '',
      'data: {"type":"done","message":"generated","files":[{"path":"src/App.jsx","size":120}]}',
      '',
    ].join('\n');
    const parsed = parseScaffoldWizardSse(raw);
    expect(parsed.error).toBeNull();
    expect(parsed.done).toMatchObject({
      type: 'done',
      message: 'generated',
      files: [{ path: 'src/App.jsx', size: 120 }],
    });
  });

  test('preserves unverified output-quality status alongside completion', () => {
    const raw = [
      'data: {"type":"output_quality","status":"UNVERIFIED","acceptanceStatus":"NOT_EVALUATED"}',
      '',
      'data: {"type":"done","message":"files created","files":[{"path":"src/App.jsx"}]}',
      '',
    ].join('\n');
    const parsed = parseScaffoldWizardSse(raw);
    expect(parsed.outputQuality).toMatchObject({
      type: 'output_quality',
      status: 'UNVERIFIED',
      acceptanceStatus: 'NOT_EVALUATED',
    });
    expect(parsed.done.files).toHaveLength(1);
  });

  test('surfaces backend error events instead of treating stream closure as success', () => {
    const parsed = parseScaffoldWizardSse('data: {"type":"error","message":"provider unavailable"}\n\n');
    expect(parsed.error).toMatchObject({ type: 'error', message: 'provider unavailable' });
    expect(parsed.done).toBeNull();
  });

  test('does not invent completion when the stream has no terminal event', () => {
    const parsed = parseScaffoldWizardSse('data: {"type":"wizard_status","step":"generating"}\n\n');
    expect(parsed.done).toBeNull();
    expect(parsed.error).toBeNull();
  });

  test('supports named SSE events and ignores keepalive comments', () => {
    const parsed = parseScaffoldWizardSse(': ping\n\nevent: done\ndata: {"message":"finished","files":[{"path":"index.html"}]}\n\n');
    expect(parsed.done).toMatchObject({ type: 'done', message: 'finished' });
  });
});
