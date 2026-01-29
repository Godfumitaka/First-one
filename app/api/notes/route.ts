import { NextResponse } from 'next/server';
import { getDb, nowIso } from '@/lib/db';
import { enqueueAnalysis } from '@/lib/queue';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const project = searchParams.get('project');
  const db = getDb();

  let rows;
  if (q) {
    rows = db
      .prepare(
        `SELECT notes.*
         FROM notes_fts
         JOIN notes ON notes.id = notes_fts.rowid
         WHERE notes_fts MATCH ?
         ORDER BY rank`
      )
      .all(q);
  } else if (project) {
    rows = db.prepare('SELECT * FROM notes WHERE project = ? ORDER BY updated_at DESC').all(project);
  } else {
    rows = db.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all();
  }

  const conceptStmt = db.prepare(
    `SELECT concepts.canonical_name as name\n     FROM note_concepts\n     JOIN concepts ON concepts.id = note_concepts.concept_id\n     WHERE note_concepts.note_id = ?\n     ORDER BY note_concepts.score DESC\n     LIMIT 5`
  );
  const relatedStmt = db.prepare(
    `SELECT notes.title as title, edges.weight as weight\n     FROM edges\n     JOIN notes ON notes.id = CASE WHEN edges.note_a = ? THEN edges.note_b ELSE edges.note_a END\n     WHERE (edges.note_a = ? OR edges.note_b = ?) AND edges.blocked = 0\n     ORDER BY edges.weight DESC\n     LIMIT 3`
  );

  const notes = rows.map((note: { id: number }) => ({
    ...note,
    concepts: conceptStmt.all(note.id),
    related: relatedStmt.all(note.id, note.id, note.id)
  }));

  return NextResponse.json({ notes });
}

export async function POST(request: Request) {
  const body = await request.json();
  const now = nowIso();
  const db = getDb();
  const info = db
    .prepare(
      'INSERT INTO notes (title, body_md, project, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    )
    .run(body.title, body.body_md, body.project ?? null, now, now);

  const id = info.lastInsertRowid as number;
  enqueueAnalysis(id);

  return NextResponse.json({ id });
}
