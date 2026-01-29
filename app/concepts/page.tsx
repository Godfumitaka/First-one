'use client';

import { useEffect, useState } from 'react';

type Concept = { id: number; canonical_name: string };

type Alias = { concept_id: number; alias_text: string };

export default function ConceptsPage() {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [primaryId, setPrimaryId] = useState('');
  const [secondaryId, setSecondaryId] = useState('');
  const [aliasId, setAliasId] = useState('');
  const [aliasText, setAliasText] = useState('');

  const load = async () => {
    const res = await fetch('/api/concepts');
    const data = await res.json();
    setConcepts(data.concepts ?? []);
    setAliases(data.aliases ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const handleMerge = async () => {
    await fetch('/api/concepts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'merge', primaryId: Number(primaryId), secondaryId: Number(secondaryId) })
    });
    await load();
  };

  const handleAlias = async () => {
    await fetch('/api/concepts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'alias', conceptId: Number(aliasId), aliasText })
    });
    setAliasText('');
    await load();
  };

  return (
    <div className="grid two">
      <section className="card">
        <h2>概念一覧</h2>
        <div className="list">
          {concepts.map((concept) => (
            <div key={concept.id} className="panel">
              <strong>#{concept.id}</strong> {concept.canonical_name}
              <div className="small">
                {aliases
                  .filter((alias) => alias.concept_id === concept.id)
                  .map((alias) => alias.alias_text)
                  .join(', ') || 'aliasなし'}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="card">
        <h2>操作</h2>
        <div className="small">概念マージ</div>
        <div className="flex">
          <input placeholder="主ID" value={primaryId} onChange={(event) => setPrimaryId(event.target.value)} />
          <input
            placeholder="副ID"
            value={secondaryId}
            onChange={(event) => setSecondaryId(event.target.value)}
          />
        </div>
        <button className="secondary" onClick={handleMerge} style={{ marginTop: 8 }}>
          マージ
        </button>
        <div className="small" style={{ marginTop: 16 }}>シノニム追加</div>
        <input placeholder="概念ID" value={aliasId} onChange={(event) => setAliasId(event.target.value)} />
        <input placeholder="エイリアス" value={aliasText} onChange={(event) => setAliasText(event.target.value)} />
        <button className="secondary" onClick={handleAlias} style={{ marginTop: 8 }}>
          追加
        </button>
      </section>
    </div>
  );
}
