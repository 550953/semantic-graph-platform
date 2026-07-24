/**
 * File-based persistent DB (JSON). Portable, no native modules.
 * Multi-tenant via workspaceId on every entity.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const defaultDb = () => ({
  users: [],
  workspaces: [],
  portfolios: [],
  projects: [],
  nodes: [],
  edges: [],
  actors: [],
  workItems: [],
  reviews: [],
  sprints: [],
  pipes: [],
  documents: [],
  chunks: [],
  questions: [],
  ontology: null,
  fsmStates: {}
});

export function loadDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const db = defaultDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    return db;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

export function saveDb(db) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export function withDb(fn) {
  const db = loadDb();
  const result = fn(db);
  saveDb(db);
  return result;
}
