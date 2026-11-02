/**
 * reviewQueue.js — Pure review-queue generation and card-direction logic.
 *
 * Extracted and modeled from templates/index.html (startSession, renderFlashcard).
 * NO DOM access. NO localStorage access. Pure functions only.
 */

import { isDue, normalizeSrsFields } from './srs.js';

export const VALID_DIRECTIONS = ['K2M', 'M2K', 'R2M'];
export const VALID_DECK_SIZES = ['10', '20', 'ALL'];
export const VALID_LEVELS = ['ALL', 'N5', 'N4', 'N3', 'N2', 'N1'];

/**
 * Derives the front and back card text based on the review direction.
 *
 * Legacy mapping (from renderFlashcard, lines 1230-1242):
 * - K2M (Kanji -> Meaning):
 *     frontText = item.kanji
 *     backReading = item.reading
 *     backMeaning = item.meaning
 * - M2K (Meaning -> Kanji):
 *     frontText = item.meaning
 *     backReading = item.reading
 *     backMeaning = item.kanji
 * - R2M (Reading -> Meaning):
 *     frontText = item.reading
 *     backReading = ""
 *     backMeaning = item.meaning
 *
 * @param {object} item - Vocab entry
 * @param {string} direction - 'K2M' | 'M2K' | 'R2M'
 * @returns {{ front: string, backReading: string, backMeaning: string }}
 */
export function getCardContent(item, direction = 'K2M') {
  if (!item) {
    return { front: '', backReading: '', backMeaning: '' };
  }

  const kanji = item.kanji || '';
  const reading = item.reading || '';
  const meaning = item.meaning || '';

  if (direction === 'M2K') {
    return {
      front: meaning,
      backReading: reading,
      backMeaning: kanji,
    };
  }

  if (direction === 'R2M') {
    return {
      front: reading,
      backReading: '',
      backMeaning: meaning,
    };
  }

  // Default: K2M
  return {
    front: kanji,
    backReading: reading,
    backMeaning: meaning,
  };
}

/**
 * Extracts a sorted list of unique tags from vocabulary items.
 *
 * @param {Array<object>} vocab
 * @returns {Array<string>}
 */
export function getAvailableTags(vocab = []) {
  const tagsSet = new Set();
  vocab.forEach((item) => {
    if (Array.isArray(item.tags)) {
      item.tags.forEach((tag) => {
        if (tag && typeof tag === 'string') {
          const trimmed = tag.trim();
          if (trimmed) tagsSet.add(trimmed);
        }
      });
    }
  });
  return Array.from(tagsSet).sort();
}

/**
 * Builds a review queue from vocabulary items according to session criteria.
 *
 * Steps mirror templates/index.html startSession():
 * 1. Filter by level (if level !== 'ALL')
 * 2. Filter by tag (if tag !== 'ALL')
 * 3. Filter for due cards (nextReviewDate <= nowMs)
 * 4. Fallback: If 0 cards are due but matching pool has cards, use the entire matching pool!
 * 5. Shuffle the resulting cards
 * 6. Slice to deck size (10, 20, or ALL)
 *
 * Does NOT mutate the input vocabulary array or individual objects.
 *
 * @param {Array<object>} vocab - List of vocabulary items
 * @param {object} options
 * @param {string} [options.level='ALL'] - 'ALL' | 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
 * @param {string} [options.tag='ALL'] - 'ALL' | specific tag
 * @param {string} [options.size='10'] - '10' | '20' | 'ALL'
 * @param {number} [nowMs=Date.now()] - Timestamp for due comparison
 * @param {Function} [rng=Math.random] - RNG function for shuffling
 * @returns {{ queue: Array<object>, totalPoolCount: number, dueCount: number, fellBackToAll: boolean }}
 */
export function buildReviewQueue(
  vocab = [],
  { level = 'ALL', tag = 'ALL', size = '10' } = {},
  nowMs = Date.now(),
  rng = Math.random
) {
  if (!Array.isArray(vocab) || vocab.length === 0) {
    return { queue: [], totalPoolCount: 0, dueCount: 0, fellBackToAll: false };
  }

  // 1. Level filter
  let pool = vocab;
  if (level && level !== 'ALL') {
    pool = pool.filter((w) => (w.level || '').toUpperCase() === level.toUpperCase());
  }

  // 2. Tag filter
  if (tag && tag !== 'ALL') {
    pool = pool.filter((w) => Array.isArray(w.tags) && w.tags.includes(tag));
  }

  const totalPoolCount = pool.length;
  if (totalPoolCount === 0) {
    return { queue: [], totalPoolCount: 0, dueCount: 0, fellBackToAll: false };
  }

  // Safely clone items with normalized SRS fields (does not mutate inputs)
  const normalizedPool = pool.map((item) => ({
    ...item,
    ...normalizeSrsFields(item, nowMs),
  }));

  // 3. Due filter
  const dueItems = normalizedPool.filter((item) => isDue(item, nowMs));
  const dueCount = dueItems.length;

  // 4. Fallback: if no cards are due, fallback to entire filtered pool
  let queue;
  let fellBackToAll = false;
  if (dueCount === 0) {
    queue = [...normalizedPool];
    fellBackToAll = true;
  } else {
    queue = [...dueItems];
  }

  // 5. Shuffle using legacy-style sort
  // (We use a copy and stable Fisher-Yates or RNG sort; with custom rng support)
  const shuffled = [...queue];
  if (typeof rng === 'function') {
    // Fisher-Yates with provided rng
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
  }

  // 6. Deck size limit
  let finalQueue = shuffled;
  if (size && size !== 'ALL') {
    const limit = parseInt(size, 10);
    if (!isNaN(limit) && limit > 0) {
      finalQueue = shuffled.slice(0, limit);
    }
  }

  return {
    queue: finalQueue,
    totalPoolCount,
    dueCount,
    fellBackToAll,
  };
}
