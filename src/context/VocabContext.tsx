"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { VocabItem } from "@/types";

interface VocabContextType {
    vocab: VocabItem[];
    addWord: (word: VocabItem) => void;
    updateWord: (word: VocabItem) => void;
    deleteWord: (id: string) => void;
    setVocabList: (words: VocabItem[]) => void;
}

const VocabContext = createContext<VocabContextType | undefined>(undefined);

export function VocabProvider({ children }: { children: React.ReactNode }) {
    const [vocab, setVocab] = useState<VocabItem[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem("vocabData");
        if (stored) {
            try {
                setVocab(JSON.parse(stored));
            } catch (e) {
                console.error("Failed to parse vocab data", e);
            }
        }
        setIsLoaded(true);
    }, []);

    const saveToLocal = (newVocab: VocabItem[]) => {
        setVocab(newVocab);
        localStorage.setItem("vocabData", JSON.stringify(newVocab));
    };

    const addWord = (word: VocabItem) => {
        saveToLocal([word, ...vocab]);
    };

    const updateWord = (updatedWord: VocabItem) => {
        saveToLocal(vocab.map(w => w.id === updatedWord.id ? updatedWord : w));
    };

    const deleteWord = (id: string) => {
        saveToLocal(vocab.filter(w => w.id !== id));
    };

    const setVocabList = (words: VocabItem[]) => {
        saveToLocal(words);
    };

    if (!isLoaded) return <div className="text-center mt-20 text-xl">Loading Quest Data...</div>;

    return (
        <VocabContext.Provider value={{ vocab, addWord, updateWord, deleteWord, setVocabList }}>
            {children}
        </VocabContext.Provider>
    );
}

export const useVocab = () => {
    const context = useContext(VocabContext);
    if (!context) throw new Error("useVocab must be used within VocabProvider");
    return context;
};
