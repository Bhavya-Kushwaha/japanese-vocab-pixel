/**
 * gamification.js — XP, rank, streak, and level logic.
 *
 * Extracted from templates/index.html:
 *   grantXP(), updateStreak(), updateStats() (rank portion), checkRankUp().
 *
 * NO DOM access. NO localStorage access.
 * All functions are pure: input state → return result.
 *
 * NOTE: grantXP() in the original mixed DOM writes and localStorage writes
 * with the core arithmetic.  This module contains ONLY the arithmetic.
 * The caller is responsible for persisting the returned state and updating
 * the DOM.
 */

// ---------------------------------------------------------------------------
// Constants (original values preserved exactly)
// ---------------------------------------------------------------------------

/**
 * XP required per level — original comment: "level 1 needs 100xp, level 2
 * needs 150, etc."  The actual formula used in the code is:
 *   xpNeeded = xpLevel * XP_PER_LEVEL
 * so level 1 needs 100, level 2 needs 200, level 3 needs 300 …
 * (The comment is slightly misleading but the formula is preserved as-is.)
 */
export const XP_PER_LEVEL = 100;

/**
 * Rank definitions — derived from updateStats() in index.html (lines 963-989).
 * Each rank has:
 *   minWords  — minimum vocab count to enter this rank
 *   name      — display string
 *   theme     — NES.css class suffix (kept for reference; not applied here)
 *   barMax    — progress bar max value (words to next rank from minWords)
 *
 * Order is DESCENDING so the first matching rank wins.
 */
export const RANKS = [
  { minWords: 100, name: 'LEGEND',     theme: 'is-maroon',  barMax: 100 },
  { minWords: 50,  name: 'MASTER',     theme: 'is-error',   barMax: 50  },
  { minWords: 30,  name: 'WARRIOR',    theme: 'is-warning', barMax: 20  },
  { minWords: 10,  name: 'APPRENTICE', theme: 'is-success', barMax: 20  },
  { minWords: 0,   name: 'NOVICE',     theme: 'is-primary', barMax: 10  },
];

// ---------------------------------------------------------------------------
// XP / Level logic
// ---------------------------------------------------------------------------

/**
 * Apply an XP grant to the current player state.
 *
 * Mirrors the arithmetic inside grantXP() from index.html (lines 607-630).
 * Coins are incremented 1:1 with XP — preserved exactly.
 *
 * Handles exactly one level-up per call (same as the original which only
 * calls showLevelUpModal() once per grant).
 *
 * @param {{ totalXP: number, xpLevel: number, coins: number }} state
 * @param {number} amount - XP to grant (must be positive)
 * @returns {{ totalXP: number, xpLevel: number, coins: number, leveledUp: boolean }}
 */
export function applyXpGrant(state, amount) {
  let { totalXP, xpLevel, coins } = state;

  totalXP += amount;
  coins   += amount;          // 1:1 coin grant — original behaviour

  const xpNeeded = xpLevel * XP_PER_LEVEL;
  let leveledUp = false;

  if (totalXP >= xpNeeded) {
    totalXP -= xpNeeded;
    xpLevel++;
    leveledUp = true;
  }

  return { totalXP, xpLevel, coins, leveledUp };
}

/**
 * Returns the XP required to level up from the given level.
 *
 * Formula: xpLevel * XP_PER_LEVEL   (preserved from original)
 *
 * @param {number} xpLevel
 * @returns {number}
 */
export function xpNeededForLevel(xpLevel) {
  return xpLevel * XP_PER_LEVEL;
}

// ---------------------------------------------------------------------------
// Rank logic
// ---------------------------------------------------------------------------

/**
 * Calculate the current rank for a given vocab count.
 *
 * Derived from updateStats() in index.html (lines 963-989).
 * Returns the matched RANKS entry.
 *
 * @param {number} wordCount
 * @returns {{ minWords: number, name: string, theme: string, barMax: number }}
 */
export function calculateRank(wordCount) {
  for (const rank of RANKS) {
    if (wordCount >= rank.minWords) return rank;
  }
  return RANKS[RANKS.length - 1]; // fallback: NOVICE
}

/**
 * Calculate the progress bar value within the current rank tier.
 *
 * Derived from updateStats() (lines 963-1002).
 *
 * @param {number} wordCount
 * @returns {{ value: number, max: number, rank: string }}
 */
export function rankProgress(wordCount) {
  const rank = calculateRank(wordCount);

  let value = wordCount - rank.minWords;

  // LEGEND tier special case — cap visual progress at +100 (original line 972)
  if (rank.name === 'LEGEND' && value > 100) value = 100;

  return { value, max: rank.barMax, rank: rank.name };
}

// ---------------------------------------------------------------------------
// Streak logic
// ---------------------------------------------------------------------------

/**
 * Update the streak counter based on today's date.
 *
 * Mirrors updateStreak() from index.html (lines 646-662).
 * The original uses new Date().toDateString() and Date.now() - 86400000.
 * This function accepts those values as parameters for testability.
 *
 * Rules (preserved exactly):
 *   lastStudyDate === today     → no change (already counted)
 *   lastStudyDate === yesterday → streak++, lastStudyDate = today
 *   anything else               → streak = 1, lastStudyDate = today
 *
 * @param {{ streakCount: number, lastStudyDate: string }} state
 * @param {string} todayStr     - today as a Date string (e.g. "Fri Oct 03 2025")
 * @param {string} yesterdayStr - yesterday as a Date string
 * @returns {{ streakCount: number, lastStudyDate: string }}
 */
export function updateStreak(state, todayStr, yesterdayStr) {
  let { streakCount, lastStudyDate } = state;

  if (lastStudyDate === todayStr) {
    // already counted today — no change
  } else if (lastStudyDate === yesterdayStr) {
    streakCount++;
    lastStudyDate = todayStr;
  } else {
    // streak broken or first time
    streakCount = 1;
    lastStudyDate = todayStr;
  }

  return { streakCount, lastStudyDate };
}

/**
 * Convenience: compute today's and yesterday's date strings the same way
 * the original app does (new Date().toDateString() and Date.now() - 86400000).
 *
 * @param {number} nowMs - defaults to Date.now()
 * @returns {{ today: string, yesterday: string }}
 */
export function getStreakDates(nowMs = Date.now()) {
  return {
    today:     new Date(nowMs).toDateString(),
    yesterday: new Date(nowMs - 86400000).toDateString(),
  };
}
