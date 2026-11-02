/**
 * libraryFilter.test.js — Comprehensive unit tests for Library pure filter and helper functions.
 */

import { describe, it, expect } from 'vitest';
import {
  filterVocabulary,
  normalizeLevel,
  formatAddedDate,
  formatReviewDate,
} from './logic/libraryFilter.js';

describe('libraryFilter — Pure Filter & Formatter Unit Tests', () => {
  const SAMPLE_VOCAB = [
    { id: 1, kanji: '猫', reading: 'ねこ', meaning: 'cat', level: 'N5', interval: 1 },
    { id: 2, kanji: '犬', reading: 'いぬ', meaning: 'dog', level: 'N5', interval: 2 },
    { id: 3, kanji: '学校', reading: 'がっこう', meaning: 'school', level: 'N4', interval: 3 },
    { id: 4, kanji: '経済', reading: 'けいざい', meaning: 'economy', level: 'N3', interval: 4 },
    { id: 5, kanji: '曖昧', reading: 'あいまい', meaning: 'vague', level: 'N2', interval: 5 },
    { id: 6, kanji: '妥協', reading: 'だきょう', meaning: 'compromise', level: 'N1', interval: 6 },
    { id: 7, kanji: 'スラング', reading: 'すらんぐ', meaning: 'slang', level: '???', interval: 0 },
    { id: 8, kanji: '未知', reading: 'みち', meaning: 'unknown path', level: null, interval: 0 },
  ];

  describe('normalizeLevel', () => {
    it('normalizes N5 through N1 levels', () => {
      expect(normalizeLevel('N5')).toBe('N5');
      expect(normalizeLevel('n5')).toBe('N5');
      expect(normalizeLevel(' N4 ')).toBe('N4');
      expect(normalizeLevel('N3')).toBe('N3');
      expect(normalizeLevel('N2')).toBe('N2');
      expect(normalizeLevel('N1')).toBe('N1');
    });

    it('returns Unknown for null, undefined, ???, ALL, or non-JLPT strings', () => {
      expect(normalizeLevel(null)).toBe('Unknown');
      expect(normalizeLevel(undefined)).toBe('Unknown');
      expect(normalizeLevel('???')).toBe('Unknown');
      expect(normalizeLevel('ALL')).toBe('Unknown');
      expect(normalizeLevel('random')).toBe('Unknown');
      expect(normalizeLevel(123)).toBe('Unknown');
    });
  });

  describe('filterVocabulary', () => {
    it('returns all items when query is empty and level is ALL', () => {
      const results = filterVocabulary(SAMPLE_VOCAB, '', 'ALL');
      expect(results).toHaveLength(SAMPLE_VOCAB.length);
    });

    it('matches by kanji (case-insensitive and trimmed)', () => {
      const results = filterVocabulary(SAMPLE_VOCAB, '  猫  ');
      expect(results).toHaveLength(1);
      expect(results[0].kanji).toBe('猫');
    });

    it('matches by reading', () => {
      const results = filterVocabulary(SAMPLE_VOCAB, 'がっこう');
      expect(results).toHaveLength(1);
      expect(results[0].kanji).toBe('学校');
    });

    it('matches by meaning (case-insensitive)', () => {
      const resultsLower = filterVocabulary(SAMPLE_VOCAB, 'cat');
      const resultsUpper = filterVocabulary(SAMPLE_VOCAB, 'CAT');
      expect(resultsLower).toHaveLength(1);
      expect(resultsUpper).toHaveLength(1);
      expect(resultsLower[0].kanji).toBe('猫');
    });

    it('filters correctly for every JLPT level from N5 to N1', () => {
      expect(filterVocabulary(SAMPLE_VOCAB, '', 'N5')).toHaveLength(2);
      expect(filterVocabulary(SAMPLE_VOCAB, '', 'N4')).toHaveLength(1);
      expect(filterVocabulary(SAMPLE_VOCAB, '', 'N3')).toHaveLength(1);
      expect(filterVocabulary(SAMPLE_VOCAB, '', 'N2')).toHaveLength(1);
      expect(filterVocabulary(SAMPLE_VOCAB, '', 'N1')).toHaveLength(1);
    });

    it('filters Unknown level words (null, ???, or missing levels)', () => {
      const unknownResults = filterVocabulary(SAMPLE_VOCAB, '', 'UNKNOWN');
      expect(unknownResults).toHaveLength(2);
      expect(unknownResults.map((w) => w.kanji)).toEqual(['スラング', '未知']);
    });

    it('combines search query with JLPT level filtering correctly', () => {
      // Both '猫' and '犬' are N5, but query 'dog' only matches '犬'
      const results = filterVocabulary(SAMPLE_VOCAB, 'dog', 'N5');
      expect(results).toHaveLength(1);
      expect(results[0].kanji).toBe('犬');

      // '猫' is N5, searching 'cat' with N4 returns 0
      const noMatch = filterVocabulary(SAMPLE_VOCAB, 'cat', 'N4');
      expect(noMatch).toHaveLength(0);
    });

    it('returns empty array when no words match search or filter', () => {
      const results = filterVocabulary(SAMPLE_VOCAB, 'nonexistentword123');
      expect(results).toEqual([]);
    });

    it('handles null, undefined, or empty vocab list gracefully without crashing', () => {
      expect(filterVocabulary(null)).toEqual([]);
      expect(filterVocabulary(undefined)).toEqual([]);
      expect(filterVocabulary([])).toEqual([]);
      expect(filterVocabulary('not-an-array')).toEqual([]);
    });

    it('handles partial, corrupted, or non-object entries safely', () => {
      const corruptVocab = [
        null,
        undefined,
        'string instead of object',
        12345,
        { id: 99 }, // missing kanji, reading, meaning, level
        { id: 100, kanji: '花' }, // missing reading and meaning
      ];

      expect(() => filterVocabulary(corruptVocab, '花', 'ALL')).not.toThrow();
      const res = filterVocabulary(corruptVocab, '花', 'ALL');
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe(100);
    });

    it('treats invalid or unrecognized level filter as ALL', () => {
      const results = filterVocabulary(SAMPLE_VOCAB, '', 'INVALID_LEVEL_NAME');
      expect(results).toHaveLength(SAMPLE_VOCAB.length);
    });
  });

  describe('formatAddedDate and formatReviewDate', () => {
    it('formats valid timestamp properly', () => {
      const ts = new Date('2025-06-15T12:00:00Z').getTime();
      const dateStr = formatAddedDate(ts);
      expect(dateStr).toContain('2025');
    });

    it('returns fallback string for invalid or missing timestamps without throwing', () => {
      expect(formatAddedDate(null)).toBe('Unknown');
      expect(formatAddedDate(undefined)).toBe('Unknown');
      expect(formatAddedDate('invalid-date')).toBe('Unknown');

      expect(formatReviewDate(null)).toBe('Not scheduled');
      expect(formatReviewDate(undefined)).toBe('Not scheduled');
      expect(formatReviewDate('invalid-date')).toBe('Not scheduled');
    });
  });
});
