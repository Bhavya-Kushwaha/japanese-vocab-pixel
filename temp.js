
        async function cloudBackup() {
    const email = document.getElementById('userEmail').value;
    if(!email || !email.includes('@')) return alert("Please enter a valid email!");

    const formData = new URLSearchParams();
    formData.append('email', email);
    formData.append('vocab_list', JSON.stringify(myVocab));

    const res = await fetch('/sync', { method: 'POST', body: formData });
    const result = await res.json();
    if(result.success) alert("Quest data synced to cloud! ☁️");
    else alert("Error: " + result.error);
}

async function cloudLoad() {
    const email = document.getElementById('userEmail').value;
    if(!email) return alert("Enter email to load backup!");

    const formData = new URLSearchParams();
    formData.append('email', email);

    const res = await fetch('/load-backup', { method: 'POST', body: formData });
    const result = await res.json();
    
    if(result.success) {
        myVocab = JSON.parse(result.data);
        saveData(); // Updates LocalStorage
        renderAll(); // Updates UI
        alert("Quest progress restored! 📥");
    } else {
        alert("No backup found for this email.");
    }
}
        // --- 1. DATA INITIALIZATION ---
        let myVocab = JSON.parse(localStorage.getItem('vocabData')) || [];
        const audio = document.getElementById('bgMusic');
        const playBtn = document.getElementById('playBtn');

        // ===== GAMIFICATION DATA =====
        let totalXP       = parseInt(localStorage.getItem('totalXP') || '0');
        let xpLevel       = parseInt(localStorage.getItem('xpLevel') || '1');
        let streakCount   = parseInt(localStorage.getItem('streakCount') || '0');
        let lastStudyDate = localStorage.getItem('lastStudyDate') || '';
        let unlockedAchievements = JSON.parse(localStorage.getItem('unlockedAchievements') || '[]');
        let coins         = parseInt(localStorage.getItem('coins') || '0');
        let inventory     = JSON.parse(localStorage.getItem('inventory') || '[]');
        let dailyQuests   = JSON.parse(localStorage.getItem('dailyQuests') || 'null');
        let lastQuestDate = localStorage.getItem('lastQuestDate') || '';

        let quizScore     = { correct: 0, wrong: 0, xpGained: 0 };
        let previousRank  = '';

        // XP thresholds per level (level 1 needs 100xp, level 2 needs 150, etc.)
        const XP_PER_LEVEL = 100;

        // Achievement definitions
        const ACHIEVEMENTS = [
            { id: 'first_word',    label: '🌱 First Steps',    desc: 'Collected your first word!',      xp: 10,  check: () => myVocab.length >= 1  },
            { id: 'ten_words',     label: '📚 Bookworm',       desc: 'Collected 10 words!',             xp: 25,  check: () => myVocab.length >= 10 },
            { id: 'fifty_words',   label: '🌟 Word Master',    desc: 'Collected 50 words!',             xp: 100, check: () => myVocab.length >= 50 },
            { id: 'hundred_words', label: '👑 LEGEND',          desc: 'Collected 100 words!',            xp: 250, check: () => myVocab.length >= 100},
            { id: 'streak_3',      label: '🔥 On Fire',        desc: 'Studied 3 days in a row!',        xp: 30,  check: () => streakCount >= 3     },
            { id: 'streak_7',      label: '⚡ Unstoppable',    desc: 'Studied 7 days in a row!',        xp: 75,  check: () => streakCount >= 7     },
            { id: 'quiz_10',       label: '⚔️ Quiz Warrior',   desc: 'Answered 10 quiz questions!',     xp: 20,  check: () => {
                const total = parseInt(localStorage.getItem('totalQuizAnswers') || '0');
                return total >= 10;
            }},
        ];

        function saveGamificationData() {
            localStorage.setItem('totalXP', totalXP);
            localStorage.setItem('xpLevel', xpLevel);
            localStorage.setItem('streakCount', streakCount);
            localStorage.setItem('lastStudyDate', lastStudyDate);
            localStorage.setItem('unlockedAchievements', JSON.stringify(unlockedAchievements));
            localStorage.setItem('coins', coins);
            localStorage.setItem('inventory', JSON.stringify(inventory));
        }

        function grantXP(amount) {
            totalXP += amount;
            coins += amount;
            // Level up check (every XP_PER_LEVEL * level XP)
            const xpNeeded = xpLevel * XP_PER_LEVEL;
            if (totalXP >= xpNeeded) {
                totalXP -= xpNeeded;
                xpLevel++;
                showLevelUpModal();
            }
            saveGamificationData();
            updateXPBar();
            updateQuestProgress('xp', amount);
        }

        function updateXPBar() {
            const xpNeeded = xpLevel * XP_PER_LEVEL;
            const xpBarEl  = document.getElementById('xpBar');
            const xpCountEl= document.getElementById('xpCount');
            const xpMaxEl  = document.getElementById('xpMax');
            if (xpBarEl) {
                xpBarEl.max   = xpNeeded;
                xpBarEl.value = totalXP;
                xpCountEl.innerText = totalXP;
                xpMaxEl.innerText   = xpNeeded;
            }
        }

        // ===== STREAK LOGIC =====
        function updateStreak() {
            const today = new Date().toDateString();
            const yesterday = new Date(Date.now() - 86400000).toDateString();
            if (lastStudyDate === today) {
                // already counted today
            } else if (lastStudyDate === yesterday) {
                streakCount++;
                lastStudyDate = today;
            } else {
                // streak broken or first time
                streakCount = 1;
                lastStudyDate = today;
            }
            saveGamificationData();
            renderStreak();
            checkAchievements();
        }

        function renderStreak() {
            const el = document.getElementById('streakCount');
            if (el) el.innerText = streakCount;
            const badge = document.getElementById('streakBadge');
            if (badge) {
                badge.classList.toggle('is-frozen', streakCount === 0);
                badge.innerHTML = streakCount > 0
                    ? `🔥 <span id="streakCount">${streakCount}</span> DAY STREAK`
                    : `❄️ <span id="streakCount">0</span> DAY STREAK`;
            }
        }

        // ===== ACHIEVEMENTS =====
        let toastTimer = null;
        function checkAchievements() {
            ACHIEVEMENTS.forEach(a => {
                if (!unlockedAchievements.includes(a.id) && a.check()) {
                    unlockedAchievements.push(a.id);
                    saveGamificationData();
                    grantXP(a.xp);
                    showAchievementToast(a.label, a.desc, a.xp);
                }
            });
        }

        function showAchievementToast(label, desc, xp) {
            const toast = document.getElementById('achievementToast');
            const inner = toast.querySelector('.toast-inner');
            document.getElementById('toastBody').innerText = label + ' — ' + desc;
            document.getElementById('toastXp').innerText   = xp > 0 ? '+' + xp + ' XP' : '';
            // Warning style for duplicates, purple for achievements
            inner.style.borderColor = label.includes('⚠️') ? '#f97316' : '#a855f7';
            toast.classList.add('show');
            clearTimeout(toastTimer);
            toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
        }

        // ===== LEVEL-UP OVERLAY =====
        function checkRankUp(newRank) {
            if (previousRank && newRank !== previousRank) {
                document.getElementById('levelUpRankName').innerText = newRank;
                const overlay = document.getElementById('levelUpOverlay');
                overlay.classList.add('show');
                grantXP(50); // Bonus XP for rank-up
            }
            previousRank = newRank;
        }

        function closeLevelUp() {
            document.getElementById('levelUpOverlay').classList.remove('show');
        }
        // ===== END GAMIFICATION =====

        window.onload = () => {
            updateStreak();
            updateXPBar();
            const urlParams = new URLSearchParams(window.location.search);
            const q = urlParams.get('q');
            if (q) {
                document.getElementById('searchInput').value = q;
                document.getElementById('clearSearchBtn').style.display = 'inline-block';
                renderAll(q);
            } else {
                renderAll();
            }
        };

        // --- SEARCH LOGIC ---
        function handleSearch(query) {
            const clearBtn = document.getElementById('clearSearchBtn');
            clearBtn.style.display = query ? 'inline-block' : 'none';
            
            const newUrl = query ? `?q=${encodeURIComponent(query)}` : window.location.pathname;
            window.history.pushState({ path: newUrl }, '', newUrl);
            
            renderAll(query);
        }

        function clearSearch() {
            const input = document.getElementById('searchInput');
            input.value = '';
            handleSearch('');
        }

        // --- 2. RADIO LOGIC ---
        function toggleMusic() {
            if (audio.paused) { 
                audio.play(); 
                playBtn.innerText = "STOP"; 
                playBtn.classList.replace('is-primary', 'is-error'); 
            }
            else { 
                audio.pause(); 
                playBtn.innerText = "PLAY"; 
                playBtn.classList.replace('is-error', 'is-primary'); 
            }
        }

        // --- 3. VOCAB LOGIC (CRUD) ---
        async function addWord() {
            const wordInput = document.getElementById('wordInput');
            const word = wordInput.value.trim();
            if(!word) return;

            const res = await fetch('/fetch', { method: 'POST', body: new URLSearchParams({'word': word}) });
            const data = await res.json();

            if(data.success) {
                // --- DUPLICATE CHECK ---
                const isDuplicate = myVocab.some(w =>
                    w.kanji === data.kanji || w.reading === data.reading
                );
                if (isDuplicate) {
                    showAchievementToast('⚠️ Already Collected!', `"${data.kanji}" is already in your quest log.`, 0);
                    wordInput.value = "";
                    return;
                }

                const newEntry = {
                    id: Date.now(),
                    kanji: data.kanji,
                    reading: data.reading,
                    meaning: data.meaning,
                    level: data.level,
                    tags: [],
                    interval: 0,
                    repetition: 0,
                    efactor: 2.5,
                    nextReviewDate: Date.now()
                };
                myVocab.unshift(newEntry);
                saveData();
                renderAll();
                wordInput.value = "";
                grantXP(10);
                updateStreak();
                checkAchievements();
            }
        }

        function deleteWord(id) {
            myVocab = myVocab.filter(item => item.id !== id);
            saveData();
            renderAll();
        }

        function addTag(id) {
            const tag = prompt("Enter a tag (e.g. anime, food):");
            if (tag) {
                const item = myVocab.find(v => v.id === id);
                if (item) {
                    if (!item.tags) item.tags = [];
                    const cleanTag = tag.trim().toLowerCase();
                    if (cleanTag && !item.tags.includes(cleanTag)) {
                        item.tags.push(cleanTag);
                        saveData();
                        renderAll();
                    }
                }
            }
        }

        function saveData() {
            localStorage.setItem('vocabData', JSON.stringify(myVocab));
        }

        function clearStorage() {
            if(confirm("Delete all your progress?")) {
                localStorage.clear();
                myVocab = [];
                renderAll();
            }
        }

        // --- 4. UI RENDERING ---
        function renderAll(query = "") {
            const levels = ['ALL', 'N5', 'N4', 'N3', 'N2', 'N1'];
            levels.forEach(lvl => document.getElementById('list-' + lvl).innerHTML = '');

            const lowerQuery = query.toLowerCase().trim();
            const filteredVocab = myVocab.filter(item => {
                if (!lowerQuery) return true;
                return (item.kanji && item.kanji.toLowerCase().includes(lowerQuery)) ||
                       (item.reading && item.reading.toLowerCase().includes(lowerQuery)) ||
                       (item.meaning && item.meaning.toLowerCase().includes(lowerQuery));
            });

            if (filteredVocab.length === 0 && myVocab.length > 0 && lowerQuery) {
                document.getElementById('list-ALL').innerHTML = `<p class="nes-text is-error text-center mt-4" style="grid-column: 1 / -1;">No words found for "${query}"</p>`;
            }

            filteredVocab.forEach(item => {
                let colorClass = "is-dark";
                let textClass = "";

                if (item.level === "N5") { colorClass = "is-success"; textClass = "is-success"; }
                else if (item.level === "N4" || item.level === "N2") { colorClass = "is-primary"; textClass = "is-primary"; }
                else if (item.level === "N3") { colorClass = "is-warning"; textClass = "is-warning"; }
                else if (item.level === "N1") { colorClass = "is-error"; textClass = "is-error"; }

                const html = `
                <div class="nes-container with-title ${colorClass} is-dark pixel-card">
                    <button class="nes-btn is-error delete-btn" onclick="deleteWord(${item.id})">X</button>
                    <p class="title ${textClass}">LVL: ${item.level}</p>
                    <div class="flex justify-between items-center">
                        <div class="flex flex-col">
                            <div class="flex items-center gap-2">
                                <span class="text-xl md:text-2xl" id="word-text-${item.id}" style="transition: color 0.2s;">${item.kanji}</span>
                                <button onclick="playWord(${item.id})" class="nes-btn is-primary flex justify-center items-center" style="padding: 2px 6px; min-height: auto;">
                                    <span id="speaker-icon-${item.id}" style="font-size: 12px; line-height: 1;">🔊</span>
                                </button>
                                <a href="https://jisho.org/search/${item.kanji}%20%23kanji" target="_blank" class="nes-btn is-warning flex justify-center items-center" style="padding: 2px 6px; min-height: auto;" title="View Stroke Order">
                                    <span style="font-size: 12px; line-height: 1;">✍️</span>
                                </a>
                            </div>
                            <span class="text-xs text-gray-400 mt-1">${item.reading}</span>
                            <div class="flex gap-1 mt-2 flex-wrap cursor-pointer" onclick="addTag(${item.id})" title="Click to add tag">
                                <span class="nes-text is-disabled" style="font-size: 6px;">+ TAG</span>
                                ${(item.tags || []).map(t => `<span class="nes-text is-warning" style="font-size: 6px;">#${t}</span>`).join('')}
                            </div>
                        </div>
                        <div class="text-right"><span class="nes-text ${textClass} text-sm">${item.meaning}</span></div>
                    </div>
                </div>`;

                document.getElementById('list-ALL').insertAdjacentHTML('beforeend', html);
                if(item.level !== "???" && document.getElementById('list-' + item.level)) {
                    document.getElementById('list-' + item.level).insertAdjacentHTML('beforeend', html);
                }
            });
            updateStats();
        }

        // --- WEB SPEECH API LOGIC ---
        // Pre-load voices
        window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();

        function speakText(text, btnId = null, textId = null) {
            const btnIcon = btnId ? document.getElementById(btnId) : null;
            const textElement = textId ? document.getElementById(textId) : null;
            
            if (btnIcon) btnIcon.innerText = "🎶";
            if (textElement) textElement.classList.add("nes-text", "is-warning");

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ja-JP';

            const voices = window.speechSynthesis.getVoices();
            const jaVoice = voices.find(voice => voice.lang === 'ja-JP' || voice.lang === 'ja_JP');
            if (jaVoice) {
                utterance.voice = jaVoice;
            }

            const resetVisuals = () => {
                if (btnIcon) btnIcon.innerText = "🔊";
                if (textElement) textElement.classList.remove("nes-text", "is-warning");
            };

            utterance.onend = resetVisuals;
            utterance.onerror = resetVisuals;

            window.speechSynthesis.speak(utterance);
        }

        function playWord(id) {
            const wordObj = myVocab.find(w => w.id === id);
            if (!wordObj) return;
            speakText(wordObj.kanji, `speaker-icon-${id}`, `word-text-${id}`);
        }

        function updateStats() {
            const count = myVocab.length;
            document.getElementById('totalCount').innerText = count;
            const bar = document.getElementById('questBar');
            const rankText = document.getElementById('rankText');
            
            let rank = "NOVICE";
            let max = 10;
            let value = count;
            let theme = "is-primary"; // Blue

            if (count >= 100) {
                rank = "LEGEND";
                max = 100;
                value = count - 100;
                if (value > 100) value = 100; // Cap visual progress at +100
                theme = "is-maroon"; // Deep Red
            } else if (count >= 50) {
                rank = "MASTER";
                max = 50; // Next goal is 100 (100 - 50 = 50)
                value = count - 50;
                theme = "is-error"; // Red
            } else if (count >= 30) {
                rank = "WARRIOR";
                max = 20; // 50 - 30 = 20
                value = count - 30;
                theme = "is-warning"; // Yellow
            } else if (count >= 10) {
                rank = "APPRENTICE";
                max = 20; // 30 - 10 = 20
                value = count - 10;
                theme = "is-success"; // Green
            }

            bar.max = max;
            bar.value = value;
            bar.className = `nes-progress ${theme}`;
            
            rankText.innerText = rank;
            rankText.className = `nes-text ${theme}`;

            // Check for rank-up animation
            checkRankUp(rank);
            // Always keep XP bar updated
            updateXPBar();
        }

        function showTab(level) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('is-active'));
            document.getElementById(level).classList.add('active');
            event.currentTarget.classList.add('is-active');
            
            if (level === 'REVIEW') {
                document.getElementById('reviewSetup').style.display = 'block';
                document.getElementById('reviewContainer').style.display = 'none';
                document.getElementById('reviewContainer').innerHTML = '';
                
                // Populate tags dropdown
                const tagSelect = document.getElementById('sessionTag');
                const allTags = new Set();
                myVocab.forEach(w => {
                    if (w.tags) w.tags.forEach(t => allTags.add(t));
                });
                tagSelect.innerHTML = '<option value="ALL" selected>Tag: All Tags</option>';
                Array.from(allTags).sort().forEach(t => {
                    tagSelect.innerHTML += `<option value="${t}">Tag: #${t}</option>`;
                });
            }
            if (level === 'BANK') {
                renderBank();
            }
        }

        // ===== JLPT BANK LOGIC =====
        let currentBankLevel = 'N5';

        async function selectBankLevel(lvl) {
            currentBankLevel = lvl;
            document.querySelectorAll('.bank-level-btn').forEach(b => b.classList.remove('is-active'));
            document.getElementById('bankBtn-' + lvl).classList.add('is-active');
            document.getElementById('bankSearch').value = '';
            await renderBank();
        }

        async function renderBank() {
            const grid = document.getElementById('bankGrid');
            grid.innerHTML = '<p style="font-size:7px;color:#9ca3af;">Loading...</p>';
            const allWords = await loadBankLevel(currentBankLevel);
            const query = (document.getElementById('bankSearch').value || '').toLowerCase().trim();
            const words = allWords.filter(w => {
                if (!query) return true;
                return w.kanji.toLowerCase().includes(query)
                    || w.reading.toLowerCase().includes(query)
                    || w.meaning.toLowerCase().includes(query);
            });
            document.getElementById('bankCount').innerText = words.length + ' words';
            grid.innerHTML = '';
            words.forEach(w => {
                const alreadyAdded = myVocab.some(v => v.kanji === w.kanji || v.reading === w.reading);
                const card = document.createElement('div');
                card.className = 'bank-card' + (alreadyAdded ? ' is-added' : '');
                card.innerHTML = `
                    <div class="bc-kanji">${w.kanji}</div>
                    <div class="bc-reading">${w.reading}</div>
                    <div class="bc-meaning">${w.meaning}</div>
                    <button class="nes-btn is-success bc-add"
                        onclick="addFromBank('${w.kanji.replace(/'/g,"\\'")}')"
                        ${alreadyAdded ? 'disabled' : ''}>
                        ${alreadyAdded ? '✓' : '＋'}
                    </button>`;
                grid.appendChild(card);
            });
        }

        async function addFromBank(kanji) {
            const wordList = await loadBankLevel(currentBankLevel);
            const w = wordList.find(x => x.kanji === kanji);
            if (!w) return;
            const isDuplicate = myVocab.some(v => v.kanji === w.kanji || v.reading === w.reading);
            if (isDuplicate) { renderBank(); return; }
            myVocab.unshift({
                id: Date.now() + Math.random(),
                kanji: w.kanji, reading: w.reading, meaning: w.meaning,
                level: currentBankLevel,
                interval: 0, repetition: 0, efactor: 2.5, nextReviewDate: Date.now()
            });
            saveData(); renderAll(); renderBank();
            grantXP(5); checkAchievements();
        }

        async function addAllFromLevel() {
            const wordList = await loadBankLevel(currentBankLevel);
            let added = 0;
            wordList.forEach(w => {
                const isDuplicate = myVocab.some(v => v.kanji === w.kanji || v.reading === w.reading);
                if (!isDuplicate) {
                    myVocab.unshift({
                        id: Date.now() + Math.random(),
                        kanji: w.kanji, reading: w.reading, meaning: w.meaning,
                        level: currentBankLevel,
                        interval: 0, repetition: 0, efactor: 2.5, nextReviewDate: Date.now()
                    });
                    added++;
                }
            });
            saveData(); renderAll(); await renderBank();
            if (added > 0) { grantXP(added * 3); checkAchievements(); }
            showAchievementToast('📥 Imported!', `Added ${added} ${currentBankLevel} words to your Quest Log.`, added * 3);
        }
        // ===== END JLPT BANK LOGIC =====

        function exportToCSV() {
            if(myVocab.length === 0) return alert("No data to export!");
            let csv = "Kanji,Reading,Meaning,Level\n";
            myVocab.forEach(i => csv += `"${i.kanji}","${i.reading}","${i.meaning}","${i.level}"\n`);
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'vocab_quest_export.csv';
            a.click();
        }

        document.getElementById("wordInput").addEventListener("keypress", (e) => {
            if (e.key === "Enter") addWord();
        });

        // --- 5. FLASHCARD / QUIZ SESSION LOGIC ---
        let reviewQueue = [];
        let currentReviewIndex = 0;
        let sessionConfig = { mode: 'flashcard', dir: 'K2M' };
        let quizSessionScore = { correct: 0, wrong: 0, xpGained: 0 };

        async function startSession() {
            const mode = document.getElementById('sessionMode').value;
            const level = document.getElementById('sessionLevel').value;
            const sizeStr = document.getElementById('sessionSize').value;
            const dir = document.getElementById('sessionDirection').value;
            const tagFilter = document.getElementById('sessionTag').value;
            
            sessionConfig = { mode, dir };

            const source = document.getElementById('sessionSource').value;

            let pool;
            if (source === 'bank') {
                const levels = level === 'ALL' ? ['N5','N4','N3','N2','N1'] : [level];
                const allData = (await Promise.all(levels.map(l => loadBankLevel(l)))).flat();
                if (allData.length === 0) {
                    alert('No words available in the JLPT Bank for that level yet!');
                    return;
                }
                pool = allData.map((w, i) => ({
                    id: 'bank_' + i,
                    kanji: w.kanji, reading: w.reading, meaning: w.meaning,
                    level: w.level || level,
                    tags: [],
                    interval: 0, repetition: 0, efactor: 2.5, nextReviewDate: Date.now()
                }));
            } else {
                pool = myVocab;
                if (level !== "ALL") {
                    pool = pool.filter(w => w.level === level);
                }
                if (tagFilter !== "ALL") {
                    pool = pool.filter(w => w.tags && w.tags.includes(tagFilter));
                }
            }

            const now = Date.now();
            let modified = false;
            
            // Auto-initialize missing SRS data for older words
            myVocab.forEach(item => {
                if (item.nextReviewDate === undefined) {
                    item.interval = 0;
                    item.repetition = 0;
                    item.efactor = 2.5;
                    item.nextReviewDate = now;
                    modified = true;
                }
            });
            if (modified) saveData();

            if (mode === "flashcard") {
                // Flashcard: Prioritize due cards
                reviewQueue = pool.filter(item => item.nextReviewDate <= now);
                if (reviewQueue.length === 0) {
                    reviewQueue = [...pool]; // Fallback to all if caught up
                }
            } else {
                // Quiz: purely for fun
                reviewQueue = [...pool];
            }

            if (reviewQueue.length === 0) {
                alert("Not enough words collected for this criteria!");
                return;
            }

            reviewQueue.sort(() => Math.random() - 0.5);
            
            if (sizeStr !== "ALL") {
                reviewQueue = reviewQueue.slice(0, parseInt(sizeStr));
            }

            currentReviewIndex = 0;
            quizSessionScore = { correct: 0, wrong: 0, xpGained: 0 };
            document.getElementById('reviewSetup').style.display = 'none';
            document.getElementById('reviewContainer').style.display = 'flex';
            
            if (mode === "flashcard") {
                renderFlashcard();
            } else if (mode === "typing") {
                renderTypingCard();
            } else if (mode === "boss") {
                renderBossCard();
            } else if (mode === "audio") {
                renderAudioCard();
            } else {
                renderQuiz();
            }
        }

        // --- FLASHCARD LOGIC ---
        function renderFlashcard() {
            if (currentReviewIndex >= reviewQueue.length) {
                document.getElementById('reviewContainer').innerHTML = '<p class="nes-text is-success text-center">Session Complete! 🎉</p><button class="nes-btn is-primary w-full mt-4" onclick="showTab(\'REVIEW\')">Back to Setup</button>';
                return;
            }
            const item = reviewQueue[currentReviewIndex];
            
            let frontText = item.kanji;
            let backReading = item.reading;
            let backMeaning = item.meaning;

            if (sessionConfig.dir === "M2K") {
                frontText = item.meaning;
                backReading = item.reading;
                backMeaning = item.kanji;
            } else if (sessionConfig.dir === "R2M") {
                frontText = item.reading;
                backReading = "";
                backMeaning = item.meaning;
            }

            const html = `
                <div class="nes-container is-dark is-rounded flashcard text-center w-full" style="padding: 1.5rem;">
                    <div class="flex items-center justify-center gap-2 mb-4">
                        <div class="text-3xl">${frontText}</div>
                        <button onclick="speakText('${item.kanji}', 'fc-word-btn', null)" class="nes-btn is-primary flex justify-center items-center" style="padding: 2px 6px; min-height: auto;">
                            <span id="fc-word-btn" style="font-size: 12px; line-height: 1;">🔊</span>
                        </button>
                    </div>
                    <button id="showAnswerBtn" class="nes-btn is-warning is-small w-full" onclick="showAnswer('${item.kanji}')">SHOW ANSWER</button>
                    
                    <div id="answerSection" style="display: none; margin-top: 15px;">
                        <hr class="mb-4">
                        <div class="text-xl text-gray-400">${backReading}</div>
                        <div class="text-2xl mt-2 nes-text is-primary">${backMeaning}</div>
                        <div id="sentenceContainer" class="mt-4 text-left p-2 border-2 border-gray-600 border-dashed" style="display: none;">
                            <div class="text-xs text-gray-400 mb-1">Example Sentence</div>
                            <div id="sentenceLoading" class="text-sm">Fetching sentence...</div>
                            <div id="sentenceContent" style="display: none;">
                                <div class="flex items-start gap-2">
                                    <div id="sentenceJp" class="text-sm nes-text is-success"></div>
                                    <button id="fc-sentence-btn" onclick="speakText(document.getElementById('sentenceJp').innerText, 'fc-sentence-icon', 'sentenceJp')" class="nes-btn is-primary flex justify-center items-center" style="padding: 2px 4px; min-height: auto; margin-top: -2px;">
                                        <span id="fc-sentence-icon" style="font-size: 8px; line-height: 1;">🔊</span>
                                    </button>
                                </div>
                                <div id="sentenceEn" class="text-xs text-gray-400 mt-2"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div id="flashcardActions" class="flashcard-actions w-full flex justify-between gap-2 mt-4" style="display: none;">
                    <button class="nes-btn is-error is-small w-full p-0" style="padding: 0 5px;" onclick="processReview(1)">AGAIN</button>
                    <button class="nes-btn is-warning is-small w-full p-0" style="padding: 0 5px;" onclick="processReview(3)">HARD</button>
                    <button class="nes-btn is-success is-small w-full p-0" style="padding: 0 5px;" onclick="processReview(5)">EASY</button>
                </div>
            `;
            document.getElementById('reviewContainer').innerHTML = html;
        }

        async function showAnswer(kanji) {
            document.getElementById('showAnswerBtn').style.display = 'none';
            document.getElementById('answerSection').style.display = 'block';
            document.getElementById('flashcardActions').style.display = 'flex';
            
            // Fetch Example Sentence
            document.getElementById('sentenceContainer').style.display = 'block';
            document.getElementById('sentenceLoading').style.display = 'block';
            document.getElementById('sentenceContent').style.display = 'none';
            
            try {
                const res = await fetch('/sentence', { method: 'POST', body: new URLSearchParams({'word': kanji}) });
                const data = await res.json();
                
                if (data.success && data.jp) {
                    document.getElementById('sentenceLoading').style.display = 'none';
                    document.getElementById('sentenceContent').style.display = 'block';
                    document.getElementById('sentenceJp').innerText = data.jp;
                    document.getElementById('sentenceEn').innerText = data.en;
                } else {
                    document.getElementById('sentenceLoading').innerText = "No example sentence found.";
                }
            } catch (e) {
                document.getElementById('sentenceLoading').innerText = "Error fetching sentence.";
            }
        }

        function processReview(quality) {
            const item = reviewQueue[currentReviewIndex];
            
            if (sessionConfig.mode === "flashcard") {
                if (quality < 3) {
                    item.repetition = 0;
                    item.interval = 1;
                } else {
                    if (item.repetition === 0) {
                        item.interval = 1;
                    } else if (item.repetition === 1) {
                        item.interval = 6;
                    } else {
                        item.interval = Math.round(item.interval * item.efactor);
                    }
                    item.repetition++;
                }

                item.efactor = item.efactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
                if (item.efactor < 1.3) item.efactor = 1.3;

                const msPerDay = 24 * 60 * 60 * 1000;
                item.nextReviewDate = Date.now() + (item.interval * msPerDay);
                
                const vocabIndex = myVocab.findIndex(v => v.id === item.id);
                if (vocabIndex > -1) {
                    myVocab[vocabIndex] = item;
                    saveData();
                }
            }

            // Grant XP for reviewing
            grantXP(quality >= 3 ? 7 : 3);

            currentReviewIndex++;
            renderFlashcard();
        }

        // --- QUIZ LOGIC ---
        function renderQuiz() {
            if (currentReviewIndex >= reviewQueue.length) {
                const total = quizSessionScore.correct + quizSessionScore.wrong;
                const pct   = total > 0 ? Math.round((quizSessionScore.correct / total) * 100) : 0;
                const accClass = pct >= 80 ? '' : pct >= 50 ? 'mid' : 'low';
                const emoji = pct >= 80 ? '🌟' : pct >= 50 ? '👍' : '💪';
                document.getElementById('reviewContainer').innerHTML = `
                    <div class="nes-container is-dark score-screen">
                        <p class="nes-text is-success mb-4" style="font-size:0.8rem;">QUEST COMPLETE ${emoji}</p>
                        <div class="score-accuracy ${accClass}">${pct}%</div>
                        <div style="font-size:7px;color:#9ca3af;margin-bottom:16px;">ACCURACY</div>
                        <div class="score-row"><span>✅ Correct</span><span class="nes-text is-success">${quizSessionScore.correct}</span></div>
                        <div class="score-row"><span>❌ Wrong</span><span class="nes-text is-error">${quizSessionScore.wrong}</span></div>
                        <div class="score-row" style="border:none;"><span>⚡ XP Earned</span><span class="nes-text is-warning">+${quizSessionScore.xpGained}</span></div>
                        <button class="nes-btn is-primary w-full mt-6" onclick="showTab('REVIEW')">BACK TO SETUP</button>
                        <button class="nes-btn is-warning w-full mt-2" onclick="startSession()">PLAY AGAIN</button>
                    </div>`;
                return;
            }
            const item = reviewQueue[currentReviewIndex];
            
            let frontText = item.kanji;
            let targetProperty = 'meaning';

            if (sessionConfig.dir === "M2K") {
                frontText = item.meaning;
                targetProperty = 'kanji';
            } else if (sessionConfig.dir === "R2M") {
                frontText = item.reading;
                targetProperty = 'meaning';
            }

            const correctAnswer = item[targetProperty];

            let pool = myVocab.filter(w => w.id !== item.id && w.level === item.level);
            if (pool.length < 3) {
                pool = myVocab.filter(w => w.id !== item.id); // Fallback
            }
            pool.sort(() => Math.random() - 0.5);
            const distractors = pool.slice(0, 3).map(w => w[targetProperty] || w.kanji);

            let options = [correctAnswer, ...distractors];
            options.sort(() => Math.random() - 0.5);

            let optionsHtml = options.map(opt => {
                const escapedOpt = opt.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                const isCorrect = opt === correctAnswer;
                const escapedKanji = item.kanji.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                return `
                    <button class="nes-btn is-primary w-full mb-2 quiz-option" style="font-size: 0.9rem; text-align: left;" data-correct="${isCorrect}" onclick="handleQuizAnswer(this, ${isCorrect}, '${escapedKanji}')">${opt}</button>
                `;
            }).join('');

            const html = `
                <div class="nes-container is-dark is-rounded flashcard text-center w-full" style="padding: 1.5rem;">
                    <div class="flex items-center justify-center gap-2 mb-6">
                        <div class="text-2xl">${frontText}</div>
                        <button onclick="speakText('${item.kanji}', 'qz-word-btn', null)" class="nes-btn is-primary flex justify-center items-center" style="padding: 2px 6px; min-height: auto;">
                            <span id="qz-word-btn" style="font-size: 12px; line-height: 1;">🔊</span>
                        </button>
                    </div>
                    <div class="flex flex-col gap-2">
                        ${optionsHtml}
                    </div>
                    
                    <div id="quizSentenceContainer" class="mt-4 text-left p-2 border-2 border-gray-600 border-dashed" style="display: none;">
                        <div class="text-xs text-gray-400 mb-1">Example Sentence</div>
                        <div id="quizSentenceLoading" class="text-sm">Fetching sentence...</div>
                        <div id="quizSentenceContent" style="display: none;">
                            <div class="flex items-start gap-2">
                                <div id="quizSentenceJp" class="text-sm nes-text is-success"></div>
                                <button id="qz-sentence-btn" onclick="speakText(document.getElementById('quizSentenceJp').innerText, 'qz-sentence-icon', 'quizSentenceJp')" class="nes-btn is-primary flex justify-center items-center" style="padding: 2px 4px; min-height: auto; margin-top: -2px;">
                                    <span id="qz-sentence-icon" style="font-size: 8px; line-height: 1;">🔊</span>
                                </button>
                            </div>
                            <div id="quizSentenceEn" class="text-xs text-gray-400 mt-2"></div>
                        </div>
                    </div>
                    <button id="quizNextBtn" class="nes-btn is-warning w-full mt-4" style="display: none;" onclick="nextQuizQuestion()">NEXT ➔</button>
                </div>
            `;
            document.getElementById('reviewContainer').innerHTML = html;
        }

        async function handleQuizAnswer(btn, isCorrect, kanji) {
            const allBtns = document.querySelectorAll('.quiz-option');
            allBtns.forEach(b => {
                b.disabled = true;
                b.classList.remove('is-primary');
                if (b.getAttribute('data-correct') === "true") {
                    b.classList.add('is-success');
                } else if (b === btn && !isCorrect) {
                    b.classList.add('is-error');
                }
            });

            // Track quiz score + XP
            const xpGain = isCorrect ? 15 : 2;
            if (isCorrect) quizSessionScore.correct++;
            else           quizSessionScore.wrong++;
            quizSessionScore.xpGained += xpGain;
            grantXP(xpGain);

            // Track total quiz answers for achievement
            const prev = parseInt(localStorage.getItem('totalQuizAnswers') || '0');
            localStorage.setItem('totalQuizAnswers', prev + 1);
            checkAchievements();
            
            // Show next button and fetch sentence
            document.getElementById('quizNextBtn').style.display = 'block';
            document.getElementById('quizSentenceContainer').style.display = 'block';
            document.getElementById('quizSentenceLoading').style.display = 'block';
            document.getElementById('quizSentenceContent').style.display = 'none';

            try {
                const res = await fetch('/sentence', { method: 'POST', body: new URLSearchParams({'word': kanji}) });
                const data = await res.json();
                
                if (data.success && data.jp) {
                    document.getElementById('quizSentenceLoading').style.display = 'none';
                    document.getElementById('quizSentenceContent').style.display = 'block';
                    document.getElementById('quizSentenceJp').innerText = data.jp;
                    document.getElementById('quizSentenceEn').innerText = data.en;
                } else {
                    document.getElementById('quizSentenceLoading').innerText = "No example sentence found.";
                }
            } catch (e) {
                document.getElementById('quizSentenceLoading').innerText = "Error fetching sentence.";
            }
        }

        function nextQuizQuestion() {
            currentReviewIndex++;
            renderQuiz();
        }

        // --- TYPING MODE LOGIC ---
        function renderTypingCard() {
            if (currentReviewIndex >= reviewQueue.length) {
                const total = quizSessionScore.correct + quizSessionScore.wrong;
                const pct   = total > 0 ? Math.round((quizSessionScore.correct / total) * 100) : 0;
                const accClass = pct >= 80 ? '' : pct >= 50 ? 'mid' : 'low';
                const emoji = pct >= 80 ? '🌟' : pct >= 50 ? '👍' : '💪';
                document.getElementById('reviewContainer').innerHTML = `
                    <div class="nes-container is-dark score-screen">
                        <p class="nes-text is-success mb-4" style="font-size:0.8rem;">QUEST COMPLETE ${emoji}</p>
                        <div class="score-accuracy ${accClass}">${pct}%</div>
                        <div style="font-size:7px;color:#9ca3af;margin-bottom:16px;">ACCURACY</div>
                        <div class="score-row"><span>✅ Correct</span><span class="nes-text is-success">${quizSessionScore.correct}</span></div>
                        <div class="score-row"><span>❌ Wrong</span><span class="nes-text is-error">${quizSessionScore.wrong}</span></div>
                        <div class="score-row" style="border:none;"><span>⚡ XP Earned</span><span class="nes-text is-warning">+${quizSessionScore.xpGained}</span></div>
                        <button class="nes-btn is-primary w-full mt-6" onclick="showTab('REVIEW')">BACK TO SETUP</button>
                        <button class="nes-btn is-warning w-full mt-2" onclick="startSession()">PLAY AGAIN</button>
                    </div>`;
                return;
            }
            const item = reviewQueue[currentReviewIndex];
            
            let frontText = item.kanji;
            let targetProperty = 'reading';

            if (sessionConfig.dir === "M2K") {
                frontText = item.meaning;
            } else if (sessionConfig.dir === "R2M") {
                frontText = item.reading;
                targetProperty = 'meaning';
            }

            const html = `
                <div class="nes-container is-dark is-rounded flashcard text-center w-full" style="padding: 1.5rem;">
                    <div class="flex items-center justify-center gap-2 mb-6">
                        <div class="text-2xl">${frontText}</div>
                        <button onclick="speakText('${item.kanji}', 'tp-word-btn', null)" class="nes-btn is-primary flex justify-center items-center" style="padding: 2px 6px; min-height: auto;">
                            <span id="tp-word-btn" style="font-size: 12px; line-height: 1;">🔊</span>
                        </button>
                    </div>
                    <div class="nes-field">
                        <input type="text" id="typingInput" class="nes-input is-dark" placeholder="Type answer...">
                    </div>
                    <button id="typingSubmitBtn" class="nes-btn is-success w-full mt-4" onclick="handleTypingAnswer('${item.kanji}', '${item[targetProperty].replace(/'/g, "\\'")}', '${targetProperty}')">SUBMIT</button>
                    
                    <div id="typingFeedback" class="mt-4 text-xl" style="display: none;"></div>
                    
                    <button id="typingNextBtn" class="nes-btn is-warning w-full mt-4" style="display: none;" onclick="nextTypingQuestion()">NEXT ➔</button>
                </div>
            `;
            document.getElementById('reviewContainer').innerHTML = html;

            const input = document.getElementById('typingInput');
            input.focus();
            
            if (targetProperty === 'reading') {
                wanakana.bind(input);
            }

            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    document.getElementById('typingSubmitBtn').click();
                }
            });
        }
        
        function handleTypingAnswer(kanji, correctAnswer, targetProperty) {
            const input = document.getElementById('typingInput');
            const submitBtn = document.getElementById('typingSubmitBtn');
            const feedback = document.getElementById('typingFeedback');
            const nextBtn = document.getElementById('typingNextBtn');
            
            const userAnswer = input.value.trim().toLowerCase();
            const isCorrect = userAnswer === correctAnswer.toLowerCase();

            input.disabled = true;
            submitBtn.style.display = 'none';
            feedback.style.display = 'block';
            nextBtn.style.display = 'block';

            if (isCorrect) {
                feedback.innerHTML = '<span class="nes-text is-success">Correct! 🎉</span>';
                input.classList.add('is-success');
            } else {
                feedback.innerHTML = `<span class="nes-text is-error">Wrong!</span><br><span style="font-size: 10px;">Correct: ${correctAnswer}</span>`;
                input.classList.add('is-error');
            }

            const xpGain = isCorrect ? 25 : 5; 
            if (isCorrect) quizSessionScore.correct++;
            else           quizSessionScore.wrong++;
            quizSessionScore.xpGained += xpGain;
            grantXP(xpGain);
            
            const prev = parseInt(localStorage.getItem('totalQuizAnswers') || '0');
            localStorage.setItem('totalQuizAnswers', prev + 1);
            checkAchievements();
            
            nextBtn.focus();
        }

        function nextTypingQuestion() {
            currentReviewIndex++;
            renderTypingCard();
        }

        // --- BOSS BATTLE LOGIC ---
        let bossTimer;
        let timeLeft = 10;

        function renderBossCard() {
            clearInterval(bossTimer);
            if (currentReviewIndex >= reviewQueue.length) {
                const total = quizSessionScore.correct + quizSessionScore.wrong;
                const won = quizSessionScore.wrong === 0 && total > 0;
                document.getElementById('reviewContainer').innerHTML = `
                    <div class="nes-container is-dark score-screen">
                        <p class="nes-text ${won ? 'is-success' : 'is-error'} mb-4" style="font-size:0.8rem;">
                            ${won ? 'BOSS DEFEATED! 🏆' : 'YOU DIED ☠️'}
                        </p>
                        <div class="score-row"><span>✅ Correct</span><span class="nes-text is-success">${quizSessionScore.correct}</span></div>
                        <div class="score-row"><span>❌ Wrong</span><span class="nes-text is-error">${quizSessionScore.wrong}</span></div>
                        <div class="score-row" style="border:none;"><span>⚡ XP Earned</span><span class="nes-text is-warning">+${quizSessionScore.xpGained}</span></div>
                        ${won ? '<p class="nes-text is-warning" style="font-size:8px; margin-top:10px;">FLAWLESS VICTORY BONUS: +50 XP!</p>' : ''}
                        <button class="nes-btn is-primary w-full mt-6" onclick="showTab('REVIEW')">RETREAT</button>
                    </div>`;
                if (won) grantXP(50);
                return;
            }
            
            timeLeft = 7; // 7 seconds per question in Boss Mode!
            const item = reviewQueue[currentReviewIndex];
            
            let frontText = item.kanji;
            let targetProperty = 'meaning';

            if (sessionConfig.dir === "M2K") { frontText = item.meaning; targetProperty = 'kanji'; } 
            else if (sessionConfig.dir === "R2M") { frontText = item.reading; targetProperty = 'meaning'; }

            const correctAnswer = item[targetProperty];
            let pool = myVocab.filter(w => w.id !== item.id && w.level === item.level);
            if (pool.length < 3) pool = myVocab.filter(w => w.id !== item.id);
            pool.sort(() => Math.random() - 0.5);
            const distractors = pool.slice(0, 3).map(w => w[targetProperty] || w.kanji);

            let options = [correctAnswer, ...distractors].sort(() => Math.random() - 0.5);

            let optionsHtml = options.map(opt => {
                const isCorrect = opt === correctAnswer;
                const escapedKanji = item.kanji.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                return `<button class="nes-btn is-error w-full mb-2 boss-option" style="font-size: 0.9rem; text-align: left;" data-correct="${isCorrect}" onclick="handleBossAnswer(this, ${isCorrect}, '${escapedKanji}')">${opt}</button>`;
            }).join('');

            const html = `
                <div class="nes-container is-dark is-rounded flashcard text-center w-full" style="padding: 1.5rem; border-color: #ef4444;">
                    <p class="nes-text is-error mb-2" style="font-size:8px;">BOSS BATTLE</p>
                    <progress class="nes-progress is-error mb-4" id="bossTimeBar" value="100" max="100"></progress>
                    <div class="text-3xl mb-6 nes-text is-error" style="text-shadow: 2px 2px 0px #000;">${frontText}</div>
                    <div class="flex flex-col gap-2">${optionsHtml}</div>
                </div>
            `;
            document.getElementById('reviewContainer').innerHTML = html;

            const bar = document.getElementById('bossTimeBar');
            bossTimer = setInterval(() => {
                timeLeft -= 0.1;
                bar.value = (timeLeft / 7) * 100;
                if (timeLeft <= 0) {
                    clearInterval(bossTimer);
                    handleBossAnswer(null, false, item.kanji); // Time out = wrong
                }
            }, 100);
        }

        function handleBossAnswer(btn, isCorrect, kanji) {
            clearInterval(bossTimer);
            const allBtns = document.querySelectorAll('.boss-option');
            allBtns.forEach(b => {
                b.disabled = true;
                if (b.getAttribute('data-correct') === "true") b.classList.replace('is-error', 'is-success');
                else if (b === btn && !isCorrect) b.classList.replace('is-error', 'is-disabled');
            });

            if (isCorrect) {
                quizSessionScore.correct++;
                quizSessionScore.xpGained += 25;
                grantXP(25);
                setTimeout(() => { currentReviewIndex++; renderBossCard(); }, 600);
            } else {
                // INSTANT LOSS IF WRONG OR TIMEOUT
                quizSessionScore.wrong++;
                setTimeout(() => { currentReviewIndex = reviewQueue.length; renderBossCard(); }, 1500);
            }
        }
        // --- GAMIFICATION / SHOP LOGIC ---
        function applyInventoryState() {
            inventory.forEach(item => {
                const btn = document.getElementById(`buy-${item}`);
                if (btn) {
                    btn.innerText = "OWNED";
                    btn.classList.replace('is-warning', 'is-success');
                    btn.disabled = true;
                }
            });
            
            // Apply themes dynamically if owned
            if (inventory.includes('theme_cyberpunk')) {
                document.body.style.backgroundColor = "#000000";
                document.documentElement.style.setProperty('--nes-primary', '#f0f');
            } else if (inventory.includes('theme_gameboy')) {
                document.body.style.backgroundColor = "#8bac0f";
                document.documentElement.style.setProperty('--nes-primary', '#0f380f');
            }
        }

        function buyItem(itemId, cost) {
            if (inventory.includes(itemId)) return;
            if (coins >= cost) {
                coins -= cost;
                inventory.push(itemId);
                saveGamificationData();
                updateXPBar();
                alert(`Purchased ${itemId}! 🎉`);
            } else {
                alert(`Not enough Coins! You need ${cost - coins} more 🪙.`);
            }
        }

        // --- QUEST LOGIC ---
        const QUEST_TYPES = [
            { id: 'xp', desc: 'Earn {target} XP', target: [50, 100, 200] },
            { id: 'words', desc: 'Add {target} new words', target: [5, 10, 20] },
            { id: 'quiz', desc: 'Answer {target} questions correctly', target: [10, 25, 50] }
        ];

        function generateQuests() {
            const todayDate = new Date().toDateString();
            if (lastQuestDate !== todayDate || !dailyQuests) {
                lastQuestDate = todayDate;
                dailyQuests = [];
                // Pick 3 random quests
                for (let i = 0; i < 3; i++) {
                    const qType = QUEST_TYPES[Math.floor(Math.random() * QUEST_TYPES.length)];
                    const target = qType.target[Math.floor(Math.random() * qType.target.length)];
                    dailyQuests.push({
                        id: qType.id + '_' + i,
                        type: qType.id,
                        desc: qType.desc.replace('{target}', target),
                        target: target,
                        progress: 0,
                        completed: false,
                        reward: target // Reward coins/XP equal to target
                    });
                }
                saveGamificationData();
            }
        }

        function renderQuests() {
            generateQuests();
            const list = document.getElementById('questList');
            if(!list) return;
            list.innerHTML = '';
            let totalCompleted = 0;
            dailyQuests.forEach(q => {
                const percent = Math.min(100, (q.progress / q.target) * 100);
                if(q.completed) totalCompleted++;
                list.innerHTML += `
                    <div class="mb-2">
                        <div class="flex justify-between items-center ${q.completed ? 'nes-text is-success' : ''}">
                            <span>${q.completed ? '✅ ' : '🔸 '}${q.desc}</span>
                            <span>${q.progress}/${q.target}</span>
                        </div>
                        <progress class="nes-progress ${q.completed ? 'is-success' : 'is-primary'} mt-1" value="${percent}" max="100" style="height:10px;"></progress>
                    </div>
                `;
            });
            const qBar = document.getElementById('questBar');
            if(qBar) {
                qBar.value = totalCompleted;
                qBar.max = dailyQuests.length;
            }
        }

        function updateQuestProgress(type, amount) {
            if(!dailyQuests) return;
            let updated = false;
            dailyQuests.forEach(q => {
                if (q.type === type && !q.completed) {
                    q.progress += amount;
                    if (q.progress >= q.target) {
                        q.progress = q.target;
                        q.completed = true;
                        grantXP(q.reward);
                        alert(`Quest Completed: ${q.desc}! +${q.reward} 🪙`);
                    }
                    updated = true;
                }
            });
            if (updated) {
                saveGamificationData();
                renderQuests();
            }
        }

        // --- AUDIO MODE LOGIC ---
        function renderAudioCard() {
            if (currentReviewIndex >= reviewQueue.length) {
                document.getElementById('reviewContainer').innerHTML = '<p class="nes-text is-success text-center">Audio Session Complete! 🎧</p><button class="nes-btn is-primary w-full mt-4" onclick="showTab(\'REVIEW\')">Back to Setup</button>';
                return;
            }
            
            const item = reviewQueue[currentReviewIndex];
            
            // Audio mode always asks for Meaning or Kanji given the Audio
            let targetProperty = sessionConfig.dir === "M2K" ? 'meaning' : 'kanji'; 
            
            const correctAnswer = item[targetProperty];
            let pool = myVocab.filter(w => w.id !== item.id);
            pool.sort(() => Math.random() - 0.5);
            const distractors = pool.slice(0, 3).map(w => w[targetProperty]);

            let options = [correctAnswer, ...distractors].sort(() => Math.random() - 0.5);

            let optionsHtml = options.map(opt => {
                const isCorrect = opt === correctAnswer;
                const escapedKanji = item.kanji.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                return `<button class="nes-btn w-full mb-2" style="font-size: 0.9rem; text-align: left;" data-correct="${isCorrect}" onclick="handleAudioAnswer(this, ${isCorrect}, '${escapedKanji}')">${opt}</button>`;
            }).join('');

            const html = `
                <div class="nes-container is-dark is-rounded flashcard text-center w-full" style="padding: 1.5rem;">
                    <p class="nes-text is-primary mb-2" style="font-size:8px;">BLIND AUDIO 🎧</p>
                    <div class="mb-6 flex justify-center">
                        <button class="nes-btn is-success is-rounded" style="padding: 20px;" onclick="playWord(${item.id})">
                            <span style="font-size: 40px;">🔊</span>
                        </button>
                    </div>
                    <p class="text-xs text-gray-400 mb-4">Listen and select the correct ${targetProperty}</p>
                    <div class="flex flex-col gap-2">${optionsHtml}</div>
                </div>
            `;
            document.getElementById('reviewContainer').innerHTML = html;
            playWord(item.id);
        }

        function handleAudioAnswer(btn, isCorrect, kanji) {
            const allBtns = document.getElementById('reviewContainer').querySelectorAll('button');
            allBtns.forEach(b => {
                b.disabled = true;
                if (b.getAttribute('data-correct') === "true") b.classList.replace('nes-btn', 'nes-btn is-success');
                else if (b === btn && !isCorrect) b.classList.replace('nes-btn', 'nes-btn is-error');
            });

            if (isCorrect) {
                quizSessionScore.correct++;
                quizSessionScore.xpGained += 15;
                updateQuestProgress('quiz', 1);
                grantXP(15);
                setTimeout(() => { currentReviewIndex++; renderAudioCard(); }, 1000);
            } else {
                quizSessionScore.wrong++;
                setTimeout(() => { currentReviewIndex++; renderAudioCard(); }, 2000);
            }
        }

        // --- MEMORY MATCH MINIGAME ---
        let memoryTimer;
        let memoryTimeLeft = 60;
        let memoryMatched = 0;
        let flippedCards = [];

        function startMemoryGame() {
            if(myVocab.length < 6) return alert("You need at least 6 words to play Memory Match!");
            document.getElementById('memoryGameContainer').classList.remove('hidden');
            
            memoryTimeLeft = 60;
            memoryMatched = 0;
            flippedCards = [];
            document.getElementById('memoryTimer').innerText = memoryTimeLeft;
            document.getElementById('memoryScore').innerText = memoryMatched;
            
            // Pick 6 random words
            let pool = [...myVocab].sort(() => Math.random() - 0.5).slice(0, 6);
            let cards = [];
            pool.forEach(w => {
                cards.push({ id: w.id, text: w.kanji, type: 'kanji' });
                cards.push({ id: w.id, text: w.meaning, type: 'meaning' });
            });
            cards.sort(() => Math.random() - 0.5); // Shuffle
            
            const grid = document.getElementById('memoryGrid');
            grid.innerHTML = '';
            cards.forEach((c, index) => {
                grid.innerHTML += `
                    <div class="nes-container is-dark is-rounded memory-card text-center cursor-pointer select-none" 
                         style="padding: 1rem 0.5rem; height: 80px; display: flex; align-items: center; justify-content: center; font-size: 10px; transition: 0.2s;"
                         data-id="${c.id}" data-index="${index}" onclick="flipMemoryCard(this)">
                         <span style="opacity: 0;">${c.text}</span>
                    </div>
                `;
            });

            clearInterval(memoryTimer);
            memoryTimer = setInterval(() => {
                memoryTimeLeft--;
                document.getElementById('memoryTimer').innerText = memoryTimeLeft;
                if(memoryTimeLeft <= 0) {
                    clearInterval(memoryTimer);
                    alert(`Time's Up! You matched ${memoryMatched} pairs. +${memoryMatched * 5} XP`);
                    grantXP(memoryMatched * 5);
                    document.getElementById('memoryGameContainer').classList.add('hidden');
                }
            }, 1000);
        }

        function flipMemoryCard(cardEl) {
            if(flippedCards.length >= 2 || cardEl.classList.contains('matched') || cardEl.classList.contains('flipped')) return;
            
            cardEl.classList.add('flipped');
            cardEl.style.backgroundColor = '#209cee';
            cardEl.querySelector('span').style.opacity = '1';
            
            flippedCards.push(cardEl);
            
            if(flippedCards.length === 2) {
                const id1 = flippedCards[0].getAttribute('data-id');
                const id2 = flippedCards[1].getAttribute('data-id');
                
                if(id1 === id2) {
                    // Match!
                    setTimeout(() => {
                        flippedCards.forEach(c => {
                            c.classList.replace('is-dark', 'is-success');
                            c.classList.add('matched');
                            c.style.backgroundColor = '#92cc41';
                        });
                        flippedCards = [];
                        memoryMatched++;
                        document.getElementById('memoryScore').innerText = memoryMatched;
                        if(memoryMatched >= 6) {
                            clearInterval(memoryTimer);
                            const bonus = memoryTimeLeft;
                            const totalXP = 50 + bonus;
                            alert(`You Win! 6 Matches! Time Bonus: ${bonus}s. Total: +${totalXP} XP`);
                            grantXP(totalXP);
                            document.getElementById('memoryGameContainer').classList.add('hidden');
                        }
                    }, 500);
                } else {
                    // No Match
                    setTimeout(() => {
                        flippedCards.forEach(c => {
                            c.classList.remove('flipped');
                            c.style.backgroundColor = '';
                            c.querySelector('span').style.opacity = '0';
                        });
                        flippedCards = [];
                    }, 1000);
                }
            }
        }

        function showLevelUpModal() {
            document.getElementById('levelUpRankName').innerText = `LEVEL ${xpLevel}`;
            document.getElementById('levelUpOverlay').style.display = 'flex';
        }

        function closeLevelUp() {
            document.getElementById('levelUpOverlay').style.display = 'none';
        }
        
        // Initializer overrides
        const oldRenderAll = renderAll;
        renderAll = function() {
            oldRenderAll();
            applyInventoryState();
            renderQuests();
        }
        
        // Ensure UI updates immediately on load
        setTimeout(() => { renderAll(); applyInventoryState(); }, 500);

        function buyItem(itemId, cost) {
            if (inventory.includes(itemId)) {
                alert("You already own this item!");
                return;
            }
            if (coins < cost) {
                alert(`Not enough coins! You need ${cost} 🪙`);
                return;
            }
            coins -= cost;
            inventory.push(itemId);
            saveGamificationData();
            applyInventoryState();
            alert("Item purchased successfully!");
        }

        function applyInventoryState() {
            // Update shop UI
            const shopItems = ['theme_cyberpunk', 'theme_gameboy', 'music_lofi'];
            shopItems.forEach(id => {
                const btn = document.getElementById('buy-' + id);
                if (btn && inventory.includes(id)) {
                    btn.innerText = "OWNED";
                    btn.disabled = true;
                    btn.classList.replace('is-warning', 'is-success');
                }
            });
            
            // Apply theme
            if (inventory.includes('theme_cyberpunk')) {
                document.body.style.backgroundColor = "#2b0038";
                document.documentElement.style.setProperty('--nes-primary', '#ff00ff');
                // Cyberpunk aesthetics
                document.querySelectorAll('.nes-container.is-dark').forEach(el => {
                    el.style.backgroundColor = '#1a0024';
                    el.style.borderColor = '#ff00ff';
                    el.style.boxShadow = '0 0 10px #ff00ff';
                });
            } else if (inventory.includes('theme_gameboy')) {
                document.body.style.backgroundColor = "#8bac0f";
                document.documentElement.style.setProperty('--nes-primary', '#0f380f');
                document.body.style.color = "#0f380f";
                // Gameboy aesthetics
                document.querySelectorAll('.nes-container.is-dark').forEach(el => {
                    el.style.backgroundColor = '#9bbc0f';
                    el.style.borderColor = '#0f380f';
                    el.style.color = '#0f380f';
                    el.classList.remove('is-dark');
                });
            }
        }

        const playlist = [
            { src: '/static/bg_music.ogg', type: 'audio/ogg' },
            { src: '/static/bg-music.webm', type: 'audio/webm' }
        ];
        let currentTrackIndex = 0;

        function updateTrackName() {
            document.getElementById('trackName').innerText = `Track ${currentTrackIndex + 1}/${playlist.length}`;
        }

        function toggleMusic() {
            const m = document.getElementById('bgMusic');
            const btn = document.getElementById('playBtn');
            if (m.paused) {
                m.play().then(() => btn.innerText = 'PAUSE').catch(e => console.log('Audio error:', e));
            } else {
                m.pause();
                btn.innerText = 'PLAY';
            }
        }

        function nextTrack() {
            currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
            const m = document.getElementById('bgMusic');
            const src = document.getElementById('bgMusicSource');
            src.src = playlist[currentTrackIndex].src;
            src.type = playlist[currentTrackIndex].type;
            m.load();
            updateTrackName();
            const btn = document.getElementById('playBtn');
            if (btn.innerText === 'PAUSE') { // If it was playing
                m.play().catch(e => console.log('Audio error:', e));
            }
        }
        updateTrackName();
    