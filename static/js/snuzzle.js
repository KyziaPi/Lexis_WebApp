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

// Get secret word from show command response
async function getSecretWord(showBatch) {
    const invalidWords = new Set([
        "loaded", "ready", "unknown", "state",
        "start", "guess", "error", "snuzzle", "file", "show", "game"
    ]);

    const normalize = (w) => {
        if (!w) return null;
        const cleaned = String(w).trim().replace(/[^a-zA-Z]/g, "");
        return cleaned.length === WORD_LENGTH ? cleaned.toLowerCase() : null;
    };

    async function fetchWordBank() {
        try {
            const res = await sendCommand("words", GAME_NAME);
            if (!res) return [];

            if (typeof res === "object") {
                if (Array.isArray(res)) return res.map(r => String(r).toLowerCase());
                if (Object.keys(res).length) return Object.keys(res).map(k => String(k).toLowerCase());
                try {
                    const s = JSON.stringify(res);
                    const tokens = s.match(/\b([a-zA-Z]{5,})\b/g) || [];
                    return tokens.map(t => t.toLowerCase());
                } catch { return []; }
            }

            if (typeof res === "string") {
                const text = res.replace(/["']/g, " ").replace(/\n/g, " ").trim();
                const afterColon = text.includes(":") ? text.split(":", 2)[1] : text;
                if (!afterColon) return [];

                const rawCandidates = afterColon.split(/[,|]/).map(s => s.trim()).filter(Boolean);
                const expanded = rawCandidates.flatMap(r => r.split(/\s+/).map(s => s.trim()).filter(Boolean));
                return expanded.map(w => normalize(w)).filter(Boolean);
            }

            return [];
        } catch (err) {
            console.warn("fetchWordBank error:", err);
            return [];
        }
    }

    try {
        const wordBank = await fetchWordBank();
        const bankSet = new Set(wordBank);
        const candidates = [];

        if (showBatch && showBatch.results && Array.isArray(showBatch.results)) {
            for (const res of showBatch.results) {
                try {
                    const raw = res.result;
                    const cmd = res.command || "";

                    if (raw && typeof raw === "object") {
                        const keys = ["word", "secret", "secret_word", "secretWord", "answer"];
                        for (const k of keys) {
                            if (raw[k] && typeof raw[k] === "string") {
                                const n = normalize(raw[k]);
                                if (n && !invalidWords.has(n)) candidates.push(n);
                            }
                        }
                        const s = JSON.stringify(raw);
                        const toks = s.match(/\b([a-zA-Z]{5,})\b/g) || [];
                        for (const t of toks) {
                            const n = normalize(t);
                            if (n && !invalidWords.has(n)) candidates.push(n);
                        }
                    }

                    if (typeof raw === "string") {
                        let m = raw.match(/(?:secret|answer|word)\s*(?:was|is|:)?\s*([a-zA-Z]{5,})/i);
                        if (m) {
                            const n = normalize(m[1]);
                            if (n && !invalidWords.has(n)) candidates.push(n);
                        }

                        const toks = raw.match(/\b([a-zA-Z]{5,})\b/g) || [];
                        for (const t of toks) {
                            const n = normalize(t);
                            if (n && !invalidWords.has(n)) candidates.push(n);
                        }
                    }

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

        const seen = new Set();
        const uniqCandidates = [];
        for (const c of candidates) {
            if (!c) continue;
            if (!seen.has(c)) {
                seen.add(c);
                uniqCandidates.push(c);
            }
        }

        for (const cand of uniqCandidates) {
            if (bankSet.has(cand)) return cand;
        }

        return null;

    } catch (err) {
        console.error("Error in getSecretWord:", err);
        return null;
    }
}

// Snuzzle Game Initialization
async function initializeGame() {
    try {
        console.log("Initializing Snuzzle game...");

        currentRow = 0;
        currentTile = 0;
        currentGuess = "";
        gameOver = false;
        clearBoard();

        console.log("Starting fresh game");
        const commands = [
            "file snuzzle",
            "start",
            `max_guesses ${MAX_GUESSES}`,
            "word",
            "show"
        ];

        const response = await sendBatchCommands(commands, GAME_NAME);
        console.log("Initialization response:", response);
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
    
    // Remove play again button
    const playAgainBtn = document.querySelector('.snuzzle-play-again');
    if (playAgainBtn) playAgainBtn.remove();

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

        // FIXED: Only send the guess command, not all previous commands
        const guessCommand = `guess ${guess}`;
        const response = await sendCommand(guessCommand, GAME_NAME);
        
        // Wrap response in batch format for compatibility
        const batchResponse = {
            results: [{
                command: guessCommand,
                result: response
            }]
        };

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
                        console.warn('submitGuess: guessResult.result is string but not JSON', guessResult.result);
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
                showPlayAgainButton();
            }, 2000);
            return;
        }

        // Lose condition returned by backend
        if (result.result === "lose") {
            gameOver = true;
            setTimeout(async () => {
                const showResponse = await sendCommand("show", GAME_NAME);
                const showBatch = { results: [{ command: "show", result: showResponse }] };
                let revealed = await getSecretWord(showBatch);
                if (!revealed) revealed = await getSecretWord(null);
                const finalWord = revealed ? revealed.toUpperCase() : "UNKNOWN";
                showMessage(`Game Over! The word was: ${finalWord}`, "error");
                showPlayAgainButton();
            }, 2000);
            return;
        }

        // Auto-lose if we've used all rows and didn't win
        if (currentRow >= MAX_GUESSES && !gameOver) {
            gameOver = true;
            setTimeout(async () => {
                const showResponse = await sendCommand("show", GAME_NAME);
                const showBatch = { results: [{ command: "show", result: showResponse }] };
                let revealed = await getSecretWord(showBatch);
                if (!revealed) revealed = await getSecretWord(null);
                const finalWord = revealed ? revealed.toUpperCase() : "UNKNOWN";
                showMessage(`Game Over! The word was: ${finalWord}`, "error");
                showPlayAgainButton();
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

function showPlayAgainButton() {
    // Remove existing button if any
    const existingBtn = document.querySelector('.snuzzle-play-again');
    if (existingBtn) existingBtn.remove();

    const button = document.createElement('button');
    button.className = 'snuzzle-play-again';
    button.textContent = 'Play Again';
    button.onclick = resetGame;
    
    // Insert button between board and keyboard
    const keyboard = document.querySelector('.snuzzle-keyboard');
    if (keyboard) {
        keyboard.parentNode.insertBefore(button, keyboard);
    } else {
        const container = document.querySelector('.snuzzle') || document.body;
        container.appendChild(button);
    }
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
    .snuzzle-play-again {
        padding: 1rem 2rem;
        background-color: #e45a92;
        color: white;
        border: none;
        border-radius: 2rem;
        font-weight: 600;
        font-size: 1.1rem;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        margin: 1.5rem auto;
        display: block;
    }
    .snuzzle-play-again:hover {
        background-color: #ff64a3;
        transform: scale(1.05);
    }
    .snuzzle-play-again:active {
        transform: scale(0.95);
    }
`;
document.head.appendChild(style);