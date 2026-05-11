with open('templates/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

render_trophy_js = """
        function renderTrophyRoom() {
            const grid = document.getElementById('badgesGrid');
            if (!grid) return;
            grid.innerHTML = '';
            
            ACHIEVEMENTS.forEach(a => {
                const isUnlocked = unlockedAchievements.includes(a.id);
                const cls = isUnlocked ? 'is-dark' : '';
                const titleColor = isUnlocked ? 'is-warning' : 'is-disabled';
                const opacity = isUnlocked ? '1' : '0.4';
                const icon = isUnlocked ? '🏆' : '🔒';
                
                grid.innerHTML += `
                    <div class="nes-container ${cls} is-rounded p-2 text-center" style="opacity: ${opacity}">
                        <div style="font-size: 2rem; margin-bottom: 5px;">${icon}</div>
                        <p class="nes-text ${titleColor}" style="font-size: 8px; margin-bottom: 5px;">${a.label}</p>
                        <p class="text-gray-400" style="font-size: 6px;">${a.desc}</p>
                    </div>
                `;
            });
        }
"""

speed_run_js = """
        // ===== SPEED RUN QUIZ =====
        let speedRunTimer;
        let speedRunTimeLeft = 60;
        let speedRunScore = 0;
        let currentSpeedRunWord = null;

        function startSpeedRunGame() {
            if (myVocab.length < 4 && (!window.JLPT_N5 || window.JLPT_N5.length < 4)) {
                return showToast("You need more words collected to play!", 'warning');
            }
            document.getElementById('speedRunContainer').classList.remove('hidden');
            document.getElementById('speedRunEndBtn').style.display = 'block';
            speedRunTimeLeft = 60;
            speedRunScore = 0;
            document.getElementById('speedRunTimer').innerText = speedRunTimeLeft;
            document.getElementById('speedRunScore').innerText = speedRunScore;
            
            clearInterval(speedRunTimer);
            speedRunTimer = setInterval(() => {
                speedRunTimeLeft--;
                document.getElementById('speedRunTimer').innerText = speedRunTimeLeft;
                if (speedRunTimeLeft <= 0) {
                    endSpeedRunGame(true);
                }
            }, 1000);
            
            nextSpeedRunQuestion();
        }

        function endSpeedRunGame(timeUp = false) {
            clearInterval(speedRunTimer);
            document.getElementById('speedRunContainer').classList.add('hidden');
            document.getElementById('speedRunEndBtn').style.display = 'none';
            if (timeUp) {
                const xpEarned = speedRunScore * 10;
                showToast(`Time's Up! You scored ${speedRunScore}. +${xpEarned} XP!`, 'info');
                grantXP(xpEarned);
            }
        }

        function nextSpeedRunQuestion() {
            const pool = myVocab.length >= 4 ? myVocab : window.JLPT_N5;
            const target = pool[Math.floor(Math.random() * pool.length)];
            currentSpeedRunWord = target;
            
            document.getElementById('speedRunKanji').innerText = target.kanji || target.reading;
            document.getElementById('speedRunReading').innerText = target.kanji ? target.reading : '';
            
            let options = set([target.meaning]); // wait python Set in JS string?
"""

# Let me rewrite JS carefully: options logic
speed_run_js = """
        // ===== SPEED RUN QUIZ =====
        let speedRunTimer;
        let speedRunTimeLeft = 60;
        let speedRunScore = 0;
        let currentSpeedRunWord = null;

        function startSpeedRunGame() {
            if (myVocab.length < 4) {
                return showToast("You need at least 4 collected words to play!", 'warning');
            }
            document.getElementById('speedRunContainer').classList.remove('hidden');
            document.getElementById('speedRunEndBtn').style.display = 'block';
            speedRunTimeLeft = 60;
            speedRunScore = 0;
            document.getElementById('speedRunTimer').innerText = speedRunTimeLeft;
            document.getElementById('speedRunScore').innerText = speedRunScore;
            
            clearInterval(speedRunTimer);
            speedRunTimer = setInterval(() => {
                speedRunTimeLeft--;
                document.getElementById('speedRunTimer').innerText = speedRunTimeLeft;
                if (speedRunTimeLeft <= 0) {
                    endSpeedRunGame(true);
                }
            }, 1000);
            
            nextSpeedRunQuestion();
        }

        function endSpeedRunGame(timeUp = false) {
            clearInterval(speedRunTimer);
            document.getElementById('speedRunContainer').classList.add('hidden');
            document.getElementById('speedRunEndBtn').style.display = 'none';
            if (timeUp) {
                const xpEarned = speedRunScore * 10;
                showToast(`Time's Up! You scored ${speedRunScore}. +${xpEarned} XP!`, 'info');
                if(xpEarned > 0) grantXP(xpEarned);
            }
        }

        function nextSpeedRunQuestion() {
            const pool = myVocab;
            const target = pool[Math.floor(Math.random() * pool.length)];
            currentSpeedRunWord = target;
            
            document.getElementById('speedRunKanji').innerText = target.kanji || target.reading;
            document.getElementById('speedRunReading').innerText = target.kanji ? target.reading : '';
            
            let options = new Set([target.meaning]);
            while(options.size < 4 && options.size < pool.length) {
                options.add(pool[Math.floor(Math.random() * pool.length)].meaning);
            }
            
            const shuffledOptions = Array.from(options).sort(() => Math.random() - 0.5);
            const optionsContainer = document.getElementById('speedRunOptions');
            optionsContainer.innerHTML = '';
            
            shuffledOptions.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'nes-btn w-full text-xs';
                btn.innerText = opt;
                btn.onclick = () => handleSpeedRunAnswer(btn, opt === target.meaning);
                optionsContainer.appendChild(btn);
            });
        }

        function handleSpeedRunAnswer(btn, isCorrect) {
            // Disable all buttons briefly
            const buttons = document.getElementById('speedRunOptions').querySelectorAll('button');
            buttons.forEach(b => b.disabled = true);
            
            if (isCorrect) {
                btn.classList.add('is-success');
                speedRunScore++;
                document.getElementById('speedRunScore').innerText = speedRunScore;
                speedRunTimeLeft = Math.min(speedRunTimeLeft + 2, 60); // Bonus time up to 60s
                document.getElementById('speedRunTimer').innerText = speedRunTimeLeft;
                setTimeout(nextSpeedRunQuestion, 200);
            } else {
                btn.classList.add('is-error');
                speedRunTimeLeft = Math.max(0, speedRunTimeLeft - 3); // Penalty
                document.getElementById('speedRunTimer').innerText = speedRunTimeLeft;
                if (speedRunTimeLeft === 0) {
                    endSpeedRunGame(true);
                } else {
                    setTimeout(nextSpeedRunQuestion, 400);
                }
            }
        }
"""

# Insert render_trophy_js after function checkAchievements
content = content.replace(
    '// Warning style for duplicates, purple for achievements',
    render_trophy_js + '\n        // Warning style for duplicates, purple for achievements'
)

# Call renderTrophyRoom inside checkAchievements
content = content.replace(
    'showAchievementToast(a.label, a.desc, a.xp);\n                }',
    'showAchievementToast(a.label, a.desc, a.xp);\n                    renderTrophyRoom();\n                }'
)

# Call renderTrophyRoom on load
content = content.replace(
    'renderQuests();',
    'renderQuests();\n            renderTrophyRoom();'
)

# Append speed_run_js at the end of the script block
content = content.replace(
    '    </script>\n</body>',
    speed_run_js + '\n    </script>\n</body>'
)

with open('templates/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Logic added via python")
