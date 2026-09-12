'use strict';

/**
 * AI-Dost 2.0 - Live Runtime API Audit Script
 * Verifies live endpoint security, authentication boundaries, state machine transitions,
 * answer key security, and timer protections against running server at http://localhost:5000.
 */

const BASE_URL = 'http://localhost:5000';

async function runLiveAudit() {
  console.log('🚀 Starting Live Runtime API Audit on', BASE_URL);
  let passed = 0;
  let failed = 0;

  function assertCheck(desc, condition, details = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc} — ${details}`);
      failed++;
    }
  }

  try {
    // 1. Create an assessment as Alice
    console.log('\n--- 1. Create Assessment ---');
    const createRes = await fetch(`${BASE_URL}/api/assessment/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'alice_auditor'
      },
      body: JSON.stringify({
        topic: 'Python Concurrency',
        subject: 'Computer Science',
        mode: 'mock',
        difficulty: 'intermediate',
        questionCount: 3,
        timeLimit: 120,
        negativeMarks: 0.25
      })
    });
    const createData = await createRes.json();
    assertCheck('Create assessment succeeds', createData.success === true);
    const asmtId = createData.assessment.id;
    assertCheck('Sanitized assessment hides correctAnswer', createData.assessment.questions[0].correctAnswer === undefined);

    // 2. Start attempt as Alice
    console.log('\n--- 2. Start Attempt Bound to Alice ---');
    const startRes = await fetch(`${BASE_URL}/api/assessment/${asmtId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'alice_auditor'
      },
      body: JSON.stringify({ mode: 'mock' })
    });
    const startData = await startRes.json();
    assertCheck('Start attempt succeeds', startData.success === true);
    const attId = startData.attemptId;
    assertCheck('Attempt belongs to alice_auditor', startData.userId === 'alice_auditor');

    // 3. User Bob tries to access Alice's attempt record
    console.log('\n--- 3. Cross-User Authorization (Bob Accessing Alice) ---');
    const bobAccessRes = await fetch(`${BASE_URL}/api/assessment/attempt/${attId}`, {
      headers: { 'x-user-id': 'bob_attacker' }
    });
    assertCheck('Bob is blocked from viewing Alice attempt (403 Forbidden)', bobAccessRes.status === 403);

    // 4. Bob tries to save progress on Alice's attempt
    const bobSaveRes = await fetch(`${BASE_URL}/api/assessment/${asmtId}/save-progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'bob_attacker'
      },
      body: JSON.stringify({ attemptId: attId, answers: { q1: 1 } })
    });
    assertCheck('Bob is blocked from saving progress on Alice attempt (403 Forbidden)', bobSaveRes.status === 403);

    // 5. Bob tries to submit Alice's attempt
    const bobSubmitRes = await fetch(`${BASE_URL}/api/assessment/${asmtId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'bob_attacker'
      },
      body: JSON.stringify({ attemptId: attId, answers: { q1: 1 } })
    });
    assertCheck('Bob is blocked from submitting Alice attempt (403 Forbidden)', bobSubmitRes.status === 403);

    // 6. Attempt-to-assessment mismatch tampering check
    console.log('\n--- 4. Tampering Protection (Mismatched Assessment ID) ---');
    const tamperRes = await fetch(`${BASE_URL}/api/assessment/asmt_FAKE_ID/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'alice_auditor'
      },
      body: JSON.stringify({ attemptId: attId, answers: { q1: 0 } })
    });
    assertCheck('Mismatching assessment ID returns 404 or 400 Bad Request', tamperRes.status >= 400);

    // 7. Alice saves progress legitimately
    console.log('\n--- 5. Legitimate Progress Saving ---');
    const aliceSaveRes = await fetch(`${BASE_URL}/api/assessment/${asmtId}/save-progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'alice_auditor'
      },
      body: JSON.stringify({
        attemptId: attId,
        answers: { q1: 0 },
        timeSpentSeconds: 20
      })
    });
    const aliceSaveData = await aliceSaveRes.json();
    assertCheck('Alice legitimately saves progress', aliceSaveData.success === true);

    // 8. Alice submits attempt legitimately
    console.log('\n--- 6. First Legitimate Submission ---');
    const submitRes = await fetch(`${BASE_URL}/api/assessment/${asmtId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'alice_auditor'
      },
      body: JSON.stringify({
        attemptId: attId,
        answers: { q1: 0, q2: 1, q3: 0 },
        timeSpentSeconds: 40
      })
    });
    const submitData = await submitRes.json();
    assertCheck('First submission returns 200 with result', submitRes.status === 200 && submitData.success === true);
    const originalScore = submitData.result.netScore;
    assertCheck('Net score calculated by server', typeof originalScore === 'number');

    // 9. Alice attempts duplicate submission (Replay Attack / Double Submit)
    console.log('\n--- 7. Idempotent Double Submission / Replay Protection ---');
    const replayRes = await fetch(`${BASE_URL}/api/assessment/${asmtId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'alice_auditor'
      },
      body: JSON.stringify({
        attemptId: attId,
        answers: { q1: 99, q2: 99, q3: 99 }, // Tampered answers
        timeSpentSeconds: 10
      })
    });
    const replayData = await replayRes.json();
    assertCheck('Replay submission returns 200 idempotent response', replayRes.status === 200 && replayData.isIdempotent === true);
    assertCheck('Original score remains unchanged during replay', replayData.result.netScore === originalScore);

    // 10. Attempting save-progress on already submitted attempt
    console.log('\n--- 8. State Machine Protection on Submitted Attempt ---');
    const lateSaveRes = await fetch(`${BASE_URL}/api/assessment/${asmtId}/save-progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'alice_auditor'
      },
      body: JSON.stringify({ attemptId: attId, answers: { q1: 0 } })
    });
    assertCheck('Cannot save progress after submission (409 Conflict)', lateSaveRes.status === 409);

    // 11. History isolation test
    console.log('\n--- 9. History Isolation Test ---');
    const aliceHistRes = await fetch(`${BASE_URL}/api/assessment/history`, {
      headers: { 'x-user-id': 'alice_auditor' }
    });
    const aliceHistData = await aliceHistRes.json();
    const aliceHasAtt = aliceHistData.attempts.some(a => a.id === attId);
    assertCheck("Alice's history contains her attempt", aliceHasAtt === true);

    const bobHistRes = await fetch(`${BASE_URL}/api/assessment/history`, {
      headers: { 'x-user-id': 'bob_attacker' }
    });
    const bobHistData = await bobHistRes.json();
    const bobHasAliceAtt = bobHistData.attempts.some(a => a.id === attId);
    assertCheck("Bob's history does NOT contain Alice's attempt", bobHasAliceAtt === false);

    // 12. Short answer modelAnswer shielding
    console.log('\n--- 10. Model Answer Shielding in Mock Mode ---');
    const evalRes = await fetch(`${BASE_URL}/api/assessment/evaluate-short-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: { prompt: 'What is TLS?', marks: 2, correctAnswer: 'Transport Layer Security cryptographic protocol.' },
        userAnswer: 'TLS is encryption for web traffic',
        isPractice: false
      })
    });
    const evalData = await evalRes.json();
    assertCheck('Evaluation completed', evalData.success === true);
    assertCheck('Model answer is shielded (undefined) when isPractice is false', evalData.evaluation.modelAnswer === undefined);

    console.log(`\n========================================`);
    console.log(`📊 LIVE AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal live audit error:', err);
    process.exit(1);
  }
}

runLiveAudit();
