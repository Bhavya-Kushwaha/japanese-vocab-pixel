// jlpt_bank.js — Dynamic loader for per-level JLPT vocab JSON files
const JLPT_BANK = {};
const JLPT_CACHE = {};

async function loadBankLevel(level) {
    if (JLPT_CACHE[level]) return JLPT_CACHE[level];
    try {
        const res = await fetch(`/static/jlpt/${level.toLowerCase()}.json`);
        const data = await res.json();
        JLPT_CACHE[level] = data;
        JLPT_BANK[level] = data;
        return data;
    } catch (e) {
        console.error('Failed to load JLPT bank for', level, e);
        return [];
    }
}
