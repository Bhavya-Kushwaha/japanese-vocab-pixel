/**
 * vocabApi.js — Service for retrieving Japanese vocabulary definitions
 * from the backend Jisho proxy endpoint (/fetch).
 */

export class VocabApiError extends Error {
  constructor(message, type, statusCode = null) {
    super(message);
    this.name = 'VocabApiError';
    this.type = type; // 'NETWORK_ERROR' | 'SERVER_ERROR' | 'NOT_FOUND' | 'EMPTY_INPUT' | 'PARSE_ERROR'
    this.statusCode = statusCode;
  }
}

/**
 * Normalizes and validates the response object returned by the /fetch endpoint.
 *
 * @param {any} data
 * @param {string} fallbackWord
 * @returns {{ kanji: string, reading: string, meaning: string, level: string }}
 */
export function normalizeVocabResponse(data, fallbackWord = '') {
  if (!data || typeof data !== 'object') {
    throw new VocabApiError('Malformed response received from server.', 'PARSE_ERROR');
  }

  if (data.success !== true) {
    throw new VocabApiError('Word not found. Check spelling or try another word.', 'NOT_FOUND');
  }

  const kanji = typeof data.kanji === 'string' && data.kanji.trim() ? data.kanji.trim() : fallbackWord;
  const reading = typeof data.reading === 'string' ? data.reading.trim() : '';
  const meaning = typeof data.meaning === 'string' ? data.meaning.trim() : '';
  const level = typeof data.level === 'string' && data.level.trim() ? data.level.trim() : '???';

  return { kanji, reading, meaning, level };
}

/**
 * Fetch vocabulary data for a keyword from the /fetch endpoint.
 *
 * @param {string} word - The Japanese word to search.
 * @param {AbortSignal} [signal] - Optional AbortSignal for request cancellation.
 * @returns {Promise<{ kanji: string, reading: string, meaning: string, level: string }>}
 */
export async function fetchVocabWord(word, signal) {
  const trimmed = typeof word === 'string' ? word.trim() : '';
  if (!trimmed) {
    throw new VocabApiError('Please enter a Japanese word to search.', 'EMPTY_INPUT');
  }

  let response;
  try {
    const body = new URLSearchParams({ word: trimmed });
    response = await fetch('/fetch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw err; // Let AbortError propagate for cancellation handling
    }
    throw new VocabApiError(
      'Network failure. Please check your connection or ensure the backend server is running.',
      'NETWORK_ERROR'
    );
  }

  if (!response.ok) {
    throw new VocabApiError(
      `Server error (${response.status}). Please try again later.`,
      'SERVER_ERROR',
      response.status
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new VocabApiError('Malformed JSON response from server.', 'PARSE_ERROR');
  }

  return normalizeVocabResponse(data, trimmed);
}
