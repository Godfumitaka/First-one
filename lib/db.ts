import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { schemaSql, ftsTriggersSql } from './schema';

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'app.db');

let db: Database.Database | null = null;

export function getDb() {
  if (db) return db;
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(schemaSql);
  db.exec(ftsTriggersSql);
  return db;
}

export function nowIso() {
  return new Date().toISOString();
}
