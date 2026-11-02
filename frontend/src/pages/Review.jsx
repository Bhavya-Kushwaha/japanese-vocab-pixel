import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore.js';
import {
  buildReviewQueue,
  getCardContent,
  getAvailableTags,
  VALID_LEVELS,
} from '../logic/reviewQueue.js';

export default function Review() {
  const vocab = useAppStore((state) => state.vocab);
  const reviewWord = useAppStore((state) => state.reviewWord);

  // Setup form states
  const [level, setLevel] = useState('ALL');
  const [tag, setTag] = useState('ALL');
  const [deckSize, setDeckSize] = useState('10');
  const [direction, setDirection] = useState('K2M');

  // Session state
  const [sessionView, setSessionView] = useState('setup'); // 'setup' | 'review' | 'complete'
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  // Sentence loading states
  const [sentenceLoading, setSentenceLoading] = useState(false);
  const [sentenceData, setSentenceData] = useState(null);
  const [sentenceMessage, setSentenceMessage] = useState('');

  // Audio speaking state
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Synchronous submission lock
  const isSubmittingRef = useRef(false);
  const sentenceAbortRef = useRef(null);

  // Tags available from current vocab
  const availableTags = getAvailableTags(vocab);

  // Compute preview counts for setup screen
  const preview = buildReviewQueue(vocab, { level, tag, size: deckSize });

  // ---------------------------------------------------------------------------
  // Speech Synthesis Helper (Japanese ja-JP)
  // ---------------------------------------------------------------------------
  const speakText = useCallback((text) => {
    if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';

      const voices = window.speechSynthesis.getVoices();
      const jaVoice = voices.find((v) => v.lang === 'ja-JP' || v.lang === 'ja_JP');
      if (jaVoice) {
        utterance.voice = jaVoice;
      }

      setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeaking(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Start Review Session
  // ---------------------------------------------------------------------------
  const handleStartSession = useCallback(() => {
    const { queue: newQueue } = buildReviewQueue(
      vocab,
      { level, tag, size: deckSize },
      Date.now(),
      Math.random
    );

    if (newQueue.length === 0) {
      return;
    }

    setQueue(newQueue);
    setCurrentIndex(0);
    setIsRevealed(false);
    setIsSubmitting(false);
    setReviewedCount(0);
    setSentenceData(null);
    setSentenceMessage('');
    isSubmittingRef.current = false;
    setSessionView('review');
  }, [vocab, level, tag, deckSize]);

  // ---------------------------------------------------------------------------
  // Fetch Example Sentence (async, non-blocking)
  // ---------------------------------------------------------------------------
  const fetchSentence = useCallback(async (kanji) => {
    if (!kanji) return;

    if (sentenceAbortRef.current) {
      sentenceAbortRef.current.abort();
    }
    const controller = new AbortController();
    sentenceAbortRef.current = controller;

    setSentenceLoading(true);
    setSentenceData(null);
    setSentenceMessage('Fetching sentence...');

    try {
      const res = await fetch('/sentence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ word: kanji }),
        signal: controller.signal,
      });

      if (!res.ok) {
        setSentenceMessage('Error fetching sentence.');
        setSentenceLoading(false);
        return;
      }

      const data = await res.json();
      if (controller.signal.aborted) return;

      if (data && data.success && data.jp) {
        setSentenceData({ jp: data.jp, en: data.en || '' });
        setSentenceMessage('');
      } else {
        setSentenceMessage('No example sentence found.');
      }
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) return;
      setSentenceMessage('Error fetching sentence.');
    } finally {
      setSentenceLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Reveal Answer Handler
  // ---------------------------------------------------------------------------
  const handleShowAnswer = useCallback(() => {
    if (isRevealed || currentIndex >= queue.length) return;
    setIsRevealed(true);

    const currentCard = queue[currentIndex];
    if (currentCard && currentCard.kanji) {
      fetchSentence(currentCard.kanji);
    }
  }, [isRevealed, currentIndex, queue, fetchSentence]);

  // ---------------------------------------------------------------------------
  // Grade Submission Handler (AGAIN: 1, HARD: 3, EASY: 5)
  // ---------------------------------------------------------------------------
  const handleGrade = useCallback(
    (quality) => {
      // Synchronous double-submission lock
      if (isSubmittingRef.current || isSubmitting) return;
      if (currentIndex >= queue.length) return;

      const currentCard = queue[currentIndex];
      if (!currentCard || typeof currentCard.id === 'undefined') return;

      isSubmittingRef.current = true;
      setIsSubmitting(true);

      const res = reviewWord(currentCard.id, quality);

      if (res && res.success) {
        setReviewedCount((prev) => prev + 1);

        const nextIndex = currentIndex + 1;
        if (nextIndex >= queue.length) {
          // Completed
          setSessionView('complete');
        } else {
          setCurrentIndex(nextIndex);
          setIsRevealed(false);
          setSentenceData(null);
          setSentenceMessage('');
        }
      }

      // Unlock for next card
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    },
    [currentIndex, queue, isSubmitting, reviewWord]
  );

  // ---------------------------------------------------------------------------
  // Keyboard Shortcuts (Space/Enter to show answer, 1/2/3 to grade)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (sessionView !== 'review') return;

    const handleKeyDown = (e) => {
      if (e.repeat) return; // Prevent repeated keyboard events

      // Don't intercept if user is typing in an input
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (!isRevealed) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleShowAnswer();
        }
      } else {
        if (e.key === '1') {
          e.preventDefault();
          handleGrade(1); // AGAIN
        } else if (e.key === '2' || e.key === 'h' || e.key === 'H') {
          e.preventDefault();
          handleGrade(3); // HARD
        } else if (e.key === '3' || e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          handleGrade(5); // EASY
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sessionView, isRevealed, handleShowAnswer, handleGrade]);

  // Clean up speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (sentenceAbortRef.current) {
        sentenceAbortRef.current.abort();
      }
    };
  }, []);

  // Current active card in session
  const currentCard = queue[currentIndex] || null;
  const cardContent = currentCard ? getCardContent(currentCard, direction) : null;

  // ===========================================================================
  // RENDER: Setup Screen
  // ===========================================================================
  if (sessionView === 'setup') {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div id="reviewSetup" className="nes-container is-dark with-title mb-6">
          <p className="title text-sm nes-text is-primary">Session Setup</p>

          {vocab.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-2xl mb-2">🌱</p>
              <p className="nes-text is-warning text-sm font-bold mb-2">No Words in Library</p>
              <p className="text-xs text-gray-400 mb-4">
                Your quest library has no vocabulary yet. Add words on the Learn page to begin your reviews!
              </p>
              <Link to="/learn" className="nes-btn is-primary text-xs">
                🔍 GO TO LEARN
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Mode indicator (Flashcard SRS) */}
              <div className="text-xs text-gray-400 border-b border-gray-700 pb-2 flex justify-between items-center">
                <span>
                  MODE: <strong className="text-white">Flashcards (SRS)</strong>
                </span>
                <span>
                  SOURCE: <strong className="text-white">My Vocab</strong>
                </span>
              </div>

              {/* JLPT Level Selector */}
              <div>
                <label htmlFor="sessionLevel" className="text-xs text-gray-300 block mb-1">
                  JLPT Level:
                </label>
                <div className="nes-select is-dark">
                  <select
                    id="sessionLevel"
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    aria-label="JLPT Level"
                  >
                    {VALID_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        Level: {lvl === 'ALL' ? 'All Levels' : lvl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tag Selector */}
              <div>
                <label htmlFor="sessionTag" className="text-xs text-gray-300 block mb-1">
                  Tag Filter:
                </label>
                <div className="nes-select is-dark">
                  <select
                    id="sessionTag"
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    aria-label="Tag Filter"
                  >
                    <option value="ALL">Tag: All Tags</option>
                    {availableTags.map((t) => (
                      <option key={t} value={t}>
                        Tag: #{t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Deck Size Selector */}
              <div>
                <label htmlFor="sessionSize" className="text-xs text-gray-300 block mb-1">
                  Deck Size:
                </label>
                <div className="nes-select is-dark">
                  <select
                    id="sessionSize"
                    value={deckSize}
                    onChange={(e) => setDeckSize(e.target.value)}
                    aria-label="Deck Size"
                  >
                    <option value="10">Deck Size: 10 Cards</option>
                    <option value="20">Deck Size: 20 Cards</option>
                    <option value="ALL">Deck Size: All Cards</option>
                  </select>
                </div>
              </div>

              {/* Card Direction Selector */}
              <div>
                <label htmlFor="sessionDirection" className="text-xs text-gray-300 block mb-1">
                  Review Direction:
                </label>
                <div className="nes-select is-dark">
                  <select
                    id="sessionDirection"
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                    aria-label="Review Direction"
                  >
                    <option value="K2M">Dir: Kanji -&gt; Meaning</option>
                    <option value="M2K">Dir: Meaning -&gt; Kanji</option>
                    <option value="R2M">Dir: Reading -&gt; Meaning</option>
                  </select>
                </div>
              </div>

              {/* Pool & Due Status Notice */}
              <div className="bg-gray-900 p-3 rounded border border-gray-700 text-xs">
                <div className="flex justify-between text-gray-300 mb-1">
                  <span>Matching Words:</span>
                  <strong className="text-white">{preview.totalPoolCount}</strong>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Due for Review:</span>
                  <strong className={preview.dueCount > 0 ? 'text-green-400' : 'text-yellow-400'}>
                    {preview.dueCount}
                  </strong>
                </div>
                {preview.totalPoolCount > 0 && preview.dueCount === 0 && (
                  <p className="text-[10px] text-yellow-300 mt-2">
                    ⚡ You are caught up! Starting this session will practice all {preview.totalPoolCount} matching words.
                  </p>
                )}
                {preview.totalPoolCount === 0 && (
                  <p className="text-[10px] text-red-400 mt-2" id="noWordsWarning">
                    ⚠️ Not enough words collected for this criteria!
                  </p>
                )}
              </div>

              {/* Start Button */}
              <button
                type="button"
                id="startSessionBtn"
                className={`nes-btn w-full mt-2 ${
                  preview.totalPoolCount > 0 ? 'is-success' : 'is-disabled'
                }`}
                disabled={preview.totalPoolCount === 0}
                onClick={handleStartSession}
              >
                START QUEST
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===========================================================================
  // RENDER: Session Complete Screen
  // ===========================================================================
  if (sessionView === 'complete') {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div id="sessionComplete" className="nes-container is-dark is-rounded text-center py-8">
          <p className="text-3xl mb-3">🎉</p>
          <p className="nes-text is-success text-base font-bold mb-2">Session Complete! 🎉</p>
          <p id="sessionCompleteSummary" className="text-xs text-gray-300 mb-6">
            Great job! You reviewed <strong className="text-white">{reviewedCount}</strong>{' '}
            {reviewedCount === 1 ? 'word' : 'words'} in this session.
          </p>
          <button
            type="button"
            id="backToSetupBtn"
            className="nes-btn is-primary w-full"
            onClick={() => setSessionView('setup')}
          >
            Back to Setup
          </button>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // RENDER: Flashcard Review Screen
  // ===========================================================================
  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Visual position indicator (UI enhancement) */}
      <div className="flex justify-between items-center text-xs text-gray-400 mb-2 px-1">
        <span id="reviewCardIndex">
          Card {currentIndex + 1} of {queue.length}
        </span>
        <span className="text-[10px] uppercase">
          {direction} | {currentCard?.level || 'N5'}
        </span>
      </div>

      <div
        id="reviewContainer"
        className="nes-container is-dark is-rounded flashcard text-center w-full"
        style={{ padding: '1.5rem' }}
      >
        {/* Card Front */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="text-3xl font-bold" id="cardFrontText">
            {cardContent?.front}
          </div>
          {currentCard?.kanji && (
            <button
              type="button"
              id="speakBtn"
              className="nes-btn is-primary flex justify-center items-center"
              style={{ padding: '2px 6px', minHeight: 'auto' }}
              onClick={() => speakText(currentCard.kanji)}
              aria-label="Speak Japanese pronunciation"
              title="Pronounce"
            >
              <span style={{ fontSize: '12px', lineHeight: 1 }}>
                {isSpeaking ? '🎶' : '🔊'}
              </span>
            </button>
          )}
        </div>

        {/* Show Answer Button (pre-reveal) */}
        {!isRevealed && (
          <button
            type="button"
            id="showAnswerBtn"
            className="nes-btn is-warning is-small w-full"
            onClick={handleShowAnswer}
          >
            SHOW ANSWER
          </button>
        )}

        {/* Answer Section (post-reveal) */}
        {isRevealed && (
          <div id="answerSection" style={{ marginTop: '15px' }}>
            <hr className="mb-4 border-gray-700" />
            {cardContent?.backReading && (
              <div className="text-xl text-gray-400 mb-1" id="cardBackReading">
                {cardContent.backReading}
              </div>
            )}
            <div className="text-2xl mt-2 nes-text is-primary font-bold" id="cardBackMeaning">
              {cardContent?.backMeaning}
            </div>

            {/* Example Sentence Container */}
            <div
              id="sentenceContainer"
              className="mt-4 text-left p-2 border-2 border-gray-600 border-dashed text-xs"
            >
              <div className="text-[10px] text-gray-400 mb-1">Example Sentence</div>
              {sentenceLoading && (
                <div id="sentenceLoading" className="text-xs text-gray-400">
                  Fetching sentence...
                </div>
              )}
              {sentenceData ? (
                <div id="sentenceContent">
                  <div className="flex items-start gap-2">
                    <div id="sentenceJp" className="text-xs nes-text is-success">
                      {sentenceData.jp}
                    </div>
                    <button
                      type="button"
                      id="speakSentenceBtn"
                      className="nes-btn is-primary flex justify-center items-center"
                      style={{ padding: '2px 4px', minHeight: 'auto', marginTop: '-2px' }}
                      onClick={() => speakText(sentenceData.jp)}
                      aria-label="Speak example sentence"
                    >
                      <span style={{ fontSize: '8px', lineHeight: 1 }}>🔊</span>
                    </button>
                  </div>
                  {sentenceData.en && (
                    <div id="sentenceEn" className="text-[10px] text-gray-400 mt-2">
                      {sentenceData.en}
                    </div>
                  )}
                </div>
              ) : (
                !sentenceLoading &&
                sentenceMessage && (
                  <div className="text-xs text-gray-400 italic" id="sentenceMessage">
                    {sentenceMessage}
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Flashcard Action Buttons (post-reveal) */}
        {isRevealed && (
          <div
            id="flashcardActions"
            className="flashcard-actions w-full flex justify-between gap-2 mt-4"
          >
            <button
              type="button"
              id="gradeAgainBtn"
              className="nes-btn is-error is-small w-full p-0"
              style={{ padding: '0 5px' }}
              disabled={isSubmitting}
              onClick={() => handleGrade(1)}
            >
              AGAIN
            </button>
            <button
              type="button"
              id="gradeHardBtn"
              className="nes-btn is-warning is-small w-full p-0"
              style={{ padding: '0 5px' }}
              disabled={isSubmitting}
              onClick={() => handleGrade(3)}
            >
              HARD
            </button>
            <button
              type="button"
              id="gradeEasyBtn"
              className="nes-btn is-success is-small w-full p-0"
              style={{ padding: '0 5px' }}
              disabled={isSubmitting}
              onClick={() => handleGrade(5)}
            >
              EASY
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
