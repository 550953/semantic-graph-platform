import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = process.env.SQLITE_PATH || path.join(DATA_DIR, 'graph.db');

let _db;

export function getDb() {
  if (_db) return _db;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  _db.exec(schema);
  
  // soft migrations
  try { _db.exec("ALTER TABLE projects ADD COLUMN template_id TEXT"); } catch {}
  try { _db.exec("ALTER TABLE projects ADD COLUMN template_version INTEGER"); } catch {}
  
  // Graph level migrations
  try { _db.exec("CREATE TABLE IF NOT EXISTS graphs (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, description TEXT DEFAULT '', settings_json TEXT DEFAULT '{}', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (workspace_id) REFERENCES workspaces(id))"); } catch {}
  try { _db.exec("ALTER TABLE nodes ADD COLUMN graph_id TEXT REFERENCES graphs(id)"); } catch {}
  try { _db.exec("ALTER TABLE edges ADD COLUMN graph_id TEXT REFERENCES graphs(id)"); } catch {}
  try { _db.exec("ALTER TABLE actors ADD COLUMN graph_id TEXT REFERENCES graphs(id)"); } catch {}
  try { _db.exec("ALTER TABLE work_items ADD COLUMN graph_id TEXT REFERENCES graphs(id)"); } catch {}
  try { _db.exec("ALTER TABLE reviews ADD COLUMN graph_id TEXT REFERENCES graphs(id)"); } catch {}
  try { _db.exec("ALTER TABLE documents ADD COLUMN graph_id TEXT REFERENCES graphs(id)"); } catch {}
  try { _db.exec("ALTER TABLE chunks ADD COLUMN graph_id TEXT REFERENCES graphs(id)"); } catch {}
  try { _db.exec("ALTER TABLE ontology ADD COLUMN graph_id TEXT REFERENCES graphs(id)"); } catch {}
  try { _db.exec("ALTER TABLE role_bindings ADD COLUMN graph_id TEXT REFERENCES graphs(id)"); } catch {}
  try { _db.exec("ALTER TABLE questions ADD COLUMN graph_id TEXT REFERENCES graphs(id)"); } catch {}
  try { _db.exec("ALTER TABLE templates ADD COLUMN graph_id TEXT REFERENCES graphs(id)"); } catch {}
  
  return _db;
}

export function jparse(s, fallback = null) {
  try { return s ? JSON.parse(s) : fallback; } catch { return fallback; }
}
export function jstr(v) {
  return JSON.stringify(v ?? null);
}