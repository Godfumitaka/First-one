'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Note = {
  id: number;
  title: string;
  body_md: string;
  project?: string | null;
  updated_at: string;
  concepts?: { name: string }[];
  related?: { title: string; weight: number }[];
};

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [query, setQuery] = useState('');
  const [project, setProject] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const loadNotes = async () => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (project) params.set('project', project);
    const res = await fetch(`/api/notes?${params.toString()}`);
    const data = await res.json();
    setNotes(data.notes ?? []);
  };

  useEffect(() => {
    loadNotes();
  }, []);

  const handleCreate = async () => {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body_md: body, project: project || null })
    });
    const data = await res.json();
    if (data.id) {
      setTitle('');
      setBody('');
      await loadNotes();
    }
  };

  return (
    <div className="grid two">
      <section className="card">
        <h2>ノート一覧</h2>
        <div className="flex">
          <input
            placeholder="検索 (Japanese / English)"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button onClick={loadNotes} className="secondary">
            検索
          </button>
        </div>
        <div className="flex" style={{ marginTop: 12 }}>
          <input
            placeholder="プロジェクト"
            value={project}
            onChange={(event) => setProject(event.target.value)}
          />
        </div>
        <div className="list" style={{ marginTop: 16 }}>
          {notes.map((note) => (
            <div key={note.id} className="panel">
              <Link href={`/notes/${note.id}`}>
                <strong>{note.title}</strong>
              </Link>
              {note.project && <span className="badge" style={{ marginLeft: 8 }}>{note.project}</span>}
              <div className="small">更新: {new Date(note.updated_at).toLocaleString()}</div>
              <div>
                {note.concepts?.map((concept) => (
                  <span key={concept.name} className="chip">
                    {concept.name}
                  </span>
                ))}
              </div>
              <div className="small">
                関連:{' '}
                {note.related?.map((edge) => `${edge.title} (${edge.weight.toFixed(2)})`).join(', ') ||
                  'なし'}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="card">
        <h2>新規ノート</h2>
        <label className="small">タイトル</label>
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
        <label className="small" style={{ marginTop: 8 }}>本文 (Markdown)</label>
        <textarea
          rows={10}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        <label className="small" style={{ marginTop: 8 }}>プロジェクト</label>
        <input value={project} onChange={(event) => setProject(event.target.value)} />
        <button style={{ marginTop: 12 }} onClick={handleCreate}>
          追加
        </button>
      </section>
    </div>
  );
}
