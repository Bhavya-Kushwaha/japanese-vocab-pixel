"use client";
import Link from "next/link";
import { useVocab } from "@/context/VocabContext";

export function Header() {
    const { vocab } = useVocab();
    const count = vocab.length;

    // Gamification Logic ported from old script
    let title = "NOVICE";
    let progress = count;
    let max = 10;
    let pClass = "is-primary";

    if (count >= 100) {
        title = "LEGEND";
        progress = count - 100;
        max = 100; // Next goal could be infinite or 200
        pClass = "is-error"; // Deep maroon/red for legend
    } else if (count >= 50) {
        title = "MASTER";
        progress = count - 50;
        max = 50;
        pClass = "is-success";
    } else if (count >= 30) {
        title = "ADEPT";
        progress = count - 30;
        max = 20;
        pClass = "is-warning";
    } else if (count >= 10) {
        title = "SCHOLAR";
        progress = count - 10;
        max = 20;
        pClass = "is-primary";
    }

    return (
        <header className="mb-6">
            <div className="text-center mb-8">
                <h1 className="text-3xl md:text-5xl mb-4 text-white drop-shadow-md" style={{ textShadow: '4px 4px 0 #000' }}>
                    Vocab Quest
                </h1>
                
                {/* Gamified Progress Bar */}
                <div className="nes-container is-dark is-rounded p-4 max-w-lg mx-auto">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Rank: <span className="text-yellow-400">{title}</span></span>
                        <span className="text-sm">{vocab.length} Words Collected</span>
                    </div>
                    <progress className={`nes-progress ${pClass}`} value={progress} max={max}></progress>
                    <div className="text-xs text-right mt-1 opacity-70">
                        {count >= 100 ? `${progress} words into Legend...` : `${max - progress} words to next rank`}
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex justify-center gap-4 border-b-4 border-gray-700 pb-2 mb-4">
                <Link href="/">
                    <button className="nes-btn is-primary">COLLECTION</button>
                </Link>
                <Link href="/review">
                    <button className="nes-btn is-warning">REVIEW</button>
                </Link>
            </nav>
        </header>
    );
}
