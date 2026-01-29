import { describe, expect, it } from 'vitest';
import { cosineSimilarity, recencyScore, weightedJaccard } from '../lib/analysis';

describe('edge scoring helpers', () => {
  it('computes weighted Jaccard', () => {
    const a = new Map([
      [1, 1],
      [2, 2]
    ]);
    const b = new Map([
      [2, 1],
      [3, 1]
    ]);
    const score = weightedJaccard(a, b);
    expect(score).toBeCloseTo(1 / 4);
  });

  it('computes cosine similarity', () => {
    const score = cosineSimilarity({ a: 1, b: 0 }, { a: 1, b: 1 });
    expect(score).toBeCloseTo(0.707, 2);
  });

  it('computes recency score', () => {
    const now = new Date().toISOString();
    const recent = recencyScore(now, now);
    expect(recent).toBeCloseTo(1);
  });
});
