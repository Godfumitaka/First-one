# Idea Graph Notebook (Japanese-first)

ローカルファーストで動作する「Idea Graph Notebook」のMVPです。日本語を中心としたノートから概念を抽出し、関連性を重み付きグラフとして可視化します。

## Quick start

```bash
npm install
npm run seed
npm run dev
```

`http://localhost:3000` にアクセスして、ノート作成・編集・グラフ表示を確認できます。

## Architecture

- **Next.js + TypeScript** (App Router)
- **SQLite (better-sqlite3)**
- **In-process queue** for background analysis (`lib/queue.ts`)
- **Kuromoji tokenizer** for Japanese-aware concept extraction
- **TF-IDF cosine similarity** for offline semantic similarity fallback

## Japanese concept extraction

- `kuromoji` で形態素解析を行い、名詞を中心に概念候補を抽出します。
- 名詞の連続を複合名詞として扱い、単語単体も候補に含めます。
- `normalizeText` で全角/半角、記号、大小文字などを正規化し、`stopwords-ja.ts` のストップワードを除外します。
- ユーザーが登録したシノニム（alias）を使って正規化後の概念を統合します。

## Weighting / explanation

デフォルトの重み付けは以下です:

```
weight = 0.55*semantic + 0.35*overlap + 0.10*recency
```

- **semantic**: TF-IDF ベクトルのコサイン類似度
- **overlap**: 概念スコアの weighted Jaccard
- **recency**: 30日以内の更新差をスコア化

Explainability には以下を含みます:

- 共有概念 (top N)
- 類似抜粋 (ノートの先頭数行)
- 重み内訳 (semantic / overlap / recency)

## User feedback

- **概念マージ**: canonical を統合し alias を保持
- **シノニム追加**: alias -> canonical の辞書に追加
- **エッジ削除**: blocked として保存し再出現を防止

これらは `feedback_actions` に記録され、将来の解析で反映されます。

## Optional embeddings

このMVPでは TF-IDF による完全オフライン動作をデフォルトとしています。外部埋め込みAPIは未実装ですが、`note_vectors` の `method` を拡張することで追加できます。

## Database schema

`lib/schema.ts` で定義されています。主なテーブル:

- notes
- concepts
- concept_aliases
- note_concepts
- note_vectors
- edges
- feedback_actions

## Limitations / next steps

- 簡易的な複合名詞抽出のみで、より高度な正規化は未実装
- Edge 再計算は対象ノート vs 既存ノートで実行 (全体再計算なし)
- 埋め込みモデルの導入や UI の改善は今後の拡張ポイント

## Testing

```bash
npm test
```

テストは日本語概念抽出とエッジスコア関数を検証します。
