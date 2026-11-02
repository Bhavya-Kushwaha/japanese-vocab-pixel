import { describe, it, expect } from 'vitest';
import {
  processReview,
  isDue,
  normalizeSrsFields,
  MS_PER_DAY,
  MIN_EFACTOR,
  DEFAULT_EFACTOR,
} from './logic/srs.js';
import {
  buildReviewQueue,
  getCardContent,
  getAvailableTags,
} from './logic/reviewQueue.js';

describe('SRS Scheduling & Normalization (srs.js)', () => {
  const NOW = 1_700_000_000_000;

  it('normalizes each missing SRS field to its respective default value', () => {
    // Missing interval
    expect(normalizeSrsFields({ repetition: 2, efactor: 2.4, nextReviewDate: 12345 }, NOW).interval).toBe(0);
    // Missing repetition
    expect(normalizeSrsFields({ interval: 5, efactor: 2.4, nextReviewDate: 12345 }, NOW).repetition).toBe(0);
    // Missing efactor
    expect(normalizeSrsFields({ interval: 5, repetition: 2, nextReviewDate: 12345 }, NOW).efactor).toBe(DEFAULT_EFACTOR);
    // Missing nextReviewDate
    expect(normalizeSrsFields({ interval: 5, repetition: 2, efactor: 2.4 }, NOW).nextReviewDate).toBe(NOW);
  });

  it('handles NaN values safely across all SRS fields', () => {
    const res = normalizeSrsFields({ interval: NaN, repetition: NaN, efactor: NaN, nextReviewDate: NaN }, NOW);
    expect(res).toEqual({
      interval: 0,
      repetition: 0,
      efactor: DEFAULT_EFACTOR,
      nextReviewDate: NOW,
    });
  });

  it('handles negative values safely (flooring interval and repetition to 0, clamping efactor to 1.3)', () => {
    const res = normalizeSrsFields({ interval: -10, repetition: -3, efactor: -2.0, nextReviewDate: -500 }, NOW);
    expect(res).toEqual({
      interval: 0,
      repetition: 0,
      efactor: MIN_EFACTOR,
      nextReviewDate: NOW, // negative date rejected and falls back to NOW
    });
  });

  it('handles invalid date values (non-numeric, null, undefined, negative) by falling back to nowMs', () => {
    expect(normalizeSrsFields({ nextReviewDate: 'invalid-date' }, NOW).nextReviewDate).toBe(NOW);
    expect(normalizeSrsFields({ nextReviewDate: null }, NOW).nextReviewDate).toBe(NOW);
    expect(normalizeSrsFields({ nextReviewDate: 0 }, NOW).nextReviewDate).toBe(NOW);
    expect(normalizeSrsFields({ nextReviewDate: -1 }, NOW).nextReviewDate).toBe(NOW);
    expect(normalizeSrsFields({ nextReviewDate: 1_800_000_000_000 }, NOW).nextReviewDate).toBe(1_800_000_000_000);
  });

  it('preserves unrelated vocabulary properties when normalized fields are applied', () => {
    const word = {
      id: 999,
      kanji: '星',
      reading: 'ほし',
      meaning: 'star',
      level: 'N4',
      tags: ['space', 'nature'],
      customField: 'preserved_value',
      extraNotes: { author: 'learner' },
    };

    const merged = { ...word, ...normalizeSrsFields(word, NOW) };

    expect(merged.id).toBe(999);
    expect(merged.kanji).toBe('星');
    expect(merged.reading).toBe('ほし');
    expect(merged.meaning).toBe('star');
    expect(merged.level).toBe('N4');
    expect(merged.tags).toEqual(['space', 'nature']);
    expect(merged.customField).toBe('preserved_value');
    expect(merged.extraNotes).toEqual({ author: 'learner' });
    expect(merged.interval).toBe(0);
    expect(merged.repetition).toBe(0);
    expect(merged.efactor).toBe(DEFAULT_EFACTOR);
    expect(merged.nextReviewDate).toBe(NOW);
  });

  it('pure helpers do NOT mutate the original input objects', () => {
    const raw = {
      id: 101,
      kanji: '火',
      reading: 'ひ',
      meaning: 'fire',
      interval: NaN,
      repetition: -1,
      efactor: 1.1,
    };
    const freeze = { ...raw };

    normalizeSrsFields(raw, NOW);
    expect(raw).toEqual(freeze);

    processReview(raw, 5, NOW);
    expect(raw).toEqual(freeze);
  });

  it('processReview handles missing SRS metadata gracefully', () => {
    const raw = { kanji: '猫' };
    const res = processReview(raw, 5, NOW);
    expect(res.repetition).toBe(1);
    expect(res.interval).toBe(1);
    expect(res.efactor).toBe(2.6);
    expect(res.nextReviewDate).toBe(NOW + 1 * MS_PER_DAY);
    // raw untouched
    expect(raw.repetition).toBeUndefined();
  });

  it('AGAIN (1) resets repetition to 0, sets interval to 1 day, drops efactor by 0.54', () => {
    const item = { repetition: 3, interval: 15, efactor: 2.5 };
    const res = processReview(item, 1, NOW);

    expect(res.repetition).toBe(0);
    expect(res.interval).toBe(1);
    expect(res.efactor).toBeCloseTo(1.96);
    expect(res.nextReviewDate).toBe(NOW + 1 * MS_PER_DAY);
    expect(item.repetition).toBe(3); // pure: input untouched
  });

  it('HARD (3) increments repetition, steps interval, drops efactor by 0.14', () => {
    // 1st review (rep 0 -> 1)
    const res1 = processReview({ repetition: 0, interval: 0, efactor: 2.5 }, 3, NOW);
    expect(res1.repetition).toBe(1);
    expect(res1.interval).toBe(1);
    expect(res1.efactor).toBeCloseTo(2.36);

    // 2nd review (rep 1 -> 2)
    const res2 = processReview({ repetition: 1, interval: 1, efactor: 2.36 }, 3, NOW);
    expect(res2.repetition).toBe(2);
    expect(res2.interval).toBe(6);
    expect(res2.efactor).toBeCloseTo(2.22);

    // 3rd review (rep 2 -> 3)
    const res3 = processReview({ repetition: 2, interval: 6, efactor: 2.22 }, 3, NOW);
    expect(res3.repetition).toBe(3);
    expect(res3.interval).toBe(Math.round(6 * 2.22)); // 13
  });

  it('EASY (5) increments repetition, steps interval, increases efactor by 0.10', () => {
    // 1st review (rep 0 -> 1)
    const res1 = processReview({ repetition: 0, interval: 0, efactor: 2.5 }, 5, NOW);
    expect(res1.repetition).toBe(1);
    expect(res1.interval).toBe(1);
    expect(res1.efactor).toBeCloseTo(2.6);

    // 2nd review (rep 1 -> 2)
    const res2 = processReview({ repetition: 1, interval: 1, efactor: 2.6 }, 5, NOW);
    expect(res2.repetition).toBe(2);
    expect(res2.interval).toBe(6);
    expect(res2.efactor).toBeCloseTo(2.7);

    // 3rd review (rep 2 -> 3)
    const res3 = processReview({ repetition: 2, interval: 6, efactor: 2.7 }, 5, NOW);
    expect(res3.repetition).toBe(3);
    expect(res3.interval).toBe(Math.round(6 * 2.7)); // 16
    expect(res3.efactor).toBeCloseTo(2.8);
  });

  it('clamps efactor to MIN_EFACTOR (1.3)', () => {
    const res = processReview({ repetition: 1, interval: 1, efactor: 1.4 }, 1, NOW);
    expect(res.efactor).toBe(MIN_EFACTOR);
  });

  it('calculates exact raw millisecond timestamp without snapping to midnight', () => {
    const arbitraryTime = 1_700_000_123_456;
    const res = processReview({ repetition: 1, interval: 1, efactor: 2.5 }, 5, arbitraryTime);
    expect(res.interval).toBe(6);
    expect(res.nextReviewDate).toBe(arbitraryTime + 6 * 86_400_000);
  });

  it('due boundaries: cards exactly at nowMs are due, future cards are not, past cards are due', () => {
    expect(isDue({ nextReviewDate: NOW }, NOW)).toBe(true);
    expect(isDue({ nextReviewDate: NOW - 1000 }, NOW)).toBe(true);
    expect(isDue({ nextReviewDate: NOW + 1 }, NOW)).toBe(false);
  });
});

describe('Review Queue & Directions (reviewQueue.js)', () => {
  const NOW = 1_700_000_000_000;

  const mockVocab = [
    { id: 1, kanji: '犬', reading: 'いぬ', meaning: 'dog', level: 'N5', tags: ['animal'], nextReviewDate: NOW - 1000 },
    { id: 2, kanji: '猫', reading: 'ねこ', meaning: 'cat', level: 'N5', tags: ['animal', 'pet'], nextReviewDate: NOW - 500 },
    { id: 3, kanji: '鳥', reading: 'とり', meaning: 'bird', level: 'N4', tags: ['animal'], nextReviewDate: NOW + 50000 }, // future
    { id: 4, kanji: '魚', reading: 'さかな', meaning: 'fish', level: 'N4', tags: ['food'], nextReviewDate: NOW + 60000 }, // future
    { id: 5, kanji: '車', reading: 'くるま', meaning: 'car', level: 'N5', tags: ['vehicle'], nextReviewDate: NOW + 70000 }, // future
  ];

  it('filters by due status when due cards exist', () => {
    const { queue, dueCount, fellBackToAll } = buildReviewQueue(mockVocab, { level: 'ALL', tag: 'ALL', size: 'ALL' }, NOW);
    expect(dueCount).toBe(2);
    expect(fellBackToAll).toBe(false);
    expect(queue.map((w) => w.id).sort()).toEqual([1, 2]);
  });

  it('falls back to all filtered words when no words are due', () => {
    const futureOnly = [
      { id: 10, kanji: '月', level: 'N5', nextReviewDate: NOW + 10000 },
      { id: 11, kanji: '日', level: 'N5', nextReviewDate: NOW + 20000 },
    ];
    const { queue, dueCount, fellBackToAll, totalPoolCount } = buildReviewQueue(
      futureOnly,
      { level: 'ALL', tag: 'ALL', size: 'ALL' },
      NOW
    );
    expect(dueCount).toBe(0);
    expect(fellBackToAll).toBe(true);
    expect(totalPoolCount).toBe(2);
    expect(queue).toHaveLength(2);
  });

  it('returns empty queue when pool matches no words', () => {
    const { queue, totalPoolCount } = buildReviewQueue(mockVocab, { level: 'N1', tag: 'ALL', size: '10' }, NOW);
    expect(totalPoolCount).toBe(0);
    expect(queue).toEqual([]);
  });

  it('filters pool by level', () => {
    // Only N4 words
    const { queue, totalPoolCount } = buildReviewQueue(mockVocab, { level: 'N4', tag: 'ALL', size: 'ALL' }, NOW);
    expect(totalPoolCount).toBe(2);
    // Both N4 words are in future, so it falls back to all N4 words
    expect(queue.map((w) => w.id).sort()).toEqual([3, 4]);
  });

  it('filters pool by tag', () => {
    const { queue } = buildReviewQueue(mockVocab, { level: 'ALL', tag: 'vehicle', size: 'ALL' }, NOW);
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe(5);
  });

  it('respects deck size limits (10, 20, ALL)', () => {
    const tenWords = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      kanji: `字${i}`,
      level: 'N5',
      nextReviewDate: NOW - 1000,
    }));

    const res10 = buildReviewQueue(tenWords, { level: 'ALL', tag: 'ALL', size: '10' }, NOW);
    expect(res10.queue).toHaveLength(10);

    const res20 = buildReviewQueue(tenWords, { level: 'ALL', tag: 'ALL', size: '20' }, NOW);
    expect(res20.queue).toHaveLength(15);

    const resAll = buildReviewQueue(tenWords, { level: 'ALL', tag: 'ALL', size: 'ALL' }, NOW);
    expect(resAll.queue).toHaveLength(15);
  });

  it('card directions: K2M, M2K, R2M project front and back correctly', () => {
    const item = { kanji: '桜', reading: 'さくら', meaning: 'cherry blossom' };

    // K2M: Kanji -> Meaning
    expect(getCardContent(item, 'K2M')).toEqual({
      front: '桜',
      backReading: 'さくら',
      backMeaning: 'cherry blossom',
    });

    // M2K: Meaning -> Kanji
    expect(getCardContent(item, 'M2K')).toEqual({
      front: 'cherry blossom',
      backReading: 'さくら',
      backMeaning: '桜',
    });

    // R2M: Reading -> Meaning
    expect(getCardContent(item, 'R2M')).toEqual({
      front: 'さくら',
      backReading: '',
      backMeaning: 'cherry blossom',
    });
  });

  it('getAvailableTags extracts unique sorted tags', () => {
    expect(getAvailableTags(mockVocab)).toEqual(['animal', 'food', 'pet', 'vehicle']);
  });

  it('does not mutate input vocabulary array or objects', () => {
    const copy = JSON.parse(JSON.stringify(mockVocab));
    buildReviewQueue(mockVocab, { level: 'N5', tag: 'ALL', size: '10' }, NOW);
    expect(mockVocab).toEqual(copy);
  });
});
