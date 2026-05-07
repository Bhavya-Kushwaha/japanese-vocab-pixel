export interface VocabItem {
    id: string;
    kanji: string;
    reading: string;
    meaning: string;
    level: string;
    
    // SRS Data
    interval?: number;
    repetition?: number;
    efactor?: number;
    nextReviewDate?: number;
}
