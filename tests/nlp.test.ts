import { describe, expect, it } from 'vitest';
import { extractConcepts, normalizeText } from '../lib/nlp';

describe('Japanese concept extraction', () => {
  it('extracts noun concepts and normalizes', async () => {
    const concepts = await extractConcepts('複雑系と自己組織化のモデルを調べる');
    const terms = concepts.map((c) => normalizeText(c.term));
    expect(terms).toContain('複雑系');
    expect(terms).toContain('自己組織化');
  });
});
