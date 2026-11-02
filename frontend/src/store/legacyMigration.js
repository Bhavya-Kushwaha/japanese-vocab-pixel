/**
 * legacyMigration.js — Safe, repeatable migration of Vocab Quest legacy localStorage data.
 *
 * Rules:
 * 1. Reads exact legacy keys without modifying or deleting them.
 * 2. Validates types and parses JSON safely, never throwing on malformed data.
 * 3. Does not discard valid data if partial corruption occurs.
 * 4. Deduplicates vocabulary and progress on repeated runs to prevent double rewards.
 * 5. Reconciles state safely without overwriting good progress with blank defaults.
 * 6. Returns a detailed report of migrated items, warnings, and errors.
 */

import { LEGACY_STORAGE_KEYS, INITIAL_PERSISTENT_STATE } from './constants.js';

/**
 * Safely parse a JSON string, returning null if parsing fails.
 *
 * @param {string | any} val
 * @param {string} fieldName
 * @param {string[]} errorCollector
 * @returns {any}
 */
function safeJsonParse(val, fieldName, errorCollector) {
  if (val === null || val === undefined || val === '') {
    return null;
  }
  if (typeof val !== 'string') {
    return val;
  }
  try {
    return JSON.parse(val);
  } catch (err) {
    errorCollector.push(`Malformed JSON for legacy key "${fieldName}": ${err.message}`);
    return null;
  }
}

/**
 * Safely parse an integer from a string or number.
 *
 * @param {any} val
 * @param {number} fallback
 * @param {number} [min=0]
 * @returns {number}
 */
function safeParseInt(val, fallback = 0, min = 0) {
  if (val === null || val === undefined || val === '') return fallback;
  const num = typeof val === 'number' ? val : parseInt(String(val), 10);
  if (Number.isNaN(num)) return fallback;
  return Math.max(min, num);
}

/**
 * Extract raw legacy key values from a source object or storage adapter.
 *
 * @param {Storage | Object | string} [source]
 * @returns {{ data: Record<string, any>, sourceDesc: string, errors: string[] }}
 */
export function extractLegacyData(source) {
  const errors = [];
  let sourceObj = source;
  let sourceDesc = 'object';

  // If no source passed, attempt reading from browser window.localStorage
  if (sourceObj === undefined || sourceObj === null) {
    if (typeof window !== 'undefined' && window.localStorage) {
      sourceObj = window.localStorage;
      sourceDesc = 'window.localStorage';
    } else {
      return { data: {}, sourceDesc: 'none', errors: [] };
    }
  }

  // If a JSON string is passed (e.g. from an exported backup)
  if (typeof sourceObj === 'string') {
    try {
      sourceObj = JSON.parse(sourceObj);
      sourceDesc = 'json_string';
    } catch (err) {
      errors.push(`Failed to parse legacy JSON payload string: ${err.message}`);
      return { data: {}, sourceDesc: 'invalid_json', errors };
    }
  }

  const rawData = {};
  const isStorageInstance = typeof sourceObj.getItem === 'function';

  for (const [keyName, storageKey] of Object.entries(LEGACY_STORAGE_KEYS)) {
    try {
      const val = isStorageInstance
        ? sourceObj.getItem(storageKey)
        : sourceObj[storageKey] ?? sourceObj[keyName];

      if (val !== undefined && val !== null) {
        rawData[keyName] = val;
      }
    } catch (err) {
      errors.push(`Failed to read legacy key "${storageKey}": ${err.message}`);
    }
  }

  return { data: rawData, sourceDesc, errors };
}

/**
 * Checks whether any legacy Vocab Quest keys exist in the given storage or object.
 *
 * @param {Storage | Object | string} [source]
 * @returns {boolean}
 */
export function hasLegacyData(source) {
  const { data } = extractLegacyData(source);
  return Object.keys(data).length > 0;
}

/**
 * Validates and migrates legacy data into a clean, reconciled state matching
 * the Fuku store schema.
 *
 * @param {Record<string, any>} rawLegacyData
 * @param {typeof INITIAL_PERSISTENT_STATE} [currentState=INITIAL_PERSISTENT_STATE]
 * @returns {{
 *   migratedState: typeof INITIAL_PERSISTENT_STATE,
 *   report: {
 *     success: boolean,
 *     hasLegacyData: boolean,
 *     vocabAdded: number,
 *     achievementsAdded: number,
 *     inventoryAdded: number,
 *     totalXP: number,
 *     coins: number,
 *     streakCount: number,
 *     warnings: string[],
 *     errors: string[],
 *   }
 * }}
 */
export function validateAndMigrateLegacy(
  rawLegacyData,
  currentState = INITIAL_PERSISTENT_STATE,
  options = {}
) {
  const warnings = [];
  const errors = [];
  const keysFound = Object.keys(rawLegacyData);
  const isAlreadyMigrated = Boolean(currentState?.migrationMeta?.migrated);
  const force = Boolean(options.force);
  const allowMerge = Boolean(options.allowMerge);

  if (keysFound.length === 0) {
    return {
      migratedState: { ...currentState },
      report: {
        success: true,
        hasLegacyData: false,
        alreadyMigrated: isAlreadyMigrated,
        vocabAdded: 0,
        achievementsAdded: 0,
        inventoryAdded: 0,
        totalXP: currentState.totalXP,
        coins: currentState.coins,
        streakCount: currentState.streakCount,
        warnings,
        errors,
      },
    };
  }

  // Detect whether target Fuku store is in a fresh/uninitialized state
  const isFreshStore =
    !isAlreadyMigrated &&
    (!currentState.vocab || currentState.vocab.length === 0) &&
    (currentState.totalXP === 0 || currentState.totalXP === undefined) &&
    (currentState.xpLevel === 1 || currentState.xpLevel === undefined) &&
    (currentState.streakCount === 0 || currentState.streakCount === undefined) &&
    (currentState.coins === 0 || currentState.coins === undefined) &&
    (!currentState.inventory || currentState.inventory.length === 0) &&
    (!currentState.unlockedAchievements || currentState.unlockedAchievements.length === 0);

  // Once migration is complete, a normal repeated migration must NOT change Fuku's state.
  // It does not restore deleted vocabulary, cleared achievements, or cleared inventory items.
  // An intentional merge must be explicitly requested via options.allowMerge.
  if (isAlreadyMigrated && !force && !allowMerge) {
    warnings.push(
      'Legacy migration was already completed. Normal repeated migration preserves Fuku state unchanged.'
    );
    return {
      migratedState: { ...currentState },
      report: {
        success: true,
        hasLegacyData: true,
        alreadyMigrated: true,
        vocabAdded: 0,
        achievementsAdded: 0,
        inventoryAdded: 0,
        totalXP: currentState.totalXP,
        coins: currentState.coins,
        streakCount: currentState.streakCount,
        warnings,
        errors,
      },
    };
  }

  const baseState = {
    ...INITIAL_PERSISTENT_STATE,
    ...currentState,
    vocab: Array.isArray(currentState.vocab) ? [...currentState.vocab] : [],
    unlockedAchievements: Array.isArray(currentState.unlockedAchievements)
      ? [...currentState.unlockedAchievements]
      : [],
    inventory: Array.isArray(currentState.inventory) ? [...currentState.inventory] : [],
  };

  // 1. Vocabulary migration & deduplication
  let vocabAdded = 0;
  if ('vocabData' in rawLegacyData) {
    const rawVocab = rawLegacyData.vocabData;
    const parsedVocab = safeJsonParse(rawVocab, 'vocabData', errors);

    if (parsedVocab !== null) {
      if (Array.isArray(parsedVocab)) {
        for (const item of parsedVocab) {
          if (!item || typeof item !== 'object') {
            warnings.push(`Skipped non-object vocab entry: ${JSON.stringify(item)}`);
            continue;
          }

          const kanji = typeof item.kanji === 'string' ? item.kanji.trim() : '';
          const reading = typeof item.reading === 'string' ? item.reading.trim() : '';
          const meaning = typeof item.meaning === 'string' ? item.meaning.trim() : '';

          if (!kanji && !reading && !meaning) {
            warnings.push(`Skipped empty vocab entry missing kanji, reading, and meaning`);
            continue;
          }

          // Check if already in baseState.vocab
          const isDuplicate = baseState.vocab.some(
            (v) => (item.id !== undefined && v.id === item.id) ||
                   (kanji && v.kanji === kanji && reading && v.reading === reading)
          );

          if (!isDuplicate) {
            // Preserve all existing fields and enforce valid SRS defaults
            const now = Date.now();
            const sanitizedEntry = {
              ...item,
              id: item.id ?? (now + Math.random()),
              kanji,
              reading,
              meaning,
              level: item.level || 'ALL',
              tags: Array.isArray(item.tags) ? item.tags : [],
              interval: safeParseInt(item.interval, 0, 0),
              repetition: safeParseInt(item.repetition, 0, 0),
              efactor: typeof item.efactor === 'number' && !Number.isNaN(item.efactor) && item.efactor >= 1.3
                ? item.efactor
                : 2.5,
              nextReviewDate: typeof item.nextReviewDate === 'number' && !Number.isNaN(item.nextReviewDate)
                ? item.nextReviewDate
                : now,
            };
            baseState.vocab.push(sanitizedEntry);
            vocabAdded++;
          }
        }
      } else {
        errors.push(`Legacy vocabData expected an array but received ${typeof parsedVocab}`);
      }
    }
  }

  // 2. Unlocked achievements (deduplicated)
  let achievementsAdded = 0;
  if ('unlockedAchievements' in rawLegacyData) {
    const parsedAchievements = safeJsonParse(
      rawLegacyData.unlockedAchievements,
      'unlockedAchievements',
      errors
    );
    if (Array.isArray(parsedAchievements)) {
      for (const achId of parsedAchievements) {
        if (typeof achId === 'string' && !baseState.unlockedAchievements.includes(achId)) {
          baseState.unlockedAchievements.push(achId);
          achievementsAdded++;
        }
      }
    }
  }

  // 3. Inventory (deduplicated)
  let inventoryAdded = 0;
  if ('inventory' in rawLegacyData) {
    const parsedInventory = safeJsonParse(rawLegacyData.inventory, 'inventory', errors);
    if (Array.isArray(parsedInventory)) {
      for (const itemId of parsedInventory) {
        if (typeof itemId === 'string' && !baseState.inventory.includes(itemId)) {
          baseState.inventory.push(itemId);
          inventoryAdded++;
        }
      }
    }
  }

  // 4. Dynamic progress handling:
  // If migration was already completed or Fuku has newer active progress (and not forced),
  // strictly PRESERVE Fuku's active progress:
  // - Do NOT restore spent coins
  // - Do NOT resurrect expired streaks
  // - Do NOT combine or distort XP and level
  // - Do NOT overwrite newer quests, quiz answers, or themes
  if (isAlreadyMigrated && !force) {
    warnings.push(
      'Explicit legacy merge completed. Additional collection items were merged; dynamic progress (XP, level, coins, streaks, quests) was preserved.'
    );
  } else if (!isFreshStore && !force) {
    warnings.push(
      'Fuku store contains active progress. Dynamic progress (XP, level, coins, streaks) was preserved; collection items were merged.'
    );
  } else {
    // Initial migration into fresh store (or force === true):
    // Directly adopt the legacy user's actual saved state.
    if ('totalXP' in rawLegacyData) {
      baseState.totalXP = safeParseInt(rawLegacyData.totalXP, 0, 0);
    }

    if ('xpLevel' in rawLegacyData) {
      baseState.xpLevel = safeParseInt(rawLegacyData.xpLevel, 1, 1);
    }

    if ('streakCount' in rawLegacyData) {
      baseState.streakCount = safeParseInt(rawLegacyData.streakCount, 0, 0);
    }

    if ('lastStudyDate' in rawLegacyData && rawLegacyData.lastStudyDate) {
      baseState.lastStudyDate = String(rawLegacyData.lastStudyDate);
    }

    if ('coins' in rawLegacyData) {
      baseState.coins = safeParseInt(rawLegacyData.coins, 0, 0);
    }

    if ('dailyQuests' in rawLegacyData) {
      const parsedQuests = safeJsonParse(rawLegacyData.dailyQuests, 'dailyQuests', errors);
      if (Array.isArray(parsedQuests)) {
        baseState.dailyQuests = parsedQuests.map((q) => ({
          ...q,
          target: safeParseInt(q.target, 10, 1),
          progress: safeParseInt(q.progress, 0, 0),
          completed: Boolean(q.completed),
          reward: safeParseInt(q.reward, 10, 0),
        }));
      }
    }

    if ('lastQuestDate' in rawLegacyData && rawLegacyData.lastQuestDate) {
      baseState.lastQuestDate = String(rawLegacyData.lastQuestDate);
    }

    if ('totalQuizAnswers' in rawLegacyData) {
      baseState.totalQuizAnswers = safeParseInt(rawLegacyData.totalQuizAnswers, 0, 0);
    }

    if ('activeTheme' in rawLegacyData && rawLegacyData.activeTheme) {
      baseState.activeTheme = String(rawLegacyData.activeTheme);
    }
  }

  // Update migration metadata
  baseState.migrationMeta = {
    migrated: true,
    migratedAt: currentState?.migrationMeta?.migratedAt || Date.now(),
    source: currentState?.migrationMeta?.source || 'legacy_storage',
  };

  return {
    migratedState: baseState,
    report: {
      success: errors.length === 0,
      hasLegacyData: true,
      alreadyMigrated: isAlreadyMigrated,
      vocabAdded,
      achievementsAdded,
      inventoryAdded,
      totalXP: baseState.totalXP,
      coins: baseState.coins,
      streakCount: baseState.streakCount,
      warnings,
      errors,
    },
  };
}
