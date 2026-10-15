'use strict';

/**
 * TenantAuditLogger.js - Structured Multi-Tenant Audit Logging
 *
 * Appends immutable audit records to tenant_audit_logs table.
 * Strictly scopes queries to ensure audit logs of one tenant can never
 * be accessed or enumerated by another tenant.
 */

const crypto = require('crypto');

class TenantAuditLogger {
  /**
   * @param {object} db - DatabaseSync instance or PostgreSQL client/pool
   * @param {object} [options]
   * @param {'sqlite' | 'postgres'} [options.engine='sqlite']
   */
  constructor(db, options = {}) {
    if (!db) {
      throw new Error('TenantAuditLogger requires an active db instance');
    }
    this.db = db;
    this.engine = options.engine || 'sqlite';
  }

  /**
   * Logs a tenant-scoped audit event
   *
   * @param {object} event
   * @param {string} event.tenantId
   * @param {string} [event.userId]
   * @param {string} event.action
   * @param {string} [event.resourceType]
   * @param {string} [event.resourceId]
   * @param {string} [event.status='SUCCESS']
   * @param {object} [event.metadata]
   * @param {object} [event.details]
   * @param {string} [event.ipAddress]
   * @returns {Promise<string>} Created audit log ID
   */
  async logEvent(event) {
    if (!event.tenantId) {
      throw new Error('TenantAuditLogger: tenantId is required');
    }
    if (!event.action) {
      throw new Error('TenantAuditLogger: action is required');
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const detailsObj = event.details || event.metadata || {};
    const detailsStr = JSON.stringify(detailsObj);
    const status = event.status || 'SUCCESS';

    if (this.engine === 'sqlite') {
      const stmt = this.db.prepare(`
        INSERT INTO tenant_audit_logs (
          id, tenant_id, user_id, action, resource_type, resource_id, status, ip_address, details, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        id,
        event.tenantId,
        event.userId || null,
        event.action,
        event.resourceType || 'system',
        event.resourceId || null,
        status,
        event.ipAddress || null,
        detailsStr,
        now
      );
    } else {
      // PostgreSQL
      const query = `
        INSERT INTO tenant_audit_logs (
          id, tenant_id, user_id, action, resource_type, resource_id, status, ip_address, details, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `;
      await this.db.query(query, [
        id,
        event.tenantId,
        event.userId || null,
        event.action,
        event.resourceType || 'system',
        event.resourceId || null,
        status,
        event.ipAddress || null,
        detailsStr,
        now
      ]);
    }

    return id;
  }

  /**
   * Queries audit logs strictly scoped to a specific tenant
   *
   * @param {string} tenantId
   * @param {object} [options]
   * @param {number} [options.limit=50]
   * @param {number} [options.offset=0]
   * @param {string} [options.action]
   * @param {string} [options.resourceType]
   * @returns {Promise<Array<object>>}
   */
  async getAuditLogs(tenantId, options = {}) {
    if (!tenantId) {
      throw new Error('TenantAuditLogger: tenantId is required for retrieval');
    }

    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 500);
    const offset = Math.max(Number(options.offset) || 0, 0);

    if (this.engine === 'sqlite') {
      let sql = 'SELECT * FROM tenant_audit_logs WHERE tenant_id = ?';
      const params = [tenantId];

      if (options.action) {
        sql += ' AND action = ?';
        params.push(options.action);
      }
      if (options.resourceType) {
        sql += ' AND resource_type = ?';
        params.push(options.resourceType);
      }

      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const rows = this.db.prepare(sql).all(...params);
      return rows.map((r) => {
        let details = {};
        try { details = JSON.parse(r.details || '{}'); } catch (_) {}
        return {
          id: r.id,
          tenantId: r.tenant_id,
          userId: r.user_id,
          action: r.action,
          resourceType: r.resource_type,
          resourceId: r.resource_id,
          status: r.status,
          details,
          metadata: details,
          ipAddress: r.ip_address,
          createdAt: r.created_at
        };
      });
    } else {
      // PostgreSQL
      let sql = 'SELECT * FROM tenant_audit_logs WHERE tenant_id = $1';
      const params = [tenantId];
      let pIdx = 2;

      if (options.action) {
        sql += ` AND action = $${pIdx++}`;
        params.push(options.action);
      }
      if (options.resourceType) {
        sql += ` AND resource_type = $${pIdx++}`;
        params.push(options.resourceType);
      }

      sql += ` ORDER BY created_at DESC LIMIT $${pIdx++} OFFSET $${pIdx++}`;
      params.push(limit, offset);

      const res = await this.db.query(sql, params);
      return (res.rows || []).map((r) => {
        let details = {};
        try { details = typeof r.details === 'string' ? JSON.parse(r.details) : (r.details || {}); } catch (_) {}
        return {
          id: r.id,
          tenantId: r.tenant_id,
          userId: r.user_id,
          action: r.action,
          resourceType: r.resource_type,
          resourceId: r.resource_id,
          status: r.status,
          details,
          metadata: details,
          ipAddress: r.ip_address,
          createdAt: r.created_at
        };
      });
    }
  }
}

module.exports = TenantAuditLogger;
