/**
 * libraryFilter.js — Pure filtering and formatting helpers for the Fuku Library.
 */

export const VALID_JLPT_LEVELS = ['ALL', 'N5', 'N4', 'N3', 'N2', 'N1', 'UNKNOWN'];

/**
 * Normalizes a JLPT level to standard display string.
 *
 * @param {any} level
 * @returns {string} One of 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | 'Unknown'
 */
export function normalizeLevel(level) {
  if (typeof level !== 'string') return 'Unknown';
  const upper = level.trim().toUpperCase();
  if (upper === 'N5' || upper === 'N4' || upper === 'N3' || upper === 'N2' || upper === 'N1') {
    return upper;
  }
  return 'Unknown';
}

/**
 * Filters a vocabulary collection by search query and JLPT level.
 *
 * Matching rules:
 * - Query: Case-insensitive match across kanji, reading, and meaning.
 * - Whitespace in query is trimmed.
 * - Missing/undefined fields do not throw.
 * - JLPT Level:
 *   - 'ALL': matches all items.
 *   - 'N5'..'N1': matches exact level.
 *   - 'UNKNOWN': matches null, undefined, '???', 'Unknown', 'ALL', or non-standard levels.
 *
 * @param {Array<Object>} vocabList - Array of stored vocabulary items
 * @param {string} [query=''] - Search term
 * @param {string} [levelFilter='ALL'] - Filter level
 * @returns {Array<Object>}
 */
export function filterVocabulary(vocabList, query = '', levelFilter = 'ALL') {
  if (!Array.isArray(vocabList)) return [];

  const trimmedQuery = typeof query === 'string' ? query.trim().toLowerCase() : '';
  const filterUpper = typeof levelFilter === 'string' ? levelFilter.trim().toUpperCase() : 'ALL';
  const activeLevel = VALID_JLPT_LEVELS.includes(filterUpper) ? filterUpper : 'ALL';

  return vocabList.filter((item) => {
    if (!item || typeof item !== 'object') return false;

    // 1. Level Filter Check
    if (activeLevel !== 'ALL') {
      const normalized = normalizeLevel(item.level);
      if (activeLevel === 'UNKNOWN') {
        if (normalized !== 'Unknown') return false;
      } else {
        if (normalized !== activeLevel) return false;
      }
    }

    // 2. Query Search Check
    if (!trimmedQuery) return true;

    const kanji = typeof item.kanji === 'string' ? item.kanji.toLowerCase() : '';
    const reading = typeof item.reading === 'string' ? item.reading.toLowerCase() : '';
    const meaning = typeof item.meaning === 'string' ? item.meaning.toLowerCase() : '';

    return (
      kanji.includes(trimmedQuery) ||
      reading.includes(trimmedQuery) ||
      meaning.includes(trimmedQuery)
    );
  });
}

/**
 * Safely format an added-date or timestamp.
 *
 * @param {any} timestamp
 * @returns {string}
 */
export function formatAddedDate(timestamp) {
  if (!timestamp) return 'Unknown';
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return 'Unknown';
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Unknown';
  }
}

/**
 * Safely format an SRS review date.
 *
 * @param {any} timestamp
 * @returns {string}
 */
export function formatReviewDate(timestamp) {
  if (!timestamp) return 'Not scheduled';
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return 'Not scheduled';
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Not scheduled';
  }
}
