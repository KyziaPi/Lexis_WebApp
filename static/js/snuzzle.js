// Snuzzle Game Logic - Connected to Interpreter Backend
const GAME_NAME = "snuzzle";
const WORD_LENGTH = 5;
const MAX_GUESSES = 6;
let currentRow = 0;
let currentTile = 0;
let currentGuess = "";
let gameOver = false;
let secretWord = "";
let gameInitCommands = [];

document.addEventListener('DOMContentLoaded', () => {
    initializeGame();
    attachKeyboardListeners();
});

// API Communication Functions
async function sendCommand(cmd, game) {
    try {
        const response = await fetch(`/run/${game}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: cmd })
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`Error executing command "${cmd}":`, error);
        throw error;
    }
}

async function sendBatchCommands(commands, game) {
    try {
        const response = await fetch(`/run/${game}/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commands: commands })
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`Error executing batch commands:`, error);
        throw error;
    }
}

async function getSessionCommands(game) {
    try {
        const response = await fetch(`/fetch/session/${game}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game: game })
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching session:`, error);
        return { commands: [] };
    }
}

// Replace your existing getSecretWord(showBatch) with this version
async function getSecretWord(showBatch) {
    // Known tokens we should ignore (common non-secret words)
    const invalidWords = new Set([
        "loaded", "ready", "unknown", "state",
        "start", "guess", "error", "snuzzle", "file", "show", "game"
    ]);

    // Helper: normalize a candidate and ensure alphabetic only
    const normalize = (w) => {
        if (!w) return null;
        const cleaned = String(w).trim().replace(/[^a-zA-Z]/g, "");
        return cleaned.length === WORD_LENGTH ? cleaned.toLowerCase() : null;
    };

    // Helper: parse the "words" command result into an array of words (lowercase)
    async function fetchWordBank() {
        try {
            const res = await sendCommand("words", GAME_NAME);
            // res might be a string like "Words: apple, berry, candy" or JSON-like
            if (!res) return [];

            // If response is an object already (some games return JSON), try to extract
            if (typeof res === "object") {
                // If it's an array already
                if (Array.isArray(res)) return res.map(r => String(r).toLowerCase());
                // If it's an object with keys being words (like raildle), return keys
                if (Object.keys(res).length) return Object.keys(res).map(k => String(k).toLowerCase());
                // fallback stringify
                try {
                    const s = JSON.stringify(res);
                    const tokens = s.match(/\b([a-zA-Z]{5,})\b/g) || [];
                    return tokens.map(t => t.toLowerCase());
                } catch { return []; }
            }

            // If it's a plain string
            if (typeof res === "string") {
                // remove quotes and newlines
                const text = res.replace(/["']/g, " ").replace(/\n/g, " ").trim();

                // common format "Words: a, b, c" -> take after colon
                const afterColon = text.includes(":") ? text.split(":", 2)[1] : text;
                if (!afterColon) return [];

                // split by commas or spaces
                const rawCandidates = afterColon.split(/[,|]/).map(s => s.trim()).filter(Boolean);
                // further split pieces that might be space-separated
                const expanded = rawCandidates.flatMap(r => r.split(/\s+/).map(s => s.trim()).filter(Boolean));
                return expanded
                    .map(w => normalize(w))
                    .filter(Boolean);
            }

            return [];
        } catch (err) {
            console.warn("fetchWordBank error:", err);
            return [];
        }
    }

    try {
        //get word bank first (so we can filter candidates)
        const wordBank = await fetchWordBank(); // array of lowercase words, 5 letters
        const bankSet = new Set(wordBank);

        //collect candidate words from showBatch results
        const candidates = [];

        if (showBatch && showBatch.results && Array.isArray(showBatch.results)) {
            for (const res of showBatch.results) {
                try {
                    const raw = res.result;
                    const cmd = res.command || "";

                    // If object, check likely fields
                    if (raw && typeof raw === "object") {
                        const keys = ["word", "secret", "secret_word", "secretWord", "answer"];
                        for (const k of keys) {
                            if (raw[k] && typeof raw[k] === "string") {
                                const n = normalize(raw[k]);
                                if (n && !invalidWords.has(n)) candidates.push(n);
                            }
                        }
                        // fallback: stringify and search tokens
                        const s = JSON.stringify(raw);
                        const toks = s.match(/\b([a-zA-Z]{5,})\b/g) || [];
                        for (const t of toks) {
                            const n = normalize(t);
                            if (n && !invalidWords.has(n)) candidates.push(n);
                        }
                    }

                    // If string, try explicit patterns first
                    if (typeof raw === "string") {
                        // explicit patterns
                        let m = raw.match(/(?:secret|answer|word)\s*(?:was|is|:)?\s*([a-zA-Z]{5,})/i);
                        if (m) {
                            const n = normalize(m[1]);
                            if (n && !invalidWords.has(n)) candidates.push(n);
                        }

                        // also pull all 5-letter tokens
                        const toks = raw.match(/\b([a-zA-Z]{5,})\b/g) || [];
                        for (const t of toks) {
                            const n = normalize(t);
                            if (n && !invalidWords.has(n)) candidates.push(n);
                        }
                    }

                    // If the command echoes the real word (e.g., "word apple")
                    if (cmd && typeof cmd === "string") {
                        const cm = cmd.match(/\bword[:\s]+\s*([a-zA-Z]{5,})\b/i);
                        if (cm) {
                            const n = normalize(cm[1]);
                            if (n && !invalidWords.has(n)) candidates.push(n);
                        }
                    }
                } catch (inner) {
                    // continue
                }
            }
        }

        //also check session commands fallback
        try {
            const session = await getSessionCommands(GAME_NAME);
            if (session && Array.isArray(session.commands)) {
                for (const cmd of session.commands) {
                    try {
                        if (typeof cmd === "string") {
                            const m = cmd.match(/\bword[:\s]+\s*([a-zA-Z]{5,})\b/i);
                            if (m) {
                                const n = normalize(m[1]);
                                if (n && !invalidWords.has(n)) candidates.push(n);
                            }
                        }
                    } catch {}
                }
            }
        } catch (e) {
            console.warn("session fallback failed:", e);
        }

        // Normalize candidate list and remove duplicates while preserving order
        const seen = new Set();
        const uniqCandidates = [];
        for (const c of candidates) {
            if (!c) continue;
            if (!seen.has(c)) {
                seen.add(c);
                uniqCandidates.push(c);
            }
        }

        //Pick the first candidate that exists in the word bank
        for (const cand of uniqCandidates) {
            if (bankSet.has(cand)) return cand;
        }

        return null;

    } catch (err) {
        console.error("Error in getSecretWord:", err);
        return null;
    }
}

async function initializeGame() {
    try {
        clearBoard();
        clearKeyboard();
        console.log('Initializing game...');

        const sessionData = await getSessionCommands(GAME_NAME);
        console.log('Session data:', sessionData);

        let response;

        if (sessionData && sessionData.commands && sessionData.commands.length > 4) {
            console.log('Restoring previous session');
            response = await sendBatchCommands(sessionData.commands, GAME_NAME);
            gameInitCommands = sessionData.commands.slice(0, 6);
            await restoreGameState(sessionData.commands, response);
        } else {
            console.log('Starting fresh game');
            const commands = [
                "file snuzzle",
                "start",
                `max_guesses ${MAX_GUESSES}`,
                "word",
                "show"
            ];
            response = await sendBatchCommands(commands, GAME_NAME);
            console.log('Initialization response:', response);
            gameInitCommands = commands;

            if (response && response.results) {
                const showResult = response.results.find(r => r.command === "show");
                if (showResult && showResult.result) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    const updatedSession = await getSessionCommands(GAME_NAME);
                    if (updatedSession && updatedSession.commands) {
                        gameInitCommands = updatedSession.commands.slice(0, 5);
                    }
                }
            }
        }

        currentRow = 0;
        currentTile = 0;
        currentGuess = "";
        gameOver = false;

        showMessage("Ready to play! Make your first guess.", "info");
    } catch (error) {
        console.error("Error initializing game:", error);
        showMessage("Failed to initialize game. Please refresh.", "error");
    }
}

async function restoreGameState(commands, response) {
    const guessCommands = commands.filter(cmd => cmd.startsWith('guess '));
    console.log('Restoring', guessCommands.length, 'previous guesses');

    currentRow = 0;

    if (response && response.results) {
        for (let i = 0; i < guessCommands.length; i++) {
            const guessCmd = guessCommands[i];
            const word = guessCmd.split(' ')[1];
            const result = response.results.find(r => r.command === guessCmd);

            if (result && result.result) {
                let guessResult;
                if (typeof result.result === 'string') {
                    try {
                        guessResult = JSON.parse(result.result);
                    } catch (e) {
                        console.error('Failed to parse guess result:', e);
                        continue;
                    }
                } else {
                    guessResult = result.result;
                }

                if (guessResult.feedback) {
                    updateBoardWithFeedback(word, guessResult.feedback, currentRow);
                    updateKeyboard(word, guessResult.feedback);
                    currentRow++;
                }

                if (guessResult.result === 'win' || guessResult.result === 'lose') {
                    gameOver = true;
                }
            }
        }
    }

    currentTile = 0;
    currentGuess = "";
}

function attachKeyboardListeners() {
    document.addEventListener('keydown', handleKeyPress);
    const keys = document.querySelectorAll('.snuzzle-key');
    keys.forEach(key => {
        key.addEventListener('click', (e) => {
            handleKeyClick(key.textContent);
        });
    });
}

async function resetGame() {
    console.log('Resetting game...');
    gameOver = true;
    clearBoard();
    clearKeyboard();

    try {
        await fetch(`/reset_game/${GAME_NAME}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game: GAME_NAME })
        });

        gameInitCommands = [];
        await new Promise(resolve => setTimeout(resolve, 500));

        await initializeGame();
        gameOver = false;
    } catch (error) {
        console.error("Error resetting game:", error);
        showMessage("Failed to reset game.", "error");
    }
}

function clearBoard() {
    document.querySelectorAll('.snuzzle-tile').forEach(tile => {
        tile.textContent = '';
        tile.classList.remove('snuzzle-tile--correct', 'snuzzle-tile--misplaced', 'snuzzle-tile--wrong');
        tile.style.animation = '';
    });
}

function clearKeyboard() {
    document.querySelectorAll('.snuzzle-key').forEach(key => {
        key.classList.remove('snuzzle-key--correct', 'snuzzle-key--misplaced', 'snuzzle-key--wrong');
    });
}

function handleKeyPress(e) {
    if (gameOver) return;
    const key = e.key.toLowerCase();
    if (key === 'enter') submitGuess();
    else if (key === 'backspace') deleteLetter();
    else if (/^[a-z]$/.test(key)) addLetter(key);
}

function handleKeyClick(key) {
    if (gameOver) return;
    if (key === 'ENTER') submitGuess();
    else if (key === 'DELETE') deleteLetter();
    else addLetter(key.toLowerCase());
}

function addLetter(letter) {
    if (currentTile < WORD_LENGTH) {
        const tile = getTile(currentRow, currentTile);
        if (!tile) return;
        tile.textContent = letter.toUpperCase();
        tile.style.animation = 'snuzzle-pop 0.1s ease-in-out';
        currentGuess += letter;
        currentTile++;
    }
}

function deleteLetter() {
    if (currentTile > 0) {
        currentTile--;
        const tile = getTile(currentRow, currentTile);
        tile.textContent = '';
        currentGuess = currentGuess.slice(0, -1);
    }
}

async function submitGuess() {
    if (gameOver) return;
    if (currentRow >= MAX_GUESSES) return;
    if (currentTile < WORD_LENGTH) {
        showMessage("Not enough letters!", "error");
        shakeTiles(currentRow);
        return;
    }

    if (gameInitCommands.length === 0) {
        showMessage("Game is still initializing...", "error");
        return;
    }

    try {
        const guess = currentGuess.toLowerCase();
        console.log('Submitting guess:', guess);

        const allCommands = [...gameInitCommands, `guess ${guess}`];
        const batchResponse = await sendBatchCommands(allCommands, GAME_NAME);

        let result;
        if (batchResponse && batchResponse.results) {
            const guessResult = batchResponse.results[batchResponse.results.length - 1];
            if (guessResult && guessResult.result) {
                if (typeof guessResult.result === 'string') {
                    if (guessResult.result.startsWith('Error:')) {
                        showMessage("Word not in word bank!", "error");
                        shakeTiles(currentRow);
                        return;
                    }
                    try {
                        result = JSON.parse(guessResult.result);
                    } catch (e) {
                        // Fallback: assume backend returned a simple object string
                        console.warn('submitGuess: guessResult.result is string but not JSON', guessResult.result);
                        // As last resort, attempt to parse "feedback:..., result:..., remaining:..."
                        const fbMatch = guessResult.result.match(/feedback[:=]\s*([\u{1F7E9}\u{1F7E8}\u{2B1C}\u{1F7E8}\u{1F7E9}\u{1F7E6}\u{1F7E5}\u{1F7EA}\u{1F7EB}\u{1F7EC}]+)/u);
                        if (fbMatch) {
                            result = { feedback: fbMatch[1] };
                        } else {
                            result = null;
                        }
                    }
                } else {
                    result = guessResult.result;
                }
            }
        }

        if (!result) {
            showMessage("Failed to get response. Try again.", "error");
            return;
        }

        const feedback = result.feedback;
        await animateTiles(currentRow, feedback);
        updateBoardWithFeedback(currentGuess, feedback, currentRow);
        updateKeyboard(currentGuess, feedback);

        currentRow++;
        currentTile = 0;
        currentGuess = "";

        // Win condition
        if (result.result === "win") {
            gameOver = true;
            const winningWord = guess.toUpperCase();
            setTimeout(() => {
                showMessage(`🎉 You won! The word was: ${winningWord}`, "success");
                celebrateWin();
                setTimeout(resetGame, 3000);
            }, 2000);
            return;
        }

        // Lose condition returned by backend
        if (result.result === "lose") {
            gameOver = true;
            setTimeout(async () => {
                const showCommands = [...gameInitCommands, "show"];
                const showBatch = await sendBatchCommands(showCommands, GAME_NAME);
                let revealed = await getSecretWord(showBatch);
                if (!revealed) revealed = await getSecretWord(null); // try session-only
                const finalWord = revealed ? revealed.toUpperCase() : "UNKNOWN";
                showMessage(`Game Over! The word was: ${finalWord}`, "error");
                setTimeout(resetGame, 3000);
            }, 2000);
            return;
        }

        // Auto-lose if we've used all rows and didn't win
        if (currentRow >= MAX_GUESSES && !gameOver) {
            gameOver = true;
            setTimeout(async () => {
                const showCommands = [...gameInitCommands, "show"];
                const showBatch = await sendBatchCommands(showCommands, GAME_NAME);
                let revealed = await getSecretWord(showBatch);
                if (!revealed) revealed = await getSecretWord(null);
                const finalWord = revealed ? revealed.toUpperCase() : "UNKNOWN";
                showMessage(`Game Over! The word was: ${finalWord}`, "error");
                setTimeout(resetGame, 3000);
            }, 2000);
            return;
        }

        // Show remaining guesses
        if (!gameOver) {
            const remaining = MAX_GUESSES - currentRow;
            showMessage(`${remaining} guess${remaining === 1 ? '' : 'es'} remaining`, "info");
        }

    } catch (error) {
        console.error("Error submitting guess:", error);
        showMessage("An error occurred. Please try again.", "error");
    }
}

function updateBoardWithFeedback(word, feedback, rowIndex) {
    const feedbackArray = Array.from(feedback);
    for (let i = 0; i < word.length; i++) {
        const tile = getTile(rowIndex, i);
        tile.textContent = word[i].toUpperCase();
        tile.classList.remove('snuzzle-tile--correct', 'snuzzle-tile--misplaced', 'snuzzle-tile--wrong');
        if (feedbackArray[i] === '🟩') tile.classList.add('snuzzle-tile--correct');
        else if (feedbackArray[i] === '🟨') tile.classList.add('snuzzle-tile--misplaced');
        else tile.classList.add('snuzzle-tile--wrong');
    }
}

async function animateTiles(row, feedback) {
    const tiles = [];
    for (let i = 0; i < WORD_LENGTH; i++) {
        tiles.push(getTile(row, i));
    }
    for (let i = 0; i < tiles.length; i++) {
        await new Promise(resolve => {
            setTimeout(() => {
                tiles[i].style.animation = 'snuzzle-flip 0.5s ease-in-out';
                resolve();
            }, i * 100);
        });
    }
    await new Promise(resolve => setTimeout(resolve, 500));
}

function updateKeyboard(word, feedback) {
    const feedbackArray = Array.from(feedback);
    for (let i = 0; i < word.length; i++) {
        const letter = word[i].toUpperCase();
        const emoji = feedbackArray[i];
        const key = Array.from(document.querySelectorAll('.snuzzle-key'))
            .find(k => k.textContent === letter);

        if (key) {
            if (emoji === '🟩') {
                key.classList.remove('snuzzle-key--misplaced', 'snuzzle-key--wrong');
                key.classList.add('snuzzle-key--correct');
            } else if (emoji === '🟨' && !key.classList.contains('snuzzle-key--correct')) {
                key.classList.remove('snuzzle-key--wrong');
                key.classList.add('snuzzle-key--misplaced');
            } else if (emoji === '⬜' && !key.classList.contains('snuzzle-key--correct') && !key.classList.contains('snuzzle-key--misplaced')) {
                key.classList.add('snuzzle-key--wrong');
            }
        }
    }
}

function getTile(row, col) {
    const rows = document.querySelectorAll('.snuzzle-row');
    if (!rows || rows.length <= row) return null;
    const tiles = rows[row].querySelectorAll('.snuzzle-tile');
    return tiles[col];
}

function shakeTiles(row) {
    const tiles = document.querySelectorAll('.snuzzle-row')[row].querySelectorAll('.snuzzle-tile');
    tiles.forEach(tile => {
        tile.style.animation = 'snuzzle-shake 0.5s ease-in-out';
        setTimeout(() => { tile.style.animation = ''; }, 500);
    });
}

function celebrateWin() {
    const characters = document.querySelectorAll('.snuzzle-character');
    characters.forEach((char, index) => {
        setTimeout(() => {
            char.style.animation = 'snuzzle-bounce 0.6s ease-in-out';
        }, index * 100);
    });
}

function showMessage(text, type) {
    const existingMsg = document.querySelector('.snuzzle-message');
    if (existingMsg) existingMsg.remove();

    const message = document.createElement('div');
    message.className = `snuzzle-message snuzzle-message--${type}`;
    message.textContent = text;
    const container = document.querySelector('.snuzzle') || document.body;
    container.prepend(message);

    setTimeout(() => { message.remove(); }, 3000);
}

// CSS Animations
const style = document.createElement('style');
style.textContent = `
    @keyframes snuzzle-flip {
        0% { transform: rotateX(0); }
        50% { transform: rotateX(90deg); }
        100% { transform: rotateX(0); }
    }
    @keyframes snuzzle-shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
    @keyframes snuzzle-pop {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
    }
    @keyframes snuzzle-bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-20px); }
    }
    .snuzzle-message {
        position: fixed;
        top: 100px;
        left: 50%;
        transform: translateX(-50%);
        padding: 1rem 2rem;
        border-radius: 0.5rem;
        font-weight: 600;
        font-size: 1rem;
        z-index: 1000;
        animation: fadeIn 0.3s ease-in-out;
    }
    .snuzzle-message--error { background-color: #f87171; color: white; }
    .snuzzle-message--success { background-color: #6aaa64; color: white; }
    .snuzzle-message--info { background-color: #60a5fa; color: white; }
    @keyframes fadeIn {
        from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    .snuzzle-key--correct { background-color: #6aaa64 !important; color: white !important; }
    .snuzzle-key--misplaced { background-color: #c9b458 !important; color: white !important; }
    .snuzzle-key--wrong { background-color: #3a3a3c !important; color: white !important; }
`;
document.head.appendChild(style);
