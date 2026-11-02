/**
 * srs.js — SM-2 Spaced Repetition System logic.
 *
 * Extracted verbatim from templates/index.html (processReview, addWord
 * SRS init block, and addFromBank SRS init block).
 *
 * NO DOM access. NO localStorage access.
 * All functions are pure: input state → return result.
 */

// ---------------------------------------------------------------------------
// Constants (original values preserved exactly)
// ---------------------------------------------------------------------------

/** Milliseconds in one day — used to compute nextReviewDate. */
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Minimum ease factor — SM-2 spec floor. */
export const MIN_EFACTOR = 1.3;

/** Default ease factor for new cards. */
export const DEFAULT_EFACTOR = 2.5;

// ---------------------------------------------------------------------------
// New-card factory helpers
// ---------------------------------------------------------------------------

/**
 * Returns the SRS fields for a newly created vocab entry.
 * Used by addWord() and addFromBank() in the original app.
 *
 * @param {number} nowMs - current timestamp in ms (defaults to Date.now())
 * @returns {{ interval: number, repetition: number, efactor: number, nextReviewDate: number }}
 */
export function newSrsFields(nowMs = Date.now()) {
  return {
    interval: 0,
    repetition: 0,
    efactor: DEFAULT_EFACTOR,
    nextReviewDate: nowMs,
  };
}

/**
 * Normalizes SRS metadata fields safely with defaults.
 *
 * @param {object} item
 * @param {number} nowMs - fallback timestamp in ms (defaults to Date.now())
 * @returns {{ interval: number, repetition: number, efactor: number, nextReviewDate: number }}
 */
export function normalizeSrsFields(item = {}, nowMs = Date.now()) {
  const interval = typeof item?.interval === 'number' && !isNaN(item.interval) ? Math.max(0, item.interval) : 0;
  const repetition = typeof item?.repetition === 'number' && !isNaN(item.repetition) ? Math.max(0, item.repetition) : 0;
  const efactor = typeof item?.efactor === 'number' && !isNaN(item.efactor) ? Math.max(MIN_EFACTOR, item.efactor) : DEFAULT_EFACTOR;
  const nextReviewDate =
    typeof item?.nextReviewDate === 'number' && !isNaN(item.nextReviewDate) && item.nextReviewDate > 0
      ? item.nextReviewDate
      : nowMs;

  return { interval, repetition, efactor, nextReviewDate };
}

// ---------------------------------------------------------------------------
// Core SM-2 review logic
// ---------------------------------------------------------------------------

/**
 * Process one flashcard review and return the updated SRS fields for the card.
 *
 * This is the pure business-logic portion of processReview() from index.html
 * (lines 1309-1344). The function returns a new object; it does NOT mutate
 * the input item.
 *
 * Original XP grants and DOM side-effects are intentionally NOT included here.
 * The caller is responsible for applying those after calling this function.
 *
 * SM-2 algorithm rules (preserved exactly):
 *   quality < 3  → reset repetition to 0, interval to 1
 *   quality >= 3 → interval progression:
 *     repetition === 0 → interval = 1
 *     repetition === 1 → interval = 6
 *     repetition >= 2  → interval = round(interval * efactor)
 *     then repetition++
 *   efactor updated in all cases:
 *     efactor = efactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
 *     clamped to MIN_EFACTOR (1.3)
 *   nextReviewDate = now + interval * MS_PER_DAY
 *
 * @param {{ repetition: number, interval: number, efactor: number }} item
 * @param {number} quality - rating: 1 (again), 3 (hard), 5 (easy)
 * @param {number} nowMs   - current timestamp in ms (defaults to Date.now())
 * @returns {{ repetition: number, interval: number, efactor: number, nextReviewDate: number }}
 */
export function processReview(item, quality, nowMs = Date.now()) {
  const normalized = normalizeSrsFields(item, nowMs);
  let { repetition, interval, efactor } = normalized;

  if (quality < 3) {
    repetition = 0;
    interval = 1;
  } else {
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * efactor);
    }
    repetition++;
  }

  // SM-2 efactor update formula — preserved exactly from original
  efactor = efactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (efactor < MIN_EFACTOR) efactor = MIN_EFACTOR;

  const nextReviewDate = nowMs + interval * MS_PER_DAY;

  return { repetition, interval, efactor, nextReviewDate };
}

/**
 * Returns the XP reward for a single flashcard review answer.
 * Preserved from original: quality >= 3 → 7 XP, otherwise → 3 XP.
 *
 * @param {number} quality
 * @returns {number}
 */
export function reviewXp(quality) {
  return quality >= 3 ? 7 : 3;
}

/**
 * Determines whether a vocab item is due for review.
 *
 * @param {{ nextReviewDate: number }} item
 * @param {number} nowMs - current timestamp in ms (defaults to Date.now())
 * @returns {boolean}
 */
export function isDue(item, nowMs = Date.now()) {
  const nextReviewDate = typeof item?.nextReviewDate === 'number' && !isNaN(item.nextReviewDate)
    ? item.nextReviewDate
    : nowMs;
  return nextReviewDate <= nowMs;
}

