/**
 * store.test.js — Comprehensive tests for the Fuku Zustand store and legacy migration.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  createAppStore,
  selectRank,
  selectRankProgress,
  selectXpNeeded,
  selectXpProgressPercent,
  selectDueWords,
  selectIsOwned,
  MemoryStorage,
  createSafeStorage,
  LEGACY_STORAGE_KEYS,
  validateAndMigrateLegacy,
  extractLegacyData,
  exportLegacyFromStorage,
  exportFukuBackup,
} from './store/index.js';

// =============================================================================
// REALISTIC LEGACY FIXTURES (derived directly from templates/index.html schema)
// =============================================================================
const REPRESENTATIVE_LEGACY_DATA = {
  vocabData: JSON.stringify([
    {
      id: 1728000000001,
      kanji: '食べる',
      reading: 'たべる',
      meaning: 'to eat',
      level: 'N5',
      tags: ['verb', 'food'],
      interval: 6,
      repetition: 2,
      efactor: 2.6,
      nextReviewDate: 1728600000000,
    },
    {
      id: 1728000000002,
      kanji: '猫',
      reading: 'ねこ',
      meaning: 'cat',
      level: 'N5',
      tags: ['animal'],
      interval: 1,
      repetition: 1,
      efactor: 2.5,
      nextReviewDate: 1728086400000,
    },
  ]),
  totalXP: '145',
  xpLevel: '2',
  streakCount: '4',
  lastStudyDate: 'Sat Oct 11 2025',
  unlockedAchievements: JSON.stringify(['first_word', 'streak_3']),
  coins: '145',
  inventory: JSON.stringify(['theme_cyberpunk']),
  dailyQuests: JSON.stringify([
    {
      id: 'xp_0',
      type: 'xp',
      desc: 'Earn 50 XP',
      target: 50,
      progress: 30,
      completed: false,
      reward: 50,
    },
  ]),
  lastQuestDate: 'Sat Oct 11 2025',
  totalQuizAnswers: '8',
  activeTheme: 'theme_cyberpunk',
};

describe('Fuku Store — Initial State', () => {
  let store;

  beforeEach(() => {
    store = createAppStore({ storage: new MemoryStorage() });
  });

  it('initializes persistent state with correct default values', () => {
    const state = store.getState();
    expect(state.vocab).toEqual([]);
    expect(state.totalXP).toBe(0);
    expect(state.xpLevel).toBe(1);
    expect(state.streakCount).toBe(0);
    expect(state.lastStudyDate).toBe('');
    expect(state.unlockedAchievements).toEqual([]);
    expect(state.coins).toBe(0);
    expect(state.inventory).toEqual([]);
    expect(state.dailyQuests).toBeNull();
    expect(state.lastQuestDate).toBe('');
    expect(state.totalQuizAnswers).toBe(0);
    expect(state.activeTheme).toBe('default');
    expect(state.migrationMeta).toEqual({
      migrated: false,
      migratedAt: null,
      source: null,
    });
  });

  it('initializes transient state with clean session values', () => {
    const state = store.getState();
    expect(state.quizSession).toEqual({ correct: 0, wrong: 0, xpGained: 0 });
  });

  it('computes correct derived values on initial state', () => {
    const state = store.getState();
    expect(state.getRank().name).toBe('NOVICE');
    expect(state.getRankProgress()).toEqual({ value: 0, max: 10, rank: 'NOVICE' });
    expect(state.getXpNeeded()).toBe(100);
    expect(state.getXpProgressPercent()).toBe(0);
    expect(state.getDueWords()).toEqual([]);

    // Standalone selectors
    expect(selectRank(state).name).toBe('NOVICE');
    expect(selectRankProgress(state)).toEqual({ value: 0, max: 10, rank: 'NOVICE' });
    expect(selectXpNeeded(state)).toBe(100);
    expect(selectXpProgressPercent(state)).toBe(0);
    expect(selectDueWords(state)).toEqual([]);
    expect(selectIsOwned(state, 'theme_cyberpunk')).toBe(false);
  });

  it('verifies legacy extraction and key constants', () => {
    expect(LEGACY_STORAGE_KEYS.vocabData).toBe('vocabData');
    expect(LEGACY_STORAGE_KEYS.totalXP).toBe('totalXP');

    const extracted = extractLegacyData(REPRESENTATIVE_LEGACY_DATA);
    expect(extracted.errors).toHaveLength(0);
    expect(extracted.data.totalXP).toBe('145');

    const { migratedState } = validateAndMigrateLegacy(extracted.data);
    expect(migratedState.totalXP).toBe(145);
  });
});

describe('Fuku Store — Legacy Data Migration', () => {
  it('migrates exact legacy schema without data loss', () => {
    const store = createAppStore({ storage: new MemoryStorage() });
    const report = store.getState().migrateLegacy(REPRESENTATIVE_LEGACY_DATA);

    expect(report.success).toBe(true);
    expect(report.hasLegacyData).toBe(true);
    expect(report.vocabAdded).toBe(2);

    const state = store.getState();
    expect(state.vocab.length).toBe(2);
    expect(state.vocab[0].kanji).toBe('食べる');
    expect(state.vocab[0].reading).toBe('たべる');
    expect(state.vocab[0].efactor).toBe(2.6);
    expect(state.vocab[0].interval).toBe(6);
    expect(state.vocab[0].repetition).toBe(2);
    expect(state.vocab[0].nextReviewDate).toBe(1728600000000);
    expect(state.vocab[0].tags).toEqual(['verb', 'food']);

    expect(state.totalXP).toBe(145);
    expect(state.xpLevel).toBe(2);
    expect(state.streakCount).toBe(4);
    expect(state.lastStudyDate).toBe('Sat Oct 11 2025');
    expect(state.unlockedAchievements).toEqual(['first_word', 'streak_3']);
    expect(state.coins).toBe(145);
    expect(state.inventory).toEqual(['theme_cyberpunk']);
    expect(state.totalQuizAnswers).toBe(8);
    expect(state.activeTheme).toBe('theme_cyberpunk');
    expect(state.dailyQuests).toHaveLength(1);
    expect(state.dailyQuests[0].target).toBe(50);
    expect(state.migrationMeta.migrated).toBe(true);
  });

  it('does not mutate or delete original legacy storage keys during migration', () => {
    const legacyStorage = new MemoryStorage();
    for (const [k, v] of Object.entries(REPRESENTATIVE_LEGACY_DATA)) {
      legacyStorage.setItem(k, v);
    }

    const store = createAppStore({ storage: new MemoryStorage() });
    store.getState().migrateLegacy(legacyStorage);

    // Verify all legacy keys still exist unchanged in the source storage
    for (const [k, v] of Object.entries(REPRESENTATIVE_LEGACY_DATA)) {
      expect(legacyStorage.getItem(k)).toBe(v);
    }
  });

  it('is repeatable and prevents duplicate vocab and rewards on multiple runs', () => {
    const store = createAppStore({ storage: new MemoryStorage() });

    // First migration
    const report1 = store.getState().migrateLegacy(REPRESENTATIVE_LEGACY_DATA);
    expect(report1.vocabAdded).toBe(2);
    expect(store.getState().vocab.length).toBe(2);
    expect(store.getState().totalXP).toBe(145);
    expect(store.getState().coins).toBe(145);

    // Second migration with identical data
    const report2 = store.getState().migrateLegacy(REPRESENTATIVE_LEGACY_DATA);
    expect(report2.vocabAdded).toBe(0); // No words added
    expect(store.getState().vocab.length).toBe(2); // Still 2
    expect(store.getState().totalXP).toBe(145); // Not doubled
    expect(store.getState().coins).toBe(145); // Not doubled
    expect(store.getState().unlockedAchievements).toEqual(['first_word', 'streak_3']);
    expect(store.getState().inventory).toEqual(['theme_cyberpunk']);
  });

  it('handles missing keys gracefully without discarding current progress', () => {
    const store = createAppStore({ storage: new MemoryStorage() });
    // Legacy storage only contains XP, missing all other keys
    const partialLegacy = {
      totalXP: '75',
    };

    const report = store.getState().migrateLegacy(partialLegacy);
    expect(report.success).toBe(true);
    expect(store.getState().totalXP).toBe(75);
    expect(store.getState().xpLevel).toBe(1); // default preserved
    expect(store.getState().vocab).toEqual([]); // default preserved
    expect(store.getState().coins).toBe(0); // default preserved
  });

  it('handles malformed JSON without crashing or corrupting store', () => {
    const store = createAppStore({ storage: new MemoryStorage() });
    const malformedLegacy = {
      vocabData: '[{ "kanji": "猫", "reading": "ねこ"', // syntax error: unclosed JSON
      unlockedAchievements: '{invalid json',
      totalXP: '50',
    };

    const report = store.getState().migrateLegacy(malformedLegacy);
    expect(report.success).toBe(false);
    expect(report.errors.length).toBeGreaterThan(0);
    // XP should still migrate successfully despite vocab parse error
    expect(store.getState().totalXP).toBe(50);
    expect(store.getState().vocab).toEqual([]);
  });

  it('sanitizes partially corrupted or non-object vocab items while keeping valid entries', () => {
    const store = createAppStore({ storage: new MemoryStorage() });
    const mixedVocab = [
      { id: 1, kanji: '犬', reading: 'いぬ', meaning: 'dog', level: 'N5' },
      null, // invalid
      'string entry', // invalid
      { id: 2, kanji: '車', reading: 'くるま', meaning: 'car', level: 'N5' },
      { id: 3 }, // missing kanji, reading, meaning
    ];

    const report = store.getState().migrateLegacy({
      vocabData: JSON.stringify(mixedVocab),
    });

    expect(store.getState().vocab.length).toBe(2);
    expect(store.getState().vocab[0].kanji).toBe('犬');
    expect(store.getState().vocab[1].kanji).toBe('車');
    expect(report.warnings.length).toBeGreaterThan(0);
  });

  it('provides SM-2 defaults when legacy vocab items lack SRS fields', () => {
    const store = createAppStore({ storage: new MemoryStorage() });
    const oldVocabWithoutSrs = [
      { id: 99, kanji: '水', reading: 'みず', meaning: 'water', level: 'N5' },
    ];

    store.getState().migrateLegacy({
      vocabData: JSON.stringify(oldVocabWithoutSrs),
    });

    const item = store.getState().vocab[0];
    expect(item.interval).toBe(0);
    expect(item.repetition).toBe(0);
    expect(item.efactor).toBe(2.5);
    expect(item.nextReviewDate).toBeTypeOf('number');
  });

  it('sanitizes invalid numbers (NaN, negative, non-numeric strings)', () => {
    const store = createAppStore({ storage: new MemoryStorage() });
    store.getState().migrateLegacy({
      totalXP: 'not_a_number',
      xpLevel: '-5',
      streakCount: 'invalid',
      coins: '-10',
    });

    const state = store.getState();
    expect(state.totalXP).toBe(0);
    expect(state.xpLevel).toBe(1); // min level 1
    expect(state.streakCount).toBe(0);
    expect(state.coins).toBe(0);
  });
});

describe('Fuku Store — Persistence & Reloading', () => {
  it('persists changes to storage and restores them on a new store instance', () => {
    const sharedStorage = new MemoryStorage();

    // 1. First session
    const store1 = createAppStore({ storage: sharedStorage });
    store1.getState().addWord({ kanji: '本', reading: 'ほん', meaning: 'book', level: 'N5' });
    store1.getState().buyItem = vi.fn(); // just testing state persistence
    store1.getState().grantXP(50);
    store1.getState().setTheme('theme_cyberpunk');

    // Transient change that should NOT be persisted
    store1.setState({ quizSession: { correct: 5, wrong: 1, xpGained: 50 } });

    // 2. Second session (simulating page reload with shared storage)
    const store2 = createAppStore({ storage: sharedStorage });
    const state2 = store2.getState();

    expect(state2.vocab.length).toBe(1);
    expect(state2.vocab[0].kanji).toBe('本');
    expect(state2.totalXP).toBe(70); // 10 from addWord + 10 from first_word achievement + 50 from grantXP
    expect(state2.activeTheme).toBe('theme_cyberpunk');
    // Transient state must NOT be persisted
    expect(state2.quizSession).toEqual({ correct: 0, wrong: 0, xpGained: 0 });
  });

  it('handles storage write failures gracefully without breaking application state', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Faulty storage adapter simulating QuotaExceededError
    const failingStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError: storage is full');
      },
      removeItem: () => {},
    };

    const safeStorage = createSafeStorage(failingStorage);
    const store = createAppStore({ storage: safeStorage });

    // Should not throw
    expect(() => {
      store.getState().addWord({ kanji: '山', reading: 'やま', meaning: 'mountain' });
    }).not.toThrow();

    expect(store.getState().vocab.length).toBe(1);
    consoleSpy.mockRestore();
  });
});

describe('Fuku Store — Business Logic & Actions', () => {
  let store;

  beforeEach(() => {
    store = createAppStore({ storage: new MemoryStorage() });
  });

  it('addWord adds entry, grants 10 XP and 10 coins, updates streak, checks achievements', () => {
    const res = store.getState().addWord({
      kanji: '火',
      reading: 'ひ',
      meaning: 'fire',
      level: 'N5',
    });

    expect(res.success).toBe(true);
    const state = store.getState();
    expect(state.vocab.length).toBe(1);
    expect(state.totalXP).toBe(20); // 10 from addWord + 10 from 'first_word' achievement!
    expect(state.coins).toBe(20);
    expect(state.streakCount).toBe(1);
    expect(state.unlockedAchievements).toContain('first_word');
  });

  it('addWord rejects duplicate words', () => {
    store.getState().addWord({ kanji: '水', reading: 'みず', meaning: 'water' });
    const res = store.getState().addWord({ kanji: '水', reading: 'みず', meaning: 'water duplicate' });

    expect(res.success).toBe(false);
    expect(res.reason).toBe('duplicate');
    expect(store.getState().vocab.length).toBe(1);
  });

  it('deleteWord removes an entry and dynamically updates derived rank', () => {
    store.getState().addWord({ id: 101, kanji: '木', reading: 'き', meaning: 'tree' });
    expect(store.getState().vocab.length).toBe(1);

    store.getState().deleteWord(101);
    expect(store.getState().vocab.length).toBe(0);
    expect(store.getState().getRank().name).toBe('NOVICE');
  });

  it('addTag appends cleaned lowercase tags without duplicates', () => {
    store.getState().addWord({ id: 202, kanji: '花', reading: 'はな', meaning: 'flower' });

    store.getState().addTag(202, 'Nature');
    store.getState().addTag(202, '  NATURE  '); // duplicate
    store.getState().addTag(202, 'beauty');

    const entry = store.getState().vocab.find((w) => w.id === 202);
    expect(entry.tags).toEqual(['nature', 'beauty']);
  });

  it('reviewWord updates SM-2 metadata, grants XP, and advances quests', () => {
    store.getState().addWord({ id: 303, kanji: '空', reading: 'そら', meaning: 'sky' });
    const xpBefore = store.getState().totalXP;

    const res = store.getState().reviewWord(303, 5); // Quality 5 (easy)
    expect(res.success).toBe(true);
    expect(res.xpGained).toBe(7);

    const updated = store.getState().vocab.find((w) => w.id === 303);
    expect(updated.repetition).toBe(1);
    expect(updated.interval).toBe(1);
    expect(store.getState().totalXP).toBe(xpBefore + 7);
  });

  it('grantXP levels up player when threshold reached and increments coins 1:1', () => {
    expect(store.getState().xpLevel).toBe(1);
    expect(store.getState().coins).toBe(0);

    const res = store.getState().grantXP(120);
    expect(res.leveledUp).toBe(true);
    expect(store.getState().xpLevel).toBe(2);
    expect(store.getState().totalXP).toBe(20); // 120 - 100
    expect(store.getState().coins).toBe(120); // 1:1 coins
  });

  it('updateStreak increments on consecutive day and resets on break', () => {
    const now = 1_700_000_000_000;
    const dayMs = 86_400_000;

    // Day 1
    store.getState().updateStreak(now);
    expect(store.getState().streakCount).toBe(1);

    // Same day
    store.getState().updateStreak(now + 1000);
    expect(store.getState().streakCount).toBe(1);

    // Consecutive day (yesterday)
    store.getState().updateStreak(now + dayMs);
    expect(store.getState().streakCount).toBe(2);

    // Broken streak (jump 3 days)
    store.getState().updateStreak(now + dayMs * 4);
    expect(store.getState().streakCount).toBe(1);
  });

  it('daily quests generate and advance progress toward completion rewards', () => {
    // Force quest generation with fixed type
    store.getState().generateQuests(true);
    expect(store.getState().dailyQuests).toHaveLength(3);

    // Set custom quest for testing
    store.setState({
      dailyQuests: [
        {
          id: 'test_words',
          type: 'words',
          desc: 'Add 1 word',
          target: 1,
          progress: 0,
          completed: false,
          reward: 50,
        },
      ],
    });

    const xpBefore = store.getState().totalXP;
    const { completedQuests } = store.getState().updateQuestProgress('words', 1);

    expect(completedQuests).toHaveLength(1);
    expect(completedQuests[0].completed).toBe(true);
    expect(store.getState().totalXP).toBe(xpBefore + 50); // reward granted
  });

  it('buyItem checks coins, prevents duplicate purchase, and updates inventory', () => {
    // Insufficient coins
    const res1 = store.getState().buyItem('theme_cyberpunk'); // cost 500
    expect(res1.success).toBe(false);
    expect(res1.reason).toBe('insufficient_coins');

    // Grant coins
    store.getState().grantXP(600);
    expect(store.getState().coins).toBe(600);

    // Successful purchase
    const res2 = store.getState().buyItem('theme_cyberpunk');
    expect(res2.success).toBe(true);
    expect(store.getState().coins).toBe(100);
    expect(store.getState().inventory).toContain('theme_cyberpunk');

    // Already owned
    const res3 = store.getState().buyItem('theme_cyberpunk');
    expect(res3.success).toBe(false);
    expect(res3.reason).toBe('already_owned');
  });

  it('setTheme toggles theme on and off', () => {
    expect(store.getState().activeTheme).toBe('default');

    store.getState().setTheme('theme_gameboy');
    expect(store.getState().activeTheme).toBe('theme_gameboy');

    // Toggling active theme resets to default
    store.getState().setTheme('theme_gameboy');
    expect(store.getState().activeTheme).toBe('default');
  });

  it('recordQuizAnswer updates quiz statistics and triggers quiz_10 achievement', () => {
    store.setState({ totalQuizAnswers: 9 });

    store.getState().recordQuizAnswer({ isCorrect: true, xpGain: 15 });

    const state = store.getState();
    expect(state.totalQuizAnswers).toBe(10);
    expect(state.quizSession.correct).toBe(1);
    expect(state.unlockedAchievements).toContain('quiz_10');
  });
});

describe('Fuku Store — Cross-Origin Export & Backup', () => {
  it('exportLegacyFromStorage extracts all legacy keys accurately', () => {
    const memory = new MemoryStorage();
    memory.setItem('totalXP', '200');
    memory.setItem('coins', '200');

    const exported = exportLegacyFromStorage(memory);
    expect(exported).toEqual({
      totalXP: '200',
      coins: '200',
    });
  });

  it('exportFukuBackup produces valid JSON parseable backup', () => {
    const store = createAppStore({ storage: new MemoryStorage() });
    store.getState().grantXP(50);

    const json = exportFukuBackup(store.getState());
    const parsed = JSON.parse(json);

    expect(parsed.app).toBe('fuku');
    expect(parsed.version).toBe(1);
    expect(parsed.state.totalXP).toBe(50);
  });
});

// =============================================================================
// PROMPT 03A — MIGRATION SAFETY REGRESSION TESTS
// =============================================================================
describe('Prompt 03A — Migration Safety Regressions', () => {
  it('1. Initial migration preserves the original saved state', () => {
    const store = createAppStore({ storage: new MemoryStorage() });
    const legacy = {
      vocabData: JSON.stringify([
        { id: 1, kanji: '木', reading: 'き', meaning: 'tree', level: 'N5', interval: 1, repetition: 1, efactor: 2.5, nextReviewDate: 1700000000000, tags: ['nature'] }
      ]),
      totalXP: '80',
      xpLevel: '1',
      coins: '80',
      streakCount: '3',
      lastStudyDate: 'Sun Oct 12 2025',
      unlockedAchievements: JSON.stringify(['first_word']),
      inventory: JSON.stringify(['theme_gameboy']),
      totalQuizAnswers: '5',
      activeTheme: 'theme_gameboy',
    };

    const report = store.getState().migrateLegacy(legacy);

    expect(report.success).toBe(true);
    expect(report.alreadyMigrated).toBe(false);
    const state = store.getState();
    expect(state.totalXP).toBe(80);
    expect(state.xpLevel).toBe(1);
    expect(state.coins).toBe(80);
    expect(state.streakCount).toBe(3);
    expect(state.lastStudyDate).toBe('Sun Oct 12 2025');
    expect(state.vocab).toHaveLength(1);
    expect(state.vocab[0].kanji).toBe('木');
    expect(state.vocab[0].tags).toEqual(['nature']);
    expect(state.inventory).toEqual(['theme_gameboy']);
    expect(state.unlockedAchievements).toEqual(['first_word']);
    expect(state.totalQuizAnswers).toBe(5);
    expect(state.activeTheme).toBe('theme_gameboy');
    expect(state.migrationMeta.migrated).toBe(true);
  });

  it('2. Repeating migration does not restore spent coins', () => {
    const store = createAppStore({ storage: new MemoryStorage() });
    const legacy = {
      coins: '500',
      totalXP: '100',
      xpLevel: '2',
    };

    // First migration: user gets 500 coins from legacy
    store.getState().migrateLegacy(legacy);
    expect(store.getState().coins).toBe(500);

    // User spends 450 coins in Fuku
    store.setState({ coins: 50 });
    expect(store.getState().coins).toBe(50);

    // Migration runs again with the stale legacy data containing 500 coins
    const report2 = store.getState().migrateLegacy(legacy);

    expect(report2.alreadyMigrated).toBe(true);
    // Spent coins must NOT be restored!
    expect(store.getState().coins).toBe(50);
  });

  it('3. Repeating migration does not restore a stale streak', () => {
    const store = createAppStore({ storage: new MemoryStorage() });
    const legacy = {
      streakCount: '7',
      lastStudyDate: 'Fri Oct 10 2025',
    };

    // First migration: streak count 7
    store.getState().migrateLegacy(legacy);
    expect(store.getState().streakCount).toBe(7);

    // Days pass without studying, streak expires and resets in Fuku
    store.setState({ streakCount: 0, lastStudyDate: '' });
    expect(store.getState().streakCount).toBe(0);

    // Migration runs again with stale legacy data containing streak 7
    const report2 = store.getState().migrateLegacy(legacy);

    expect(report2.alreadyMigrated).toBe(true);
    // Expired streak must NOT be resurrected!
    expect(store.getState().streakCount).toBe(0);
  });

  it('4. XP progress and player level remain consistent without arithmetic distortion', () => {
    const store = createAppStore({ storage: new MemoryStorage() });
    const legacy = {
      totalXP: '90', // 90 XP towards level 2 (needed 100)
      xpLevel: '1',
    };

    // First migration: Level 1 with 90 XP
    store.getState().migrateLegacy(legacy);
    expect(store.getState().xpLevel).toBe(1);
    expect(store.getState().totalXP).toBe(90);

    // In Fuku, player earns 30 XP, which triggers level up to Level 2 with 20 XP (120 - 100 = 20)
    store.getState().grantXP(30);
    expect(store.getState().xpLevel).toBe(2);
    expect(store.getState().totalXP).toBe(20);

    // Migration runs again with the stale legacy data (totalXP: 90, xpLevel: 1)
    const report2 = store.getState().migrateLegacy(legacy);

    expect(report2.alreadyMigrated).toBe(true);
    // Must NOT combine level 2 with stale level 1 totalXP (90) via Math.max!
    expect(store.getState().xpLevel).toBe(2);
    expect(store.getState().totalXP).toBe(20);
  });

  it('5. A completed migration does not silently overwrite newer Fuku progress', () => {
    const store = createAppStore({ storage: new MemoryStorage() });
    const legacy = {
      vocabData: JSON.stringify([{ id: 1, kanji: '山', reading: 'やま', meaning: 'mountain' }]),
      totalQuizAnswers: '10',
      activeTheme: 'default',
    };

    store.getState().migrateLegacy(legacy);

    // User makes new progress in Fuku
    store.setState({
      totalQuizAnswers: 25,
      activeTheme: 'theme_cyberpunk',
    });

    const report2 = store.getState().migrateLegacy(legacy);

    expect(report2.alreadyMigrated).toBe(true);
    expect(report2.warnings.some((w) => w.includes('already completed'))).toBe(true);
    expect(store.getState().totalQuizAnswers).toBe(25);
    expect(store.getState().activeTheme).toBe('theme_cyberpunk');
  });

  it('6. Vocabulary and collection metadata remain intact without duplicates', () => {
    const store = createAppStore({ storage: new MemoryStorage() });
    const legacyWord = {
      id: 55,
      kanji: '川',
      reading: 'かわ',
      meaning: 'river',
      level: 'N5',
      tags: ['water', 'nature'],
      interval: 6,
      repetition: 2,
      efactor: 2.7,
      nextReviewDate: 1729000000000,
      customField: 'preserved_custom_metadata',
    };

    store.getState().migrateLegacy({
      vocabData: JSON.stringify([legacyWord]),
    });

    const entry = store.getState().vocab[0];
    expect(entry.kanji).toBe('川');
    expect(entry.reading).toBe('かわ');
    expect(entry.interval).toBe(6);
    expect(entry.repetition).toBe(2);
    expect(entry.efactor).toBe(2.7);
    expect(entry.nextReviewDate).toBe(1729000000000);
    expect(entry.tags).toEqual(['water', 'nature']);
    expect(entry.customField).toBe('preserved_custom_metadata');

    // Run explicit manual import with duplicate entry plus one genuinely new word
    const newWord = {
      id: 56,
      kanji: '雨',
      reading: 'あめ',
      meaning: 'rain',
      level: 'N5',
      interval: 0,
      repetition: 0,
      efactor: 2.5,
      nextReviewDate: 1729000000000,
    };

    const report2 = store.getState().importLegacyData({
      vocabData: JSON.stringify([legacyWord, newWord]),
    });

    expect(report2.vocabAdded).toBe(1); // Only the new word was added
    expect(store.getState().vocab).toHaveLength(2);
    expect(store.getState().vocab.map((v) => v.kanji)).toContain('川');
    expect(store.getState().vocab.map((v) => v.kanji)).toContain('雨');
  });
});

// =============================================================================
// PROMPT 03B — FINAL MIGRATION SAFETY CHECK
// =============================================================================
describe('Prompt 03B — Final Migration Safety Check', () => {
  const INITIAL_LEGACY_SNAPSHOT = {
    vocabData: JSON.stringify([
      { id: 101, kanji: '食べる', reading: 'たべる', meaning: 'to eat', level: 'N5' },
      { id: 102, kanji: '飲む', reading: 'のむ', meaning: 'to drink', level: 'N5' },
    ]),
    totalXP: '150',
    xpLevel: '2',
    coins: '150',
    streakCount: '5',
    lastStudyDate: 'Sun Oct 12 2025',
    unlockedAchievements: JSON.stringify(['first_word', 'ten_words']),
    inventory: JSON.stringify(['theme_cyberpunk', 'music_lofi']),
    activeTheme: 'theme_cyberpunk',
  };

  it('1. Repeating migration does not restore vocabulary deliberately deleted in Fuku', () => {
    const store = createAppStore({ storage: new MemoryStorage() });

    // Initial migration: user gets 2 words
    store.getState().migrateLegacy(INITIAL_LEGACY_SNAPSHOT);
    expect(store.getState().vocab).toHaveLength(2);

    // User deliberately deletes '飲む' (id 102) in Fuku
    store.getState().deleteWord(102);
    expect(store.getState().vocab).toHaveLength(1);
    expect(store.getState().vocab[0].id).toBe(101);

    // Repeating normal migration with the original stale legacy snapshot
    const repeatReport = store.getState().migrateLegacy(INITIAL_LEGACY_SNAPSHOT);

    expect(repeatReport.alreadyMigrated).toBe(true);
    expect(repeatReport.vocabAdded).toBe(0);
    // Deleted word must NOT be restored!
    expect(store.getState().vocab).toHaveLength(1);
    expect(store.getState().vocab[0].id).toBe(101);
    expect(store.getState().vocab[0].kanji).toBe('食べる');
    expect(store.getState().vocab.some((v) => v.kanji === '飲む')).toBe(false);
    expect(store.getState().vocab.some((v) => v.kanji === '食べる')).toBe(true);
  });

  it('2. Repeating migration does not restore achievements cleared by a reset', () => {
    const store = createAppStore({ storage: new MemoryStorage() });

    // Initial migration: user gets 2 achievements
    store.getState().migrateLegacy(INITIAL_LEGACY_SNAPSHOT);
    expect(store.getState().unlockedAchievements).toEqual(['first_word', 'ten_words']);

    // Achievements are cleared in Fuku
    store.setState({ unlockedAchievements: [] });
    expect(store.getState().unlockedAchievements).toEqual([]);

    // Repeating normal migration with stale legacy snapshot
    const repeatReport = store.getState().migrateLegacy(INITIAL_LEGACY_SNAPSHOT);

    expect(repeatReport.alreadyMigrated).toBe(true);
    expect(repeatReport.achievementsAdded).toBe(0);
    // Cleared achievements must NOT be restored!
    expect(store.getState().unlockedAchievements).toEqual([]);
  });

  it('3. Repeating migration does not restore inventory items cleared by a reset', () => {
    const store = createAppStore({ storage: new MemoryStorage() });

    // Initial migration: user gets 2 inventory items
    store.getState().migrateLegacy(INITIAL_LEGACY_SNAPSHOT);
    expect(store.getState().inventory).toEqual(['theme_cyberpunk', 'music_lofi']);

    // Inventory is cleared in Fuku
    store.setState({ inventory: [] });
    expect(store.getState().inventory).toEqual([]);

    // Repeating normal migration with stale legacy snapshot
    const repeatReport = store.getState().migrateLegacy(INITIAL_LEGACY_SNAPSHOT);

    expect(repeatReport.alreadyMigrated).toBe(true);
    expect(repeatReport.inventoryAdded).toBe(0);
    // Cleared inventory items must NOT be restored!
    expect(store.getState().inventory).toEqual([]);
  });

  it('4. Once migration is complete, a normal repeated migration preserves Fuku state completely unchanged', () => {
    const store = createAppStore({ storage: new MemoryStorage() });
    store.getState().migrateLegacy(INITIAL_LEGACY_SNAPSHOT);

    // User progresses in Fuku: spends coins, changes streak, earns XP, changes theme
    store.setState({
      coins: 20,
      streakCount: 1,
      totalXP: 40,
      xpLevel: 3,
      activeTheme: 'default',
    });

    const snapshotBefore = {
      vocab: [...store.getState().vocab],
      coins: store.getState().coins,
      streakCount: store.getState().streakCount,
      totalXP: store.getState().totalXP,
      xpLevel: store.getState().xpLevel,
      unlockedAchievements: [...store.getState().unlockedAchievements],
      inventory: [...store.getState().inventory],
      activeTheme: store.getState().activeTheme,
    };

    // Normal repeated migration runs
    const report = store.getState().migrateLegacy(INITIAL_LEGACY_SNAPSHOT);

    expect(report.alreadyMigrated).toBe(true);
    expect(report.vocabAdded).toBe(0);
    expect(report.achievementsAdded).toBe(0);
    expect(report.inventoryAdded).toBe(0);

    const snapshotAfter = {
      vocab: [...store.getState().vocab],
      coins: store.getState().coins,
      streakCount: store.getState().streakCount,
      totalXP: store.getState().totalXP,
      xpLevel: store.getState().xpLevel,
      unlockedAchievements: [...store.getState().unlockedAchievements],
      inventory: [...store.getState().inventory],
      activeTheme: store.getState().activeTheme,
    };

    // State must be completely identical
    expect(snapshotAfter).toEqual(snapshotBefore);
  });

  it('5. An intentional manual import explicitly merges additional legacy data without duplicating rewards or overwriting progress', () => {
    const store = createAppStore({ storage: new MemoryStorage() });
    store.getState().migrateLegacy(INITIAL_LEGACY_SNAPSHOT);

    // Player progresses in Fuku
    store.setState({ coins: 40, totalXP: 30, xpLevel: 3 });

    // Explicit manual import contains 1 already-existing word and 1 genuinely new word
    const additionalData = {
      vocabData: JSON.stringify([
        { id: 101, kanji: '食べる', reading: 'たべる', meaning: 'to eat', level: 'N5' }, // already exists
        { id: 103, kanji: '走る', reading: 'はしる', meaning: 'to run', level: 'N5' }, // new
      ]),
      coins: '999', // stale higher coins
      totalXP: '999', // stale higher XP
    };

    const importReport = store.getState().importLegacyData(additionalData);

    expect(importReport.success).toBe(true);
    expect(importReport.vocabAdded).toBe(1);
    expect(store.getState().vocab).toHaveLength(3);
    expect(store.getState().vocab.map((v) => v.kanji)).toContain('走る');

    // Dynamic progress is NOT overwritten by stale legacy values
    expect(store.getState().coins).toBe(40);
    expect(store.getState().totalXP).toBe(30);
    expect(store.getState().xpLevel).toBe(3);
  });

  it('6. Original legacy storage remains completely unchanged throughout operations', () => {
    const legacyStorage = new MemoryStorage();
    for (const [k, v] of Object.entries(INITIAL_LEGACY_SNAPSHOT)) {
      legacyStorage.setItem(k, v);
    }

    const store = createAppStore({ storage: new MemoryStorage() });

    // 1. Initial migration
    store.getState().migrateLegacy(legacyStorage);

    // 2. Normal repeat migration
    store.getState().migrateLegacy(legacyStorage);

    // 3. Explicit manual import
    store.getState().importLegacyData(legacyStorage);

    // Check every key in legacyStorage
    for (const [k, v] of Object.entries(INITIAL_LEGACY_SNAPSHOT)) {
      expect(legacyStorage.getItem(k)).toBe(v);
    }
  });
});

// =============================================================================
// REGRESSION: addWord / addWords must NOT advance 'words' quest progress
// Legacy parity: templates/index.html addWord() calls grantXP(10),
// updateStreak(), checkAchievements() — it never calls
// updateQuestProgress('words', ...).
// =============================================================================
describe('Fuku Store — addWord legacy quest parity (Prompt 05 follow-up)', () => {
  function makeStoreWithWordQuest() {
    const store = createAppStore({ storage: new MemoryStorage() });
    // Manually set a 'words' quest with progress 0 so we can detect any change
    store.setState({
      dailyQuests: [
        {
          id: 'words_0',
          type: 'words',
          desc: 'Collect 5 words',
          target: 5,
          progress: 0,
          completed: false,
          reward: 30,
        },
        {
          id: 'xp_0',
          type: 'xp',
          desc: 'Earn 50 XP',
          target: 50,
          progress: 0,
          completed: false,
          reward: 50,
        },
      ],
    });
    return store;
  }

  it('addWord() does not advance the words quest (legacy parity)', () => {
    const store = makeStoreWithWordQuest();

    store.getState().addWord({ kanji: '猫', reading: 'ねこ', meaning: 'cat', level: 'N5' });

    const state = store.getState();
    const wordsQuest = state.dailyQuests.find((q) => q.type === 'words');
    // Legacy addWord() does NOT call updateQuestProgress('words', ...) — progress must stay at 0
    expect(wordsQuest.progress).toBe(0);
    expect(wordsQuest.completed).toBe(false);
  });

  it('addWord() still advances the xp quest indirectly via grantXP (legacy parity)', () => {
    const store = makeStoreWithWordQuest();

    store.getState().addWord({ kanji: '犬', reading: 'いぬ', meaning: 'dog', level: 'N5' });

    const state = store.getState();
    const xpQuest = state.dailyQuests.find((q) => q.type === 'xp');
    // grantXP(10) is called → updateQuestProgress('xp', 10) fires → xp quest progress += 10
    // Additionally, checkAchievements() unlocks 'first_word' (+10 XP) → another +10 XP quest progress
    // Total: 10 (addWord XP) + 10 (first_word achievement XP) = 20
    expect(xpQuest.progress).toBe(20);
  });

  it('addWords() does not advance the words quest regardless of batch size (legacy parity)', () => {
    const store = makeStoreWithWordQuest();

    store.getState().addWords([
      { kanji: '山', reading: 'やま', meaning: 'mountain', level: 'N5' },
      { kanji: '川', reading: 'かわ', meaning: 'river', level: 'N5' },
      { kanji: '木', reading: 'き', meaning: 'tree', level: 'N5' },
    ]);

    const state = store.getState();
    const wordsQuest = state.dailyQuests.find((q) => q.type === 'words');
    expect(wordsQuest.progress).toBe(0);
    expect(wordsQuest.completed).toBe(false);
  });

  it('addWords() does advance the xp quest via grantXP (legacy parity)', () => {
    const store = makeStoreWithWordQuest();

    store.getState().addWords([
      { kanji: '山', reading: 'やま', meaning: 'mountain', level: 'N5' },
      { kanji: '川', reading: 'かわ', meaning: 'river', level: 'N5' },
    ], 3); // xpPerWord = 3, 2 words → 6 XP total

    const state = store.getState();
    const xpQuest = state.dailyQuests.find((q) => q.type === 'xp');
    // 2 words × 3 XP = 6 XP from grantXP → quest progress += 6
    // checkAchievements() unlocks 'first_word' (+10 XP) → another +10
    // Total: 6 (addWords XP) + 10 (first_word achievement XP) = 16
    expect(xpQuest.progress).toBe(16);
  });
});

// =============================================================================
// PROMPT 06: reviewWord Legacy Parity & Reward Guarantees
// =============================================================================
describe('Fuku Store — reviewWord Legacy Parity (Prompt 06)', () => {
  function makeStoreWithQuests() {
    const store = createAppStore({ storage: new MemoryStorage() });
    store.setState({
      dailyQuests: [
        { id: 'quest_xp', type: 'xp', desc: 'Gain 50 XP', target: 50, progress: 0, reward: 20, completed: false },
        { id: 'quest_words', type: 'words', desc: 'Collect 5 words', target: 5, progress: 0, reward: 25, completed: false },
      ],
      lastQuestDate: new Date().toDateString(),
      totalXP: 0,
      xpLevel: 1,
      coins: 0,
      streakCount: 0,
      lastStudyDate: '',
      unlockedAchievements: [],
    });
    return store;
  }

  it('AGAIN (quality 1) grants exactly 3 XP and 3 coins 1:1', () => {
    const store = makeStoreWithQuests();
    store.setState({
      vocab: [{ id: 10, kanji: '木', reading: 'き', meaning: 'tree', interval: 5, repetition: 2, efactor: 2.5, nextReviewDate: 1000 }],
    });

    const res = store.getState().reviewWord(10, 1, 2000);
    expect(res.success).toBe(true);
    expect(res.xpGained).toBe(3);

    const state = store.getState();
    expect(state.totalXP).toBe(3);
    expect(state.coins).toBe(3);
    expect(res.updatedWord.repetition).toBe(0);
    expect(res.updatedWord.interval).toBe(1);
  });

  it('HARD (quality 3) grants exactly 7 XP and 7 coins 1:1', () => {
    const store = makeStoreWithQuests();
    store.setState({
      vocab: [{ id: 20, kanji: '森', reading: 'もり', meaning: 'forest', interval: 0, repetition: 0, efactor: 2.5, nextReviewDate: 1000 }],
    });

    const res = store.getState().reviewWord(20, 3, 2000);
    expect(res.success).toBe(true);
    expect(res.xpGained).toBe(7);

    const state = store.getState();
    expect(state.totalXP).toBe(7);
    expect(state.coins).toBe(7);
    expect(res.updatedWord.repetition).toBe(1);
    expect(res.updatedWord.interval).toBe(1);
  });

  it('EASY (quality 5) grants exactly 7 XP and 7 coins 1:1', () => {
    const store = makeStoreWithQuests();
    store.setState({
      vocab: [{ id: 30, kanji: '雨', reading: 'あめ', meaning: 'rain', interval: 1, repetition: 1, efactor: 2.5, nextReviewDate: 1000 }],
    });

    const res = store.getState().reviewWord(30, 5, 2000);
    expect(res.success).toBe(true);
    expect(res.xpGained).toBe(7);

    const state = store.getState();
    expect(state.totalXP).toBe(7);
    expect(state.coins).toBe(7);
    expect(res.updatedWord.repetition).toBe(2);
    expect(res.updatedWord.interval).toBe(6);
  });

  it('XP quest progresses exactly once (no double counting) and words quest is untouched', () => {
    const store = makeStoreWithQuests();
    store.setState({
      vocab: [{ id: 40, kanji: '火', reading: 'ひ', meaning: 'fire', interval: 0, repetition: 0, efactor: 2.5, nextReviewDate: 1000 }],
    });

    store.getState().reviewWord(40, 5, 2000); // 7 XP

    const state = store.getState();
    const xpQuest = state.dailyQuests.find((q) => q.type === 'xp');
    const wordsQuest = state.dailyQuests.find((q) => q.type === 'words');

    // Exactly 7 XP progress (proves previous double progression bug is fixed)
    expect(xpQuest.progress).toBe(7);
    expect(wordsQuest.progress).toBe(0);
  });

  it('reviewWord does NOT modify streakCount or lastStudyDate (legacy parity)', () => {
    const store = makeStoreWithQuests();
    store.setState({
      streakCount: 5,
      lastStudyDate: 'Sun Nov 01 2026',
      vocab: [{ id: 50, kanji: '水', reading: 'みず', meaning: 'water', interval: 0, repetition: 0, efactor: 2.5, nextReviewDate: 1000 }],
    });

    store.getState().reviewWord(50, 3, 2000);

    const state = store.getState();
    expect(state.streakCount).toBe(5);
    expect(state.lastStudyDate).toBe('Sun Nov 01 2026');
  });

  it('reviewWord does NOT check or trigger achievements (legacy parity)', () => {
    const store = makeStoreWithQuests();
    // 0 unlocked achievements, but vocab.length >= 1 which would trigger 'first_word' if checkAchievements was called
    store.setState({
      unlockedAchievements: [],
      vocab: [{ id: 60, kanji: '山', reading: 'やま', meaning: 'mountain', interval: 0, repetition: 0, efactor: 2.5, nextReviewDate: 1000 }],
    });

    store.getState().reviewWord(60, 5, 2000);

    const state = store.getState();
    expect(state.unlockedAchievements).toEqual([]);
  });

  it('returns { success: false, reason: "not_found" } when word id does not exist', () => {
    const store = makeStoreWithQuests();
    const res = store.getState().reviewWord(99999, 5, 2000);
    expect(res.success).toBe(false);
    expect(res.reason).toBe('not_found');
    expect(store.getState().totalXP).toBe(0);
    expect(store.getState().coins).toBe(0);
  });
});
