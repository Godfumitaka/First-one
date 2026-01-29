import { NextResponse } from 'next/server';
import { getDb, nowIso } from '@/lib/db';
import { enqueueAnalysis } from '@/lib/queue';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const db = getDb();
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(params.id);
  const concepts = db
    .prepare(
      `SELECT concepts.id, concepts.canonical_name, note_concepts.score
       FROM note_concepts
       JOIN concepts ON concepts.id = note_concepts.concept_id
       WHERE note_concepts.note_id = ?
       ORDER BY note_concepts.score DESC`
    )
    .all(params.id);
  const related = db
    .prepare(
      `SELECT edges.*, notes.title
       FROM edges
       JOIN notes ON (notes.id = CASE WHEN edges.note_a = ? THEN edges.note_b ELSE edges.note_a END)
       WHERE (edges.note_a = ? OR edges.note_b = ?) AND edges.blocked = 0
       ORDER BY edges.weight DESC
       LIMIT 10`
    )
    .all(params.id, params.id, params.id);

  return NextResponse.json({ note, concepts, related });
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();
  const db = getDb();
  db.prepare('UPDATE notes SET title = ?, body_md = ?, project = ?, updated_at = ? WHERE id = ?').run(
    body.title,
    body.body_md,
    body.project ?? null,
    nowIso(),
    params.id
  );

  enqueueAnalysis(Number(params.id));

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const db = getDb();
  db.prepare('DELETE FROM notes WHERE id = ?').run(params.id);
  db.prepare('DELETE FROM note_concepts WHERE note_id = ?').run(params.id);
  db.prepare('DELETE FROM note_vectors WHERE note_id = ?').run(params.id);
  db.prepare('DELETE FROM edges WHERE note_a = ? OR note_b = ?').run(params.id, params.id);

  return NextResponse.json({ ok: true });
}
