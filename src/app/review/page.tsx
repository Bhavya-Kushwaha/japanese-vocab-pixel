"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";

export default function ReviewSetup() {
    const router = useRouter();
    const [mode, setMode] = useState("flashcard");
    const [level, setLevel] = useState("ALL");
    const [size, setSize] = useState("10");
    const [direction, setDirection] = useState("K2M");

    const startSession = () => {
        const queryParams = new URLSearchParams({
            level,
            size,
            direction
        }).toString();

        if (mode === "flashcard") {
            router.push(`/review/flashcard?${queryParams}`);
        } else {
            router.push(`/review/quiz?${queryParams}`);
        }
    };

    return (
        <>
            <Header />
            
            <div className="nes-container is-dark mb-6 mt-8 max-w-2xl mx-auto">
                <p className="title">Session Setup</p>
                <div className="flex flex-col gap-6">
                    <div className="nes-select is-dark">
                        <select required value={mode} onChange={(e) => setMode(e.target.value)}>
                            <option value="flashcard">Mode: Flashcards (SRS)</option>
                            <option value="quiz">Mode: Quiz (Fun)</option>
                        </select>
                    </div>
                    <div className="nes-select is-dark">
                        <select required value={level} onChange={(e) => setLevel(e.target.value)}>
                            <option value="ALL">Level: All Levels</option>
                            <option value="N5">Level: N5</option>
                            <option value="N4">Level: N4</option>
                            <option value="N3">Level: N3</option>
                            <option value="N2">Level: N2</option>
                            <option value="N1">Level: N1</option>
                        </select>
                    </div>
                    <div className="nes-select is-dark">
                        <select required value={size} onChange={(e) => setSize(e.target.value)}>
                            <option value="10">Deck Size: 10 Cards</option>
                            <option value="20">Deck Size: 20 Cards</option>
                            <option value="ALL">Deck Size: All Cards</option>
                        </select>
                    </div>
                    <div className="nes-select is-dark">
                        <select required value={direction} onChange={(e) => setDirection(e.target.value)}>
                            <option value="K2M">Dir: Kanji -{'>'} Meaning</option>
                            <option value="M2K">Dir: Meaning -{'>'} Kanji</option>
                            <option value="R2M">Dir: Reading -{'>'} Meaning</option>
                        </select>
                    </div>
                    <button className="nes-btn is-success w-full mt-4 text-xl py-4" onClick={startSession}>
                        START QUEST
                    </button>
                </div>
            </div>
        </>
    );
}
