"use client";
import React, { useState } from "react";

export function AudioButton({ text }: { text: string }) {
    const [isPlaying, setIsPlaying] = useState(false);

    const playAudio = (e: React.MouseEvent) => {
        e.stopPropagation();
        
        if (!("speechSynthesis" in window)) {
            alert("Your browser does not support speech synthesis.");
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "ja-JP";
        utterance.rate = 0.9;

        const voices = window.speechSynthesis.getVoices();
        const jaVoice = voices.find(v => v.lang.includes("ja"));
        if (jaVoice) {
            utterance.voice = jaVoice;
        }

        utterance.onstart = () => setIsPlaying(true);
        utterance.onend = () => setIsPlaying(false);
        utterance.onerror = () => setIsPlaying(false);

        window.speechSynthesis.speak(utterance);
    };

    return (
        <button 
            onClick={playAudio} 
            className={`transition-colors duration-200 ml-2 ${isPlaying ? 'text-green-400' : 'text-gray-400 hover:text-white'}`}
            title="Listen"
        >
            {isPlaying ? '🔊' : '🔈'}
        </button>
    );
}
