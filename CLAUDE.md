# CLAUDE.md — Idea Graph Notebook

This file provides guidance for AI assistants working in this repository.

---

## Project Overview

**Idea Graph Notebook** is a Japanese-first, locally-run note-taking application that automatically extracts concepts from notes written in Japanese, identifies semantic relationships between notes, and visualizes them as an interactive force-directed graph.

Key characteristics:
- All data is stored locally in SQLite (no external database or auth)
- Japanese text is analyzed using kuromoji morphological analysis
- Relationships between notes are scored using a weighted formula combining semantic similarity, concept overlap, and recency
- Users can refine graph relationships through merging, aliasing, and edge blocking

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode, ES2020) |
| Frontend | React 18 |
| Database | SQLite via better-sqlite3 |
| NLP | kuromoji (Japanese morphological analysis) |
| Visualization | react-force-graph-2d |
| Testing | Vitest |
| Script runner | tsx |

---

## Repository Structure

```
/
├── app/                        # Next.js App Router
│   ├── api/                    # API route handlers
│   │   ├── notes/route.ts      # GET (list/search), POST (create)
│   │   ├── notes/[id]/route.ts # GET, PUT, DELETE individual notes
│   │   ├── concepts/route.ts   # GET (list), POST (merge/alias)
│   │   ├── edges/route.ts      # POST (block edge)
│   │   └── graph/route.ts      # GET graph nodes/edges for visualization
│   ├── notes/[id]/page.tsx     # Note editor with sidebar
│   ├── concepts/page.tsx       # Concept management UI
│   ├── graph/page.tsx          # Force graph visualization
│   ├── layout.tsx              # Root layout and nav (Japanese nav labels)
│   ├── page.tsx                # Notes list (main landing page)
│   └── globals.css             # Global styles and utility classes
├── lib/                        # Core shared logic
│   ├── analysis.ts             # CORE: concept extraction, scoring, edge computation
│   ├── db.ts                   # SQLite singleton (getDb, nowIso)
│   ├── nlp.ts                  # Japanese tokenization and concept extraction
│   ├── queue.ts                # In-process async analysis queue
│   ├── schema.ts               # SQLite schema SQL (tables, FTS, triggers)
│   └── stopwords-ja.ts         # Japanese stopwords set
├── scripts/
│   └── seed.ts                 # Seeds DB with sample Japanese notes
├── tests/
│   ├── analysis.test.ts        # Unit tests for scoring functions
│   └── nlp.test.ts             # Unit tests for concept extraction
├── next.config.mjs             # Next.js config (React strict mode)
├── tsconfig.json               # TypeScript config
└── package.json                # Dependencies and scripts
```

---

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev

# Run all tests
npm test

# Seed the database with sample Japanese notes
npm run seed

# Build for production
npm run build

# Start production server
npm start
```

> **Note:** There is no ESLint or Prettier configuration. TypeScript strict mode is the primary code quality tool.

---

## Database

### Overview

SQLite is used for all persistence. The database file is at `data/notes.db` (excluded from git via `.gitignore`). The `data/` directory is created automatically if it does not exist.

Always obtain the DB instance via `getDb()` from `lib/db.ts`; never instantiate `Database` directly.

### Schema (lib/schema.ts)

| Table | Purpose |
|---|---|
| `notes` | Notes with title, body, project, timestamps |
| `notes_fts` | FTS5 full-text search index (auto-updated via triggers) |
| `concepts` | Canonical concept terms |
| `concept_aliases` | Synonym/alias mappings to canonical concepts |
| `note_concepts` | Note-to-concept associations with TF-IDF scores |
| `note_vectors` | Serialized TF-IDF vectors (JSON) per note |
| `edges` | Weighted edges between note pairs with explanations |
| `feedback_actions` | Records of user feedback (merge, alias, block) |
| `meta` | Key-value metadata |

### Database Access Patterns

- All queries use `better-sqlite3` synchronous API (no async/await needed)
- Use parameterized queries — never interpolate user input into SQL strings
- `getDb()` returns the same singleton instance across the app
- `nowIso()` returns the current timestamp in ISO 8601 format

---

## Core Logic: Analysis Pipeline (lib/analysis.ts)

This is the most important file in the codebase. Understand it before modifying any concept or edge behavior.

### Edge Weight Formula

```
weight = 0.55 × semantic + 0.35 × overlap + 0.10 × recency
```

- **semantic** (`cosineSimilarity`): TF-IDF vector cosine similarity between notes
- **overlap** (`weightedJaccard`): Concept overlap weighted by scores
- **recency** (`recencyScore`): Decays over a 30-day window based on how recently both notes were updated

### Key Functions

| Function | Description |
|---|---|
| `analyzeNote(noteId)` | Full pipeline: extract concepts → build vectors → compute edges |
| `updateEdgesForNote(noteId)` | Computes weighted edges to all other notes, writes to `edges` table |
| `buildTfidfVector(noteId)` | Builds TF-IDF vector from note tokens; writes to `note_vectors` |
| `cosineSimilarity(a, b)` | Cosine similarity between two TF-IDF Maps |
| `weightedJaccard(a, b)` | Weighted Jaccard between two concept score Maps |
| `recencyScore(updatedA, updatedB)` | Time-decay score using the more recent of two timestamps |
| `buildExplanation(...)` | Generates human-readable explanation for an edge |
| `mergeConcepts(fromId, toId)` | Merges one concept into another, updates all references |
| `addAlias(conceptId, alias)` | Adds synonym; updates future tokenization normalization |
| `blockEdge(noteIdA, noteIdB)` | Inserts feedback action to permanently suppress an edge |

### Analysis Queue (lib/queue.ts)

Note analysis is CPU-bound (kuromoji tokenization). Analysis is offloaded to an in-process async queue via `enqueueAnalysis(noteId)`. Call this after creating or updating any note — the queue processes entries sequentially to avoid contention.

---

## NLP: Japanese Text Processing (lib/nlp.ts)

### Text Pipeline

1. **Normalize** — NFKC Unicode normalization, lowercase, strip punctuation (`normalizeText`)
2. **Tokenize** — kuromoji morphological analysis (`getTokenizer`)
3. **Extract concepts** — Keep nouns; compound consecutive nouns into phrases (`extractConcepts`)
4. **Filter stopwords** — Remove particles, pronouns, and common verbs (`stopwords-ja.ts`)
5. **Vectorize** — Produce token frequency maps for TF-IDF (`tokenizeForVector`)

### Important Notes

- The kuromoji tokenizer is loaded lazily and cached; the first call takes longer
- Compound nouns (e.g., 自己組織化) are joined with no separator
- Always use `normalizeText()` before passing Japanese text to any NLP function

---

## API Routes

All API routes are in `app/api/`. They use the Next.js App Router conventions (exported `GET`, `POST`, `PUT`, `DELETE` functions).

| Route | Methods | Purpose |
|---|---|---|
| `/api/notes` | GET, POST | List/search notes; create new note |
| `/api/notes/[id]` | GET, PUT, DELETE | Fetch, update, or delete a note |
| `/api/concepts` | GET, POST | List concepts; merge or add alias |
| `/api/edges` | POST | Block an edge between two notes |
| `/api/graph` | GET | Fetch graph nodes and edges for visualization |

### API Conventions

- Return JSON for all responses
- Use `NextResponse.json(data)` for success
- Use `NextResponse.json({ error: message }, { status: N })` for errors
- After creating or updating a note, call `enqueueAnalysis(noteId)` to trigger background analysis
- The graph endpoint accepts `?project=` and `?minWeight=` query params for filtering

---

## Frontend Pages

All pages are under `app/` and use the Next.js App Router. Client components are marked with `'use client'`.

| Route | File | Description |
|---|---|---|
| `/` | `app/page.tsx` | Notes list with search and project filter |
| `/notes/[id]` | `app/notes/[id]/page.tsx` | Note editor with concepts, related notes, and feedback controls |
| `/graph` | `app/graph/page.tsx` | Interactive force-directed graph |
| `/concepts` | `app/concepts/page.tsx` | Concept merge and alias management |

### Styling

- Custom utility classes are defined in `globals.css`: `.card`, `.grid`, `.flex`, `.panel`, `.badge`, `.chip`
- Primary color: `#2f6df6`
- Japanese fonts: Hiragino Sans, Noto Sans JP
- No CSS framework (no Tailwind, no Bootstrap)
- Do not add external CSS frameworks without discussion

---

## Testing

Tests live in `tests/` and use Vitest.

```bash
npm test          # Run all tests once
```

### Test Files

| File | What It Tests |
|---|---|
| `tests/analysis.test.ts` | `weightedJaccard`, `cosineSimilarity`, `recencyScore` |
| `tests/nlp.test.ts` | `extractConcepts` with Japanese text |

### Testing Conventions

- Test files use `.test.ts` suffix
- Vitest globals (`describe`, `it`, `expect`) are available without explicit imports (configured in `tsconfig.json`)
- Keep unit tests focused on pure functions in `lib/`
- API routes and pages do not have tests; integration testing is manual

---

## Key Conventions for AI Assistants

### Do

- Run `npm test` after modifying anything in `lib/analysis.ts` or `lib/nlp.ts`
- Use `getDb()` from `lib/db.ts` — never create a new `Database` instance
- Call `enqueueAnalysis(noteId)` after any note create or update
- Use parameterized SQLite queries at all times
- Use `nowIso()` for all timestamps
- Keep the edge weight formula (`0.55/0.35/0.10`) intact unless explicitly asked to change it
- Respect the lazy-load pattern for the kuromoji tokenizer

### Do Not

- Do not add external authentication or user management — this is a local-first app
- Do not add an ORM — raw SQL with better-sqlite3 is intentional
- Do not switch from the App Router to the Pages Router
- Do not add CSS frameworks (Tailwind, Bootstrap, etc.) without explicit request
- Do not interpolate user input directly into SQL strings
- Do not create async database operations — better-sqlite3 is synchronous by design
- Do not modify `lib/schema.ts` without also considering whether existing `data/notes.db` files need migration

### Working with Japanese Text

- Always pass Japanese text through `normalizeText()` before analysis
- When adding stopwords, add to `lib/stopwords-ja.ts` as a `Set` member
- Concept extraction is noun-based; do not attempt to extract verbs or adjectives as concepts
- The kuromoji dictionary files are bundled in `node_modules/kuromoji/dict/` and must not be removed

---

## Environment & Infrastructure

- **Runtime:** Node.js (no specific version pinned, but Node 18+ recommended for Next.js 14)
- **Database file location:** `data/notes.db` (auto-created at startup)
- **No environment variables required** for basic operation
- **No Docker or containerization** — runs directly on the host
- **No CI/CD configuration** present in the repository

---

## Known Limitations & Future Work

Documented in `README.md`:

- Concept extraction quality depends on kuromoji dictionary coverage
- No English-language NLP support
- Graph can become dense with many notes — UI filtering by project/weight helps
- No note versioning or history
- No export functionality
- Analysis queue is in-process and lost on server restart (unprocessed items are not persisted)
