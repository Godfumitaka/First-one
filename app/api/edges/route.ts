import { NextResponse } from 'next/server';
import { blockEdge } from '@/lib/analysis';

export async function POST(request: Request) {
  const body = await request.json();
  if (body.action === 'block') {
    blockEdge(body.noteA, body.noteB);
  }
  return NextResponse.json({ ok: true });
}
