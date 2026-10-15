'use strict';

const crypto = require('crypto');
const { assertBytes, createBudget, DEFAULTS } = require('./ResourceGuard');

const SECRET_KEY = /(token|secret|password|authorization|cookie|api[-_]?key|private[-_]?key)/i;

function redact(value, depth = 0) {
  if (depth > 6) return '[TRUNCATED]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.length > 4096 ? `${value.slice(0, 4096)}…[TRUNCATED]` : value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 100).map(item => redact(item, depth + 1));
  return Object.fromEntries(Object.entries(value).slice(0, 100).map(([key, item]) => [key, SECRET_KEY.test(key) ? '[REDACTED]' : redact(item, depth + 1)]));
}

class AuditSink {
  constructor({ maxEvents = 5000, retentionMs = 24 * 60 * 60 * 1000, clock = Date } = {}) {
    this.maxEvents = Number.isFinite(Number(maxEvents)) && Number(maxEvents) > 0 ? Number(maxEvents) : 5000;
    this.retentionMs = Number.isFinite(Number(retentionMs)) && Number(retentionMs) > 0 ? Number(retentionMs) : 24 * 60 * 60 * 1000;
    this.clock = clock;
    this.events = [];
  }

  emit(type, payload = {}) {
    const now = this.clock.now();
    this.prune(now);
    const event = Object.freeze({
      id: `audit_${now}_${crypto.randomBytes(6).toString('hex')}`,
      type: String(type),
      timestamp: new Date(now).toISOString(),
      correlationId: payload.correlationId || null,
      requestId: payload.requestId || null,
      taskId: payload.taskId || null,
      runId: payload.runId || null,
      stepId: payload.stepId || null,
      data: redact(payload.data || {})
    });
    this.events.push(event);
    if (this.events.length > this.maxEvents) this.events.splice(0, this.events.length - this.maxEvents);
    return event;
  }

  list({ correlationId, requestId, taskId, runId } = {}) {
    this.prune(this.clock.now());
    return this.events.filter(event =>
      (!correlationId || event.correlationId === correlationId) &&
      (!requestId || event.requestId === requestId) &&
      (!taskId || event.taskId === taskId) &&
      (!runId || event.runId === runId)
    );
  }

  prune(now = this.clock.now()) {
    const cutoff = now - this.retentionMs;
    this.events = this.events.filter(event => Date.parse(event.timestamp) >= cutoff);
  }
}

function createExecutionGuard(options = {}) {
  const budget = createBudget({ ...DEFAULTS, ...(options.limits || {}) });
  const rawAudit = options.audit || new AuditSink(options.auditOptions);
  const audit = typeof rawAudit.emit === 'function'
    ? rawAudit
    : {
        emit(type, payload) {
          if (typeof rawAudit.record === 'function') return rawAudit.record({ type, ...payload });
          return payload;
        },
        list: typeof rawAudit.list === 'function' ? rawAudit.list.bind(rawAudit) : () => []
      };
  const correlationId = options.correlationId || crypto.randomUUID();

  return {
    budget,
    audit,
    correlationId,
    beforeStep(meta = {}) {
      budget.consumeStep();
      budget.assertActive();
      return audit.emit('execution.step.started', { ...meta, correlationId, data: { budget: budget.snapshot() } });
    },
    beforeRepair(meta = {}) {
      budget.consumeRepair();
      budget.assertActive();
      return audit.emit('execution.repair.started', { ...meta, correlationId, data: { budget: budget.snapshot() } });
    },
    beforeInput(value, meta = {}) {
      assertBytes(value, budget.limits.maxInputBytes, 'INPUT_TOO_LARGE', 'Input');
      return audit.emit('execution.input.accepted', { ...meta, correlationId, data: { bytes: Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value ?? ''), 'utf8') } });
    },
    beforeOutput(value, meta = {}) {
      assertBytes(value, budget.limits.maxOutputBytes, 'OUTPUT_TOO_LARGE', 'Output');
      return audit.emit('execution.output.accepted', { ...meta, correlationId, data: { bytes: Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value ?? ''), 'utf8') } });
    },
    beforePersistedChange(value, meta = {}) {
      budget.consumeChangedBytes(value);
      return audit.emit('execution.change.accepted', { ...meta, correlationId, data: { budget: budget.snapshot() } });
    },
    complete(meta = {}) {
      return audit.emit('execution.completed', { ...meta, correlationId, data: { budget: budget.snapshot() } });
    },
    fail(error, meta = {}) {
      return audit.emit('execution.failed', { ...meta, correlationId, data: { code: error?.code || 'EXECUTION_FAILED', message: String(error?.message || error).slice(0, 1000), budget: budget.snapshot() } });
    }
  };
}

module.exports = { AuditSink, redact, createExecutionGuard };
