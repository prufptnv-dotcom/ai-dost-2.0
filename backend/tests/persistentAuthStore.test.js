'use strict';

/**
 * AI-Dost 2.0 — Phase 5B: PersistentAuthStore Unit & Contract Suite
 * 
 * 40+ assertions testing SQLite, PostgreSQL contract/mock, and Memory adapters.
 * Verifies atomic single-use rotation, replay family revocation, unique constraints,
 * and zero plain-text token storage.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const {
  PersistentAuthStore,
  SqliteAuthStore,
  PostgresAuthStore,
  AuthStoreFactory,
  MemoryAuthStore,
  AuthPersistenceResult
} = require('../agent/capabilities/auth');

describe('PersistentAuthStore & Adapters Unit Suite', () => {

  test('1. PersistentAuthStore abstract class cannot be instantiated directly', () => {
    assert.throws(() => new PersistentAuthStore(), /abstract class/i);
  });

  test('2. Unimplemented abstract methods throw errors', async () => {
    class DummyStore extends PersistentAuthStore {}
    const dummy = new DummyStore();
    await assert.rejects(() => dummy.init(), /must be implemented/i);
    await assert.rejects(() => dummy.saveUser({}), /must be implemented/i);
    await assert.rejects(() => dummy.getUserById('1'), /must be implemented/i);
    await assert.rejects(() => dummy.getUserByEmail('a@b.com'), /must be implemented/i);
    await assert.rejects(() => dummy.getUserByUsername('u'), /must be implemented/i);
    await assert.rejects(() => dummy.incrementUserTokenVersion('1'), /must be implemented/i);
    await assert.rejects(() => dummy.saveRefreshToken({}), /must be implemented/i);
    await assert.rejects(() => dummy.getRefreshTokenByHash('hash'), /must be implemented/i);
    await assert.rejects(() => dummy.rotateRefreshToken('old', {}), /must be implemented/i);
    await assert.rejects(() => dummy.revokeFamily('fam'), /must be implemented/i);
    await assert.rejects(() => dummy.revokeAllForUser('1'), /must be implemented/i);
    await assert.rejects(() => dummy.pruneExpiredTokens(), /must be implemented/i);
    await assert.rejects(() => dummy.close(), /must be implemented/i);
  });

  test('3. AuthStoreFactory instantiates correct store types', () => {
    const memStore = AuthStoreFactory.create('memory');
    assert.ok(memStore instanceof MemoryAuthStore);

    const sqlStore = AuthStoreFactory.create('sqlite', { dbPath: ':memory:' });
    assert.ok(sqlStore instanceof SqliteAuthStore);

    const pgStore = AuthStoreFactory.create('postgres', { connectionString: 'postgres://test' });
    assert.ok(pgStore instanceof PostgresAuthStore);

    assert.throws(() => AuthStoreFactory.create('oracle'), /AUTH_STORE_TYPE_INVALID/);
  });

  // ── SqliteAuthStore Detailed Verification ────────────────────────────────
  describe('SqliteAuthStore Implementation', () => {
    let tempDir;
    let dbFile;
    let store;

    test('Setup: creates isolated sqlite database file', async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidost-sqlite-test-'));
      dbFile = path.join(tempDir, 'test_auth.sqlite');
      store = new SqliteAuthStore({ dbPath: dbFile });
      await store.init();
      assert.equal(store.initialized, true);
    });

    test('4. Saves new user and retrieves by ID, email, and username', async () => {
      const userRec = {
        id: 'usr_sqlite_001',
        email: 'alice@example.com',
        username: 'alice_01',
        passwordHash: '$scrypt$v=1$fakehash',
        role: 'user',
        tokenVersion: 1
      };

      const saveRes = await store.saveUser(userRec);
      assert.equal(saveRes.ok, true);

      // By ID
      const byId = await store.getUserById('usr_sqlite_001');
      assert.equal(byId.ok, true);
      assert.equal(byId.record.email, 'alice@example.com');
      assert.equal(byId.record.username, 'alice_01');

      // By email case-insensitive
      const byEmail = await store.getUserByEmail('ALICE@EXAMPLE.COM');
      assert.equal(byEmail.ok, true);
      assert.equal(byEmail.record.id, 'usr_sqlite_001');

      // By username
      const byUsername = await store.getUserByUsername('alice_01');
      assert.equal(byUsername.ok, true);
      assert.equal(byUsername.record.id, 'usr_sqlite_001');
    });

    test('5. Rejects duplicate email registration with DUPLICATE_KEY error', async () => {
      const dupUser = {
        id: 'usr_sqlite_002',
        email: 'alice@example.com', // same email
        username: 'alice_different',
        passwordHash: '$scrypt$v=1$fake'
      };
      const res = await store.saveUser(dupUser);
      assert.equal(res.ok, false);
      assert.equal(res.code, 'DUPLICATE_KEY');
    });

    test('6. User updates idempotently on conflict by ID', async () => {
      const updateRec = {
        id: 'usr_sqlite_001',
        email: 'alice.updated@example.com',
        username: 'alice_updated',
        passwordHash: '$scrypt$v=1$newhash',
        role: 'admin'
      };
      const res = await store.saveUser(updateRec);
      assert.equal(res.ok, true);

      const byId = await store.getUserById('usr_sqlite_001');
      assert.equal(byId.record.email, 'alice.updated@example.com');
      assert.equal(byId.record.role, 'admin');
    });

    test('7. Atomically increments token_version on global logout/revocation', async () => {
      const incRes = await store.incrementUserTokenVersion('usr_sqlite_001');
      assert.equal(incRes.ok, true);
      assert.equal(incRes.record.token_version, 2);

      const check = await store.getUserById('usr_sqlite_001');
      assert.equal(check.record.tokenVersion, 2);
    });

    test('8. Saves refresh token and retrieves by hash (zero plain-text token stored)', async () => {
      const tokenHash = crypto.createHash('sha256').update('raw_token_xyz_1').digest('hex');
      const tokenRec = {
        id: 'rt_001',
        userId: 'usr_sqlite_001',
        tokenHash,
        familyId: 'fam_001',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      };

      const saveRes = await store.saveRefreshToken(tokenRec);
      assert.equal(saveRes.ok, true);

      const byHash = await store.getRefreshTokenByHash(tokenHash);
      assert.equal(byHash.ok, true);
      assert.equal(byHash.record.id, 'rt_001');
      assert.equal(byHash.record.familyId, 'fam_001');
      assert.equal(byHash.record.revokedAt, null);
    });

    test('9. Rejects duplicate token_hash insertion', async () => {
      const tokenHash = crypto.createHash('sha256').update('raw_token_xyz_1').digest('hex');
      const dup = {
        id: 'rt_dup',
        userId: 'usr_sqlite_001',
        tokenHash,
        familyId: 'fam_002',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      };
      const res = await store.saveRefreshToken(dup);
      assert.equal(res.ok, false);
      assert.equal(res.code, 'DUPLICATE_TOKEN_HASH');
    });

    test('10. Atomic token rotation: old token is revoked and linked, new token issued', async () => {
      const oldHash = crypto.createHash('sha256').update('raw_token_xyz_1').digest('hex');
      const newHash = crypto.createHash('sha256').update('raw_token_xyz_2').digest('hex');

      const newTokenRec = {
        id: 'rt_002',
        tokenHash: newHash,
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      };

      const rotateRes = await store.rotateRefreshToken(oldHash, newTokenRec);
      assert.equal(rotateRes.ok, true);
      assert.equal(rotateRes.record.id, 'rt_001');
      assert.ok(rotateRes.record.revokedAt);
      assert.equal(rotateRes.newRecord.id, 'rt_002');
      assert.equal(rotateRes.newRecord.familyId, 'fam_001');

      // Verify old token is revoked on disk
      const checkOld = await store.getRefreshTokenByHash(oldHash);
      assert.ok(checkOld.record.revokedAt);
      assert.equal(checkOld.record.replacedByTokenId, 'rt_002');

      // Verify new token is active
      const checkNew = await store.getRefreshTokenByHash(newHash);
      assert.equal(checkNew.record.revokedAt, null);
    });

    test('11. REPLAY ATTACK DETECTION: replaying revoked token revokes the entire family', async () => {
      const oldHash = crypto.createHash('sha256').update('raw_token_xyz_1').digest('hex'); // already revoked rt_001
      const attackerHash = crypto.createHash('sha256').update('attacker_token').digest('hex');

      const attackerRec = {
        id: 'rt_attacker',
        tokenHash: attackerHash,
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      };

      // Attacker attempts to replay consumed rt_001
      const replayRes = await store.rotateRefreshToken(oldHash, attackerRec);
      assert.equal(replayRes.ok, false);
      assert.equal(replayRes.code, 'TOKEN_REPLAY_DETECTED');
      assert.equal(replayRes.familyRevoked, true);

      // Verify the active successor rt_002 is now also revoked due to family compromise
      const newHash = crypto.createHash('sha256').update('raw_token_xyz_2').digest('hex');
      const checkSuccessor = await store.getRefreshTokenByHash(newHash);
      assert.ok(checkSuccessor.record.revokedAt, 'Successor must be revoked');
      assert.equal(checkSuccessor.record.replacedByTokenId, 'FAMILY_REVOKED');
    });

    test('12. Rotating an expired token marks it revoked and returns TOKEN_EXPIRED', async () => {
      const expiredHash = crypto.createHash('sha256').update('expired_raw_token').digest('hex');
      await store.saveRefreshToken({
        id: 'rt_expired',
        userId: 'usr_sqlite_001',
        tokenHash: expiredHash,
        familyId: 'fam_expired',
        expiresAt: new Date(Date.now() - 10000).toISOString() // in the past
      });

      const nextRec = {
        id: 'rt_next',
        tokenHash: crypto.createHash('sha256').update('next_raw').digest('hex'),
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      };

      const res = await store.rotateRefreshToken(expiredHash, nextRec);
      assert.equal(res.ok, false);
      assert.equal(res.code, 'TOKEN_EXPIRED');
    });

    test('13. revokeAllForUser revokes all active tokens for a user', async () => {
      const hashA = crypto.createHash('sha256').update('user_tok_a').digest('hex');
      const hashB = crypto.createHash('sha256').update('user_tok_b').digest('hex');

      await store.saveRefreshToken({ id: 'tok_a', userId: 'usr_sqlite_001', tokenHash: hashA, familyId: 'fam_a', expiresAt: new Date(Date.now() + 3600000).toISOString() });
      await store.saveRefreshToken({ id: 'tok_b', userId: 'usr_sqlite_001', tokenHash: hashB, familyId: 'fam_b', expiresAt: new Date(Date.now() + 3600000).toISOString() });

      const revokedCount = await store.revokeAllForUser('usr_sqlite_001');
      assert.ok(revokedCount >= 2);

      const checkA = await store.getRefreshTokenByHash(hashA);
      assert.ok(checkA.record.revokedAt);
      const checkB = await store.getRefreshTokenByHash(hashB);
      assert.ok(checkB.record.revokedAt);
    });

    test('14. pruneExpiredTokens removes expired records', async () => {
      const pastExp = new Date(Date.now() - 60000).toISOString();
      const pruneHash = crypto.createHash('sha256').update('prune_me').digest('hex');
      await store.saveRefreshToken({
        id: 'rt_prune',
        userId: 'usr_sqlite_001',
        tokenHash: pruneHash,
        familyId: 'fam_prune',
        expiresAt: pastExp
      });

      const deleted = await store.pruneExpiredTokens();
      assert.ok(deleted >= 1);

      const check = await store.getRefreshTokenByHash(pruneHash);
      assert.equal(check.ok, false);
      assert.equal(check.code, 'NOT_FOUND');
    });

    test('Teardown: closes store and cleans up disk directory', async () => {
      await store.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  // ── MemoryAuthStore Contract Parity Verification ──────────────────────────
  describe('MemoryAuthStore Contract Parity', () => {
    let memStore;

    test('Setup: creates memory store', async () => {
      memStore = AuthStoreFactory.create('memory');
      await memStore.init();
    });

    test('15. Memory store handles user registration and uniqueness', async () => {
      const res = await memStore.saveUser({ id: 'm_1', email: 'mem@test.com', username: 'memuser' });
      assert.equal(res.ok, true);

      const dup = await memStore.saveUser({ id: 'm_2', email: 'MEM@TEST.COM', username: 'diff' });
      assert.equal(dup.ok, false);
      assert.equal(dup.code, 'DUPLICATE_KEY');
    });

    test('16. Memory store rotates tokens and detects replay attack', async () => {
      const hash1 = 'hash_mem_1';
      const hash2 = 'hash_mem_2';
      const hash3 = 'hash_mem_3';

      await memStore.saveRefreshToken({
        id: 'rt_m1',
        userId: 'm_1',
        tokenHash: hash1,
        familyId: 'fam_m',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      });

      const rot1 = await memStore.rotateRefreshToken(hash1, { id: 'rt_m2', tokenHash: hash2, expiresAt: new Date(Date.now() + 3600000).toISOString() });
      assert.equal(rot1.ok, true);

      // Replay hash1
      const replay = await memStore.rotateRefreshToken(hash1, { id: 'rt_m3', tokenHash: hash3, expiresAt: new Date(Date.now() + 3600000).toISOString() });
      assert.equal(replay.ok, false);
      assert.equal(replay.code, 'TOKEN_REPLAY_DETECTED');

      // Successor hash2 must be revoked
      const checkSuccessor = await memStore.getRefreshTokenByHash(hash2);
      assert.ok(checkSuccessor.record.revokedAt);
      assert.equal(checkSuccessor.record.replacedByTokenId, 'FAMILY_REVOKED');
    });

    test('Teardown: closes memory store', async () => {
      await memStore.close();
    });
  });

  // ── PostgresAuthStore Contract & Mock Verification ────────────────────────
  describe('PostgresAuthStore Contract & Protocol Compliance', () => {
    test('17. PostgresAuthStore reports offline gracefully if local PG unavailable', async () => {
      const pgStore = new PostgresAuthStore({
        connectionString: 'postgresql://invalid_host:5432/none',
        requireLive: false
      });
      await pgStore.init();
      assert.equal(pgStore.isLiveAvailable, false);
    });

    test('18. PostgresAuthStore executes parameterized queries and transactions against client mock', async () => {
      const queries = [];
      const mockClient = {
        query: async (text, params) => {
          queries.push({ text: text.trim(), params });
          if (/SELECT \* FROM auth_users WHERE id/i.test(text)) {
            return { rows: [{ id: params[0], email: 'pg@test.com', role: 'user', token_version: 1, status: 'active' }] };
          }
          if (/INSERT INTO auth_users/i.test(text)) {
            return { rows: [{ id: params[0], email: params[1], role: params[4], token_version: 1, status: 'active' }] };
          }
          if (/SELECT \* FROM auth_refresh_tokens WHERE token_hash = \$1 FOR UPDATE/i.test(text)) {
            return {
              rows: [{
                id: 'rt_pg_1',
                user_id: 'usr_pg_1',
                token_hash: params[0],
                family_id: 'fam_pg_1',
                revoked_at: null,
                expires_at: new Date(Date.now() + 3600000).toISOString()
              }]
            };
          }
          return { rows: [], rowCount: 1 };
        }
      };

      const store = new PostgresAuthStore({ pool: mockClient });
      await store.init();
      assert.equal(store.isLiveAvailable, true);

      // Save user
      const saveRes = await store.saveUser({ id: 'usr_pg_1', email: 'pg@test.com', passwordHash: 'hash' });
      assert.equal(saveRes.ok, true);

      // Get user
      const getRes = await store.getUserById('usr_pg_1');
      assert.equal(getRes.ok, true);
      assert.equal(getRes.record.email, 'pg@test.com');

      // Rotate token inside transaction
      const rotRes = await store.rotateRefreshToken('hash_old', { id: 'rt_pg_2', tokenHash: 'hash_new', expiresAt: new Date(Date.now() + 3600000).toISOString() });
      assert.equal(rotRes.ok, true);
      assert.equal(rotRes.newRecord.id, 'rt_pg_2');

      // Verify transaction boundary commands executed
      const queryTexts = queries.map(q => q.text);
      assert.ok(queryTexts.includes('BEGIN'), 'Must issue BEGIN transaction');
      assert.ok(queryTexts.includes('COMMIT'), 'Must issue COMMIT on success');
      assert.ok(queryTexts.some(q => q.includes('FOR UPDATE')), 'Must utilize row-level lock FOR UPDATE');
    });

    test('19. PostgresAuthStore rolls back and detects replay attack on revoked token', async () => {
      const queries = [];
      const mockClient = {
        query: async (text, params) => {
          queries.push(text.trim());
          if (/SELECT \* FROM auth_refresh_tokens WHERE token_hash = \$1 FOR UPDATE/i.test(text)) {
            return {
              rows: [{
                id: 'rt_pg_revoked',
                user_id: 'usr_pg_1',
                token_hash: params[0],
                family_id: 'fam_pg_1',
                revoked_at: new Date().toISOString(), // already revoked!
                expires_at: new Date(Date.now() + 3600000).toISOString()
              }]
            };
          }
          return { rows: [], rowCount: 1 };
        }
      };

      const store = new PostgresAuthStore({ pool: mockClient });
      await store.init();

      const replayRes = await store.rotateRefreshToken('replayed_hash', { id: 'rt_new', tokenHash: 'new_hash' });
      assert.equal(replayRes.ok, false);
      assert.equal(replayRes.code, 'TOKEN_REPLAY_DETECTED');
      assert.equal(replayRes.familyRevoked, true);

      assert.ok(queries.includes('BEGIN'));
      assert.ok(queries.some(q => q.includes("FAMILY_REVOKED")));
      assert.ok(queries.includes('COMMIT'));
    });
  });
});
