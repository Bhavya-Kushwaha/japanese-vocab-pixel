# 🎌 Vocab Quest v3.0

**Vocab Quest** is a gamified, keyboard-driven web application designed for students and developers mastering the Japanese language. Built with a retro 8-bit aesthetic, it streamlines the process of discovering, categorizing, and exporting JLPT-aligned vocabulary.

![Project Preview](https://img.shields.io/badge/Version-3.0-blue?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Python-Flask-lightgrey?style=for-the-badge&logo=python)
![UI](https://img.shields.io/badge/CSS-NES.css-green?style=for-the-badge)

---

## 🚀 Key Features

*   **Real-time JLPT Tagging:** Automatically fetches Kanji, Reading, Meaning, and JLPT levels (N5-N1) via the Jisho API.
*   **Gamified Progress:** Integrated "Adventurer Rank" system (Novice to Master) with a visual XP/Progress bar!
*   **Keyboard Optimized:** High-speed workflow using `Enter` key listeners and `autofocus` inputs for rapid-fire collection.
*   **Data Persistence:** Uses `localStorage` to ensure your vocabulary "inventory" persists across browser sessions.
*   **Export for Anki/Notion:** One-click CSV export to bridge your quest data with professional SRS tools.
*   **Atmospheric HUD:** A floating 8-bit "Radio" featuring royalty-free Japanese lofi and retro beats.

---

## 🛠️ Tech Stack

### Backend
- **Python / Flask**: Handles API routing and server-side logic.
- **Requests**: Manages asynchronous communication with the Jisho.org API.
- **Vercel**: Serverless deployment for high availability.

### Frontend
- **NES.css**: For the authentic pixel-art aesthetic.
- **Tailwind CSS**: For responsive layout and utility-first styling.
- **JavaScript (ES6)**: Manages client-side state, LocalStorage, and interactive UI components.

---

## 📂 Project Structure

```text
VocabQuest/
├── api/
│   └── index.py         # Flask Backend & API Logic
├── templates/
│   └── index.html       # Single-page Frontend & Logic
├── requirements.txt     # Python Dependencies
└── vercel.json          # Deployment Configuration
