'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

type Node = { id: number; title: string; project?: string | null };

type Edge = {
  id: number;
  note_a: number;
  note_b: number;
  weight: number;
  explanation_json: string;
};

export default function GraphPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [project, setProject] = useState('');
  const [minWeight, setMinWeight] = useState(0.2);
  const [selected, setSelected] = useState<Edge | null>(null);

  const loadGraph = async () => {
    const params = new URLSearchParams();
    if (project) params.set('project', project);
    params.set('minWeight', String(minWeight));
    const res = await fetch(`/api/graph?${params.toString()}`);
    const data = await res.json();
    setNodes(data.nodes ?? []);
    setEdges(data.edges ?? []);
  };

  useEffect(() => {
    loadGraph();
  }, []);

  const graphData = useMemo(
    () => ({
      nodes: nodes.map((node) => ({ ...node })),
      links: edges.map((edge) => ({
        source: edge.note_a,
        target: edge.note_b,
        weight: edge.weight,
        id: edge.id
      }))
    }),
    [nodes, edges]
  );

  return (
    <div className="grid two">
      <section className="card">
        <h2>グラフ概要</h2>
        <div className="flex">
          <input
            placeholder="プロジェクトで絞り込み"
            value={project}
            onChange={(event) => setProject(event.target.value)}
          />
          <input
            type="number"
            step="0.05"
            value={minWeight}
            onChange={(event) => setMinWeight(Number(event.target.value))}
          />
          <button className="secondary" onClick={loadGraph}>
            更新
          </button>
        </div>
        <div style={{ height: 520, marginTop: 16 }}>
          <ForceGraph2D
            graphData={graphData}
            linkWidth={(link: { weight: number }) => Math.max(1, link.weight * 6)}
            nodeAutoColorBy="project"
            nodeLabel={(node: Node) => node.title}
            onLinkClick={(link: { id: number }) => {
              const edge = edges.find((item) => item.id === link.id) ?? null;
              setSelected(edge);
            }}
          />
        </div>
      </section>
      <section className="card">
        <h3>エッジ説明</h3>
        {!selected && <div className="small">エッジをクリックすると説明が表示されます。</div>}
        {selected && (
          <div className="panel">
            {(() => {
              const explanation = JSON.parse(selected.explanation_json);
              return (
                <div>
                  <div className="small">共有概念</div>
                  <ul>
                    {explanation.sharedConcepts?.map((item: { name: string; score: number }) => (
                      <li key={item.name}>{item.name} (score {item.score.toFixed(2)})</li>
                    ))}
                  </ul>
                  <div className="small">類似抜粋</div>
                  <ul>
                    {explanation.excerpts?.map((excerpt: string, idx: number) => (
                      <li key={idx}>{excerpt}</li>
                    ))}
                  </ul>
                  <div className="small">重み内訳</div>
                  <ul>
                    <li>semantic: {explanation.weightBreakdown.semantic.toFixed(3)}</li>
                    <li>overlap: {explanation.weightBreakdown.overlap.toFixed(3)}</li>
                    <li>recency: {explanation.weightBreakdown.recency.toFixed(3)}</li>
                    <li>{explanation.weightBreakdown.formula}</li>
                  </ul>
                </div>
              );
            })()}
          </div>
        )}
      </section>
    </div>
  );
}
