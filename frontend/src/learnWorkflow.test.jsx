/**
 * learnWorkflow.test.jsx — Integration and component tests for the Learn vocabulary discovery workflow.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import Learn from './pages/Learn.jsx';
import { useAppStore, createAppStore, MemoryStorage, FUKU_STORAGE_KEY } from './store/index.js';

describe('Learn — Vocabulary Discovery Workflow Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    act(() => {
      useAppStore.getState().resetProgress();
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders initial idle discovery UI with input and search button', () => {
    render(<Learn />);

    expect(screen.getByPlaceholderText(/e\.g\. 食べる, 猫, 勉強\.\.\./i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /search/i })).toBeTruthy();
    expect(screen.getByText(/recently collected/i)).toBeTruthy();
    expect(screen.getByText(/no words collected yet/i)).toBeTruthy();
  });

  it('shows validation error when searching with empty or whitespace input without sending request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<Learn />);

    const searchBtn = screen.getByRole('button', { name: /search/i });
    fireEvent.click(searchBtn);

    expect(fetchSpy).not.toHaveBeenCalled();
    const errorMsg = await screen.findByText(/Please enter a Japanese word/i);
    expect(errorMsg).toBeTruthy();
  });

  it('displays loading state during search and renders result preview upon success', async () => {
    let resolveFetch;
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFetch = () =>
            resolve({
              ok: true,
              json: async () => ({
                success: true,
                kanji: '猫',
                reading: 'ねこ',
                meaning: 'cat',
                level: 'N5',
              }),
            });
        })
    );

    render(<Learn />);
    const input = screen.getByPlaceholderText(/e\.g\. 食べる, 猫, 勉強\.\.\./i);
    fireEvent.change(input, { target: { value: '猫' } });

    // Submit with Enter key
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // Loading indicator appears
    expect(screen.getByText(/Searching Jisho API\.\.\./i)).toBeTruthy();

    // Resolve network response
    await act(async () => {
      resolveFetch();
    });

    // Result preview displays
    await waitFor(() => {
      expect(screen.getByText('Word Preview')).toBeTruthy();
      expect(screen.getByText('猫')).toBeTruthy();
      expect(screen.getByText('ねこ')).toBeTruthy();
      expect(screen.getByText('cat')).toBeTruthy();
      expect(screen.getByText('N5')).toBeTruthy();
      expect(screen.getByRole('button', { name: /collect \(\+10 xp\)/i })).toBeTruthy();
    });
  });

  it('successfully collects word into Zustand store, awards 10 XP, and clears input', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        kanji: '食べる',
        reading: 'たべる',
        meaning: 'to eat',
        level: 'N5',
      }),
    });

    render(<Learn />);
    const input = screen.getByPlaceholderText(/e\.g\. 食べる, 猫, 勉強\.\.\./i);
    fireEvent.change(input, { target: { value: '食べる' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    const collectBtn = await screen.findByRole('button', { name: /collect \(\+10 xp\)/i });

    // Initial store XP before collect
    expect(useAppStore.getState().totalXP).toBe(0);

    // Collect the word
    fireEvent.click(collectBtn);

    // Verify success banner appears
    await waitFor(() => {
      expect(screen.getByText(/Collected "食べる"!/i)).toBeTruthy();
    });

    // Verify word added to store
    const storeState = useAppStore.getState();
    expect(storeState.vocab).toHaveLength(1);
    expect(storeState.vocab[0].kanji).toBe('食べる');
    expect(storeState.vocab[0].reading).toBe('たべる');
    expect(storeState.vocab[0].meaning).toBe('to eat');
    expect(storeState.vocab[0].level).toBe('N5');

    // Verify SM-2 metadata initialized
    expect(storeState.vocab[0].interval).toBe(0);
    expect(storeState.vocab[0].repetition).toBe(0);
    expect(storeState.vocab[0].efactor).toBe(2.5);
    expect(storeState.vocab[0].nextReviewDate).toBeTypeOf('number');

    // Verify rewards: 10 XP for word + 10 XP for 'first_word' achievement = 20 XP
    expect(storeState.totalXP).toBe(20);
    expect(storeState.coins).toBe(20);
    expect(storeState.streakCount).toBe(1);

    // Verify Recently Collected section updated
    expect(screen.getByText('Recently Collected (Last 5)')).toBeTruthy();
    expect(screen.getAllByText('食べる').length).toBeGreaterThanOrEqual(1);

    // Verify input was cleared
    expect(input.value).toBe('');
  });

  it('detects duplicate word and prevents duplicate collection without awarding XP', async () => {
    // Seed store with an existing word
    act(() => {
      useAppStore.getState().addWord({
        kanji: '犬',
        reading: 'いぬ',
        meaning: 'dog',
        level: 'N5',
      });
    });

    const xpBefore = useAppStore.getState().totalXP;
    const vocabCountBefore = useAppStore.getState().vocab.length;

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        kanji: '犬',
        reading: 'いぬ',
        meaning: 'dog',
        level: 'N5',
      }),
    });

    render(<Learn />);
    const input = screen.getByPlaceholderText(/e\.g\. 食べる, 猫, 勉強\.\.\./i);
    fireEvent.change(input, { target: { value: '犬' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    // Preview appears showing duplicate status
    await waitFor(() => {
      expect(screen.getByText(/Already in Library/i)).toBeTruthy();
    });

    // Collect button should NOT be present when duplicate
    expect(screen.queryByRole('button', { name: /collect \(\+10 xp\)/i })).toBeNull();

    // Verify no XP awarded and no duplicate added
    expect(useAppStore.getState().totalXP).toBe(xpBefore);
    expect(useAppStore.getState().vocab.length).toBe(vocabCountBefore);
  });

  it('allows pressing Enter on result preview to collect word', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        kanji: '山',
        reading: 'やま',
        meaning: 'mountain',
        level: 'N5',
      }),
    });

    render(<Learn />);
    const input = screen.getByPlaceholderText(/e\.g\. 食べる, 猫, 勉強\.\.\./i);
    fireEvent.change(input, { target: { value: '山' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await screen.findByText('Word Preview');

    // Pressing Enter again while preview is displayed collects the word
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/Collected "山"!/i)).toBeTruthy();
      expect(useAppStore.getState().vocab.some((v) => v.kanji === '山')).toBe(true);
    });
  });

  it('repeated Enter presses on the same word while loading do not trigger duplicate fetch requests', async () => {
    let resolveFetch;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = () =>
            resolve({
              ok: true,
              json: async () => ({
                success: true,
                kanji: '川',
                reading: 'かわ',
                meaning: 'river',
                level: 'N5',
              }),
            });
        })
    );

    render(<Learn />);
    const input = screen.getByPlaceholderText(/e\.g\. 食べる, 猫, 勉強\.\.\./i);
    fireEvent.change(input, { target: { value: '川' } });

    // First Enter triggers request
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Repeated Enter presses while loading should be ignored
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch();
    });

    await waitFor(() => {
      expect(screen.getByText('Word Preview')).toBeTruthy();
    });
  });

  it('displays word-not-found error when Jisho returns success: false', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false }),
    });

    render(<Learn />);
    const input = screen.getByPlaceholderText(/e\.g\. 食べる, 猫, 勉強\.\.\./i);
    fireEvent.change(input, { target: { value: 'asdfxyz' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText('⚠️ Word Not Found')).toBeTruthy();
      expect(screen.getByText(/Check spelling or try another word/i)).toBeTruthy();
    });
  });

  it('displays network failure banner when server is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new TypeError('Failed to fetch (net::ERR_CONNECTION_REFUSED)')
    );

    render(<Learn />);
    const input = screen.getByPlaceholderText(/e\.g\. 食べる, 猫, 勉強\.\.\./i);
    fireEvent.change(input, { target: { value: '水' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText('🔌 Network Failure')).toBeTruthy();
      expect(screen.getByText(/ensure the backend server is running/i)).toBeTruthy();
    });
  });

  it('displays server error banner when HTTP 500 returned', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    render(<Learn />);
    const input = screen.getByPlaceholderText(/e\.g\. 食べる, 猫, 勉強\.\.\./i);
    fireEvent.change(input, { target: { value: '火' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText('🔥 Server Error')).toBeTruthy();
      expect(screen.getByText(/Server error \(500\)/i)).toBeTruthy();
    });
  });

  it('ignores stale responses when a newer search is initiated', async () => {
    let resolveFirst;
    let resolveSecond;

    vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = () =>
              resolve({
                ok: true,
                json: async () => ({
                  success: true,
                  kanji: '古い',
                  reading: 'ふるい',
                  meaning: 'old',
                  level: 'N5',
                }),
              });
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = () =>
              resolve({
                ok: true,
                json: async () => ({
                  success: true,
                  kanji: '新しい',
                  reading: 'あたらしい',
                  meaning: 'new',
                  level: 'N5',
                }),
              });
          })
      );

    render(<Learn />);
    const input = screen.getByPlaceholderText(/e\.g\. 食べる, 猫, 勉強\.\.\./i);

    // First search
    fireEvent.change(input, { target: { value: '古い' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // Second search initiated with a different word before first resolves
    fireEvent.change(input, { target: { value: '新しい' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // Resolve second request first
    await act(async () => {
      resolveSecond();
    });

    await waitFor(() => {
      expect(screen.getByText('新しい')).toBeTruthy();
    });

    // Even if first request finishes later, stale result is ignored
    await act(async () => {
      resolveFirst();
    });

    expect(screen.getByText('新しい')).toBeTruthy();
    expect(screen.queryByText('古い')).toBeNull();
  });

  it('persists newly collected vocabulary to storage and initializes SRS metadata', () => {
    const memoryStorage = new MemoryStorage();
    const isolatedStore = createAppStore({ storage: memoryStorage });

    const beforeXP = isolatedStore.getState().totalXP;
    const res = isolatedStore.getState().addWord({
      kanji: '空',
      reading: 'そら',
      meaning: 'sky',
      level: 'N5',
    });

    expect(res.success).toBe(true);

    // Verify SRS initialization
    expect(res.entry.interval).toBe(0);
    expect(res.entry.repetition).toBe(0);
    expect(res.entry.efactor).toBe(2.5);
    expect(res.entry.nextReviewDate).toBeTypeOf('number');

    // Verify XP reward: 10 base + 10 first_word achievement
    expect(isolatedStore.getState().totalXP).toBe(beforeXP + 20);

    // Verify written to storage
    const stored = JSON.parse(memoryStorage.getItem(FUKU_STORAGE_KEY));
    expect(stored.state.vocab).toHaveLength(1);
    expect(stored.state.vocab[0].kanji).toBe('空');
    expect(stored.state.totalXP).toBe(20);
  });
});
