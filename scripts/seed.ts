import { getDb, nowIso } from '../lib/db';
import { enqueueAnalysis } from '../lib/queue';

const seedNotes = [
  {
    title: '複雑系と自己組織化',
    body: '複雑系では局所的な相互作用から全体の秩序が生まれる。自己組織化のメカニズムを探る。',
    project: 'systems'
  },
  {
    title: '都市のレジリエンス',
    body: '都市システムのレジリエンスを高めるために、ネットワーク構造と冗長性を考察する。',
    project: 'systems'
  },
  {
    title: '学習と記憶',
    body: '人間の記憶は反復と意味づけで強化される。メタ認知が重要。',
    project: 'cognition'
  },
  {
    title: '言語モデルと創造性',
    body: 'LLMは生成的な創造性を支援するが、評価指標や倫理の議論が必要。',
    project: 'ai'
  },
  {
    title: '経済の循環',
    body: 'サプライチェーンの循環性を高めるには、データ共有と信頼の構築が鍵。',
    project: 'economy'
  },
  {
    title: '複雑系シミュレーション',
    body: 'agent-based model を使って複雑系のパターンを再現する。パラメータ感度を確認。',
    project: 'systems'
  },
  {
    title: '都市と環境',
    body: '都市の環境政策は市民参加が必要。緑地の配置と交通の最適化。',
    project: 'urban'
  },
  {
    title: '集中とフロー',
    body: 'フロー体験はチャレンジとスキルのバランスで生まれる。',
    project: 'cognition'
  },
  {
    title: 'Complex systems notes',
    body: 'Complex systems研究では emergent behavior と network dynamics が重要。',
    project: 'systems'
  },
  {
    title: 'エッジ説明の設計',
    body: '関連性の説明では、共有概念と類似した抜粋の提示が有効。',
    project: 'ai'
  },
  {
    title: 'プロジェクト管理',
    body: 'タスクの優先順位とカンバンの可視化で進捗を維持する。',
    project: 'management'
  },
  {
    title: 'リサーチノート',
    body: '文献レビューでは関連研究の概念マップが役に立つ。',
    project: 'research'
  }
];

const db = getDb();

const existing = db.prepare('SELECT COUNT(*) as count FROM notes').get() as { count: number };
if (existing.count === 0) {
  const insert = db.prepare(
    'INSERT INTO notes (title, body_md, project, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  );
  const now = nowIso();
  for (const note of seedNotes) {
    const info = insert.run(note.title, note.body, note.project, now, now);
    enqueueAnalysis(info.lastInsertRowid as number);
  }
  console.log('Seed data inserted');
} else {
  console.log('Notes already exist, skipping seed');
}
