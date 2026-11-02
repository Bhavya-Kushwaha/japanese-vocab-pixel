/**
 * Learn.jsx — Vocabulary discovery and collection interface for Fuku.
 *
 * Implements the full vocabulary discovery workflow:
 * - Search keyword via Jisho API (/fetch)
 * - Result preview with kanji, reading, meaning, level
 * - Duplicate detection against shared Zustand store
 * - Collection into store with SRS initialization and 10 XP award
 * - Recent collection list (last 5 words)
 * - Robust keyboard interactions (Enter to search, Enter to collect)
 * - Clear visual states for idle, loading, result, success, duplicate, not-found, server-error, network-error
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/index.js';
import { fetchVocabWord, VocabApiError } from '../services/vocabApi.js';

export default function Learn() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'preview' | 'success' | 'error'
  const [result, setResult] = useState(null);
  const [errorInfo, setErrorInfo] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);
  const [isCollecting, setIsCollecting] = useState(false);

  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const activeSearchWordRef = useRef('');
  const inFlightWordRef = useRef('');

  // Store bindings
  const vocab = useAppStore((state) => state.vocab);
  const addWord = useAppStore((state) => state.addWord);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Cleanup pending requests on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Check if current result is already in user's library
  const isDuplicate = result
    ? vocab.some(
        (v) =>
          (result.kanji && v.kanji === result.kanji) ||
          (result.reading && v.reading === result.reading)
      )
    : false;

  // Search handler
  const handleSearch = useCallback(
    async (e) => {
      if (e) e.preventDefault();

      const trimmed = query.trim();
      if (!trimmed) {
        setStatus('error');
        setErrorInfo({
          type: 'EMPTY_INPUT',
          message: 'Please enter a Japanese word (Kanji or Hiragana).',
        });
        return;
      }

      // If already loading the SAME word, ignore repeated submits
      if (status === 'loading' && inFlightWordRef.current === trimmed) {
        return;
      }

      // Cancel any prior in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      activeSearchWordRef.current = trimmed;
      inFlightWordRef.current = trimmed;

      setStatus('loading');
      setErrorInfo(null);
      setSuccessInfo(null);
      setResult(null);

      try {
        const data = await fetchVocabWord(trimmed, controller.signal);
        // If this request was superseded or aborted while waiting, ignore it
        if (controller.signal.aborted || activeSearchWordRef.current !== trimmed) {
          return;
        }
        setResult(data);
        setStatus('preview');
      } catch (err) {
        if (
          err.name === 'AbortError' ||
          controller.signal.aborted ||
          activeSearchWordRef.current !== trimmed
        ) {
          return; // Ignore aborted or superseded requests
        }
        setStatus('error');
        if (err instanceof VocabApiError) {
          setErrorInfo({ type: err.type, message: err.message });
        } else {
          setErrorInfo({
            type: 'UNKNOWN',
            message: 'An unexpected error occurred. Please try again.',
          });
        }
      } finally {
        if (inFlightWordRef.current === trimmed) {
          inFlightWordRef.current = '';
        }
      }
    },
    [query, status]
  );

  // Collect handler
  const handleCollect = useCallback(() => {
    if (!result || isCollecting) return;

    if (isDuplicate) {
      setStatus('error');
      setErrorInfo({
        type: 'DUPLICATE',
        message: `"${result.kanji}" is already in your quest library.`,
      });
      return;
    }

    setIsCollecting(true);
    try {
      const res = addWord({
        kanji: result.kanji,
        reading: result.reading,
        meaning: result.meaning,
        level: result.level,
      });

      if (res.success) {
        setSuccessInfo({
          kanji: result.kanji,
          reading: result.reading,
          meaning: result.meaning,
          level: result.level,
        });
        setStatus('success');
        setResult(null);
        setQuery('');
        setErrorInfo(null);

        // Refocus the input for rapid subsequent lookups
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }, 50);
      } else {
        setStatus('error');
        setErrorInfo({
          type: 'DUPLICATE',
          message: `"${result.kanji}" is already in your quest library.`,
        });
      }
    } finally {
      setIsCollecting(false);
    }
  }, [result, isCollecting, isDuplicate, addWord]);

  // Keyboard handler for Enter submission
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // If preview is active, query matches current preview, and word is NOT duplicate: collect
      if (
        status === 'preview' &&
        result &&
        !isDuplicate &&
        (query.trim() === result.kanji || query.trim() === result.reading)
      ) {
        handleCollect();
      } else {
        handleSearch();
      }
    }
  };

  const handleReset = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    activeSearchWordRef.current = '';
    inFlightWordRef.current = '';
    setQuery('');
    setResult(null);
    setStatus('idle');
    setErrorInfo(null);
    setSuccessInfo(null);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Derive recent 5 words
  const recentWords = vocab.slice(0, 5);

  return (
    <div className="w-full flex flex-col gap-6">
      {/* 1. DISCOVERY INPUT CONTAINER */}
      <div className="nes-container with-title is-dark">
        <p className="title text-sm md:text-base">Vocabulary Discovery</p>
        <p className="text-xs text-gray-300 mb-4">
          Enter a Japanese word to search Jisho and discover definitions, readings, and JLPT levels.
        </p>

        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <input
              ref={inputRef}
              type="text"
              id="vocabSearchInput"
              className="nes-input is-dark w-full"
              placeholder="e.g. 食べる, 猫, 勉強..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              id="searchBtn"
              className="nes-btn is-primary whitespace-nowrap"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'SEARCHING...' : '🔍 SEARCH'}
            </button>
            {(status === 'preview' || query || errorInfo) && (
              <button
                type="button"
                id="clearBtn"
                className="nes-btn is-dark"
                onClick={handleReset}
              >
                CLEAR
              </button>
            )}
          </div>
        </form>

        {/* LOADING INDICATOR */}
        {status === 'loading' && (
          <div id="loadingIndicator" className="mt-4 flex items-center gap-2 nes-text is-warning text-xs">
            <span className="animate-pulse">Searching Jisho API... ⌛</span>
          </div>
        )}

        {/* ERROR FEEDBACK */}
        {status === 'error' && errorInfo && (
          <div id="errorBanner" className="mt-4 nes-container is-rounded is-dark border-red-500 text-xs">
            <p className="nes-text is-error mb-1">
              {errorInfo.type === 'NOT_FOUND' && '⚠️ Word Not Found'}
              {errorInfo.type === 'NETWORK_ERROR' && '🔌 Network Failure'}
              {errorInfo.type === 'SERVER_ERROR' && '🔥 Server Error'}
              {errorInfo.type === 'EMPTY_INPUT' && '✏️ Input Required'}
              {errorInfo.type === 'DUPLICATE' && '⚠️ Already Collected'}
              {errorInfo.type === 'UNKNOWN' && '❌ Error'}
            </p>
            <p className="text-gray-300">{errorInfo.message}</p>
          </div>
        )}

        {/* SUCCESS NOTIFICATION */}
        {status === 'success' && successInfo && (
          <div id="successBanner" className="mt-4 nes-container is-rounded is-dark border-green-500 text-xs">
            <p className="nes-text is-success mb-1">
              🎉 Collected "{successInfo.kanji}"! +10 XP ⚡ +10 Coins 🪙
            </p>
            <p className="text-gray-300">
              {successInfo.reading && <span className="mr-3">Reading: {successInfo.reading}</span>}
              <span>Meaning: {successInfo.meaning}</span>
            </p>
          </div>
        )}
      </div>

      {/* 2. RESULT PREVIEW CARD */}
      {status === 'preview' && result && (
        <div id="resultPreview" className="nes-container with-title is-dark pixel-card border-purple-500">
          <p className="title nes-text is-primary">Word Preview</p>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <span id="previewKanji" className="text-2xl md:text-3xl nes-text is-warning font-bold">
                  {result.kanji}
                </span>
                <span
                  id="previewLevel"
                  className={`nes-badge ${
                    result.level === 'N5'
                      ? 'is-success'
                      : result.level === 'N4' || result.level === 'N2'
                      ? 'is-primary'
                      : result.level === 'N1'
                      ? 'is-error'
                      : 'is-warning'
                  }`}
                >
                  <span className="text-xs">{result.level}</span>
                </span>
              </div>
              <span id="previewReading" className="text-xs text-gray-400 mt-1">
                {result.reading || '(No kana reading provided)'}
              </span>
              <p id="previewMeaning" className="text-sm text-gray-200 mt-2">
                {result.meaning || '(No definition provided)'}
              </p>
            </div>

            <div className="flex flex-col gap-2 w-full md:w-auto">
              {isDuplicate ? (
                <div id="duplicateBadge" className="nes-container is-rounded is-dark border-yellow-500 p-2 text-center">
                  <span className="text-xs nes-text is-warning">⚠️ Already in Library</span>
                </div>
              ) : (
                <button
                  type="button"
                  id="collectBtn"
                  className="nes-btn is-success w-full md:w-auto text-xs whitespace-nowrap"
                  onClick={handleCollect}
                  disabled={isCollecting}
                >
                  {isCollecting ? 'COLLECTING...' : '📥 COLLECT (+10 XP)'}
                </button>
              )}
              <button
                type="button"
                id="searchAnotherBtn"
                className="nes-btn is-dark w-full md:w-auto text-xs"
                onClick={handleReset}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. RECENTLY COLLECTED (LAST 5 WORDS) */}
      <div id="recentlyCollectedSection" className="nes-container with-title is-dark">
        <p className="title text-sm">Recently Collected (Last 5)</p>

        {recentWords.length === 0 ? (
          <p id="emptyRecentText" className="text-xs text-gray-400 text-center py-4">
            No words collected yet. Search and collect your first word to start your quest! 🌱
          </p>
        ) : (
          <div id="recentWordsList" className="flex flex-col gap-3">
            {recentWords.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center p-3 bg-gray-900 border border-gray-700 rounded"
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-base nes-text is-primary font-bold">{item.kanji}</span>
                    <span className="text-xs text-gray-400">({item.reading})</span>
                    <span className="text-xs text-yellow-400">[{item.level}]</span>
                  </div>
                  <span className="text-xs text-gray-300 mt-1">{item.meaning}</span>
                </div>
                <span className="text-xs nes-text is-success whitespace-nowrap">✓ COLLECTED</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
