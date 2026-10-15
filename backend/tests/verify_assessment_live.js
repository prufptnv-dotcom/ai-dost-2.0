/**
 * Live Runtime Verification for Interactive Assessment & Quiz Capability
 * AI-Dost v2.0 - Real HTTP integration against http://localhost:5000
 */

const BASE = 'http://localhost:5000';

async function runLiveVerification() {
  console.log(`🚀 Starting Live Assessment Capability Verification on ${BASE}...`);
  const results = [];

  // Test 1: Create Assessment via API
  let createdAssessment = null;
  try {
    const res = await fetch(`${BASE}/api/assessment/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: 'Python Programming',
        mode: 'mock',
        difficulty: 'intermediate',
        questionCount: 4,
        timeLimit: 300,
        negativeMarks: 0.25
      })
    });
    const data = await res.json();
    const hasQuestions = data.success && Array.isArray(data.assessment?.questions) && data.assessment.questions.length > 0;
    const isSanitized = hasQuestions && data.assessment.questions.every(q => q.correctAnswer === undefined && q.explanation === undefined);
    
    console.log('1. [Create Assessment API]:', hasQuestions && isSanitized ? 'PASS' : 'FAIL', `(Questions: ${data.assessment?.questions?.length || 0}, Answers Stripped: ${isSanitized})`);
    createdAssessment = data.assessment;
    results.push({
      test: 'Create Assessment API',
      pass: hasQuestions && isSanitized,
      details: { id: data.assessment?.id, questionCount: data.assessment?.questions?.length }
    });
  } catch (err) {
    console.error('1. [Create Assessment API] FAILED:', err.message);
    results.push({ test: 'Create Assessment API', pass: false, error: err.message });
  }

  // Test 2: Fetch Sanitized Assessment by ID
  try {
    const res = await fetch(`${BASE}/api/assessment/${createdAssessment.id}`);
    const data = await res.json();
    const answersHidden = data.assessment?.questions?.every(q => q.correctAnswer === undefined);
    console.log('2. [Get Assessment By ID]:', data.success && answersHidden ? 'PASS' : 'FAIL', `(Mode: ${data.assessment?.mode})`);
    results.push({
      test: 'Get Assessment By ID',
      pass: data.success && answersHidden
    });
  } catch (err) {
    console.error('2. [Get Assessment By ID] FAILED:', err.message);
    results.push({ test: 'Get Assessment By ID', pass: false, error: err.message });
  }

  // Test 3: Start Attempt
  let attemptId = null;
  try {
    const res = await fetch(`${BASE}/api/assessment/${createdAssessment.id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'live_test_user' })
    });
    const data = await res.json();
    attemptId = data.attemptId;
    console.log('3. [Start Attempt Session]:', data.success && !!attemptId ? 'PASS' : 'FAIL', `(AttemptId: ${attemptId})`);
    results.push({
      test: 'Start Attempt Session',
      pass: data.success && !!attemptId
    });
  } catch (err) {
    console.error('3. [Start Attempt Session] FAILED:', err.message);
    results.push({ test: 'Start Attempt Session', pass: false, error: err.message });
  }

  // Test 4: Incremental Progress Saving (Refresh Recovery)
  try {
    const res = await fetch(`${BASE}/api/assessment/${createdAssessment.id}/save-progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attemptId,
        answers: { q1: 0, q2: 1 },
        timeSpentSeconds: 35
      })
    });
    const data = await res.json();
    console.log('4. [Save Progress for Refresh Recovery]:', data.success ? 'PASS' : 'FAIL');
    results.push({
      test: 'Save Progress for Refresh Recovery',
      pass: data.success
    });
  } catch (err) {
    console.error('4. [Save Progress] FAILED:', err.message);
    results.push({ test: 'Save Progress', pass: false, error: err.message });
  }

  // Test 5: Submit Answers & Evaluation
  let evaluationResult = null;
  try {
    const res = await fetch(`${BASE}/api/assessment/${createdAssessment.id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attemptId,
        answers: { q1: 0, q2: 0, q3: 0 },
        timeSpentSeconds: 90
      })
    });
    const data = await res.json();
    evaluationResult = data.result;
    const hasScores = data.success && evaluationResult && typeof evaluationResult.netScore === 'number' && typeof evaluationResult.accuracy === 'number';
    console.log('5. [Submit Answers & Grade Evaluation]:', hasScores ? 'PASS' : 'FAIL', `(Score: ${evaluationResult?.netScore}/${evaluationResult?.totalMarks}, Accuracy: ${evaluationResult?.accuracy}%, Grade: ${evaluationResult?.grade})`);
    results.push({
      test: 'Submit Answers & Grade Evaluation',
      pass: hasScores,
      details: { netScore: evaluationResult?.netScore, grade: evaluationResult?.grade }
    });
  } catch (err) {
    console.error('5. [Submit Answers] FAILED:', err.message);
    results.push({ test: 'Submit Answers', pass: false, error: err.message });
  }

  // Test 6: Attempt History & Weak Topics
  try {
    const res = await fetch(`${BASE}/api/assessment/history?userId=live_test_user`);
    const data = await res.json();
    const hasHistory = data.success && Array.isArray(data.attempts);
    console.log('6. [User Attempt History & Analytics]:', hasHistory ? 'PASS' : 'FAIL', `(Total Attempts: ${data.attempts?.length || 0})`);
    results.push({
      test: 'User Attempt History & Analytics',
      pass: hasHistory
    });
  } catch (err) {
    console.error('6. [History API] FAILED:', err.message);
    results.push({ test: 'History API', pass: false, error: err.message });
  }

  // Test 7: Natural Language Chat Stream Intent Trigger
  try {
    const res = await fetch(`${BASE}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Mujhe Python ka 5-question quiz karao.'
      })
    });
    
    let receivedCreatedEvent = false;
    let receivedDoneWithAssessment = false;
    let introText = '';

    const text = await res.text();
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const parsed = JSON.parse(line.slice(6));
          if (parsed.type === 'assessment_created') {
            receivedCreatedEvent = true;
          }
          if (parsed.done && parsed.assessment) {
            receivedDoneWithAssessment = true;
          }
          if (parsed.chunk) {
            introText += parsed.chunk;
          }
        } catch (_) {}
      }
    }

    const passChat = receivedCreatedEvent && receivedDoneWithAssessment;
    console.log('7. [Natural Language Chat Quiz Stream]:', passChat ? 'PASS' : 'FAIL', `(Created Event: ${receivedCreatedEvent}, Card Attached: ${receivedDoneWithAssessment})`);
    results.push({
      test: 'Natural Language Chat Quiz Stream',
      pass: passChat
    });
  } catch (err) {
    console.error('7. [Chat Stream Quiz Trigger] FAILED:', err.message);
    results.push({ test: 'Chat Stream Quiz Trigger', pass: false, error: err.message });
  }

  const allPassed = results.every(r => r.pass);
  console.log('\n========================================');
  console.log(`TOTAL LIVE TESTS: ${results.length} | PASSED: ${results.filter(r => r.pass).length} | FAILED: ${results.filter(r => !r.pass).length}`);
  console.log('OVERALL ASSESSMENT STATUS:', allPassed ? '✅ ALL LIVE CHECKS PASSED' : '❌ SOME CHECKS FAILED');
  console.log('========================================\n');

  return { allPassed, results };
}

runLiveVerification().then(res => {
  process.exit(res.allPassed ? 0 : 1);
}).catch(err => {
  console.error('Execution failure:', err);
  process.exit(1);
});
