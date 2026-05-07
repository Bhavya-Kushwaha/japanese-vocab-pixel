"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useVocab } from "@/context/VocabContext";
import { VocabItem } from "@/types";

function FlashcardSession() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { vocab, updateWord } = useVocab();
    
    const [queue, setQueue] = useState<VocabItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isShowingAnswer, setIsShowingAnswer] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        if (!isInitialized && vocab.length > 0) {
            const level = searchParams.get("level") || "ALL";
            const sizeStr = searchParams.get("size") || "10";
            
            let pool = [...vocab];
            if (level !== "ALL") {
                pool = pool.filter(w => w.level === level);
            }

            const now = Date.now();
            let dueCards = pool.filter(item => item.nextReviewDate && item.nextReviewDate <= now);
            
            if (dueCards.length === 0) {
                dueCards = [...pool]; // Fallback to all if caught up
            }

            if (dueCards.length === 0) {
                alert("Not enough words collected!");
                router.push("/review");
                return;
            }

            dueCards.sort(() => Math.random() - 0.5);
            
            if (sizeStr !== "ALL") {
                dueCards = dueCards.slice(0, parseInt(sizeStr));
            }

            setQueue(dueCards);
            setIsInitialized(true);
        }
    }, [vocab, isInitialized, searchParams, router]);

    if (!isInitialized || queue.length === 0) {
        return <div className="text-center mt-20 text-xl">Shuffling deck...</div>;
    }

    if (currentIndex >= queue.length) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <p className="nes-text is-success text-2xl text-center mb-8">Session Complete! 🎉</p>
                <button className="nes-btn is-primary w-full max-w-sm" onClick={() => router.push("/review")}>
                    Back to Setup
                </button>
            </div>
        );
    }

    const item = queue[currentIndex];
    const direction = searchParams.get("direction") || "K2M";

    let frontText = item.kanji;
    let backReading = item.reading;
    let backMeaning = item.meaning;

    if (direction === "M2K") {
        frontText = item.meaning;
        backReading = item.reading;
        backMeaning = item.kanji;
    } else if (direction === "R2M") {
        frontText = item.reading;
        backReading = "";
        backMeaning = item.meaning;
    }

    const processReview = (quality: number) => {
        // SM-2 Algorithm
        let newInterval = item.interval || 0;
        let newRepetition = item.repetition || 0;
        let newEfactor = item.efactor || 2.5;

        if (quality < 3) {
            newRepetition = 0;
            newInterval = 1;
        } else {
            if (newRepetition === 0) {
                newInterval = 1;
            } else if (newRepetition === 1) {
                newInterval = 6;
            } else {
                newInterval = Math.round(newInterval * newEfactor);
            }
            newRepetition++;
        }

        newEfactor = newEfactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        if (newEfactor < 1.3) newEfactor = 1.3;

        const msPerDay = 24 * 60 * 60 * 1000;
        const nextReviewDate = Date.now() + (newInterval * msPerDay);

        const updatedItem = {
            ...item,
            interval: newInterval,
            repetition: newRepetition,
            efactor: newEfactor,
            nextReviewDate
        };

        updateWord(updatedItem);
        setIsShowingAnswer(false);
        setCurrentIndex(prev => prev + 1);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 w-full max-w-lg mx-auto">
            <div className="w-full text-right mb-4 text-gray-400">
                Card {currentIndex + 1} / {queue.length}
            </div>

            <div className="nes-container is-dark is-rounded flashcard text-center w-full" style={{ padding: '2rem' }}>
                <div className="text-4xl mb-8">{frontText}</div>
                
                {!isShowingAnswer ? (
                    <button className="nes-btn is-warning w-full py-4 text-xl" onClick={() => setIsShowingAnswer(true)}>
                        SHOW ANSWER
                    </button>
                ) : (
                    <div className="mt-4 animate-fade-in">
                        <hr className="mb-6 border-gray-600" />
                        <div className="text-xl text-gray-400 mb-2">{backReading}</div>
                        <div className="text-3xl nes-text is-primary drop-shadow-sm">{backMeaning}</div>
                    </div>
                )}
            </div>

            {isShowingAnswer && (
                <div className="w-full flex justify-between gap-4 mt-8">
                    <button className="nes-btn is-error w-full py-2" onClick={() => processReview(1)}>AGAIN</button>
                    <button className="nes-btn is-warning w-full py-2" onClick={() => processReview(3)}>HARD</button>
                    <button className="nes-btn is-success w-full py-2" onClick={() => processReview(5)}>EASY</button>
                </div>
            )}
        </div>
    );
}

export default function Page() {
    return (
        <Suspense fallback={<div className="text-center mt-20">Loading...</div>}>
            <FlashcardSession />
        </Suspense>
    );
}
