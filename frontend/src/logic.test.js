/**
 * logic.test.js — Tests for all extracted logic modules.
 *
 * Uses Vitest (compatible with Vite project, zero extra config needed).
 * Run with: npm test
 *
 * Goal: prove OLD LOGIC RESULT == EXTRACTED LOGIC RESULT using the same
 * inputs and expected values as the original index.html implementation.
 */

import { describe, it, expect } from 'vitest';

import {
  processReview, reviewXp, isDue, newSrsFields,
  MS_PER_DAY, MIN_EFACTOR, DEFAULT_EFACTOR,
} from './logic/srs.js';

import {
  applyXpGrant, xpNeededForLevel, calculateRank, rankProgress,
  updateStreak, getStreakDates, XP_PER_LEVEL, RANKS,
} from './logic/gamification.js';

import {
  QUEST_TYPES, generateDailyQuests, shouldRegenerateQuests, applyQuestProgress,
} from './logic/quests.js';

import {
  ACHIEVEMENTS, checkAchievements,
} from './logic/achievements.js';

import {
  SHOP_ITEMS, attemptPurchase, isOwned, getShopItem,
} from './logic/shop.js';

// ===========================================================================
// 1. SRS — SM-2 algorithm
// ===========================================================================
describe('SRS — processReview', () => {
  const BASE = { repetition: 0, interval: 0, efactor: 2.5 };
  const NOW = 1_000_000_000_000; // fixed timestamp for determinism

  it('quality < 3 resets repetition to 0, interval to 1', () => {
    const result = processReview({ repetition: 3, interval: 20, efactor: 2.5 }, 1, NOW);
    expect(result.repetition).toBe(0);
    expect(result.interval).toBe(1);
  });

  it('first correct review (rep=0) sets interval=1, increments rep to 1', () => {
    const result = processReview(BASE, 5, NOW);
    expect(result.interval).toBe(1);
    expect(result.repetition).toBe(1);
  });

  it('second correct review (rep=1) sets interval=6, increments rep to 2', () => {
    const result = processReview({ repetition: 1, interval: 1, efactor: 2.5 }, 5, NOW);
    expect(result.interval).toBe(6);
    expect(result.repetition).toBe(2);
  });

  it('third correct review (rep=2) multiplies interval by efactor', () => {
    const result = processReview({ repetition: 2, interval: 6, efactor: 2.5 }, 5, NOW);
    expect(result.interval).toBe(Math.round(6 * 2.5)); // = 15
    expect(result.repetition).toBe(3);
  });

  it('efactor update formula — quality 5', () => {
    // efactor = 2.5 + (0.1 - (5-5)*(0.08+(5-5)*0.02)) = 2.5 + 0.1 = 2.6
    const result = processReview(BASE, 5, NOW);
    expect(result.efactor).toBeCloseTo(2.6);
  });

  it('efactor update formula — quality 3', () => {
    // efactor = 2.5 + (0.1 - (5-3)*(0.08+(5-3)*0.02))
    //         = 2.5 + (0.1 - 2*(0.08+0.04))
    //         = 2.5 + (0.1 - 0.24) = 2.5 - 0.14 = 2.36
    const result = processReview(BASE, 3, NOW);
    expect(result.efactor).toBeCloseTo(2.36);
  });

  it('efactor update formula — quality 1 (below threshold, clamp to 1.3)', () => {
    // Starting efactor 1.4, quality 1:
    // efactor = 1.4 + (0.1 - (5-1)*(0.08+(5-1)*0.02))
    //         = 1.4 + (0.1 - 4*(0.08+0.08))
    //         = 1.4 + (0.1 - 0.64) = 1.4 - 0.54 = 0.86 → clamped to 1.3
    const result = processReview({ repetition: 0, interval: 0, efactor: 1.4 }, 1, NOW);
    expect(result.efactor).toBe(MIN_EFACTOR);
  });

  it('nextReviewDate is computed as now + interval * MS_PER_DAY', () => {
    const result = processReview(BASE, 5, NOW);
    expect(result.nextReviewDate).toBe(NOW + result.interval * MS_PER_DAY);
  });

  it('reviewXp — quality >= 3 returns 7', () => {
    expect(reviewXp(3)).toBe(7);
    expect(reviewXp(5)).toBe(7);
  });

  it('reviewXp — quality < 3 returns 3', () => {
    expect(reviewXp(1)).toBe(3);
    expect(reviewXp(2)).toBe(3);
  });

  it('isDue — card with nextReviewDate in past is due', () => {
    expect(isDue({ nextReviewDate: NOW - 1 }, NOW)).toBe(true);
  });

  it('isDue — card with nextReviewDate in future is not due', () => {
    expect(isDue({ nextReviewDate: NOW + 1 }, NOW)).toBe(false);
  });

  it('newSrsFields returns correct defaults', () => {
    const fields = newSrsFields(NOW);
    expect(fields).toEqual({ interval: 0, repetition: 0, efactor: DEFAULT_EFACTOR, nextReviewDate: NOW });
  });
});

// ===========================================================================
// 2. XP progression
// ===========================================================================
describe('Gamification — XP', () => {
  it('applyXpGrant increases XP and coins by the same amount', () => {
    const state = { totalXP: 0, xpLevel: 1, coins: 0 };
    const result = applyXpGrant(state, 10);
    expect(result.totalXP).toBe(10);
    expect(result.coins).toBe(10);
    expect(result.leveledUp).toBe(false);
  });

  it('XP_PER_LEVEL is 100', () => {
    expect(XP_PER_LEVEL).toBe(100);
  });

  it('xpNeededForLevel returns level * 100', () => {
    expect(xpNeededForLevel(1)).toBe(100);
    expect(xpNeededForLevel(2)).toBe(200);
    expect(xpNeededForLevel(5)).toBe(500);
  });

  it('applyXpGrant triggers level-up when XP meets threshold', () => {
    // level 1 needs 1*100 = 100 XP
    const state = { totalXP: 90, xpLevel: 1, coins: 0 };
    const result = applyXpGrant(state, 10);
    expect(result.leveledUp).toBe(true);
    expect(result.xpLevel).toBe(2);
    expect(result.totalXP).toBe(0);   // 100 - 100 = 0 remainder
  });

  it('applyXpGrant does NOT level up when XP is below threshold', () => {
    const state = { totalXP: 80, xpLevel: 1, coins: 0 };
    const result = applyXpGrant(state, 10); // 90 < 100
    expect(result.leveledUp).toBe(false);
    expect(result.xpLevel).toBe(1);
  });

  it('coins are awarded 1:1 with XP even on level-up', () => {
    const state = { totalXP: 90, xpLevel: 1, coins: 50 };
    const result = applyXpGrant(state, 10);
    expect(result.coins).toBe(60); // 50 + 10
  });
});

// ===========================================================================
// 3. Rank threshold behaviour
// ===========================================================================
describe('Gamification — Rank', () => {
  const cases = [
    { words: 0, name: 'NOVICE' },
    { words: 1, name: 'NOVICE' },
    { words: 9, name: 'NOVICE' },
    { words: 10, name: 'APPRENTICE' },
    { words: 29, name: 'APPRENTICE' },
    { words: 30, name: 'WARRIOR' },
    { words: 49, name: 'WARRIOR' },
    { words: 50, name: 'MASTER' },
    { words: 99, name: 'MASTER' },
    { words: 100, name: 'LEGEND' },
    { words: 200, name: 'LEGEND' },
  ];

  cases.forEach(({ words, name }) => {
    it(`${words} words → rank ${name}`, () => {
      expect(calculateRank(words).name).toBe(name);
    });
  });

  it('LEGEND rank caps bar value at 100 when over 200 words', () => {
    const { value } = rankProgress(250);
    expect(value).toBe(100);
  });

  it('APPRENTICE bar value = wordCount - 10', () => {
    const { value, max } = rankProgress(20);
    expect(value).toBe(10);
    expect(max).toBe(20);
  });
});

// ===========================================================================
// 4. Streak behaviour
// ===========================================================================
describe('Gamification — Streak', () => {
  const TODAY = 'Mon Jan 01 2025';
  const YESTERDAY = 'Sun Dec 31 2024';
  const OLDER = 'Fri Dec 27 2024';

  it('does not increment streak when already counted today', () => {
    const state = { streakCount: 5, lastStudyDate: TODAY };
    const result = updateStreak(state, TODAY, YESTERDAY);
    expect(result.streakCount).toBe(5);
    expect(result.lastStudyDate).toBe(TODAY);
  });

  it('increments streak when last study date was yesterday', () => {
    const state = { streakCount: 5, lastStudyDate: YESTERDAY };
    const result = updateStreak(state, TODAY, YESTERDAY);
    expect(result.streakCount).toBe(6);
    expect(result.lastStudyDate).toBe(TODAY);
  });

  it('resets streak to 1 when last study date is older than yesterday', () => {
    const state = { streakCount: 10, lastStudyDate: OLDER };
    const result = updateStreak(state, TODAY, YESTERDAY);
    expect(result.streakCount).toBe(1);
    expect(result.lastStudyDate).toBe(TODAY);
  });

  it('resets streak to 1 on first-ever study (empty lastStudyDate)', () => {
    const state = { streakCount: 0, lastStudyDate: '' };
    const result = updateStreak(state, TODAY, YESTERDAY);
    expect(result.streakCount).toBe(1);
  });

  it('getStreakDates returns today and yesterday as dateStrings', () => {
    const fixedMs = new Date('2025-01-01T12:00:00Z').getTime();
    const { today, yesterday } = getStreakDates(fixedMs);
    expect(typeof today).toBe('string');
    expect(typeof yesterday).toBe('string');
    expect(today).not.toBe(yesterday);
  });
});

// ===========================================================================
// 5. Quest generation
// ===========================================================================
describe('Quests — generation', () => {
  // Deterministic RNG that cycles through 0, 0.5, 0.99 in sequence
  function makeSeededRng(values) {
    let i = 0;
    return () => values[i++ % values.length];
  }

  it('always generates exactly 3 quests', () => {
    const quests = generateDailyQuests('Mon Jan 01 2025');
    expect(quests).toHaveLength(3);
  });

  it('each quest has required fields', () => {
    const quests = generateDailyQuests('Mon Jan 01 2025');
    quests.forEach(q => {
      expect(q).toHaveProperty('id');
      expect(q).toHaveProperty('type');
      expect(q).toHaveProperty('desc');
      expect(q).toHaveProperty('target');
      expect(q).toHaveProperty('progress', 0);
      expect(q).toHaveProperty('completed', false);
      expect(q).toHaveProperty('reward');
    });
  });

  it('reward equals target (original behaviour)', () => {
    const quests = generateDailyQuests('Mon Jan 01 2025');
    quests.forEach(q => expect(q.reward).toBe(q.target));
  });

  it('quest types come from QUEST_TYPES', () => {
    const validTypes = QUEST_TYPES.map(t => t.id);
    const quests = generateDailyQuests('Mon Jan 01 2025');
    quests.forEach(q => expect(validTypes).toContain(q.type));
  });

  it('quest targets come from the matching QUEST_TYPES target array', () => {
    const quests = generateDailyQuests('Mon Jan 01 2025');
    quests.forEach(q => {
      const typeDef = QUEST_TYPES.find(t => t.id === q.type);
      expect(typeDef.target).toContain(q.target);
    });
  });

  it('QUEST_TYPES has exactly 3 entries with correct ids', () => {
    expect(QUEST_TYPES).toHaveLength(3);
    const ids = QUEST_TYPES.map(t => t.id);
    expect(ids).toContain('xp');
    expect(ids).toContain('words');
    expect(ids).toContain('quiz');
  });

  it('shouldRegenerateQuests — true when date changed', () => {
    expect(shouldRegenerateQuests('Mon Jan 01 2024', [], 'Tue Jan 02 2024')).toBe(true);
  });

  it('shouldRegenerateQuests — false when same date and quests exist', () => {
    expect(shouldRegenerateQuests('Mon Jan 01 2025', [{ id: 'x' }], 'Mon Jan 01 2025')).toBe(false);
  });

  it('shouldRegenerateQuests — true when quests is null', () => {
    expect(shouldRegenerateQuests('Mon Jan 01 2025', null, 'Mon Jan 01 2025')).toBe(true);
  });
});

// ===========================================================================
// 6. Quest progress
// ===========================================================================
describe('Quests — applyQuestProgress', () => {
  function makeQuest(type, target, progress = 0, completed = false) {
    return { id: type + '_0', type, desc: '', target, progress, completed, reward: target };
  }

  it('increments progress on a matching incomplete quest', () => {
    const quests = [makeQuest('xp', 100)];
    const { quests: updated } = applyQuestProgress(quests, 'xp', 50);
    expect(updated[0].progress).toBe(50);
    expect(updated[0].completed).toBe(false);
  });

  it('marks quest completed when progress reaches target', () => {
    const quests = [makeQuest('xp', 100, 90)];
    const { quests: updated, completedQuests } = applyQuestProgress(quests, 'xp', 10);
    expect(updated[0].completed).toBe(true);
    expect(updated[0].progress).toBe(100);
    expect(completedQuests).toHaveLength(1);
  });

  it('caps progress at target, does not overflow (original behaviour)', () => {
    const quests = [makeQuest('xp', 100, 90)];
    const { quests: updated } = applyQuestProgress(quests, 'xp', 50);
    expect(updated[0].progress).toBe(100); // capped
  });

  it('does not update already-completed quests', () => {
    const quests = [makeQuest('xp', 100, 100, true)];
    const { quests: updated, completedQuests } = applyQuestProgress(quests, 'xp', 50);
    expect(updated[0].progress).toBe(100);
    expect(completedQuests).toHaveLength(0);
  });

  it('does not update quests of a different type', () => {
    const quests = [makeQuest('words', 10)];
    const { quests: updated } = applyQuestProgress(quests, 'xp', 50);
    expect(updated[0].progress).toBe(0);
  });

  it('returns empty completedQuests when nothing completed', () => {
    const quests = [makeQuest('xp', 100)];
    const { completedQuests } = applyQuestProgress(quests, 'xp', 10);
    expect(completedQuests).toHaveLength(0);
  });

  it('handles null quests gracefully', () => {
    const { quests, completedQuests } = applyQuestProgress(null, 'xp', 10);
    expect(quests).toBeNull();
    expect(completedQuests).toHaveLength(0);
  });
});

// ===========================================================================
// 7. Achievement conditions
// ===========================================================================
describe('Achievements — checkAchievements', () => {
  it('ACHIEVEMENTS has exactly 7 entries', () => {
    expect(ACHIEVEMENTS).toHaveLength(7);
  });

  it('first_word unlocks at vocabCount >= 1 (xp: 10)', () => {
    const a = ACHIEVEMENTS.find(a => a.id === 'first_word');
    expect(a.xp).toBe(10);
    expect(a.check({ vocabCount: 0, streakCount: 0, totalQuizAnswers: 0 })).toBe(false);
    expect(a.check({ vocabCount: 1, streakCount: 0, totalQuizAnswers: 0 })).toBe(true);
  });

  it('ten_words unlocks at vocabCount >= 10 (xp: 25)', () => {
    const a = ACHIEVEMENTS.find(a => a.id === 'ten_words');
    expect(a.xp).toBe(25);
    expect(a.check({ vocabCount: 9 })).toBe(false);
    expect(a.check({ vocabCount: 10 })).toBe(true);
  });

  it('fifty_words unlocks at vocabCount >= 50 (xp: 100)', () => {
    const a = ACHIEVEMENTS.find(a => a.id === 'fifty_words');
    expect(a.xp).toBe(100);
    expect(a.check({ vocabCount: 49 })).toBe(false);
    expect(a.check({ vocabCount: 50 })).toBe(true);
  });

  it('hundred_words unlocks at vocabCount >= 100 (xp: 250)', () => {
    const a = ACHIEVEMENTS.find(a => a.id === 'hundred_words');
    expect(a.xp).toBe(250);
    expect(a.check({ vocabCount: 99 })).toBe(false);
    expect(a.check({ vocabCount: 100 })).toBe(true);
  });

  it('streak_3 unlocks at streakCount >= 3 (xp: 30)', () => {
    const a = ACHIEVEMENTS.find(a => a.id === 'streak_3');
    expect(a.xp).toBe(30);
    expect(a.check({ streakCount: 2 })).toBe(false);
    expect(a.check({ streakCount: 3 })).toBe(true);
  });

  it('streak_7 unlocks at streakCount >= 7 (xp: 75)', () => {
    const a = ACHIEVEMENTS.find(a => a.id === 'streak_7');
    expect(a.xp).toBe(75);
    expect(a.check({ streakCount: 6 })).toBe(false);
    expect(a.check({ streakCount: 7 })).toBe(true);
  });

  it('quiz_10 unlocks at totalQuizAnswers >= 10 (xp: 20)', () => {
    const a = ACHIEVEMENTS.find(a => a.id === 'quiz_10');
    expect(a.xp).toBe(20);
    expect(a.check({ totalQuizAnswers: 9 })).toBe(false);
    expect(a.check({ totalQuizAnswers: 10 })).toBe(true);
  });

  it('checkAchievements returns only newly unlocked', () => {
    const ctx = { vocabCount: 10, streakCount: 0, totalQuizAnswers: 0 };
    // first_word already unlocked, ten_words is new
    const newOnes = checkAchievements(['first_word'], ctx);
    const ids = newOnes.map(a => a.id);
    expect(ids).toContain('ten_words');
    expect(ids).not.toContain('first_word');
  });

  it('checkAchievements returns empty array when nothing new', () => {
    const ctx = { vocabCount: 0, streakCount: 0, totalQuizAnswers: 0 };
    const result = checkAchievements([], ctx);
    expect(result).toHaveLength(0);
  });

  it('checkAchievements returns multiple achievements in one call', () => {
    const ctx = { vocabCount: 100, streakCount: 7, totalQuizAnswers: 15 };
    const result = checkAchievements([], ctx);
    expect(result.length).toBeGreaterThanOrEqual(5); // all word + both streak + quiz
  });
});

// ===========================================================================
// 8. Shop — purchase / insufficient coins
// ===========================================================================
describe('Shop — attemptPurchase', () => {
  it('successful purchase deducts coins and adds item to inventory', () => {
    const result = attemptPurchase('theme_cyberpunk', 500, 600, []);
    expect(result.success).toBe(true);
    expect(result.reason).toBe('ok');
    expect(result.coins).toBe(100);
    expect(result.inventory).toContain('theme_cyberpunk');
  });

  it('rejects purchase when insufficient coins', () => {
    const result = attemptPurchase('theme_cyberpunk', 500, 300, []);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('insufficient_coins');
    expect(result.coins).toBe(300); // unchanged
    expect(result.inventory).toHaveLength(0);
  });

  it('rejects purchase when item already owned', () => {
    const result = attemptPurchase('theme_cyberpunk', 500, 1000, ['theme_cyberpunk']);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('already_owned');
    expect(result.coins).toBe(1000); // unchanged
  });

  it('exact coin amount is sufficient (edge case)', () => {
    const result = attemptPurchase('music_lofi', 300, 300, []);
    expect(result.success).toBe(true);
    expect(result.coins).toBe(0);
  });

  it('one coin short is insufficient', () => {
    const result = attemptPurchase('music_lofi', 300, 299, []);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('insufficient_coins');
  });
});

// ===========================================================================
// 9. Inventory changes
// ===========================================================================
describe('Shop — inventory', () => {
  it('SHOP_ITEMS has exactly 3 items', () => {
    expect(SHOP_ITEMS).toHaveLength(3);
  });

  it('item prices are correct', () => {
    expect(getShopItem('theme_cyberpunk').cost).toBe(500);
    expect(getShopItem('theme_gameboy').cost).toBe(500);
    expect(getShopItem('music_lofi').cost).toBe(300);
  });

  it('isOwned returns true when item is in inventory', () => {
    expect(isOwned('theme_cyberpunk', ['theme_cyberpunk'])).toBe(true);
  });

  it('isOwned returns false when item is not in inventory', () => {
    expect(isOwned('theme_cyberpunk', [])).toBe(false);
  });

  it('purchase does not mutate the original inventory array', () => {
    const original = ['music_lofi'];
    const result = attemptPurchase('theme_cyberpunk', 500, 600, original);
    expect(original).toHaveLength(1);          // unchanged
    expect(result.inventory).toHaveLength(2);  // new array
  });

  it('getShopItem returns undefined for unknown id', () => {
    expect(getShopItem('nonexistent_item')).toBeUndefined();
  });

  it('can own all items independently', () => {
    let coins = 2000;
    let inventory = [];
    for (const item of SHOP_ITEMS) {
      const result = attemptPurchase(item.id, item.cost, coins, inventory);
      expect(result.success).toBe(true);
      coins = result.coins;
      inventory = result.inventory;
    }
    expect(inventory).toHaveLength(3);
  });
});
