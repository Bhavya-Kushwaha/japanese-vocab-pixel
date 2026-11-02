/**
 * quests.js — Daily quest generation and progress tracking.
 *
 * Extracted from templates/index.html:
 *   QUEST_TYPES, generateQuests(), updateQuestProgress().
 *
 * NO DOM access. NO localStorage access.
 * All functions are pure: input state → return result.
 */

// ---------------------------------------------------------------------------
// Constants (original values preserved exactly)
// ---------------------------------------------------------------------------

/**
 * Quest type definitions — original QUEST_TYPES from index.html (lines 1713-1717).
 * Each type defines possible target values and a description template.
 */
export const QUEST_TYPES = [
  { id: 'xp',    desc: 'Earn {target} XP',                      target: [50, 100, 200] },
  { id: 'words', desc: 'Add {target} new words',                 target: [5, 10, 20]   },
  { id: 'quiz',  desc: 'Answer {target} questions correctly',    target: [10, 25, 50]   },
];

// ---------------------------------------------------------------------------
// Quest generation
// ---------------------------------------------------------------------------

/**
 * Generate a fresh set of 3 daily quests.
 *
 * Mirrors the generation block inside generateQuests() from index.html
 * (lines 1719-1740) — exactly 3 quests, random type and target from each type.
 *
 * To be testable, this function accepts a seeded random function so tests
 * can produce deterministic output without touching the original rules.
 *
 * @param {string} todayDateStr  - today as Date.toDateString()
 * @param {Function} [rng=Math.random] - random function, returns [0,1)
 * @returns {Array<{ id: string, type: string, desc: string, target: number, progress: number, completed: boolean, reward: number }>}
 */
export function generateDailyQuests(todayDateStr, rng = Math.random) {
  const quests = [];
  for (let i = 0; i < 3; i++) {
    const qType  = QUEST_TYPES[Math.floor(rng() * QUEST_TYPES.length)];
    const target = qType.target[Math.floor(rng() * qType.target.length)];
    quests.push({
      id:        qType.id + '_' + i,
      type:      qType.id,
      desc:      qType.desc.replace('{target}', target),
      target,
      progress:  0,
      completed: false,
      reward:    target,           // reward = target value — original behaviour
    });
  }
  return quests;
}

/**
 * Decide whether new quests should be generated.
 *
 * Mirrors the condition in generateQuests() (lines 1721):
 *   lastQuestDate !== todayDate || !dailyQuests
 *
 * @param {string|null} lastQuestDate
 * @param {Array|null}  dailyQuests
 * @param {string}      todayDateStr
 * @returns {boolean}
 */
export function shouldRegenerateQuests(lastQuestDate, dailyQuests, todayDateStr) {
  return lastQuestDate !== todayDateStr || !dailyQuests;
}

// ---------------------------------------------------------------------------
// Quest progress
// ---------------------------------------------------------------------------

/**
 * Apply progress to quests of the matching type.
 *
 * Mirrors updateQuestProgress() from index.html (lines 1768-1788).
 *
 * Rules (preserved exactly):
 *   - Only incomplete quests of matching type are updated.
 *   - progress is capped at target when completed.
 *   - Returns the updated quests array and any completion events.
 *
 * XP grants and DOM side-effects are NOT included.  The caller receives
 * `completed` events and is responsible for calling grantXP / showing toasts.
 *
 * @param {Array} quests  - current dailyQuests array
 * @param {string} type   - quest type id ('xp', 'words', 'quiz')
 * @param {number} amount - amount of progress to add
 * @returns {{ quests: Array, completedQuests: Array }}
 *   completedQuests contains the quests that were just completed this call.
 */
export function applyQuestProgress(quests, type, amount) {
  if (!quests) return { quests, completedQuests: [] };

  const completedQuests = [];

  const updatedQuests = quests.map(q => {
    if (q.type !== type || q.completed) return q;

    const updated = { ...q };
    updated.progress += amount;

    if (updated.progress >= updated.target) {
      updated.progress  = updated.target;   // cap — original behaviour
      updated.completed = true;
      completedQuests.push(updated);
    }

    return updated;
  });

  return { quests: updatedQuests, completedQuests };
}
