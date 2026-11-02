/**
 * exportImport.js — Cross-origin data transfer and backup utilities.
 *
 * Allows users to:
 * 1. Export legacy Vocab Quest data from the old website origin via a console snippet.
 * 2. Import that exported JSON into the Fuku frontend.
 * 3. Export/import native Fuku state backups.
 */

import { ALL_LEGACY_KEYS } from './constants.js';

/**
 * JavaScript snippet to run in the DevTools console of the OLD Vocab Quest website
 * to copy all legacy data to the clipboard or download as JSON.
 */
export const LEGACY_BROWSER_EXPORT_SNIPPET = `(() => {
  const keys = ${JSON.stringify(ALL_LEGACY_KEYS)};
  const exportData = {};
  let count = 0;
  for (const k of keys) {
    const val = localStorage.getItem(k);
    if (val !== null) {
      exportData[k] = val;
      count++;
    }
  }
  const json = JSON.stringify(exportData, null, 2);
  if (navigator.clipboard) {
    navigator.clipboard.writeText(json)
      .then(() => console.log('✅ Exported ' + count + ' legacy keys to clipboard!'))
      .catch(() => console.log('Legacy Export JSON:\\n' + json));
  } else {
    console.log('Legacy Export JSON:\\n' + json);
  }
  return exportData;
})();`;

/**
 * Exports all legacy keys from a given storage instance into a plain object.
 *
 * @param {Storage | Object} [storage]
 * @returns {Record<string, string>}
 */
export function exportLegacyFromStorage(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage) return {};
  const exportObj = {};
  for (const key of ALL_LEGACY_KEYS) {
    const val = typeof storage.getItem === 'function' ? storage.getItem(key) : storage[key];
    if (val !== null && val !== undefined) {
      exportObj[key] = val;
    }
  }
  return exportObj;
}

/**
 * Export current Fuku store state as a JSON string with metadata.
 *
 * @param {Object} storeState
 * @returns {string}
 */
export function exportFukuBackup(storeState) {
  const backup = {
    app: 'fuku',
    version: 1,
    exportedAt: new Date().toISOString(),
    state: {
      vocab: storeState.vocab,
      totalXP: storeState.totalXP,
      xpLevel: storeState.xpLevel,
      streakCount: storeState.streakCount,
      lastStudyDate: storeState.lastStudyDate,
      unlockedAchievements: storeState.unlockedAchievements,
      coins: storeState.coins,
      inventory: storeState.inventory,
      dailyQuests: storeState.dailyQuests,
      lastQuestDate: storeState.lastQuestDate,
      totalQuizAnswers: storeState.totalQuizAnswers,
      activeTheme: storeState.activeTheme,
    },
  };
  return JSON.stringify(backup, null, 2);
}
