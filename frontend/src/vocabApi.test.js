/**
 * vocabApi.test.js — Tests for the Jisho API service module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchVocabWord, normalizeVocabResponse, VocabApiError } from './services/vocabApi.js';

describe('vocabApi — Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects empty input without sending network request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(fetchVocabWord('')).rejects.toThrow(VocabApiError);
    await expect(fetchVocabWord('   ')).rejects.toMatchObject({
      type: 'EMPTY_INPUT',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends request with correct method, endpoint, and URLSearchParams format', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        kanji: '猫',
        reading: 'ねこ',
        meaning: 'cat',
        level: 'N5',
      }),
    });

    const result = await fetchVocabWord('  猫  ');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe('/fetch');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');

    // Verify body contains trimmed word
    const bodyParams = new URLSearchParams(options.body);
    expect(bodyParams.get('word')).toBe('猫');

    expect(result).toEqual({
      kanji: '猫',
      reading: 'ねこ',
      meaning: 'cat',
      level: 'N5',
    });
  });

  it('handles word not found ({ success: false })', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false }),
    });

    await expect(fetchVocabWord('xyzgibberish')).rejects.toMatchObject({
      type: 'NOT_FOUND',
      message: expect.stringContaining('Word not found'),
    });
  });

  it('handles server errors (HTTP 500)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(fetchVocabWord('食べる')).rejects.toMatchObject({
      type: 'SERVER_ERROR',
      statusCode: 500,
      message: expect.stringContaining('Server error (500)'),
    });
  });

  it('handles network failure (fetch throws TypeError)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new TypeError('Failed to fetch (net::ERR_CONNECTION_REFUSED)')
    );

    await expect(fetchVocabWord('食べる')).rejects.toMatchObject({
      type: 'NETWORK_ERROR',
      message: expect.stringContaining('Network failure'),
    });
  });

  it('handles malformed JSON response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
    });

    await expect(fetchVocabWord('食べる')).rejects.toMatchObject({
      type: 'PARSE_ERROR',
    });
  });

  it('gracefully handles missing optional fields', () => {
    const rawData = {
      success: true,
      kanji: '漢字',
      // reading missing
      // meaning missing
      // level missing
    };

    const normalized = normalizeVocabResponse(rawData, '漢字');
    expect(normalized).toEqual({
      kanji: '漢字',
      reading: '',
      meaning: '',
      level: '???',
    });
  });

  it('uses fallbackWord when response kanji is missing', () => {
    const rawData = {
      success: true,
      kanji: '',
      reading: 'ひらがな',
      meaning: 'hiragana script',
      level: 'N5',
    };

    const normalized = normalizeVocabResponse(rawData, 'ひらがな');
    expect(normalized.kanji).toBe('ひらがな');
  });
});
