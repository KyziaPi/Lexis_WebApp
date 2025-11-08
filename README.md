# Guessarium 🎮

A collection of interactive word-guessing games built as a web application. Challenge yourself with multiple game modes including Wordle-style puzzles, movie trivia, and Honkai Star Rail character guessing!


---

## 📘 Overview

Guessarium combines several guessing games into one application powered by a custom interpreter called [**Lexis**](https://github.com/raldddddddd/Lexis). The system uses Flask on the backend, JavaScript for the frontend, and server-side sessions for saving game progress.

---

## 📘 Table of Contents

1. [Game Modes](#game-modes)
2. [Getting Started](#getting-started)
4. [How to Play](#user-guide)
5. [Developer Reference](#developer-reference)
6. [Flask Endpoints](#flask-endpoints)
7. [Frontend JavaScript Functions](#frontend-javascript-functions)
8. [Project Structure](#project-structure)
9. [Developer notes](#developer-notes)


---

## 🧠 Game Modes

### 🅰️ Snuzzle (Letters Mode)

* Guess a 5-letter word in 6 tries.
* Type or use the on-screen keyboard.
* Feedback after each guess:

  * 🟩 **Correct letter and position**
  * 🟨 **Correct letter, wrong position**
  * ⬜ **Letter not in the word**

### 🎬 Filmster (Hints Mode)

* Guess the movie based on hints revealed one by one.
* Feedback after each guess:

  * 🟩 **Correct movie**
  * 🟥 **Wrong movie**

### 👾 Raildle (Categories Mode)

* Guess the Honkai: Star Rail character from dropdown choices.
* Each guess shows feedback across four categories:

  * **Path**, **Element**, **World/Faction**, **Weekly Boss**
* Feedback:

  * 🟩 **Correct value**
  * 🟥 **Wrong value**
* Game progress is saved automatically between sessions.

---

## 🚀 Getting Started

### Prerequisites

* Python 3.7 or higher
* Flask installed
* Modern web browser

### Installation

```bash
# Clone the repository
git clone https://github.com/KyziaPi/Lexis_WebApp.git
cd Lexis_WebApp

# Install dependencies
pip install flask

# Run the app
flask run
# or
python app.py
```

Then open your browser and go to:
[http://127.0.0.1:5000](http://127.0.0.1:5000)

---

## 🧩 User Guide

### Starting a Game

1. Choose a game mode from the main menu.
2. Follow the instructions shown in each mode.
3. You can refresh or come back later — progress in **Raildle** is saved automatically.

### Game Controls

* Each games have a **dedicated tutorial** on how to play them.

### Game Feedback

Each game gives feedback in a color-coded or category-based format to help you deduce the answer.

---

## 💻 Developer Reference

### 🛠️ Technology Stack

| Layer                  | Description                              |
| ---------------------- | ---------------------------------------- |
| **Backend**            | Python Flask web server                  |
| **Frontend**           | HTML, CSS, JavaScript (jQuery)           |
| **API Communication**  | AJAX requests                            |
| **Session Management** | Flask session cookies                    |
| **Game Logic**         | [Lexis interpreter](https://github.com/raldddddddd/Lexis) (custom mini-language) |

---

### Application Architecture

| Layer                      | Description                                                                 |
| -------------------------- | --------------------------------------------------------------------------- |
| **Backend (Flask)**        | Handles routes, sessions, and game logic execution via Lexis interpreter    |
| **Frontend (HTML/CSS/JS)** | Displays UI, handles user input, and interacts with Flask routes using AJAX |
| [**Lexis Interpreter**](https://github.com/raldddddddd/Lexis)      | Custom mini programming language for running game logic and state           |
| **Session Management**     | Uses Flask’s session to persist player progress                             |


---

## ⚙️ Key Developer Notes

### Flask Endpoints

| Endpoint                | Method | Description                                   |
| ----------------------- | ------ | --------------------------------------------- |
| `/`                     | GET    | Renders homepage                              |
| `/game-redirect`        | POST   | Redirects to chosen game                      |
| `/tutorial-redirect`    | POST   | Redirects to game tutorial                    |
| `/<game>/tutorial`      | GET    | Displays tutorial for selected game           |
| `/<game>`               | GET    | Loads a specific game page and sets session   |
| `/fetch/session/<game>` | POST   | Fetches stored session commands for replay    |
| `/run/<game>`           | POST   | Executes a single command and updates session |
| `/run/<game>/batch`     | POST   | Runs multiple commands (batch) sequentially   |
| `/reset_game/<game>`    | POST   | Clears all session data for the given game    |

Each route interacts with Lexis, storing and replaying session commands to maintain game progress.

---

### Frontend JavaScript Functions

| Function                                     | Purpose                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **sendCommand(cmd, game)**                   | Sends a single Lexis command to Flask                                                            |
| **sendBatchCommands(commands, game)**        | Sends multiple commands at once (used on startup)                                                |
| **initGame(game, max_guesses, secret_word)** | Initializes a new game session, runs setup commands, and optionally replays sessions for Raildle |
| **resetGame(game)**                          | Clears current game progress (server + client)                                                   |
| **getCommands(game)**                        | Fetches stored command history for replay                                                        |

#### Example – Sending a Command
```bash
await sendCommand("guess apple", "snuzzle");
```

#### Example – Batch Setup
```bash
await sendBatchCommands([
  "file snuzzle.txt",
  "start",
  "max_guesses 6",
  "word apple",
  "show"
], "snuzzle");

```

#### Session Replay (Raildle)

When the page reloads, the JS function `initGame()` automatically fetches and replays previous session commands to restore progress.

---

### Adding a New Game Mode

1. Create a new file in `/WordBanks` for the game data.
2. Define logic in the Lexis interpreter or add a new AST node if needed.
3. Add a new route in `app.py`.
4. Create a corresponding template and JS file in `/templates` and `/static/js`.

---

## 🧑‍💻 Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

---

### Project Structure

```
Lexis_WebApp/
├── app.py                     # Main Flask app (routes, API endpoints)
├── repl.py                    # Lexis command-line interface
├── Interpreter/               # Lexis interpreter core
│   ├── interpreter.py
│   ├── parser.py
│   ├── lexer.py
│   └── ast_nodes/
│       ├── base.py
│       ├── edit.py
│       └── play.py
├── static/                    # Frontend assets
│   ├── css/                   # Stylesheets
│   ├── js/                    # Game UI update and AJAX calls
│   └── images/                # Visual assets
│       ├── background/
│       ├── logo/
│       ├── nav/
│       ├── raildle/
│       │   ├── boss_drop/
│       │   ├── character/
│       │   ├── element/
│       │   └── path/
│       └── snuzzle/
├── templates/                 # HTML pages (Flask Jinja templates)
├── WordBanks/                 # Game data and word lists
└── README.md                  # User & Developer documentation
```


---

## 🔧 Developer Notes

* Use `session["<game>_commands"]` to persist command history.
* Use `session["<game>_loaded"]` to track reload states.
* To debug Lexis execution, check the `repl.py` or `Interpreter/` folder.
* Modify frontend logic in `static/js/` if you want to change UI feedback or session handling.

---

**Enjoy playing and coding Guessarium! 🎉**
