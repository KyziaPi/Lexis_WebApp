// Load saved state or initialize defaults
const savedState = JSON.parse(localStorage.getItem('gameState')) || {
  snuzzle: { active: false, winstreak: 0, over: false },
  filmster: { active: false, winstreak: 0, over: false },
  raildle: { active: false, winstreak: 0, over: false },
};

// Helper function to save state
function saveGameState() {
  localStorage.setItem('gameState', JSON.stringify(savedState));
}

// Use savedState directly
const gameState = savedState;

// Helper functions
function setGameActive(game, isActive) {
  if (gameState[game]) {
    gameState[game].active = isActive;
    saveGameState();
  }
}

function incrementWinstreak(game) {
  if (gameState[game] && !(isGameOver(game))) {
    gameState[game].winstreak += 1;
    saveGameState();
  }
}

function resetWinstreak(game) {
  if (gameState[game]) {
    gameState[game].winstreak = 0;
    saveGameState();
  }
}

function setGameOver(game, isOver) {
  if (gameState[game]) {
    gameState[game].over = isOver;
    saveGameState();
  }
}

function isGameActive(game) {
  return gameState[game] ? gameState[game].active : false;
}

function isGameOver(game) {
  return gameState[game] ? gameState[game].over : false;
}

function getWinstreak(game) {
  return gameState[game] ? gameState[game].winstreak : 0;
}

// Example usage
// setGameActive('snuzzle', true);
// incrementWinstreak('snuzzle');
// console.log(getWinstreak('snuzzle')); // 0

// setGameActive('filmster', false);
// resetWinstreak('filmster');
// console.log(isGameActive('filmster')); // false