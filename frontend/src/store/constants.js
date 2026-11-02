/**
 * constants.js — Storage keys, schema versions, and initial state definitions
 * for the Fuku Zustand store.
 */

export const FUKU_STORAGE_KEY = 'fuku_store_v1';
export const SCHEMA_VERSION = 1;

/**
 * Exact legacy localStorage keys discovered in Vocab Quest (templates/index.html).
 */
export const LEGACY_STORAGE_KEYS = {
  vocabData: 'vocabData',
  totalXP: 'totalXP',
  xpLevel: 'xpLevel',
  streakCount: 'streakCount',
  lastStudyDate: 'lastStudyDate',
  unlockedAchievements: 'unlockedAchievements',
  coins: 'coins',
  inventory: 'inventory',
  dailyQuests: 'dailyQuests',
  lastQuestDate: 'lastQuestDate',
  totalQuizAnswers: 'totalQuizAnswers',
  activeTheme: 'activeTheme',
};

/**
 * List of all legacy storage keys as an array for batch operations.
 */
export const ALL_LEGACY_KEYS = Object.values(LEGACY_STORAGE_KEYS);

/**
 * Default persistent state for the Fuku application.
 */
export const INITIAL_PERSISTENT_STATE = {
  vocab: [],
  totalXP: 0,
  xpLevel: 1,
  streakCount: 0,
  lastStudyDate: '',
  unlockedAchievements: [],
  coins: 0,
  inventory: [],
  dailyQuests: null,
  lastQuestDate: '',
  totalQuizAnswers: 0,
  activeTheme: 'default',
  migrationMeta: {
    migrated: false,
    migratedAt: null,
    source: null,
  },
};

/**
 * Transient (in-memory only, not persisted to localStorage) state.
 */
export const INITIAL_TRANSIENT_STATE = {
  quizSession: {
    correct: 0,
    wrong: 0,
    xpGained: 0,
  },
  lastError: null,
};
