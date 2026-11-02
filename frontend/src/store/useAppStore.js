/**
 * useAppStore.js — Centralized Zustand store for Fuku.
 *
 * Manages:
 * - Vocabulary & SRS metadata (SM-2)
 * - XP, level, and derived ranks
 * - Daily quests & progress
 * - Streaks & study history
 * - Achievements & unlock checks
 * - Inventory & shop transactions
 * - Themes & quiz statistics
 * - Safe legacy data migration
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import {
  FUKU_STORAGE_KEY,
  SCHEMA_VERSION,
  INITIAL_PERSISTENT_STATE,
  INITIAL_TRANSIENT_STATE,
} from './constants.js';
import { defaultStorage } from './storageAdapter.js';
import {
  extractLegacyData,
  validateAndMigrateLegacy,
} from './legacyMigration.js';

import { processReview, reviewXp, isDue, newSrsFields } from '../logic/srs.js';
import {
  applyXpGrant,
  calculateRank,
  rankProgress,
  xpNeededForLevel,
  updateStreak as logicUpdateStreak,
  getStreakDates,
} from '../logic/gamification.js';
import {
  generateDailyQuests,
  shouldRegenerateQuests,
  applyQuestProgress,
} from '../logic/quests.js';
import { checkAchievements as logicCheckAchievements } from '../logic/achievements.js';
import { attemptPurchase, getShopItem, isOwned } from '../logic/shop.js';

/**
 * Filter state to only persistent keys for storage serialization.
 */
function partializeState(state) {
  return {
    vocab: state.vocab,
    totalXP: state.totalXP,
    xpLevel: state.xpLevel,
    streakCount: state.streakCount,
    lastStudyDate: state.lastStudyDate,
    unlockedAchievements: state.unlockedAchievements,
    coins: state.coins,
    inventory: state.inventory,
    dailyQuests: state.dailyQuests,
    lastQuestDate: state.lastQuestDate,
    totalQuizAnswers: state.totalQuizAnswers,
    activeTheme: state.activeTheme,
    migrationMeta: state.migrationMeta,
  };
}

/**
 * Factory function to create an isolated Fuku store instance.
 * Useful for tests, SSR, or standalone store operations.
 *
 * @param {Object} [options]
 * @param {Object} [options.initialState]
 * @param {Object} [options.storage]
 * @param {boolean} [options.disablePersist=false]
 * @returns {import('zustand').StoreApi<any>}
 */
export function createAppStore(options = {}) {
  const {
    initialState = {},
    storage = defaultStorage,
    disablePersist = false,
  } = options;

  const storeInitializer = (set, get) => ({
    // Persistent state fields
    ...INITIAL_PERSISTENT_STATE,
    ...initialState,

    // Transient UI / session state
    ...INITIAL_TRANSIENT_STATE,

    // =========================================================================
    // DERIVED GETTERS / SELECTORS
    // =========================================================================
    getRank: () => calculateRank(get().vocab.length),
    getRankProgress: () => rankProgress(get().vocab.length),
    getXpNeeded: () => xpNeededForLevel(get().xpLevel),
    getXpProgressPercent: () => {
      const { totalXP, xpLevel } = get();
      const needed = xpNeededForLevel(xpLevel);
      if (needed <= 0) return 100;
      return Math.min(100, Math.round((totalXP / needed) * 100));
    },
    getDueWords: (nowMs = Date.now()) => get().vocab.filter((w) => isDue(w, nowMs)),
    isItemOwned: (itemId) => isOwned(itemId, get().inventory),

    // =========================================================================
    // VOCABULARY ACTIONS
    // =========================================================================
    addWord: (wordData, nowMs = Date.now()) => {
      const state = get();
      const kanji = typeof wordData.kanji === 'string' ? wordData.kanji.trim() : '';
      const reading = typeof wordData.reading === 'string' ? wordData.reading.trim() : '';

      const isDuplicate = state.vocab.some(
        (v) => (kanji && v.kanji === kanji) || (reading && v.reading === reading)
      );

      if (isDuplicate) {
        return { success: false, reason: 'duplicate', entry: null };
      }

      const newEntry = {
        id: wordData.id ?? (nowMs + Math.random()),
        kanji,
        reading,
        meaning: typeof wordData.meaning === 'string' ? wordData.meaning.trim() : '',
        level: wordData.level || 'ALL',
        tags: Array.isArray(wordData.tags) ? [...wordData.tags] : [],
        ...newSrsFields(nowMs),
        ...wordData,
      };

      set((s) => ({
        vocab: [newEntry, ...s.vocab],
      }));

      // Legacy parity: grantXP(10), updateStreak(), checkAchievements()
      // NOTE: legacy addWord() does NOT call updateQuestProgress('words', 1)
      get().grantXP(10);
      get().updateStreak(nowMs);
      get().checkAchievements();

      return { success: true, reason: 'ok', entry: newEntry };
    },

    addWords: (wordsArray, xpPerWord = 3, nowMs = Date.now()) => {
      if (!Array.isArray(wordsArray) || wordsArray.length === 0) {
        return { addedCount: 0, entries: [] };
      }

      const currentVocab = get().vocab;
      const addedEntries = [];

      for (const w of wordsArray) {
        const kanji = typeof w.kanji === 'string' ? w.kanji.trim() : '';
        const reading = typeof w.reading === 'string' ? w.reading.trim() : '';

        const isDuplicate =
          currentVocab.some((v) => (kanji && v.kanji === kanji) || (reading && v.reading === reading)) ||
          addedEntries.some((v) => (kanji && v.kanji === kanji) || (reading && v.reading === reading));

        if (!isDuplicate) {
          const entry = {
            id: w.id ?? (nowMs + Math.random()),
            kanji,
            reading,
            meaning: typeof w.meaning === 'string' ? w.meaning.trim() : '',
            level: w.level || 'ALL',
            tags: Array.isArray(w.tags) ? [...w.tags] : [],
            ...newSrsFields(nowMs),
            ...w,
          };
          addedEntries.unshift(entry);
        }
      }

      if (addedEntries.length > 0) {
        set((s) => ({
          vocab: [...addedEntries, ...s.vocab],
        }));

        // Legacy parity: grantXP only, no updateQuestProgress('words', ...)
        const totalXp = addedEntries.length * xpPerWord;
        get().grantXP(totalXp);
        get().checkAchievements();
      }

      return { addedCount: addedEntries.length, entries: addedEntries };
    },

    deleteWord: (id) => {
      set((s) => ({
        vocab: s.vocab.filter((item) => item.id !== id),
      }));
    },

    updateWord: (id, updates) => {
      set((s) => ({
        vocab: s.vocab.map((item) => (item.id === id ? { ...item, ...updates } : item)),
      }));
    },

    addTag: (id, tag) => {
      if (!tag || typeof tag !== 'string') return;
      const cleanTag = tag.trim().toLowerCase();
      if (!cleanTag) return;

      set((s) => ({
        vocab: s.vocab.map((item) => {
          if (item.id !== id) return item;
          const currentTags = Array.isArray(item.tags) ? item.tags : [];
          if (currentTags.includes(cleanTag)) return item;
          return { ...item, tags: [...currentTags, cleanTag] };
        }),
      }));
    },

    // =========================================================================
    // SRS REVIEW ACTIONS
    // =========================================================================
    reviewWord: (id, quality, nowMs = Date.now()) => {
      const word = get().vocab.find((v) => v.id === id);
      if (!word) {
        return { success: false, reason: 'not_found' };
      }

      const srsUpdate = processReview(word, quality, nowMs);
      const updatedWord = { ...word, ...srsUpdate };

      set((s) => ({
        vocab: s.vocab.map((v) => (v.id === id ? updatedWord : v)),
      }));

      const xpGained = reviewXp(quality);
      // grantXP already updates totalXP, coins (1:1), and forwards to 'xp' daily quest once.
      // Legacy processReview() does NOT call checkAchievements(), updateStreak(), or words/quiz quests.
      get().grantXP(xpGained);

      return { success: true, updatedWord, xpGained };
    },

    // =========================================================================
    // GAMIFICATION (XP, LEVEL, STREAK)
    // =========================================================================
    grantXP: (amount) => {
      if (typeof amount !== 'number' || amount <= 0) return { leveledUp: false };

      const { totalXP, xpLevel, coins } = get();
      const result = applyXpGrant({ totalXP, xpLevel, coins }, amount);

      set({
        totalXP: result.totalXP,
        xpLevel: result.xpLevel,
        coins: result.coins,
      });

      // Also forward XP progress to daily quests
      get().updateQuestProgress('xp', amount);

      return result;
    },

    updateStreak: (nowMs = Date.now()) => {
      const { today, yesterday } = getStreakDates(nowMs);
      const { streakCount, lastStudyDate } = get();

      const result = logicUpdateStreak({ streakCount, lastStudyDate }, today, yesterday);
      set({
        streakCount: result.streakCount,
        lastStudyDate: result.lastStudyDate,
      });

      get().checkAchievements();
      return result;
    },

    // =========================================================================
    // DAILY QUESTS
    // =========================================================================
    generateQuests: (force = false, nowMs = Date.now(), rng = Math.random) => {
      const today = new Date(nowMs).toDateString();
      const { lastQuestDate, dailyQuests } = get();

      if (force || shouldRegenerateQuests(lastQuestDate, dailyQuests, today)) {
        const newQuests = generateDailyQuests(today, rng);
        set({
          dailyQuests: newQuests,
          lastQuestDate: today,
        });
        return newQuests;
      }
      return dailyQuests;
    },

    updateQuestProgress: (type, amount) => {
      const { dailyQuests } = get();
      if (!dailyQuests) return { completedQuests: [] };

      const { quests, completedQuests } = applyQuestProgress(dailyQuests, type, amount);
      set({ dailyQuests: quests });

      // Grant rewards for completed quests
      for (const q of completedQuests) {
        if (q.reward > 0) {
          get().grantXP(q.reward);
        }
      }

      return { completedQuests };
    },

    // =========================================================================
    // ACHIEVEMENTS
    // =========================================================================
    checkAchievements: () => {
      const { vocab, streakCount, totalQuizAnswers, unlockedAchievements } = get();
      const newlyUnlocked = logicCheckAchievements(unlockedAchievements, {
        vocabCount: vocab.length,
        streakCount,
        totalQuizAnswers,
      });

      if (newlyUnlocked.length > 0) {
        const updatedUnlocked = [
          ...unlockedAchievements,
          ...newlyUnlocked.map((a) => a.id),
        ];
        set({ unlockedAchievements: updatedUnlocked });

        // Grant XP for each newly unlocked achievement
        for (const ach of newlyUnlocked) {
          if (ach.xp > 0) {
            get().grantXP(ach.xp);
          }
        }
      }

      return newlyUnlocked;
    },

    // =========================================================================
    // SHOP & THEMES
    // =========================================================================
    buyItem: (itemId) => {
      const item = getShopItem(itemId);
      if (!item) {
        return { success: false, reason: 'item_not_found' };
      }

      const { coins, inventory } = get();
      const result = attemptPurchase(itemId, item.cost, coins, inventory);

      if (result.success) {
        set({
          coins: result.coins,
          inventory: result.inventory,
        });
      }

      return result;
    },

    setTheme: (themeId) => {
      const currentTheme = get().activeTheme;
      const nextTheme = currentTheme === themeId ? 'default' : themeId;
      set({ activeTheme: nextTheme });
      return nextTheme;
    },

    // =========================================================================
    // QUIZ ACTIONS
    // =========================================================================
    recordQuizAnswer: ({ isCorrect, xpGain, nowMs = Date.now() }) => {
      const resolvedXp = typeof xpGain === 'number' ? xpGain : (isCorrect ? 15 : 2);

      set((s) => ({
        totalQuizAnswers: s.totalQuizAnswers + 1,
        quizSession: {
          correct: s.quizSession.correct + (isCorrect ? 1 : 0),
          wrong: s.quizSession.wrong + (isCorrect ? 0 : 1),
          xpGained: s.quizSession.xpGained + resolvedXp,
        },
      }));

      get().grantXP(resolvedXp);
      get().updateStreak(nowMs);

      if (isCorrect) {
        get().updateQuestProgress('quiz', 1);
      }
      get().checkAchievements();
    },

    resetQuizSession: () => {
      set({
        quizSession: { correct: 0, wrong: 0, xpGained: 0 },
      });
    },

    // =========================================================================
    // MIGRATION & BACKUP
    // =========================================================================
    migrateLegacy: (source, options = {}) => {
      const extracted = extractLegacyData(source);
      if (extracted.errors.length > 0 && Object.keys(extracted.data).length === 0) {
        return {
          success: false,
          hasLegacyData: false,
          alreadyMigrated: Boolean(get().migrationMeta?.migrated),
          vocabAdded: 0,
          achievementsAdded: 0,
          inventoryAdded: 0,
          totalXP: get().totalXP,
          coins: get().coins,
          streakCount: get().streakCount,
          warnings: [],
          errors: extracted.errors,
        };
      }

      const { migratedState, report } = validateAndMigrateLegacy(extracted.data, get(), options);
      if (extracted.errors.length > 0) {
        report.errors.push(...extracted.errors);
      }

      // Update store with migrated state safely
      set({
        ...migratedState,
        migrationMeta: {
          migrated: true,
          migratedAt: get().migrationMeta?.migratedAt || Date.now(),
          source: get().migrationMeta?.source || extracted.sourceDesc,
        },
      });

      return report;
    },

    importLegacyData: (source, options = {}) => {
      return get().migrateLegacy(source, { ...options, allowMerge: true });
    },

    resetProgress: () => {
      set({
        ...INITIAL_PERSISTENT_STATE,
        ...INITIAL_TRANSIENT_STATE,
      });
    },
  });

  if (disablePersist) {
    return create(storeInitializer);
  }

  return create(
    persist(storeInitializer, {
      name: FUKU_STORAGE_KEY,
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => storage),
      partialize: partializeState,
      migrate: (persistedState, version) => {
        // Handle future schema transitions here
        if (version === 0) {
          // Future migration from v0 to v1 if applicable
          return { ...INITIAL_PERSISTENT_STATE, ...persistedState };
        }
        return persistedState;
      },
    })
  );
}

/**
 * Singleton Fuku application store hook for React components.
 */
export const useAppStore = createAppStore();

// =============================================================================
// STANDALONE SELECTOR FUNCTIONS (for optimal component subscriptions)
// =============================================================================
export const selectRank = (state) => calculateRank(state.vocab.length);
export const selectRankProgress = (state) => rankProgress(state.vocab.length);
export const selectXpNeeded = (state) => xpNeededForLevel(state.xpLevel);
export const selectXpProgressPercent = (state) => {
  const needed = xpNeededForLevel(state.xpLevel);
  if (needed <= 0) return 100;
  return Math.min(100, Math.round((state.totalXP / needed) * 100));
};
export const selectDueWords = (state, nowMs = Date.now()) =>
  state.vocab.filter((w) => isDue(w, nowMs));
export const selectIsOwned = (state, itemId) => isOwned(itemId, state.inventory);
