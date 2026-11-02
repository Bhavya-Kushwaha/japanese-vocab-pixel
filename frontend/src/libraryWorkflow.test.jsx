/**
 * libraryWorkflow.test.jsx — Component and Store Integration tests for the Library page.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter, createMemoryRouter, RouterProvider } from 'react-router-dom';
import Library from './pages/Library.jsx';
import { useAppStore, createAppStore, MemoryStorage, FUKU_STORAGE_KEY } from './store/index.js';

describe('Library — Component and Integration Tests', () => {
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

  const renderWithRouter = (ui, { initialEntries = ['/library'] } = {}) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
      </MemoryRouter>
    );
  };

  it('renders empty library state with link to /learn when no words exist', () => {
    renderWithRouter(<Library />);

    expect(screen.getByText('Your Library is Empty')).toBeTruthy();
    const discoverLink = screen.getByRole('link', { name: /discover words/i });
    expect(discoverLink).toBeTruthy();
    expect(discoverLink.getAttribute('href')).toBe('/learn');
  });

  it('renders saved vocabulary cards with kanji, reading, meaning, and level', () => {
    act(() => {
      useAppStore.getState().addWord({
        id: 101,
        kanji: '猫',
        reading: 'ねこ',
        meaning: 'cat',
        level: 'N5',
      });
      useAppStore.getState().addWord({
        id: 102,
        kanji: '学校',
        reading: 'がっこう',
        meaning: 'school',
        level: 'N4',
      });
    });

    renderWithRouter(<Library />);

    expect(screen.getByText('猫')).toBeTruthy();
    expect(screen.getByText('ねこ')).toBeTruthy();
    expect(screen.getByText('cat')).toBeTruthy();
    expect(screen.getByText('学校')).toBeTruthy();
    expect(screen.getByText('がっこう')).toBeTruthy();
    expect(screen.getByText('school')).toBeTruthy();
    expect(document.getElementById('resultsCount').textContent).toMatch(/Showing 2 of 2 words/i);
  });

  it('renders fallbacks gracefully for missing optional fields without crashing', () => {
    act(() => {
      useAppStore.setState({
        vocab: [
          {
            id: 201,
            kanji: '',
            reading: '',
            meaning: '',
            level: null,
          },
        ],
      });
    });

    renderWithRouter(<Library />);

    expect(screen.getByText('(No Kanji)')).toBeTruthy();
    expect(screen.getByText('(No Kana Reading)')).toBeTruthy();
    expect(screen.getByText('(No Definition)')).toBeTruthy();
    expect(screen.getAllByText('Unknown').length).toBeGreaterThanOrEqual(1);
  });

  it('filters vocabulary by search query across kanji, reading, and meaning', () => {
    act(() => {
      useAppStore.getState().addWord({ id: 1, kanji: '犬', reading: 'いぬ', meaning: 'dog', level: 'N5' });
      useAppStore.getState().addWord({ id: 2, kanji: '猫', reading: 'ねこ', meaning: 'cat', level: 'N5' });
    });

    renderWithRouter(<Library />);
    const searchInput = screen.getByPlaceholderText(/search by kanji/i);

    // Filter by reading "ねこ"
    fireEvent.change(searchInput, { target: { value: 'ねこ' } });
    expect(screen.getByText('猫')).toBeTruthy();
    expect(screen.queryByText('犬')).toBeNull();

    // Filter by meaning "dog"
    fireEvent.change(searchInput, { target: { value: 'dog' } });
    expect(screen.getByText('犬')).toBeTruthy();
    expect(screen.queryByText('猫')).toBeNull();
  });

  it('filters by JLPT level buttons and supports UNKNOWN level', () => {
    act(() => {
      useAppStore.getState().addWord({ id: 1, kanji: '火', reading: 'ひ', meaning: 'fire', level: 'N5' });
      useAppStore.getState().addWord({ id: 2, kanji: '水', reading: 'みず', meaning: 'water', level: 'N4' });
      useAppStore.getState().addWord({ id: 3, kanji: '未知語', reading: 'みちご', meaning: 'unknown word', level: '???' });
    });

    renderWithRouter(<Library />);

    // Click N5 filter
    fireEvent.click(screen.getByRole('button', { name: 'N5' }));
    expect(screen.getByText('火')).toBeTruthy();
    expect(screen.queryByText('水')).toBeNull();
    expect(screen.queryByText('未知語')).toBeNull();

    // Click N4 filter
    fireEvent.click(screen.getByRole('button', { name: 'N4' }));
    expect(screen.getByText('水')).toBeTruthy();
    expect(screen.queryByText('火')).toBeNull();

    // Click Unknown filter
    fireEvent.click(screen.getByRole('button', { name: 'Unknown' }));
    expect(screen.getByText('未知語')).toBeTruthy();
    expect(screen.queryByText('火')).toBeNull();
    expect(screen.queryByText('水')).toBeNull();

    // Click ALL filter
    fireEvent.click(screen.getByRole('button', { name: 'ALL' }));
    expect(screen.getByText('火')).toBeTruthy();
    expect(screen.getByText('水')).toBeTruthy();
    expect(screen.getByText('未知語')).toBeTruthy();
  });

  it('displays no-matches empty state and provides a working reset filters button', () => {
    act(() => {
      useAppStore.getState().addWord({ id: 1, kanji: '山', reading: 'やま', meaning: 'mountain', level: 'N5' });
    });

    renderWithRouter(<Library />);
    const searchInput = screen.getByPlaceholderText(/search by kanji/i);
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    expect(screen.getByText('No Matching Words Found')).toBeTruthy();
    const clearBtn = screen.getByRole('button', { name: /clear filters/i });
    expect(clearBtn).toBeTruthy();

    fireEvent.click(clearBtn);
    expect(screen.getByText('山')).toBeTruthy();
    expect(screen.queryByText('No Matching Words Found')).toBeNull();
  });

  it('opens and closes inspect modal with detailed read-only SRS info and supports Escape key', () => {
    act(() => {
      useAppStore.getState().addWord({
        id: 301,
        kanji: '勉強',
        reading: 'べんきょう',
        meaning: 'study',
        level: 'N5',
        tags: ['school', 'focus'],
        sentence_jp: '毎日日本語を勉強します。',
        sentence_en: 'I study Japanese every day.',
      });
    });

    renderWithRouter(<Library />);

    const inspectBtn = screen.getByRole('button', { name: /inspect 勉強/i });
    fireEvent.click(inspectBtn);

    // Modal opens
    expect(screen.getByText('Word Details')).toBeTruthy();
    expect(screen.getByText('#school')).toBeTruthy();
    expect(screen.getByText('#focus')).toBeTruthy();
    expect(screen.getByText('毎日日本語を勉強します。')).toBeTruthy();
    expect(screen.getByText('I study Japanese every day.')).toBeTruthy();

    // SRS read-only fields
    expect(screen.getByText(/SRS METADATA \(READ-ONLY\)/i)).toBeTruthy();
    expect(screen.getByText('0 days')).toBeTruthy(); // Interval
    expect(screen.getByText('2.5')).toBeTruthy(); // E-Factor

    // Press Escape to close modal
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByText('Word Details')).toBeNull();
  });

  it('inspecting a word never mutates its SRS fields', () => {
    act(() => {
      useAppStore.getState().addWord({
        id: 401,
        kanji: '本',
        reading: 'ほん',
        meaning: 'book',
        level: 'N5',
      });
    });

    const srsBefore = { ...useAppStore.getState().vocab[0] };

    renderWithRouter(<Library />);
    const inspectBtn = screen.getByRole('button', { name: /inspect 本/i });
    fireEvent.click(inspectBtn);

    // Close inspect modal via close button
    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);

    const srsAfter = { ...useAppStore.getState().vocab[0] };
    expect(srsAfter.interval).toBe(srsBefore.interval);
    expect(srsAfter.repetition).toBe(srsBefore.repetition);
    expect(srsAfter.efactor).toBe(srsBefore.efactor);
    expect(srsAfter.nextReviewDate).toBe(srsBefore.nextReviewDate);
  });

  it('canceling deletion leaves word intact in store and list', () => {
    act(() => {
      useAppStore.getState().addWord({
        id: 501,
        kanji: '川',
        reading: 'かわ',
        meaning: 'river',
        level: 'N5',
      });
    });

    renderWithRouter(<Library />);
    const deleteBtn = screen.getByRole('button', { name: /delete 川/i });
    fireEvent.click(deleteBtn);

    // Confirmation dialog appears
    expect(screen.getByText('Delete Vocabulary?')).toBeTruthy();
    expect(document.getElementById('deleteDialogDesc').textContent).toMatch(/Are you sure you want to remove "川"/i);

    // Click CANCEL
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);

    // Word remains
    expect(screen.queryByText('Delete Vocabulary?')).toBeNull();
    expect(screen.getByText('川')).toBeTruthy();
    expect(useAppStore.getState().vocab).toHaveLength(1);
  });

  it('confirming deletion removes word without changing XP, coins, streak, or achievements', () => {
    act(() => {
      useAppStore.getState().addWord({
        id: 601,
        kanji: '木',
        reading: 'き',
        meaning: 'tree',
        level: 'N5',
      });
      useAppStore.getState().addWord({
        id: 602,
        kanji: '森',
        reading: 'もり',
        meaning: 'forest',
        level: 'N5',
      });
    });

    const xpBefore = useAppStore.getState().totalXP;
    const coinsBefore = useAppStore.getState().coins;
    const streakBefore = useAppStore.getState().streakCount;
    const achievementsBefore = [...useAppStore.getState().unlockedAchievements];
    const srsForestBefore = { ...useAppStore.getState().vocab.find((w) => w.id === 602) };

    renderWithRouter(<Library />);

    const deleteBtn = screen.getByRole('button', { name: /delete 木/i });
    fireEvent.click(deleteBtn);

    const confirmBtn = screen.getByRole('button', { name: /confirm delete/i });
    fireEvent.click(confirmBtn);

    // Word removed from UI and store
    expect(screen.queryByText('木')).toBeNull();
    expect(screen.getByText('森')).toBeTruthy();
    expect(useAppStore.getState().vocab).toHaveLength(1);
    expect(useAppStore.getState().vocab[0].id).toBe(602);

    // Game stats remain unchanged as verified by legacy parity audit
    expect(useAppStore.getState().totalXP).toBe(xpBefore);
    expect(useAppStore.getState().coins).toBe(coinsBefore);
    expect(useAppStore.getState().streakCount).toBe(streakBefore);
    expect(useAppStore.getState().unlockedAchievements).toEqual(achievementsBefore);

    // Surviving word's SRS metadata is completely unchanged
    const srsForestAfter = useAppStore.getState().vocab[0];
    expect(srsForestAfter.interval).toBe(srsForestBefore.interval);
    expect(srsForestAfter.repetition).toBe(srsForestBefore.repetition);
    expect(srsForestAfter.efactor).toBe(srsForestBefore.efactor);
    expect(srsForestAfter.nextReviewDate).toBe(srsForestBefore.nextReviewDate);
  });

  it('restores search and filter state from URL query parameters on initial load', () => {
    act(() => {
      useAppStore.getState().addWord({ id: 1, kanji: '花', reading: 'はな', meaning: 'flower', level: 'N5' });
      useAppStore.getState().addWord({ id: 2, kanji: '鳥', reading: 'とり', meaning: 'bird', level: 'N4' });
    });

    // Initial URL has ?q=flower&level=N5
    renderWithRouter(<Library />, { initialEntries: ['/library?q=flower&level=N5'] });

    const searchInput = screen.getByPlaceholderText(/search by kanji/i);
    expect(searchInput.value).toBe('flower');
    expect(screen.getByText('花')).toBeTruthy();
    expect(screen.queryByText('鳥')).toBeNull();
  });

  it('supports back and forward browser navigation with router history', () => {
    act(() => {
      useAppStore.getState().addWord({ id: 1, kanji: '雨', reading: 'あめ', meaning: 'rain', level: 'N5' });
      useAppStore.getState().addWord({ id: 2, kanji: '雪', reading: 'ゆき', meaning: 'snow', level: 'N4' });
    });

    const routes = [
      {
        path: '/library',
        element: <Library />,
      },
    ];

    const router = createMemoryRouter(routes, {
      initialEntries: ['/library?q=rain', '/library?q=snow'],
      initialIndex: 1, // Start on 'snow'
    });

    render(<RouterProvider router={router} />);

    expect(screen.getByText('雪')).toBeTruthy();
    expect(screen.queryByText('雨')).toBeNull();

    // Navigate back to 'rain'
    act(() => {
      router.navigate(-1);
    });

    expect(screen.getByText('雨')).toBeTruthy();
    expect(screen.queryByText('雪')).toBeNull();

    // Navigate forward to 'snow'
    act(() => {
      router.navigate(1);
    });

    expect(screen.getByText('雪')).toBeTruthy();
    expect(screen.queryByText('雨')).toBeNull();
  });

  it('deletion persists to storage and safeguards against restoration via repeat migration', () => {
    const memoryStorage = new MemoryStorage();
    const isolatedStore = createAppStore({ storage: memoryStorage });

    const INITIAL_SNAPSHOT = {
      vocabData: JSON.stringify([
        { id: 701, kanji: '昼', reading: 'ひる', meaning: 'noon', level: 'N5' },
        { id: 702, kanji: '夜', reading: 'よる', meaning: 'night', level: 'N5' },
      ]),
      totalXP: '100',
    };

    // 1. Initial migration
    isolatedStore.getState().migrateLegacy(INITIAL_SNAPSHOT);
    expect(isolatedStore.getState().vocab).toHaveLength(2);

    // 2. Delete word 701 in Fuku
    isolatedStore.getState().deleteWord(701);
    expect(isolatedStore.getState().vocab).toHaveLength(1);
    expect(isolatedStore.getState().vocab[0].id).toBe(702);

    // 3. Confirm deleted state written to storage
    const stored = JSON.parse(memoryStorage.getItem(FUKU_STORAGE_KEY));
    expect(stored.state.vocab).toHaveLength(1);
    expect(stored.state.vocab[0].id).toBe(702);

    // 4. Repeat migration attempt with the old snapshot must NOT restore deleted word
    const repeatReport = isolatedStore.getState().migrateLegacy(INITIAL_SNAPSHOT);
    expect(repeatReport.alreadyMigrated).toBe(true);
    expect(repeatReport.vocabAdded).toBe(0);
    expect(isolatedStore.getState().vocab).toHaveLength(1);
    expect(isolatedStore.getState().vocab[0].id).toBe(702);
  });
});
