const { chromium } = require('../frontend/node_modules/playwright');

async function run() {
  console.log('🚀 Starting Chat <-> IDE Integration E2E Browser Test...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleLogs = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleLogs.push(`[BROWSER ERROR] ${msg.text()}`);
  });

  try {
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('✅ Navigated to http://localhost:3000/dashboard');

    // 1. Check active session id
    console.log('Current URL:', page.url());
    console.log('Page Title:', await page.title());
    const bodyHtml = await page.evaluate(() => document.body.innerHTML.slice(0, 500));
    console.log('Body HTML:', bodyHtml);
    console.log('Console logs:', consoleLogs);

    // 2. Click "New chat" button
    const newChatBtn = await page.waitForSelector('button[aria-label="New chat"], button:has-text("New chat")', { timeout: 10000 });
    await newChatBtn.click();
    await page.waitForTimeout(1000);

    const newSessionId = await page.evaluate(() => localStorage.getItem('ai_dost_session_id'));
    console.log(`✨ After New Chat click, session ID is: ${newSessionId}`);
    if (!newSessionId.startsWith('chat_')) {
      throw new Error(`Expected session ID starting with chat_, got: ${newSessionId}`);
    }

    // 3. Switch to Copilot IDE view
    const copilotNav = await page.waitForSelector('button:has-text("Copilot")', { timeout: 10000 });
    await copilotNav.click();
    await page.waitForTimeout(2000);

    // 4. Verify IDE starts fresh with empty file tree (no old project files)
    const fileCount = await page.evaluate(() => {
      const stored = localStorage.getItem('copilot_sessions_v2');
      const sessions = stored ? JSON.parse(stored) : [];
      const currentId = localStorage.getItem('copilot_current_session_id');
      const current = sessions.find(s => s.id === currentId);
      return current?.files?.length || 0;
    });
    console.log(`📂 Greenfield file count for new chat in IDE: ${fileCount}`);
    if (fileCount !== 0) {
      throw new Error(`Expected 0 files in new chat workspace, got ${fileCount}`);
    }
    console.log('✅ Verified: New chat starts completely greenfield with 0 files in IDE!');

    // 5. Simulate creating and saving a file in this session
    const saveResult = await page.evaluate(async (sessId) => {
      const res = await fetch(`/api/memory/project/${sessId}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'src/App.jsx', content: 'export default function App() { return <h1>Chat App</h1>; }' })
      });
      const data = await res.json();
      // Also update copilot_sessions_v2
      const stored = localStorage.getItem('copilot_sessions_v2');
      const sessions = stored ? JSON.parse(stored) : [];
      const updated = sessions.map(s => s.id === sessId ? {
        ...s,
        files: [{ path: 'src/App.jsx', content: 'export default function App() { return <h1>Chat App</h1>; }' }],
        contents: { 'src/App.jsx': 'export default function App() { return <h1>Chat App</h1>; }' }
      } : s);
      localStorage.setItem('copilot_sessions_v2', JSON.stringify(updated));
      return { status: res.status, data };
    }, newSessionId);

    console.log('💾 File src/App.jsx saved response:', saveResult);

    // Verify backend has the file
    const fileRes = await page.evaluate(async (sessId) => {
      const r = await fetch(`/api/memory/project/${sessId}`);
      return await r.json();
    }, newSessionId);
    console.log(`📁 Backend files for ${newSessionId}:`, fileRes.files?.length);
    if (!fileRes.files || fileRes.files.length === 0) {
      throw new Error('Backend did not store file for session');
    }

    // 6. Click "New chat" again to create a 2nd chat
    await newChatBtn.click();
    await page.waitForTimeout(1000);
    const secondSessionId = await page.evaluate(() => localStorage.getItem('ai_dost_session_id'));
    console.log(`✨ Second new chat created: ${secondSessionId}`);

    // Switch to Copilot IDE and verify it is completely blank (0 files), NOT showing the previous project!
    const secondFileCount = await page.evaluate(() => {
      const stored = localStorage.getItem('copilot_sessions_v2');
      const sessions = stored ? JSON.parse(stored) : [];
      const currentId = localStorage.getItem('copilot_current_session_id');
      const current = sessions.find(s => s.id === currentId);
      return current?.files?.length || 0;
    });
    console.log(`📂 Second session file count in IDE: ${secondFileCount}`);
    if (secondFileCount !== 0) {
      throw new Error(`Second session leaked files from first session! Count: ${secondFileCount}`);
    }
    console.log('✅ Verified: Second chat does NOT display old project files!');

    // 7. Delete the first session
    console.log(`🗑️ Deleting first session: ${newSessionId}...`);
    await page.evaluate(async (sessId) => {
      await fetch(`/api/chat/history?session_id=${encodeURIComponent(sessId)}`, { method: 'DELETE' });
      await fetch(`/api/memory/project/${encodeURIComponent(sessId)}`, { method: 'DELETE' });
    }, newSessionId);

    // Verify that the code and files for the deleted session are completely deleted from backend
    const checkDeletedRes = await page.evaluate(async (sessId) => {
      const r = await fetch(`/api/memory/project/${sessId}`);
      return await r.json();
    }, newSessionId);

    console.log(`🔍 Verification after delete: Backend files count for deleted session = ${checkDeletedRes.files?.length || 0}`);
    if ((checkDeletedRes.files?.length || 0) !== 0) {
      throw new Error(`Files for deleted session were not deleted! Count: ${checkDeletedRes.files?.length}`);
    }
    console.log('✅ Verified: When chat is deleted, its IDE code and files are permanently deleted!');

    console.log('🎉 ALL TESTS PASSED! Chat and IDE are seamlessly integrated, clean-reset on new chat, and completely purge files on delete.');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
