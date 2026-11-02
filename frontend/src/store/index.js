/**
 * index.js — Public exports for the Fuku store module.
 */

export {
  useAppStore,
  createAppStore,
  selectRank,
  selectRankProgress,
  selectXpNeeded,
  selectXpProgressPercent,
  selectDueWords,
  selectIsOwned,
} from './useAppStore.js';

export {
  FUKU_STORAGE_KEY,
  SCHEMA_VERSION,
  LEGACY_STORAGE_KEYS,
  ALL_LEGACY_KEYS,
  INITIAL_PERSISTENT_STATE,
  INITIAL_TRANSIENT_STATE,
} from './constants.js';

export {
  MemoryStorage,
  createSafeStorage,
  defaultStorage,
  isLocalStorageAvailable,
} from './storageAdapter.js';

export {
  extractLegacyData,
  hasLegacyData,
  validateAndMigrateLegacy,
} from './legacyMigration.js';

export {
  LEGACY_BROWSER_EXPORT_SNIPPET,
  exportLegacyFromStorage,
  exportFukuBackup,
} from './exportImport.js';
