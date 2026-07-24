/**
 * PostgreSQL pool singleton with optional Infisical secret loading.
 * Replaces better-sqlite3. DATABASE_URL is loaded from env or Infisical.
 */
import pg from 'pg';
const { Pool } = pg;

let _pool = null;

async function loadInfisicalSecrets() {
  if (process.env.DATABASE_URL) return;
  const { INFISICAL_CLIENT_ID, INFISICAL_CLIENT_SECRET } = process.env;
  if (!INFISICAL_CLIENT_ID || !INFISICAL_CLIENT_SECRET) return;
  try {
    const tokenRes = await fetch('https://app.infisical.com/api/v1/auth/universal-auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: INFISICAL_CLIENT_ID, clientSecret: INFISICAL_CLIENT_SECRET })
    });
    const { accessToken } = await tokenRes.json();
    const projectId = process.env.INFISICAL_PROJECT_ID || '555e71be-4c53-4b3e-9409-0d9838aea8b6';
    const environment = process.env.INFISICAL_ENVIRONMENT || 'dev';
    const secretsRes = await fetch(
      `https://app.infisical.com/api/v3/secrets/raw?workspaceId=${projectId}&environment=${environment}&secretPath=%2F`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const { secrets } = await secretsRes.json();
    for (const s of secrets || []) {
      if (s.secretKey === 'SUPABASE_CP_amelitacoffey4d162_semantic-graph-platform') {
        process.env.DATABASE_URL = s.secretValue;
        console.log('DATABASE_URL loaded from Infisical');
      }
    }
  } catch (e) {
    console.error('Infisical load failed:', e.message);
  }
}

export async function initPool() {
  await loadInfisicalSecrets();
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Provide it via env or Infisical.');
  }
  _pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  // Test connection
  await _pool.query('SELECT 1');
  console.log('PostgreSQL pool connected');
  return _pool;
}

export function getPool() {
  if (!_pool) throw new Error('Pool not initialized. Call initPool() first.');
  return _pool;
}

/** Convert SQLite ? placeholders to PostgreSQL $N */
function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export async function queryAll(sql, params = []) {
  const res = await getPool().query(toPg(sql), params);
  return res.rows;
}

export async function queryOne(sql, params = []) {
  const res = await getPool().query(toPg(sql), params);
  return res.rows[0] || null;
}

export async function queryRun(sql, params = []) {
  await getPool().query(toPg(sql), params);
}

export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn({
      queryAll: async (sql, params = []) => (await client.query(toPg(sql), params)).rows,
      queryOne: async (sql, params = []) => (await client.query(toPg(sql), params)).rows[0] || null,
      queryRun: async (sql, params = []) => { await client.query(toPg(sql), params); },
    });
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
