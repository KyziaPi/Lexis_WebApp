$(document).ready(function () {
  // Initialized variables
  var game = "filmster";
  var max_guesses = 3;
  var secret_word = "";
  var allMovies = {};  
  var movieHints = {};  
  var currentMovie = "";  
  var triesLeft = 3;
  var gameOver = false;
  var hintIndex = 0;

  // DOM elements
  const filmsterHint1 = document.getElementById('filmster-hint1');
  const filmsterHint2 = document.getElementById('filmster-hint2');
  const filmsterHint3 = document.getElementById('filmster-hint3');
  const filmsterFeedback = document.getElementById('filmster-feedback');
  const filmsterTriesDisplay = document.getElementById('filmster-triesLeft');
  const filmsterChoicesContainer = document.querySelector('.filmster-choices');

  startNewGame();

  async function startNewGame() {
    try {
      gameOver = false;
      triesLeft = 3;
      hintIndex = 0;
      
      
      resetUI();
      
      // Initialize game with interpreter
      const initResponse = await initGame(game, max_guesses, secret_word);
      
      // Parse the word bank to get movies and hints
      if (initResponse && initResponse.results) {
        // Find "words" command result to get all movies
        const wordsResult = initResponse.results.find(r => r.command === "words");
        if (wordsResult && wordsResult.result) {
          // The result should be the word bank data
          parseWordBank(wordsResult.result);
        }
        
        // Find "show" command to get the secret word details
        const showResult = initResponse.results.find(r => r.command === "show");
        if (showResult && showResult.result && showResult.result.name) {
          // The secret word's key should be in the response
          currentMovie = showResult.result.name;
        }
        
        // If we didn't get it from show, try the word command
        if (!currentMovie) {
          const wordResult = initResponse.results.find(r => r.command.startsWith("word"));
          if (wordResult && wordResult.command) {
            const parts = wordResult.command.split(" ");
            if (parts.length > 1) {
              currentMovie = parts[1];
            }
          }
        }
      }
      
      // If still no currentMovie, pick a random one
      if (!currentMovie || !allMovies[currentMovie]) {
        const movieKeys = Object.keys(allMovies);
        if (movieKeys.length > 0) {
          currentMovie = movieKeys[Math.floor(Math.random() * movieKeys.length)];
        }
      }
      
      // Display first hint (Hint1 from the secret movie)
      if (movieHints[currentMovie] && movieHints[currentMovie].length > 0) {
        displayHint(0, movieHints[currentMovie][0]);
      } else {
        displayHint(0, "A mysterious movie...");
      }
      
      // Generate and display choices
      generateMovieChoices();
      
    } catch (error) {
      console.error("Error starting game:", error);
      filmsterFeedback.textContent = "Error loading game. Please refresh.";
      filmsterFeedback.className = "filmster-feedback incorrect";
    }
  }

  function parseWordBank(wordBankData) {
    // Reset data structures
    allMovies = {};
    movieHints = {};
    
    // Expected format: { "Barbie": ["hint1", "hint2", "hint3"], ... }
    if (typeof wordBankData === 'object' && wordBankData !== null && !Array.isArray(wordBankData)) {
      Object.keys(wordBankData).forEach(key => {
        // Format the display name (e.g., "TheLionKing" -> "The Lion King")
        const displayName = key.replace(/([A-Z])/g, ' $1').trim();
        allMovies[key] = displayName;
        
        // Store the hints
        if (Array.isArray(wordBankData[key]) && wordBankData[key].length >= 3) {
          movieHints[key] = wordBankData[key];
        } else {
          console.error(`Invalid hints for ${key}:`, wordBankData[key]);
          movieHints[key] = ["Hint 1", "Hint 2", "Hint 3"];
        }
      });
    } else {
      console.error("Unexpected word bank format!", wordBankData);
    }
    
  }

  function generateMovieChoices() {
    // Get movie keys (not display names)
    const movieKeys = Object.keys(allMovies);
    
    if (movieKeys.length < 4) {
      console.error("Not enough movies in word bank!");
      filmsterFeedback.textContent = "Not enough movies in word bank. Need at least 4.";
      return;
    }
    
    // Ensure currentMovie is valid
    if (!currentMovie || !allMovies[currentMovie]) {
      console.error("Invalid current movie:", currentMovie);
      filmsterFeedback.textContent = "Error: Invalid movie selection.";
      return;
    }
    
    // Get 3 random wrong movies
    const wrongMovies = movieKeys
      .filter(k => k !== currentMovie)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    
    // Combine with correct answer and shuffle
    const choices = [currentMovie, ...wrongMovies]
      .sort(() => Math.random() - 0.5);
    
    // Clear existing choices
    filmsterChoicesContainer.innerHTML = '';
    
    // Create choice buttons
    choices.forEach(movieKey => {
      const button = document.createElement('button');
      button.className = 'filmster-choice';
      button.textContent = allMovies[movieKey] || movieKey;  // Display name
      button.dataset.movieKey = movieKey;  // Store key for guess
      button.dataset.answer = movieKey === currentMovie ? 'correct' : 'wrong';
      button.addEventListener('click', handleChoice);
      filmsterChoicesContainer.appendChild(button);
    });
  }

  async function handleChoice(event) {
    if (gameOver) return;
    
    const button = event.target;
    const isCorrect = button.dataset.answer === 'correct';
    const movieKey = button.dataset.movieKey;
    
    if (isCorrect) {
      // Correct guess
      button.classList.add('correct');
      filmsterFeedback.textContent = 'Correct! You guessed it!';
      filmsterFeedback.className = 'filmster-feedback correct';
      gameOver = true;
      disableAllChoices();
      incrementWinstreak(game);
      setGameOver(game, true);
      showPlayAgainButton();
    } else {
      // Wrong guess
      button.classList.add('incorrect');
      button.disabled = true;
      triesLeft--;
      filmsterTriesDisplay.textContent = triesLeft;
      
      // Send guess to interpreter (for tracking purposes)
      try {
        await sendCommand(`guess ${movieKey}`, game);
      } catch (error) {
        console.error("Error sending guess:", error);
      }
      
      if (triesLeft > 0) {
        // Reveal next hint from the available hints (Hint2, then Hint3)
        if (movieHints[currentMovie] && hintIndex < 2 && hintIndex < movieHints[currentMovie].length - 1) {
          hintIndex++;
          const nextHint = movieHints[currentMovie][hintIndex];
          displayHint(hintIndex, nextHint);
        }
        
        filmsterFeedback.textContent = `Wrong! Try again. ${triesLeft} ${triesLeft === 1 ? 'try' : 'tries'} left.`;
        filmsterFeedback.className = 'filmster-feedback incorrect';
      } else {
        // Game over - no tries left
        const displayName = allMovies[currentMovie] || currentMovie;
        
        filmsterFeedback.textContent = `Game Over! The answer was ${displayName}.`;
        filmsterFeedback.className = 'filmster-feedback incorrect';
        gameOver = true;
        disableAllChoices();
        highlightCorrectAnswer();
        resetWinstreak(game);
        setGameOver(game, true);
        showPlayAgainButton();
      }
    }
  }

  function displayHint(index, hintText) {
    const hintElements = [filmsterHint1, filmsterHint2, filmsterHint3];
    const hintElement = hintElements[index];
    
    if (hintElement) {
      hintElement.classList.remove('filmster-locked');
      hintElement.classList.add('filmster-unlocked', 'filmster-hint-1');
      hintElement.innerHTML = `<strong>${hintText}</strong>`;
    }
  }

  function disableAllChoices() {
    const choices = document.querySelectorAll('.filmster-choice');
    choices.forEach(choice => choice.disabled = true);
  }

  function highlightCorrectAnswer() {
    const choices = document.querySelectorAll('.filmster-choice');
    choices.forEach(choice => {
      if (choice.dataset.answer === 'correct') {
        choice.classList.add('correct');
      }
    });
  }

  function resetUI() {
    // Reset tries display
    filmsterTriesDisplay.textContent = '3';
    
    // Reset hints
    filmsterHint1.innerHTML = '<strong>Loading...</strong>';
    filmsterHint1.classList.remove('filmster-locked');
    filmsterHint1.classList.add('filmster-unlocked', 'filmster-hint-1');
    
    filmsterHint2.classList.add('filmster-locked');
    filmsterHint2.classList.remove('filmster-unlocked');
    filmsterHint2.textContent = 'Locked 🔒';
    
    filmsterHint3.classList.add('filmster-locked');
    filmsterHint3.classList.remove('filmster-unlocked');
    filmsterHint3.textContent = 'Locked 🔒';
    
    // Clear feedback
    filmsterFeedback.textContent = '';
    filmsterFeedback.className = 'filmster-feedback';
    
    // Clear choices
    filmsterChoicesContainer.innerHTML = '';
  }

function showPlayAgainButton() {
  const playAgainBtn = document.createElement('button');
  playAgainBtn.textContent = 'Play Again 🎬';
  playAgainBtn.className = 'filmster-play-again-btn';
  playAgainBtn.type = 'button';

  playAgainBtn.style.cssText = `
    background-color: #6b2d8f !important;
    color: white !important;
    border: none !important;
    border-radius: 50px !important;
    padding: 1rem 3rem !important;
    font-size: 1.2rem !important;
    font-weight: 600 !important;
    margin: 1.5rem auto 0 auto !important;
    cursor: pointer !important;
    display: block !important;
    font-family: 'Poppins', sans-serif !important;
  `;

  playAgainBtn.addEventListener('click', async function() {
    // Optional: visually indicate loading
    playAgainBtn.textContent = 'Loading new round... 🎥';
    playAgainBtn.disabled = true;

    // Fully reset and start a new randomized game
    try {
      await resetGame(game); // clear any backend/interpreter state
      currentMovie = ""; // ensure we don't reuse the same movie
      hintIndex = 0;
      gameOver = false;
      startNewGame(); // this will randomly select a new movie and hints
    } catch (error) {
      console.error("Error restarting game:", error);
      filmsterFeedback.textContent = "Error restarting game. Please refresh.";
    }
  });

  filmsterFeedback.appendChild(document.createElement('br'));
  filmsterFeedback.appendChild(playAgainBtn);
}
});