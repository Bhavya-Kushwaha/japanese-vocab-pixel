"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useVocab } from "@/context/VocabContext";
import { VocabItem } from "@/types";

function QuizSession() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { vocab } = useVocab();
    
    const [queue, setQueue] = useState<VocabItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isInitialized, setIsInitialized] = useState(false);
    
    // Quiz specific state
    const [options, setOptions] = useState<string[]>([]);
    const [correctAnswer, setCorrectAnswer] = useState<string>("");
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [isWaiting, setIsWaiting] = useState(false);

    useEffect(() => {
        if (!isInitialized && vocab.length > 0) {
            const level = searchParams.get("level") || "ALL";
            const sizeStr = searchParams.get("size") || "10";
            
            let pool = [...vocab];
            if (level !== "ALL") {
                pool = pool.filter(w => w.level === level);
            }

            if (pool.length === 0) {
                alert("Not enough words collected!");
                router.push("/review");
                return;
            }

            pool.sort(() => Math.random() - 0.5);
            
            if (sizeStr !== "ALL") {
                pool = pool.slice(0, parseInt(sizeStr));
            }

            setQueue(pool);
            setIsInitialized(true);
        }
    }, [vocab, isInitialized, searchParams, router]);

    // Generate options when moving to a new card
    useEffect(() => {
        if (isInitialized && currentIndex < queue.length) {
            const item = queue[currentIndex];
            const direction = searchParams.get("direction") || "K2M";
            
            let targetProperty: keyof VocabItem = 'meaning';
            if (direction === "M2K") {
                targetProperty = 'kanji';
            } else if (direction === "R2M") {
                targetProperty = 'meaning';
            }

            const correct = item[targetProperty] as string;
            setCorrectAnswer(correct);

            // Get distractors
            let pool = vocab.filter(w => w.id !== item.id && w.level === item.level);
            if (pool.length < 3) {
                pool = vocab.filter(w => w.id !== item.id);
            }
            pool.sort(() => Math.random() - 0.5);
            
            const distractors = pool.slice(0, 3).map(w => (w[targetProperty] as string) || w.kanji);
            const allOptions = [correct, ...distractors].sort(() => Math.random() - 0.5);
            
            setOptions(allOptions);
            setSelectedAnswer(null);
        }
    }, [currentIndex, isInitialized, queue, vocab, searchParams]);

    if (!isInitialized || queue.length === 0) {
        return <div className="text-center mt-20 text-xl">Preparing Quiz...</div>;
    }

    if (currentIndex >= queue.length) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <p className="nes-text is-success text-2xl text-center mb-8">Quiz Complete! 🎉</p>
                <button className="nes-btn is-primary w-full max-w-sm" onClick={() => router.push("/review")}>
                    Back to Setup
                </button>
            </div>
        );
    }

    const item = queue[currentIndex];
    const direction = searchParams.get("direction") || "K2M";

    let frontText = item.kanji;
    if (direction === "M2K") {
        frontText = item.meaning;
    } else if (direction === "R2M") {
        frontText = item.reading;
    }

    const handleAnswer = (opt: string) => {
        if (isWaiting) return;
        
        setSelectedAnswer(opt);
        setIsWaiting(true);

        setTimeout(() => {
            setCurrentIndex(prev => prev + 1);
            setIsWaiting(false);
        }, 1000);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 w-full max-w-lg mx-auto">
            <div className="w-full text-right mb-4 text-gray-400">
                Question {currentIndex + 1} / {queue.length}
            </div>

            <div className="nes-container is-dark is-rounded flashcard text-center w-full" style={{ padding: '2rem' }}>
                <div className="text-4xl mb-10">{frontText}</div>
                
                <div className="flex flex-col gap-3">
                    {options.map((opt, i) => {
                        let btnClass = "nes-btn is-primary";
                        
                        if (selectedAnswer !== null) {
                            if (opt === correctAnswer) {
                                btnClass = "nes-btn is-success";
                            } else if (opt === selectedAnswer && opt !== correctAnswer) {
                                btnClass = "nes-btn is-error";
                            } else {
                                btnClass = "nes-btn is-disabled";
                            }
                        }

                        return (
                            <button 
                                key={i}
                                className={`${btnClass} w-full text-left`}
                                style={{ fontSize: '0.9rem', minHeight: '60px' }}
                                onClick={() => handleAnswer(opt)}
                                disabled={selectedAnswer !== null}
                            >
                                {opt}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default function Page() {
    return (
        <Suspense fallback={<div className="text-center mt-20">Loading...</div>}>
            <QuizSession />
        </Suspense>
    );
}
