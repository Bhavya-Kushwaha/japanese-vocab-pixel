/**
 * reviewWorkflow.test.jsx — Component and Store Integration tests for Review page.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Review from './pages/Review.jsx';
import { useAppStore } from './store/index.js';

describe('Review — Component and Integration Tests (Prompt 06)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    act(() => {
      useAppStore.getState().resetProgress();
    });
    // Mock SpeechSynthesis & SpeechSynthesisUtterance
    global.SpeechSynthesisUtterance = class MockSpeechUtterance {
      constructor(text) {
        this.text = text;
        this.lang = '';
      }
    };
    window.speechSynthesis = {
      speak: vi.fn(),
      cancel: vi.fn(),
      getVoices: vi.fn().mockReturnValue([{ lang: 'ja-JP', name: 'Kyoko' }]),
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const renderWithRouter = (ui, { initialEntries = ['/review'] } = {}) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
      </MemoryRouter>
    );
  };

  it('renders empty library state with link to /learn when no words exist', () => {
    renderWithRouter(<Review />);

    expect(screen.getByText('No Words in Library')).toBeTruthy();
    const learnLink = screen.getByRole('link', { name: /go to learn/i });
    expect(learnLink).toBeTruthy();
    expect(learnLink.getAttribute('href')).toBe('/learn');
  });

  it('renders setup screen with Level, Tag, Deck Size, and Direction selectors when words exist', () => {
    act(() => {
      useAppStore.getState().addWord({ id: 1, kanji: '犬', reading: 'いぬ', meaning: 'dog', level: 'N5', tags: ['animal'] });
    });

    renderWithRouter(<Review />);

    expect(screen.getByText('Session Setup')).toBeTruthy();
    expect(screen.getByLabelText(/jlpt level/i)).toBeTruthy();
    expect(screen.getByLabelText(/tag filter/i)).toBeTruthy();
    expect(screen.getByLabelText(/deck size/i)).toBeTruthy();
    expect(screen.getByLabelText(/review direction/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /start quest/i })).toBeTruthy();
  });

  it('starts session and presents card front, speech button, and SHOW ANSWER button', () => {
    act(() => {
      useAppStore.getState().addWord({ id: 10, kanji: '猫', reading: 'ねこ', meaning: 'cat', level: 'N5' });
    });

    renderWithRouter(<Review />);

    const startBtn = screen.getByRole('button', { name: /start quest/i });
    fireEvent.click(startBtn);

    // In review session
    expect(screen.getByText('Card 1 of 1')).toBeTruthy();
    expect(screen.getByText('猫')).toBeTruthy();
    expect(screen.getByRole('button', { name: /speak japanese pronunciation/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /show answer/i })).toBeTruthy();

    // Answer and grading buttons not yet visible
    expect(screen.queryByText('cat')).toBeNull();
    expect(screen.queryByRole('button', { name: /again/i })).toBeNull();
  });

  it('speech button triggers window.speechSynthesis.speak', () => {
    act(() => {
      useAppStore.getState().addWord({ id: 10, kanji: '猫', reading: 'ねこ', meaning: 'cat', level: 'N5' });
    });

    renderWithRouter(<Review />);
    fireEvent.click(screen.getByRole('button', { name: /start quest/i }));

    const speakBtn = screen.getByRole('button', { name: /speak japanese pronunciation/i });
    fireEvent.click(speakBtn);

    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
  });

  it('clicking SHOW ANSWER reveals reading, meaning, exactly 3 grading buttons, and fetches example sentence', async () => {
    // Mock successful sentence API
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, jp: '猫が好きです。', en: 'I like cats.' }),
    });

    act(() => {
      useAppStore.getState().addWord({ id: 10, kanji: '猫', reading: 'ねこ', meaning: 'cat', level: 'N5' });
    });

    renderWithRouter(<Review />);
    fireEvent.click(screen.getByRole('button', { name: /start quest/i }));

    const showBtn = screen.getByRole('button', { name: /show answer/i });
    fireEvent.click(showBtn);

    // Answer visible
    expect(screen.getByText('ねこ')).toBeTruthy();
    expect(screen.getByText('cat')).toBeTruthy();

    // Exactly 3 grading buttons (no GOOD button)
    expect(screen.getByRole('button', { name: /again/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /hard/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /easy/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /good/i })).toBeNull();

    // Sentence fetched and rendered
    await waitFor(() => {
      expect(screen.getByText('猫が好きです。')).toBeTruthy();
      expect(screen.getByText('I like cats.')).toBeTruthy();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/sentence',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('sentence failure does NOT block grading buttons', async () => {
    // Mock failing sentence API
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    act(() => {
      useAppStore.getState().addWord({ id: 10, kanji: '木', reading: 'き', meaning: 'tree', level: 'N5' });
    });

    renderWithRouter(<Review />);
    fireEvent.click(screen.getByRole('button', { name: /start quest/i }));
    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));

    await waitFor(() => {
      expect(screen.getByText('Error fetching sentence.')).toBeTruthy();
    });

    // Grading buttons remain fully functional
    const easyBtn = screen.getByRole('button', { name: /easy/i });
    expect(easyBtn).toBeTruthy();
    expect(easyBtn.hasAttribute('disabled')).toBe(false);
  });

  it('grading AGAIN (1) updates SRS metadata, grants 3 XP, and completes session', () => {
    act(() => {
      useAppStore.getState().addWord({ id: 10, kanji: '犬', reading: 'いぬ', meaning: 'dog', level: 'N5' });
    });

    const xpBefore = useAppStore.getState().totalXP;
    const coinsBefore = useAppStore.getState().coins;

    renderWithRouter(<Review />);
    fireEvent.click(screen.getByRole('button', { name: /start quest/i }));
    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));

    const againBtn = screen.getByRole('button', { name: /again/i });
    fireEvent.click(againBtn);

    // Completed
    expect(screen.getByText('Session Complete! 🎉')).toBeTruthy();
    expect(document.getElementById('sessionCompleteSummary').textContent).toContain('You reviewed 1 word');

    // Store updated with 3 XP and 3 Coins
    expect(useAppStore.getState().totalXP).toBe(xpBefore + 3);
    expect(useAppStore.getState().coins).toBe(coinsBefore + 3);

    // SRS fields: interval = 1, repetition = 0
    const updated = useAppStore.getState().vocab.find((w) => w.id === 10);
    expect(updated.interval).toBe(1);
    expect(updated.repetition).toBe(0);
  });

  it('grading EASY (5) updates SRS metadata, grants 7 XP, and advances through queue', () => {
    act(() => {
      useAppStore.getState().addWord({ id: 21, kanji: '山', reading: 'やま', meaning: 'mountain', level: 'N5' });
      useAppStore.getState().addWord({ id: 22, kanji: '川', reading: 'かわ', meaning: 'river', level: 'N5' });
    });

    const xpBefore = useAppStore.getState().totalXP;

    renderWithRouter(<Review />);
    fireEvent.click(screen.getByRole('button', { name: /start quest/i }));

    // Card 1
    expect(screen.getByText('Card 1 of 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));
    fireEvent.click(screen.getByRole('button', { name: /easy/i }));

    // Card 2
    expect(screen.getByText('Card 2 of 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));
    fireEvent.click(screen.getByRole('button', { name: /hard/i }));

    // Session Complete
    expect(screen.getByText('Session Complete! 🎉')).toBeTruthy();
    expect(document.getElementById('sessionCompleteSummary').textContent).toContain('You reviewed 2 words');

    // 7 XP (easy) + 7 XP (hard) = 14 XP
    expect(useAppStore.getState().totalXP).toBe(xpBefore + 14);
  });

  it('clicking Back to Setup on completion screen returns to setup view', () => {
    act(() => {
      useAppStore.getState().addWord({ id: 31, kanji: '日', reading: 'ひ', meaning: 'sun', level: 'N5' });
    });

    renderWithRouter(<Review />);
    fireEvent.click(screen.getByRole('button', { name: /start quest/i }));
    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));
    fireEvent.click(screen.getByRole('button', { name: /easy/i }));

    expect(screen.getByText('Session Complete! 🎉')).toBeTruthy();

    const backBtn = screen.getByRole('button', { name: /back to setup/i });
    fireEvent.click(backBtn);

    expect(screen.getByText('Session Setup')).toBeTruthy();
  });

  it('prevents double submissions on rapid clicks', () => {
    act(() => {
      useAppStore.getState().addWord({ id: 41, kanji: '月', reading: 'つき', meaning: 'moon', level: 'N5' });
    });

    const xpBefore = useAppStore.getState().totalXP;
    renderWithRouter(<Review />);
    fireEvent.click(screen.getByRole('button', { name: /start quest/i }));
    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));

    const easyBtn = screen.getByRole('button', { name: /easy/i });

    // Rapid double click
    fireEvent.click(easyBtn);
    fireEvent.click(easyBtn);

    // Total XP should have increased by 7 only once
    expect(useAppStore.getState().totalXP).toBe(xpBefore + 7);
  });

  it('respects M2K and R2M review directions', () => {
    act(() => {
      useAppStore.getState().addWord({ id: 51, kanji: '桜', reading: 'さくら', meaning: 'cherry blossom', level: 'N5' });
    });

    // 1. M2K (Meaning -> Kanji)
    const { unmount } = renderWithRouter(<Review />);
    const dirSelect = screen.getByLabelText(/review direction/i);
    fireEvent.change(dirSelect, { target: { value: 'M2K' } });
    fireEvent.click(screen.getByRole('button', { name: /start quest/i }));

    expect(screen.getByText('cherry blossom')).toBeTruthy(); // Front is meaning
    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));
    expect(screen.getByText('桜')).toBeTruthy(); // Back is kanji
    expect(screen.getByText('さくら')).toBeTruthy(); // Back is reading
    unmount();

    // 2. R2M (Reading -> Meaning)
    renderWithRouter(<Review />);
    const dirSelect2 = screen.getByLabelText(/review direction/i);
    fireEvent.change(dirSelect2, { target: { value: 'R2M' } });
    fireEvent.click(screen.getByRole('button', { name: /start quest/i }));

    expect(screen.getByText('さくら')).toBeTruthy(); // Front is reading
    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));
    expect(screen.getByText('cherry blossom')).toBeTruthy(); // Back is meaning
  });

  it('supports keyboard navigation: Enter to reveal, 1/2/3 to grade', () => {
    act(() => {
      useAppStore.getState().addWord({ id: 61, kanji: '花', reading: 'はな', meaning: 'flower', level: 'N5' });
    });

    renderWithRouter(<Review />);
    fireEvent.click(screen.getByRole('button', { name: /start quest/i }));

    // Space/Enter reveals answer
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByText('flower')).toBeTruthy();

    // Press '3' for EASY
    fireEvent.keyDown(window, { key: '3' });
    expect(screen.getByText('Session Complete! 🎉')).toBeTruthy();
  });

  it('session resets to setup screen on unmount/remount while store keeps completed reviews', () => {
    act(() => {
      useAppStore.getState().addWord({ id: 71, kanji: '雨', reading: 'あめ', meaning: 'rain', level: 'N5' });
      useAppStore.getState().addWord({ id: 72, kanji: '雪', reading: 'ゆき', meaning: 'snow', level: 'N5' });
    });

    const { unmount } = renderWithRouter(<Review />);
    fireEvent.click(screen.getByRole('button', { name: /start quest/i }));

    // Review card 1
    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));
    fireEvent.click(screen.getByRole('button', { name: /easy/i }));

    // One of the cards was reviewed: repetition=1 in store
    const reviewedCardBefore = useAppStore.getState().vocab.find((w) => w.repetition === 1);
    expect(reviewedCardBefore).toBeTruthy();
    const reviewedId = reviewedCardBefore.id;

    // Simulate page refresh / unmount
    unmount();

    // Remount Review page
    renderWithRouter(<Review />);

    // Returns to setup screen naturally
    expect(screen.getByText('Session Setup')).toBeTruthy();

    // The reviewed card's SRS data remains persisted in store
    const reviewedCardAfter = useAppStore.getState().vocab.find((w) => w.id === reviewedId);
    expect(reviewedCardAfter.repetition).toBe(1);
    expect(reviewedCardAfter.interval).toBe(1);
  });
});
