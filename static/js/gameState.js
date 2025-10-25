// Load saved state or initialize defaults
const savedState = JSON.parse(localStorage.getItem('gameState')) || {
  snuzzle: { active: false, winstreak: 0 },
  filmster: { active: false, winstreak: 0 },
  raildle: { active: false, winstreak: 0 },
};

// Helper function to save state
function saveGameState() {
  localStorage.setItem('gameState', JSON.stringify(savedState));
}

// Use savedState directly (no proxy needed since we'll save manually)
const gameState = savedState;

// Helper functions
function setGameActive(game, isActive) {
  if (gameState[game]) {
    gameState[game].active = isActive;
    saveGameState();
  }
}

function incrementWinstreak(game) {
  if (gameState[game]) {
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

function isGameActive(game) {
  return gameState[game] ? gameState[game].active : false;
}

function getWinstreak(game) {
  return gameState[game] ? gameState[game].winstreak : 0;
}

// Example usage
// setGameActive('snuzzle', true);
// incrementWinstreak('snuzzle');
// console.log(isGameActive('snuzzle')); // true

// setGameActive('filmster', false);
// resetWinstreak('filmster');
// console.log(getWinstreak('filmster')); // 0