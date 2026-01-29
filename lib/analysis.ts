import { getDb, nowIso } from './db';
import { ExtractedConcept, extractConcepts, normalizeText, tokenizeForVector } from './nlp';

export type Vector = Record<string, number>;

export function buildTfidfVector(tokens: string[], corpus: string[][]): Vector {
  if (tokens.length === 0) return {};
  const termCounts = new Map<string, number>();
  for (const token of tokens) {
    termCounts.set(token, (termCounts.get(token) ?? 0) + 1);
  }

  const docCount = corpus.length;
  const idf = new Map<string, number>();
  const vocab = new Set(tokens);

  for (const term of vocab) {
    let docsWithTerm = 0;
    for (const doc of corpus) {
      if (doc.includes(term)) docsWithTerm += 1;
    }
    idf.set(term, Math.log((docCount + 1) / (docsWithTerm + 1)) + 1);
  }

  const vector: Vector = {};
  for (const [term, count] of termCounts.entries()) {
    const tf = count / tokens.length;
    vector[term] = tf * (idf.get(term) ?? 0);
  }
  return vector;
}

export function cosineSimilarity(a: Vector, b: Vector) {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  const terms = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const term of terms) {
    const va = a[term] ?? 0;
    const vb = b[term] ?? 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function weightedJaccard(a: Map<number, number>, b: Map<number, number>) {
  let intersection = 0;
  let union = 0;
  const all = new Set([...a.keys(), ...b.keys()]);
  for (const key of all) {
    const va = a.get(key) ?? 0;
    const vb = b.get(key) ?? 0;
    intersection += Math.min(va, vb);
    union += Math.max(va, vb);
  }
  if (union === 0) return 0;
  return intersection / union;
}

export function recencyScore(updatedAtA: string, updatedAtB: string) {
  const a = new Date(updatedAtA).getTime();
  const b = new Date(updatedAtB).getTime();
  const days = Math.abs(a - b) / (1000 * 60 * 60 * 24);
  return Math.max(0, 1 - days / 30);
}

export type AnalysisResult = {
  concepts: { conceptId: number; score: number }[];
  vector: Vector;
};

export async function analyzeNote(noteId: number) {
  const db = getDb();
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
  if (!note) return;

  const rawConcepts = await extractConcepts(note.body_md);
  const aliasMap = getAliasMap();

  const canonical = new Map<string, ExtractedConcept>();
  for (const concept of rawConcepts) {
    const normalized = normalizeText(concept.term);
    const alias = aliasMap.get(normalized) ?? normalized;
    const existing = canonical.get(alias);
    if (existing) {
      existing.score += concept.score;
    } else {
      canonical.set(alias, { term: alias, score: concept.score });
    }
  }

  const conceptIds: { conceptId: number; score: number }[] = [];
  for (const [term, data] of canonical.entries()) {
    const conceptId = upsertConcept(term);
    conceptIds.push({ conceptId, score: data.score });
  }

  db.prepare('DELETE FROM note_concepts WHERE note_id = ?').run(noteId);
  const insertNoteConcept = db.prepare(
    'INSERT INTO note_concepts (note_id, concept_id, score) VALUES (?, ?, ?)'
  );
  for (const entry of conceptIds) {
    insertNoteConcept.run(noteId, entry.conceptId, entry.score);
  }

  const allNotes = db.prepare('SELECT id, body_md FROM notes').all();
  const corpus = [] as string[][];
  for (const row of allNotes) {
    corpus.push(await tokenizeForVector(row.body_md));
  }

  const tokens = await tokenizeForVector(note.body_md);
  const vector = buildTfidfVector(tokens, corpus);
  db.prepare(
    'INSERT OR REPLACE INTO note_vectors (note_id, method, vector_json) VALUES (?, ?, ?)'
  ).run(noteId, 'tfidf', JSON.stringify(vector));

  db.prepare('UPDATE notes SET updated_at = ? WHERE id = ?').run(nowIso(), noteId);

  await updateEdgesForNote(noteId);
}

function upsertConcept(name: string) {
  const db = getDb();
  const existing = db
    .prepare('SELECT id FROM concepts WHERE canonical_name = ?')
    .get(name);
  if (existing) return existing.id as number;
  const now = nowIso();
  const info = db
    .prepare('INSERT INTO concepts (canonical_name, created_at, updated_at) VALUES (?, ?, ?)')
    .run(name, now, now);
  return info.lastInsertRowid as number;
}

function getAliasMap() {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT concept_aliases.alias_text as alias, concepts.canonical_name as canonical FROM concept_aliases JOIN concepts ON concepts.id = concept_aliases.concept_id'
    )
    .all();
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(normalizeText(row.alias), normalizeText(row.canonical));
  }
  return map;
}

async function updateEdgesForNote(noteId: number) {
  const db = getDb();
  const notes = db.prepare('SELECT id, updated_at FROM notes').all();
  const vectors = db
    .prepare('SELECT note_id, vector_json FROM note_vectors WHERE method = ?')
    .all('tfidf');
  const vectorMap = new Map<number, Vector>();
  for (const row of vectors) {
    vectorMap.set(row.note_id as number, JSON.parse(row.vector_json as string));
  }

  const noteConcepts = db
    .prepare('SELECT note_id, concept_id, score FROM note_concepts')
    .all();
  const conceptsMap = new Map<number, Map<number, number>>();
  for (const row of noteConcepts) {
    const map = conceptsMap.get(row.note_id as number) ?? new Map();
    map.set(row.concept_id as number, row.score as number);
    conceptsMap.set(row.note_id as number, map);
  }

  const noteRow = notes.find((n: { id: number }) => n.id === noteId);
  if (!noteRow) return;

  for (const other of notes) {
    if (other.id === noteId) continue;
    const a = Math.min(noteId, other.id);
    const b = Math.max(noteId, other.id);

    const blocked = db
      .prepare('SELECT blocked FROM edges WHERE note_a = ? AND note_b = ?')
      .get(a, b) as { blocked?: number } | undefined;
    if (blocked?.blocked) continue;

    const semantic = cosineSimilarity(
      vectorMap.get(noteId) ?? {},
      vectorMap.get(other.id) ?? {}
    );
    const overlap = weightedJaccard(
      conceptsMap.get(noteId) ?? new Map(),
      conceptsMap.get(other.id) ?? new Map()
    );
    const recency = recencyScore(noteRow.updated_at, other.updated_at);
    const weight = 0.55 * semantic + 0.35 * overlap + 0.1 * recency;

    const explanation = buildExplanation(noteId, other.id, semantic, overlap, recency);

    db.prepare(
      `INSERT INTO edges (note_a, note_b, weight, edge_type, explanation_json, blocked, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)
       ON CONFLICT(note_a, note_b) DO UPDATE SET
         weight = excluded.weight,
         explanation_json = excluded.explanation_json,
         updated_at = excluded.updated_at,
         blocked = edges.blocked`
    ).run(a, b, weight, 'similar', JSON.stringify(explanation), nowIso());
  }
}

function buildExplanation(noteA: number, noteB: number, semantic: number, overlap: number, recency: number) {
  const db = getDb();
  const shared = db
    .prepare(
      `SELECT concepts.canonical_name as name,
              MIN(note_concepts.score) as score
       FROM note_concepts
       JOIN concepts ON concepts.id = note_concepts.concept_id
       WHERE note_concepts.note_id IN (?, ?)
       GROUP BY concepts.id
       HAVING COUNT(DISTINCT note_concepts.note_id) = 2
       ORDER BY score DESC
       LIMIT 5`
    )
    .all(noteA, noteB);

  const noteAData = db.prepare('SELECT body_md FROM notes WHERE id = ?').get(noteA) as {
    body_md: string;
  };
  const noteBData = db.prepare('SELECT body_md FROM notes WHERE id = ?').get(noteB) as {
    body_md: string;
  };

  const excerptA = noteAData.body_md.split(/\n+/).slice(0, 2).join(' / ');
  const excerptB = noteBData.body_md.split(/\n+/).slice(0, 2).join(' / ');

  return {
    sharedConcepts: shared,
    excerpts: [excerptA, excerptB],
    weightBreakdown: {
      semantic,
      overlap,
      recency,
      formula: '0.55*semantic + 0.35*overlap + 0.10*recency'
    }
  };
}

export function mergeConcepts(primaryId: number, secondaryId: number) {
  const db = getDb();
  const primary = db.prepare('SELECT canonical_name FROM concepts WHERE id = ?').get(primaryId) as {
    canonical_name: string;
  };
  const secondary = db.prepare('SELECT canonical_name FROM concepts WHERE id = ?').get(secondaryId) as {
    canonical_name: string;
  };
  if (!primary || !secondary) return;
  db.prepare('UPDATE note_concepts SET concept_id = ? WHERE concept_id = ?').run(primaryId, secondaryId);
  db.prepare('INSERT OR IGNORE INTO concept_aliases (concept_id, alias_text) VALUES (?, ?)').run(
    primaryId,
    secondary.canonical_name
  );
  const secondaryAliases = db
    .prepare('SELECT alias_text FROM concept_aliases WHERE concept_id = ?')
    .all(secondaryId) as { alias_text: string }[];
  for (const alias of secondaryAliases) {
    db.prepare('INSERT OR IGNORE INTO concept_aliases (concept_id, alias_text) VALUES (?, ?)').run(
      primaryId,
      alias.alias_text
    );
  }
  db.prepare('DELETE FROM concept_aliases WHERE concept_id = ?').run(secondaryId);
  db.prepare('DELETE FROM concepts WHERE id = ?').run(secondaryId);
  db.prepare('INSERT INTO feedback_actions (kind, payload_json, created_at) VALUES (?, ?, ?)').run(
    'merge_concepts',
    JSON.stringify({ primaryId, secondaryId }),
    nowIso()
  );
}

export function addAlias(conceptId: number, aliasText: string) {
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO concept_aliases (concept_id, alias_text) VALUES (?, ?)').run(
    conceptId,
    normalizeText(aliasText)
  );
  db.prepare('INSERT INTO feedback_actions (kind, payload_json, created_at) VALUES (?, ?, ?)').run(
    'add_alias',
    JSON.stringify({ conceptId, aliasText }),
    nowIso()
  );
}

export function blockEdge(noteA: number, noteB: number) {
  const db = getDb();
  const a = Math.min(noteA, noteB);
  const b = Math.max(noteA, noteB);
  db.prepare(
    'UPDATE edges SET blocked = 1, updated_at = ? WHERE note_a = ? AND note_b = ?'
  ).run(nowIso(), a, b);
  db.prepare('INSERT INTO feedback_actions (kind, payload_json, created_at) VALUES (?, ?, ?)').run(
    'block_edge',
    JSON.stringify({ noteA: a, noteB: b }),
    nowIso()
  );
}
