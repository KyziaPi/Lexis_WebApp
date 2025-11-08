// Snuzzle Game Logic - Connected to Interpreter Backend
const GAME_NAME = "snuzzle";
const WORD_LENGTH = 5;
const MAX_GUESSES = 6;
let currentRow = 0;
let currentTile = 0;
let currentGuess = "";
let gameOver = false;
let secretWord = "";
let guesses = [];

document.addEventListener('DOMContentLoaded', () => {
    initializeGame();
    attachKeyboardListeners();
});

// Snuzzle Game Initialization
async function initializeGame() {
    try {
        currentRow = 0;
        currentTile = 0;
        currentGuess = "";
        guesses = [];
        gameOver = false;
        clearBoard();
        
        await initGame(GAME_NAME, MAX_GUESSES, secretWord);
        
        // Reset game state
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

async function snuzzleResetGame() {
    gameOver = true;
    clearBoard();
    clearKeyboard();
    
    // Remove play again button
    const playAgainBtn = document.querySelector('.snuzzle-play-again');
    if (playAgainBtn) playAgainBtn.remove();

    try {
        resetGame(GAME_NAME);

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
        currentGuess += letter;
        currentTile++;
        tile.textContent = letter.toUpperCase();
        tile.classList.add('snuzzle-pop-animation');
        setTimeout(() => tile.classList.remove('snuzzle-pop-animation'), 100);
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

    try {
        const guess = currentGuess.toLowerCase();
        for (const previous_guess of guesses) {
            if (previous_guess == guess) {
                showMessage("Already guessed that word!", "error");
                shakeTiles(currentRow);
                return;
            }
        }
        guesses.push(guess);

        // Only send the guess command, not all previous commands
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
                        guesses.pop();
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
            }, 1000);
            return;
        }

        // Lose condition returned by backend
        if (result.result === "lose") {
            gameOver = true;
            setTimeout(async () => {
                const revealed = await sendCommand("show", GAME_NAME);
                if (!revealed) revealed = await getSecretWord(null);
                const finalWord = revealed ? revealed.toUpperCase() : "UNKNOWN";
                showMessage(`Game Over! The word was: ${finalWord}`, "error");
                showPlayAgainButton();
            }, 1000);
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

    setTimeout(() => {
        message.style.animation = 'fadeOut 0.3s ease-in-out forwards';
        message.addEventListener('animationend', () => message.remove());
    }, 2700);
}

function showPlayAgainButton() {
    // Remove existing button if any
    const existingBtn = document.querySelector('.snuzzle-play-again');
    if (existingBtn) existingBtn.remove();

    const button = document.createElement('button');
    button.className = 'snuzzle-play-again';
    button.textContent = 'Play Again';
    button.onclick = snuzzleResetGame;
    
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
    .snuzzle-message--info { background-color: #e45a92; color: white; }
    @keyframes fadeIn {
        from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes fadeOut {
        from { opacity: 1; transform: translateX(-50%) translateY(0); }
        to { opacity: 0; transform: translateX(-50%) translateY(-10px); }
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