import kuromoji from 'kuromoji';
import { japaneseStopwords } from './stopwords-ja';

let tokenizerPromise: Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> | null = null;

export function getTokenizer() {
  if (!tokenizerPromise) {
    tokenizerPromise = new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((err, tokenizer) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(tokenizer);
      });
    });
  }
  return tokenizerPromise;
}

export function normalizeText(text: string) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u3000\s]+/g, ' ')
    .replace(/[。、，．\.,\/#!$%\^&\*;:{}=\-_`~()\[\]「」『』【】（）]/g, '')
    .trim();
}

export type ExtractedConcept = { term: string; score: number };

export async function extractConcepts(input: string): Promise<ExtractedConcept[]> {
  const tokenizer = await getTokenizer();
  const tokens = tokenizer.tokenize(input);
  const concepts: string[] = [];
  let buffer: string[] = [];

  const flushBuffer = () => {
    if (buffer.length > 0) {
      concepts.push(buffer.join(''));
      buffer = [];
    }
  };

  for (const token of tokens) {
    const isNoun = token.pos === '名詞';
    if (isNoun) {
      buffer.push(token.surface_form);
    } else {
      flushBuffer();
    }
  }
  flushBuffer();

  const singles = tokens
    .filter((token) => token.pos === '名詞')
    .map((token) => token.surface_form);

  const all = [...concepts, ...singles]
    .map((term) => normalizeText(term))
    .filter((term) => term.length > 1)
    .filter((term) => !japaneseStopwords.has(term));

  const counts = new Map<string, number>();
  for (const term of all) {
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([term, count]) => ({ term, score: count }))
    .sort((a, b) => b.score - a.score);
}

export async function tokenizeForVector(input: string) {
  const tokenizer = await getTokenizer();
  return tokenizer
    .tokenize(input)
    .map((token) => normalizeText(token.surface_form))
    .filter((term) => term.length > 1)
    .filter((term) => !japaneseStopwords.has(term));
}
