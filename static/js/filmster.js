const filmsterHints = [
  "Hint 1: A boy with a lightning scar.",
  "Hint 2: He attends a school of witchcraft and wizardry.",
  "Hint 3: His best friends are Ron and Hermione."
];

let filmsterCurrentHint = 0;
let filmsterTriesLeft = 3;
let filmsterGameOver = false;

const filmsterRevealBtn = document.getElementById('filmster-revealBtn');
const filmsterHint2 = document.getElementById('filmster-hint2');
const filmsterHint3 = document.getElementById('filmster-hint3');
const filmsterFeedback = document.getElementById('filmster-feedback');
const filmsterTriesDisplay = document.getElementById('filmster-triesLeft');
const filmsterChoices = document.querySelectorAll('.filmster-choice');

filmsterRevealBtn.addEventListener('click', () => {
  if (filmsterCurrentHint < 2) {
    filmsterCurrentHint++;
    
    if (filmsterCurrentHint === 1) {
      filmsterHint2.classList.remove('filmster-locked');
      filmsterHint2.classList.add('filmster-unlocked');
      filmsterHint2.innerHTML = `<strong>${filmsterHints[1]}</strong>`;
    } else if (filmsterCurrentHint === 2) {
      filmsterHint3.classList.remove('filmster-locked');
      filmsterHint3.classList.add('filmster-unlocked');
      filmsterHint3.innerHTML = `<strong>${filmsterHints[2]}</strong>`;
      filmsterRevealBtn.disabled = true;
      filmsterRevealBtn.textContent = 'All Hints Revealed';
    }
  }
});

filmsterChoices.forEach(choice => {
  choice.addEventListener('click', function() {
    if (filmsterGameOver) return;

    const isCorrect = this.dataset.answer === 'correct';
    
    if (isCorrect) {
      this.classList.add('correct');
      filmsterFeedback.textContent = 'Correct! You guessed it!';
      filmsterFeedback.className = 'filmster-feedback correct';
      filmsterGameOver = true;
      disableFilmsterChoices();
    } else {
      this.classList.add('incorrect');
      this.disabled = true;
      filmsterTriesLeft--;
      filmsterTriesDisplay.textContent = filmsterTriesLeft;
      
      if (filmsterTriesLeft > 0) {
        filmsterFeedback.textContent = `Wrong! Try again. ${filmsterTriesLeft} ${filmsterTriesLeft === 1 ? 'try' : 'tries'} left.`;
        filmsterFeedback.className = 'filmster-feedback incorrect';
      } else {
        filmsterFeedback.textContent = 'Game Over! The answer was Harry Potter.';
        filmsterFeedback.className = 'filmster-feedback incorrect';
        filmsterGameOver = true;
        disableFilmsterChoices();
        highlightFilmsterCorrectAnswer();
      }
    }
  });
});

function disableFilmsterChoices() {
  filmsterChoices.forEach(choice => choice.disabled = true);
}

function highlightFilmsterCorrectAnswer() {
  filmsterChoices.forEach(choice => {
    if (choice.dataset.answer === 'correct') {
      choice.classList.add('correct');
    }
  });
}
