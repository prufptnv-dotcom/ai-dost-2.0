import { createTaskPlan, inferIntent, summarizePlan } from '../components/chat/taskPlanner';

describe('taskPlanner', () => {
  it('classifies create requests with a concrete target', () => {
    const intent = inferIntent('build a website for my portfolio');
    expect(intent.type).toBe('task');
    expect(intent.action).toBe('create');
    expect(intent.target).toBe('code');
    expect(intent.confidence).toBeGreaterThan(0.8);
  });

  it('builds an explicit tool and verification plan', () => {
    const plan = createTaskPlan('convert this document into pdf', {
      hasFiles: true,
      fileCount: 2,
    });

    expect(plan.version).toBe(1);
    expect(plan.intent.action).toBe('convert');
    expect(plan.steps.map((step) => step.kind)).toEqual(['reason', 'tool', 'verify', 'answer']);
    expect(plan.context).toEqual({ hasFiles: true, fileCount: 2, hasSharedContext: false });
    expect(summarizePlan(plan)).toBe('understand-intent → convert → verify-result → present-result');
  });

  it('keeps ordinary conversation as answer-only', () => {
    const plan = createTaskPlan('hello, how are you?');
    expect(plan.intent.type).toBe('chat');
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].action).toBe('respond');
  });

  it('intercepts preview open and show commands as command instead of tool task', () => {
    const phrases = [
      'preview open karo',
      'preview dikhao',
      'show preview',
      'open preview',
      'preview kholo',
      'live preview dikhao',
      'preview',
    ];
    for (const phrase of phrases) {
      const intent = inferIntent(phrase);
      expect(intent.type).toBe('command');
      expect(intent.action).toBe('open-preview');
      expect(intent.target).toBe('preview');
      const plan = createTaskPlan(phrase);
      expect(plan.intent.type).toBe('command');
      expect(plan.intent.requiresTool).toBeFalsy();
    }
  });

  it('classifies creative writing and storytelling as chat without tool execution', () => {
    const creativePhrases = [
      'ek achhi kahani banao',
      'write a poem about stars',
      'ek funny joke sunao',
      'write an essay on climate change',
      'ek leave letter banao',
    ];
    for (const phrase of creativePhrases) {
      const intent = inferIntent(phrase);
      expect(intent.type).toBe('chat');
      expect(intent.requiresTool).toBeFalsy();
      const plan = createTaskPlan(phrase);
      expect(plan.intent.type).toBe('chat');
      expect(plan.steps).toHaveLength(1);
    }
  });
});
