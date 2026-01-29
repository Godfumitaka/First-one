import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const project = searchParams.get('project');
  const minWeight = Number(searchParams.get('minWeight') ?? 0);
  const db = getDb();

  let nodes;
  if (project) {
    nodes = db.prepare('SELECT id, title, project, updated_at FROM notes WHERE project = ?').all(project);
  } else {
    nodes = db.prepare('SELECT id, title, project, updated_at FROM notes').all();
  }

  const edges = db
    .prepare('SELECT * FROM edges WHERE blocked = 0 AND weight >= ? ORDER BY weight DESC')
    .all(minWeight);

  return NextResponse.json({ nodes, edges });
}
