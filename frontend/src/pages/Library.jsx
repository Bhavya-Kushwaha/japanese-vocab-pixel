/**
 * Library.jsx — Vocabulary Library page for Fuku.
 *
 * Displays saved vocabulary from the shared Zustand store with:
 * - Real-time case-insensitive search (kanji, reading, meaning)
 * - JLPT level filtering (ALL, N5..N1, UNKNOWN)
 * - URL query parameter persistence (search & filter survive refresh & back/forward)
 * - Detailed inspection modal with read-only SRS metadata
 * - Safe deletion with accessible confirmation dialog
 * - Empty library and no-search-results states
 * - Robust handling of missing or corrupted fields
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store/index.js';
import {
  filterVocabulary,
  normalizeLevel,
  formatAddedDate,
  formatReviewDate,
  VALID_JLPT_LEVELS,
} from '../logic/libraryFilter.js';

export default function Library() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL query parameters with safe defaults
  const queryParam = searchParams.get('q') || '';
  const rawLevelParam = (searchParams.get('level') || 'ALL').toUpperCase();
  const levelParam = VALID_JLPT_LEVELS.includes(rawLevelParam) ? rawLevelParam : 'ALL';

  // Store bindings
  const vocab = useAppStore((state) => state.vocab);
  const deleteWord = useAppStore((state) => state.deleteWord);

  // Modal states
  const [inspectWord, setInspectWord] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  // Focus restoration references
  const lastActiveElementRef = useRef(null);
  const inspectCloseBtnRef = useRef(null);
  const deleteCancelBtnRef = useRef(null);
  const searchInputRef = useRef(null);

  // URL State updater
  const updateUrlParams = useCallback(
    (newQuery, newLevel) => {
      const nextParams = new URLSearchParams();
      const trimmed = newQuery.trim();
      if (trimmed) {
        nextParams.set('q', trimmed);
      }
      if (newLevel && newLevel !== 'ALL') {
        nextParams.set('level', newLevel);
      }
      setSearchParams(nextParams);
    },
    [setSearchParams]
  );

  const handleSearchChange = (e) => {
    updateUrlParams(e.target.value, levelParam);
  };

  const handleLevelChange = (lvl) => {
    updateUrlParams(queryParam, lvl);
  };

  const handleClearFilters = () => {
    updateUrlParams('', 'ALL');
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // Filtered vocabulary derived from store and active filters
  const filteredVocab = filterVocabulary(vocab, queryParam, levelParam);

  // Open inspection modal
  const handleOpenInspect = (word) => {
    lastActiveElementRef.current = document.activeElement;
    setInspectWord(word);
  };

  // Close inspection modal
  const handleCloseInspect = useCallback(() => {
    setInspectWord(null);
    if (lastActiveElementRef.current) {
      lastActiveElementRef.current.focus();
    }
  }, []);

  // Open delete confirmation
  const handleOpenDelete = (word) => {
    lastActiveElementRef.current = document.activeElement;
    setDeleteCandidate(word);
  };

  // Cancel deletion
  const handleCancelDelete = useCallback(() => {
    setDeleteCandidate(null);
    if (lastActiveElementRef.current) {
      lastActiveElementRef.current.focus();
    }
  }, []);

  // Confirm deletion
  const handleConfirmDelete = () => {
    if (!deleteCandidate) return;
    const idToDelete = deleteCandidate.id;
    deleteWord(idToDelete);

    setDeleteCandidate(null);
    if (inspectWord && inspectWord.id === idToDelete) {
      setInspectWord(null);
    }
    if (lastActiveElementRef.current) {
      lastActiveElementRef.current.focus();
    }
  };

  // Keyboard accessibility: Escape closes open dialogs
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (deleteCandidate) {
          e.preventDefault();
          handleCancelDelete();
        } else if (inspectWord) {
          e.preventDefault();
          handleCloseInspect();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [deleteCandidate, inspectWord, handleCancelDelete, handleCloseInspect]);

  // Auto-focus management when modals open
  useEffect(() => {
    if (deleteCandidate && deleteCancelBtnRef.current) {
      deleteCancelBtnRef.current.focus();
    } else if (inspectWord && inspectCloseBtnRef.current) {
      inspectCloseBtnRef.current.focus();
    }
  }, [deleteCandidate, inspectWord]);

  return (
    <div className="w-full flex flex-col gap-6">
      {/* 1. HEADER & SEARCH/FILTER CONTROLS */}
      <div className="nes-container with-title is-dark">
        <p className="title text-sm md:text-base">Vocabulary Library</p>
        <p className="text-xs text-gray-300 mb-4">
          Review, search, inspect, and manage all Japanese words collected in your quest.
        </p>

        {/* Search input bar */}
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="flex-1 relative">
            <input
              ref={searchInputRef}
              type="text"
              id="librarySearchInput"
              className="nes-input is-dark w-full"
              placeholder="Search by Kanji, Reading, or Meaning..."
              value={queryParam}
              onChange={handleSearchChange}
              aria-label="Search vocabulary"
              autoComplete="off"
            />
          </div>
          {queryParam && (
            <button
              type="button"
              id="clearSearchBtn"
              className="nes-btn is-dark whitespace-nowrap text-xs"
              onClick={() => updateUrlParams('', levelParam)}
              aria-label="Clear search query"
            >
              ✕ CLEAR
            </button>
          )}
        </div>

        {/* JLPT Level Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-3" role="group" aria-label="JLPT Level Filters">
          <span className="text-xs text-gray-400 mr-1">LEVEL:</span>
          {VALID_JLPT_LEVELS.map((lvl) => {
            const isActive = levelParam === lvl;
            return (
              <button
                key={lvl}
                type="button"
                id={`filterBtn-${lvl}`}
                className={`nes-btn is-small ${isActive ? 'is-primary' : 'is-dark'}`}
                onClick={() => handleLevelChange(lvl)}
                aria-pressed={isActive}
              >
                {lvl === 'UNKNOWN' ? 'Unknown' : lvl}
              </button>
            );
          })}
        </div>

        {/* Results count indicator */}
        <div className="flex justify-between items-center text-xs text-gray-400 border-t border-gray-700 pt-3">
          <span id="resultsCount">
            Showing <strong className="text-white">{filteredVocab.length}</strong> of{' '}
            <strong className="text-white">{vocab.length}</strong> {vocab.length === 1 ? 'word' : 'words'}
          </span>
          {(queryParam || levelParam !== 'ALL') && (
            <button
              type="button"
              id="resetFiltersBtn"
              className="nes-text is-error text-xs underline cursor-pointer bg-transparent border-0 p-0"
              onClick={handleClearFilters}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 2. MAIN CONTENT AREA */}
      {vocab.length === 0 ? (
        /* EMPTY STATE: LIBRARY IS EMPTY */
        <div id="emptyLibraryState" className="nes-container is-dark text-center py-8">
          <p className="text-2xl mb-2">🌱</p>
          <p className="nes-text is-warning text-sm font-bold mb-2">Your Library is Empty</p>
          <p className="text-xs text-gray-300 max-w-md mx-auto mb-6">
            You haven't collected any Japanese words yet. Search and add your first vocabulary words on the Learn page!
          </p>
          <Link to="/learn" id="discoverWordsBtn" className="nes-btn is-primary">
            🔍 DISCOVER WORDS
          </Link>
        </div>
      ) : filteredVocab.length === 0 ? (
        /* EMPTY STATE: NO MATCHES FOUND */
        <div id="noResultsState" className="nes-container is-dark text-center py-8">
          <p className="text-2xl mb-2">🔍</p>
          <p className="nes-text is-error text-sm font-bold mb-2">No Matching Words Found</p>
          <p className="text-xs text-gray-300 max-w-md mx-auto mb-6">
            No vocabulary matches your search "{queryParam}" with level filter "{levelParam}".
          </p>
          <button type="button" id="clearMatchingBtn" className="nes-btn is-warning" onClick={handleClearFilters}>
            CLEAR FILTERS
          </button>
        </div>
      ) : (
        /* VOCABULARY LIST GRID */
        <div id="vocabGrid" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredVocab.map((item, index) => {
            const safeKey = item.id ?? `${item.kanji || 'word'}_${index}`;
            const displayLevel = normalizeLevel(item.level);

            let badgeClass = 'is-dark';
            if (displayLevel === 'N5') badgeClass = 'is-success';
            else if (displayLevel === 'N4' || displayLevel === 'N2') badgeClass = 'is-primary';
            else if (displayLevel === 'N3') badgeClass = 'is-warning';
            else if (displayLevel === 'N1') badgeClass = 'is-error';

            return (
              <div
                key={safeKey}
                className="nes-container with-title is-dark pixel-card flex flex-col justify-between"
                id={`vocabCard-${item.id ?? index}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`nes-badge ${badgeClass} text-xs`}>
                    <span className="text-xs">{displayLevel}</span>
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      id={`inspectBtn-${item.id ?? index}`}
                      className="nes-btn is-primary is-small"
                      onClick={() => handleOpenInspect(item)}
                      aria-label={`Inspect ${item.kanji || item.reading || 'word'}`}
                    >
                      🔍
                    </button>
                    <button
                      type="button"
                      id={`deleteBtn-${item.id ?? index}`}
                      className="nes-btn is-error is-small"
                      onClick={() => handleOpenDelete(item)}
                      aria-label={`Delete ${item.kanji || item.reading || 'word'}`}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="flex flex-col mb-3">
                  <div className="text-xl md:text-2xl font-bold nes-text is-warning mb-1">
                    {item.kanji || '(No Kanji)'}
                  </div>
                  <div className="text-xs text-gray-400 mb-1">
                    {item.reading || '(No Kana Reading)'}
                  </div>
                  <div className="text-sm text-gray-200 line-clamp-2">
                    {item.meaning || '(No Definition)'}
                  </div>
                </div>

                <div className="text-[10px] text-gray-400 border-t border-gray-800 pt-2 flex justify-between items-center">
                  <span>Added: {formatAddedDate(item.id)}</span>
                  <span>Rep: {item.repetition ?? 0}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. INSPECTION DETAIL MODAL */}
      {inspectWord && (
        <div
          className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inspectTitle"
        >
          <div className="nes-container with-title is-dark max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <p className="title text-sm nes-text is-primary" id="inspectTitle">
              Word Details
            </p>

            <div className="flex flex-col gap-4">
              {/* Header: Kanji & Badge */}
              <div className="flex justify-between items-center">
                <span className="text-3xl font-bold nes-text is-warning">
                  {inspectWord.kanji || '(No Kanji)'}
                </span>
                <span
                  className={`nes-badge ${
                    normalizeLevel(inspectWord.level) === 'N5'
                      ? 'is-success'
                      : normalizeLevel(inspectWord.level) === 'N4' || normalizeLevel(inspectWord.level) === 'N2'
                      ? 'is-primary'
                      : normalizeLevel(inspectWord.level) === 'N1'
                      ? 'is-error'
                      : 'is-warning'
                  }`}
                >
                  <span className="text-xs">{normalizeLevel(inspectWord.level)}</span>
                </span>
              </div>

              {/* Reading & Meaning */}
              <div className="bg-gray-900 p-3 rounded border border-gray-700">
                <p className="text-xs text-gray-400 mb-1">READING (KANA):</p>
                <p className="text-sm text-white mb-3">{inspectWord.reading || '(No reading provided)'}</p>

                <p className="text-xs text-gray-400 mb-1">ENGLISH MEANING:</p>
                <p className="text-sm text-white">{inspectWord.meaning || '(No meaning provided)'}</p>
              </div>

              {/* Tags if present */}
              {Array.isArray(inspectWord.tags) && inspectWord.tags.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">TAGS:</p>
                  <div className="flex flex-wrap gap-1">
                    {inspectWord.tags.map((tag) => (
                      <span key={tag} className="nes-badge is-dark text-xs">
                        <span className="text-xs">#{tag}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Example sentence if available */}
              {(inspectWord.sentence_jp || inspectWord.sentence_en) && (
                <div className="bg-gray-900 p-3 rounded border border-gray-700 text-xs">
                  <p className="text-gray-400 mb-1">EXAMPLE SENTENCE:</p>
                  {inspectWord.sentence_jp && <p className="text-yellow-300 mb-1">{inspectWord.sentence_jp}</p>}
                  {inspectWord.sentence_en && <p className="text-gray-300">{inspectWord.sentence_en}</p>}
                </div>
              )}

              {/* READ-ONLY SRS METADATA */}
              <div className="nes-container is-dark is-rounded border-purple-500 text-xs">
                <p className="nes-text is-primary text-xs font-bold mb-2">SRS METADATA (READ-ONLY)</p>
                <div className="grid grid-cols-2 gap-2 text-gray-300 text-xs">
                  <div>
                    <span className="text-gray-400 block">Interval:</span>
                    <strong id="inspectInterval">{inspectWord.interval ?? 0} days</strong>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Repetition:</span>
                    <strong id="inspectRepetition">{inspectWord.repetition ?? 0}</strong>
                  </div>
                  <div>
                    <span className="text-gray-400 block">E-Factor:</span>
                    <strong id="inspectEfactor">{inspectWord.efactor ?? 2.5}</strong>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Next Review:</span>
                    <strong id="inspectNextReview">{formatReviewDate(inspectWord.nextReviewDate)}</strong>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-between items-center pt-3 border-t border-gray-700">
                <button
                  type="button"
                  id="inspectDeleteBtn"
                  className="nes-btn is-error text-xs"
                  onClick={() => {
                    handleOpenDelete(inspectWord);
                  }}
                >
                  DELETE
                </button>
                <button
                  ref={inspectCloseBtnRef}
                  type="button"
                  id="inspectCloseBtn"
                  className="nes-btn is-primary text-xs"
                  onClick={handleCloseInspect}
                >
                  ✕ CLOSE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. DELETE CONFIRMATION DIALOG */}
      {deleteCandidate && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="deleteDialogTitle"
          aria-describedby="deleteDialogDesc"
        >
          <div className="nes-container with-title is-dark border-red-500 max-w-md w-full">
            <p className="title text-sm nes-text is-error" id="deleteDialogTitle">
              Delete Vocabulary?
            </p>

            <p id="deleteDialogDesc" className="text-xs text-gray-200 mb-4 leading-relaxed">
              Are you sure you want to remove{' '}
              <strong className="text-yellow-400">"{deleteCandidate.kanji || deleteCandidate.reading}"</strong> from
              your Library? This will permanently remove it from your quest log.
            </p>

            <div className="flex justify-end gap-3">
              <button
                ref={deleteCancelBtnRef}
                type="button"
                id="cancelDeleteBtn"
                className="nes-btn is-dark text-xs"
                onClick={handleCancelDelete}
              >
                CANCEL
              </button>
              <button
                type="button"
                id="confirmDeleteBtn"
                className="nes-btn is-error text-xs"
                onClick={handleConfirmDelete}
              >
                CONFIRM DELETE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
