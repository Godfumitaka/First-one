'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Concept = { id: number; canonical_name: string; score: number };

type RelatedEdge = {
  id: number;
  note_a: number;
  note_b: number;
  weight: number;
  title: string;
  explanation_json: string;
};

export default function NoteEditor({ params }: { params: { id: string } }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [project, setProject] = useState('');
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [related, setRelated] = useState<RelatedEdge[]>([]);
  const [mergePrimary, setMergePrimary] = useState('');
  const [mergeSecondary, setMergeSecondary] = useState('');
  const [aliasConceptId, setAliasConceptId] = useState('');
  const [aliasText, setAliasText] = useState('');

  const loadNote = async () => {
    const res = await fetch(`/api/notes/${params.id}`);
    const data = await res.json();
    setTitle(data.note?.title ?? '');
    setBody(data.note?.body_md ?? '');
    setProject(data.note?.project ?? '');
    setConcepts(data.concepts ?? []);
    setRelated(data.related ?? []);
  };

  useEffect(() => {
    loadNote();
  }, []);

  const handleSave = async () => {
    await fetch(`/api/notes/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body_md: body, project: project || null })
    });
    await loadNote();
  };

  const handleMerge = async () => {
    await fetch('/api/concepts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'merge', primaryId: Number(mergePrimary), secondaryId: Number(mergeSecondary) })
    });
    await loadNote();
  };

  const handleAlias = async () => {
    await fetch('/api/concepts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'alias', conceptId: Number(aliasConceptId), aliasText })
    });
    setAliasText('');
    await loadNote();
  };

  const handleBlockEdge = async (edge: RelatedEdge) => {
    const otherId = edge.note_a === Number(params.id) ? edge.note_b : edge.note_a;
    await fetch('/api/edges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'block', noteA: Number(params.id), noteB: otherId })
    });
    await loadNote();
  };

  return (
    <div className="grid two">
      <section className="card">
        <div className="flex" style={{ justifyContent: 'space-between' }}>
          <h2>ノート編集</h2>
          <Link href="/">一覧へ戻る</Link>
        </div>
        <label className="small">タイトル</label>
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
        <label className="small" style={{ marginTop: 8 }}>本文 (Markdown)</label>
        <textarea rows={14} value={body} onChange={(event) => setBody(event.target.value)} />
        <label className="small" style={{ marginTop: 8 }}>プロジェクト</label>
        <input value={project} onChange={(event) => setProject(event.target.value)} />
        <button style={{ marginTop: 12 }} onClick={handleSave}>
          保存 & 解析
        </button>
      </section>
      <aside className="sidebar">
        <section className="card">
          <h3>抽出概念</h3>
          {concepts.map((concept) => (
            <div key={concept.id} className="small">
              {concept.canonical_name} (score {concept.score.toFixed(1)})
            </div>
          ))}
        </section>
        <section className="card">
          <h3>関連ノート</h3>
          {related.map((edge) => (
            <div key={edge.id} className="panel">
              <div className="flex" style={{ justifyContent: 'space-between' }}>
                <div>
                  <strong>{edge.title}</strong>
                  <div className="small">weight {edge.weight.toFixed(2)}</div>
                </div>
                <button className="danger" onClick={() => handleBlockEdge(edge)}>
                  削除
                </button>
              </div>
              <div className="small">{JSON.parse(edge.explanation_json).sharedConcepts?.map((c: { name: string }) => c.name).join(', ')}</div>
            </div>
          ))}
        </section>
        <section className="card">
          <h3>フィードバック</h3>
          <div className="small">概念マージ</div>
          <div className="flex">
            <input placeholder="主ID" value={mergePrimary} onChange={(event) => setMergePrimary(event.target.value)} />
            <input placeholder="副ID" value={mergeSecondary} onChange={(event) => setMergeSecondary(event.target.value)} />
          </div>
          <button className="secondary" onClick={handleMerge} style={{ marginTop: 8 }}>
            マージ
          </button>
          <div className="small" style={{ marginTop: 12 }}>シノニム追加</div>
          <input placeholder="概念ID" value={aliasConceptId} onChange={(event) => setAliasConceptId(event.target.value)} />
          <input
            placeholder="エイリアス (例: complex systems)"
            value={aliasText}
            onChange={(event) => setAliasText(event.target.value)}
          />
          <button className="secondary" onClick={handleAlias} style={{ marginTop: 8 }}>
            追加
          </button>
        </section>
      </aside>
    </div>
  );
}
