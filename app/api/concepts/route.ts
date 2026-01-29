import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { addAlias, mergeConcepts } from '@/lib/analysis';

export async function GET() {
  const db = getDb();
  const concepts = db.prepare('SELECT * FROM concepts ORDER BY updated_at DESC').all();
  const aliases = db
    .prepare('SELECT concept_id, alias_text FROM concept_aliases ORDER BY alias_text ASC')
    .all();
  return NextResponse.json({ concepts, aliases });
}

export async function POST(request: Request) {
  const body = await request.json();
  if (body.action === 'merge') {
    mergeConcepts(body.primaryId, body.secondaryId);
  }
  if (body.action === 'alias') {
    addAlias(body.conceptId, body.aliasText);
  }
  return NextResponse.json({ ok: true });
}
