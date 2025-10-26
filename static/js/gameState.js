// Load saved state or initialize defaults
const savedState = JSON.parse(localStorage.getItem('gameState')) || {
  snuzzle: { winstreak: 0 },
  filmster: { winstreak: 0 },
  raildle: { winstreak: 0 },
};

// Helper function to save state
function saveGameState() {
  localStorage.setItem('gameState', JSON.stringify(savedState));
}

// Use savedState directly
const gameState = savedState;

// Helper functions
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

function getWinstreak(game) {
  return gameState[game] ? gameState[game].winstreak : 0;
}

// Example usage
// setGameActive('snuzzle', true);
// incrementWinstreak('snuzzle');
// console.log(getWinstreak('snuzzle')); // 0

// setGameActive('filmster', false);
// resetWinstreak('filmster');
// console.log(getWinstreak('filmster')); // 0