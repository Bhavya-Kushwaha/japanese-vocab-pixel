"use client";
import React, { useState } from "react";
import { useVocab } from "@/context/VocabContext";
import { Header } from "@/components/Header";
import { AudioButton } from "@/components/AudioButton";
import { VocabItem } from "@/types";

export default function Dashboard() {
    const { vocab, addWord, deleteWord } = useVocab();
    const [searchQuery, setSearchQuery] = useState("");
    const [wordInput, setWordInput] = useState("");
    const [isSearchingJisho, setIsSearchingJisho] = useState(false);

    const filteredVocab = vocab.filter(item => 
        item.kanji.includes(searchQuery) || 
        item.reading.includes(searchQuery) || 
        item.meaning.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleAddWord = async () => {
        const word = wordInput.trim();
        if (!word) return;

        setIsSearchingJisho(true);
        try {
            const res = await fetch(`/api/jisho?word=${encodeURIComponent(word)}`);
            const data = await res.json();
            
            if (data.data && data.data.length > 0) {
                const result = data.data[0];
                const kanji = result.japanese[0].word || result.japanese[0].reading;
                const reading = result.japanese[0].reading;
                const meaning = result.senses[0].english_definitions.join(", ");
                const tags = result.jlpt || [];
                let level = "N5"; // Default
                for (let tag of tags) {
                    if (tag.includes("jlpt-n")) {
                        level = tag.replace("jlpt-n", "N").toUpperCase();
                        break;
                    }
                }

                // Add to Context
                const newWord: VocabItem = {
                    id: Date.now().toString() + Math.random().toString(36).substring(7),
                    kanji,
                    reading,
                    meaning,
                    level
                };
                
                addWord(newWord);
                setWordInput("");
            } else {
                alert("Word not found in Jisho dictionary!");
            }
        } catch (error) {
            console.error(error);
            alert("Error fetching data. Check backend connection.");
        } finally {
            setIsSearchingJisho(false);
        }
    };

    return (
        <>
            <Header />

            {/* Input Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="nes-container is-dark with-title">
                    <p className="title">New Discovery</p>
                    <div className="nes-field">
                        <label htmlFor="wordInput">Enter Japanese Word/Kanji</label>
                        <input 
                            type="text" 
                            id="wordInput" 
                            className="nes-input is-dark" 
                            value={wordInput}
                            onChange={(e) => setWordInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddWord()}
                            placeholder="e.g. 食べる or taberu"
                        />
                    </div>
                    <button 
                        className={`nes-btn w-full mt-4 ${isSearchingJisho ? 'is-disabled' : 'is-success'}`} 
                        onClick={handleAddWord}
                        disabled={isSearchingJisho}
                    >
                        {isSearchingJisho ? 'SEARCHING...' : 'ADD TO QUEST'}
                    </button>
                </div>

                <div className="nes-container is-dark with-title">
                    <p className="title">Cloud Sync (Supabase)</p>
                    <p className="text-xs mb-4">Sync your local browser progress to the cloud to prevent data loss across devices.</p>
                    <div className="flex flex-col gap-2">
                        <button className="nes-btn is-primary w-full" onClick={() => alert("Cloud sync migration in progress.")}>Backup to Cloud</button>
                        <button className="nes-btn is-warning w-full" onClick={() => alert("Cloud sync migration in progress.")}>Load from Cloud</button>
                    </div>
                </div>
            </div>

            {/* Search and Filter */}
            <div className="nes-container is-dark mb-6">
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        className="nes-input is-dark w-full" 
                        placeholder="Search your collection..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button className="nes-btn is-error" onClick={() => setSearchQuery("")}>X</button>
                    )}
                </div>
            </div>

            {/* Vocab Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredVocab.length === 0 ? (
                    <div className="col-span-full text-center py-8 opacity-50">
                        {vocab.length === 0 ? "Your quest log is empty! Add some words above." : "No words match your search."}
                    </div>
                ) : (
                    filteredVocab.map((item) => (
                        <div key={item.id} className="nes-container is-dark is-rounded flex justify-between items-center group relative">
                            <div>
                                <div className="text-2xl mb-1 flex items-center">
                                    {item.kanji}
                                    <AudioButton text={item.kanji} />
                                </div>
                                <div className="text-sm text-gray-400">{item.reading}</div>
                                <div className="text-sm text-yellow-400 mt-2">{item.meaning}</div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className={`nes-badge is-icon`}>
                                    <span className="is-dark">{item.level}</span>
                                </span>
                                {/* Hidden delete button on hover */}
                                <button 
                                    className="nes-btn is-error is-small opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 px-2"
                                    style={{ padding: '0px 8px' }}
                                    onClick={() => deleteWord(item.id)}
                                    title="Abandon Word"
                                >
                                    X
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </>
    );
}
