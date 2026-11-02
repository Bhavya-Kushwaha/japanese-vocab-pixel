/**
 * achievements.js — Achievement definitions and evaluation logic.
 *
 * Extracted from templates/index.html:
 *   ACHIEVEMENTS const, checkAchievements().
 *
 * NO DOM access. NO localStorage access.
 *
 * IMPORTANT: In the original, ACHIEVEMENTS.check() closures directly read the
 * global variables myVocab, streakCount, and localStorage ('totalQuizAnswers').
 * In this module, the check functions are replaced with pure equivalents that
 * receive the required values as parameters, preserving the exact thresholds
 * and logic.
 */

// ---------------------------------------------------------------------------
// Achievement definitions (original values preserved exactly)
// ---------------------------------------------------------------------------

/**
 * Achievement definitions.
 *
 * Each achievement has:
 *   id    — unique string key (used for storage)
 *   label — display name
 *   desc  — description
 *   xp    — XP reward on unlock
 *   check — pure function(context) → boolean
 *
 * context shape:
 *   {
 *     vocabCount:       number,  // myVocab.length
 *     streakCount:      number,  // current streak
 *     totalQuizAnswers: number,  // from storage in original; passed in here
 *   }
 *
 * Thresholds are identical to the original:
 *   first_word:    vocabCount >= 1,   xp: 10
 *   ten_words:     vocabCount >= 10,  xp: 25
 *   fifty_words:   vocabCount >= 50,  xp: 100
 *   hundred_words: vocabCount >= 100, xp: 250
 *   streak_3:      streakCount >= 3,  xp: 30
 *   streak_7:      streakCount >= 7,  xp: 75
 *   quiz_10:       totalQuizAnswers >= 10, xp: 20
 */
export const ACHIEVEMENTS = [
  {
    id:    'first_word',
    label: '🌱 First Steps',
    desc:  'Collected your first word!',
    xp:    10,
    check: (ctx) => ctx.vocabCount >= 1,
  },
  {
    id:    'ten_words',
    label: '📚 Bookworm',
    desc:  'Collected 10 words!',
    xp:    25,
    check: (ctx) => ctx.vocabCount >= 10,
  },
  {
    id:    'fifty_words',
    label: '🌟 Word Master',
    desc:  'Collected 50 words!',
    xp:    100,
    check: (ctx) => ctx.vocabCount >= 50,
  },
  {
    id:    'hundred_words',
    label: '👑 LEGEND',
    desc:  'Collected 100 words!',
    xp:    250,
    check: (ctx) => ctx.vocabCount >= 100,
  },
  {
    id:    'streak_3',
    label: '🔥 On Fire',
    desc:  'Studied 3 days in a row!',
    xp:    30,
    check: (ctx) => ctx.streakCount >= 3,
  },
  {
    id:    'streak_7',
    label: '⚡ Unstoppable',
    desc:  'Studied 7 days in a row!',
    xp:    75,
    check: (ctx) => ctx.streakCount >= 7,
  },
  {
    id:    'quiz_10',
    label: '⚔️ Quiz Warrior',
    desc:  'Answered 10 quiz questions!',
    xp:    20,
    check: (ctx) => ctx.totalQuizAnswers >= 10,
  },
];

// ---------------------------------------------------------------------------
// Achievement evaluation
// ---------------------------------------------------------------------------

/**
 * Check all achievements and return those newly unlocked this call.
 *
 * Mirrors checkAchievements() from index.html (lines 678-688).
 *
 * Rules (preserved exactly):
 *   - Only achievements not already in unlockedIds are evaluated.
 *   - Any that now pass their check() are returned as newly unlocked.
 *   - Does NOT mutate unlockedIds — the caller owns state updates.
 *
 * @param {string[]} unlockedIds - array of already-unlocked achievement ids
 * @param {{ vocabCount: number, streakCount: number, totalQuizAnswers: number }} context
 * @returns {Array<{ id: string, label: string, desc: string, xp: number }>}
 *   Array of newly unlocked achievement objects (may be empty).
 */
export function checkAchievements(unlockedIds, context) {
  const newlyUnlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (!unlockedIds.includes(a.id) && a.check(context)) {
      newlyUnlocked.push(a);
    }
  }
  return newlyUnlocked;
}
