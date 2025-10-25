from flask import Flask, request, jsonify, render_template, abort, redirect, session
import json
from os import urandom
import re
from Interpreter import Interpreter, InterpreterError

app = Flask(__name__)
app.secret_key = urandom(24)
interp = Interpreter()

games = [
    "snuzzle", "filmster", "raildle"
]

routes = {
    "snuzzle": "/snuzzle",
    "filmster": "/filmster",
    "raildle": "/raildle"
}

htmls = {
    "snuzzle": "snuzzle.html",
    "filmster": "filmster.html",
    "raildle": "raildle.html"
}


# Homepage
@app.route("/")
def homepage():
    return render_template("index.html", page="homepage")

# Game redirector
@app.route("/game-redirect", methods=["POST"])
def gameRedirect():
    game = request.form.get("game")
    
    if game not in routes:
        abort(400, "Invalid game selected")
        
    route = routes[game]
    
    return redirect(route)  # Redirect to game


# Tutorial redirector
@app.route("/tutorial-redirect", methods=["POST"])
def tutorialRedirect():
    game = request.form.get("game")
    
    if game not in routes:
        abort(400, "Invalid game selected")
    
    route = routes[game]
    
    return redirect(f"{route}/tutorial") # Redirect to tutorial for chosen game

    
# Tutorial page
@app.route("/<game>/tutorial")
def tutorialPage(game): 
    if game not in games:
        return "Invalid game", 400
    
    return render_template(f"{game}_help.html", page=game)


# Game: Snuzzle
@app.route("/snuzzle", methods=["GET"])
def snuzzle():
    
    if request.method == "GET":       
        return render_template(htmls["snuzzle"], page="snuzzle")


# Game: Filmster
@app.route("/filmster", methods=["GET"])
def filmster():
    if request.method == "GET":
        return render_template(htmls["filmster"], page="filmster")


# Game: Raildle
@app.route("/raildle", methods=["GET"])
def raildle():
    # Only set loaded flag if it's not already False (first load or after session cleared)
    if not session.get("raildle_loaded"):
        session["raildle_loaded"] = True  
        print(f"Page loaded, raildle_loaded set to: {session.get('raildle_loaded')}")
        
    return render_template(htmls["raildle"], page="raildle")


@app.route("/raildle/play-again", methods=["POST"])
def raildlePlayAgain():
    session["raildle"] = True
    return redirect("/raildle")

@app.route("/run/<game>", methods=["POST"])
def run(game):
    """Main command router"""
    try:
        data = request.get_json(force=True)
        command = data.get("command", "").strip()
        if not command:
            return jsonify({"status": "error", "message": "No command provided"}), 400

        # Mark game session as active
        if not session.get(game):
            session[game] = True
            
        print(f"Before: {session.get(f"{game}_loaded")}")
        # Replay session state on first command after page load
        replayed_data = None
        if session.get(f"{game}_loaded"):
            session[f"{game}_loaded"] = False
            replayed_data = replay_session_state(game)
            print(f"During: {session.get(f"{game}_loaded")}")

        print(f"After: {session.get(f"{game}_loaded")}")

        # Route to specific handlers based on command
        if command == "show":
            result = handle_show(game)
        elif command == "words":
            result = handle_words(game)
        elif command.startswith("guess"):
            result = process_guess(game, command)
        else:
            result = handle_generic_command(command)
            
        # If we replayed data, include it in the response
        if replayed_data:
            response_data = result.get_json()
            response_data["replayed"] = replayed_data
            return jsonify(response_data)
        
        return result

    except InterpreterError as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": f"Runtime error: {e}"}), 500


def replay_session_state(game):
    """Replay session state for specific games"""
    secret_key = f"{game}_secret_word"
    guesses_key = f"{game}_guesses"
    
    replayed_guesses = []
    
    # Rerun the current session if it exists
    secret = session.get(secret_key)
    if secret:
        interp.run_once(f"word {secret}")
        print(f"Replayed secret word: {secret}")
    
    # Replay guesses (if any)
    guesses = session.get(guesses_key, [])
    if guesses:
        # Temporarily store guesses and clear session to avoid duplication
        temp_guesses = guesses.copy()
        session[guesses_key] = []
    
        # Replay each guess and collect results
        for guess in temp_guesses:
            command = f"guess {guess}"
            try:
                result = process_guess(game, command)
                if result:
                    replayed_guesses.append(result)
                    print(f"Replayed guess: {guess}")
            except Exception as e:
                print(f"Error replaying guess {guess}: {e}")
    
    return replayed_guesses


def process_guess(game, command):
    """Core guess processing logic (returns data object)"""
    result = interp.run_once(command)
    
    # Only process successful guesses
    if result.startswith("Error:"):
        return None
    
    # Store the guess
    save_guess(game, command)
    
    # Parse result
    result = json.loads(result)
    
    if game == "raildle":
        return format_raildle_guess(result, command)
    
    return result


def handle_guess(game, command):
    """Handle 'guess' command - process and return JSON response"""
    result = process_guess(game, command)
    
    if result is None:
        # Handle error case
        error_result = interp.run_once(command)
        return jsonify(error_result)
    
    return jsonify(result)


def handle_show(game):
    """Handle 'show' command - save secret word"""
    result = interp.run_once("show")
    secret_word = result.split(":", 1)[1].strip()
    secret_key = f"{game}_secret_word"
    session[secret_key] = secret_word
    print(session[secret_key])
    return jsonify("Secret word has been saved.")


def handle_words(game):
    """Handle 'words' command - retrieve and format word list"""
    result = interp.run_once("words")
    
    if game == "raildle":
        return format_raildle_words(game, result)
    
    return jsonify(result)


def handle_generic_command(command):
    """Handle all other commands"""
    result = interp.run_once(command)
    return jsonify(result)


# Helper functions

def save_guess(game, command):
    """Store guessed word in session"""
    guesses_key = f"{game}_guesses"
    session.setdefault(guesses_key, [])
    
    guessed_word = command.split(" ", 1)[1] if " " in command else ""
    if guessed_word:
        session[guesses_key].append(guessed_word)


def format_raildle_words(game, result):
    """Format word list for Raildle game"""
    response = result.split(":", 1)[1]
    keys = [w.strip() for w in response.split(",")]
    keys.sort()
    
    words = {}
    for k in keys:
        # If PascalCase or contains numbers, insert spaces before capitals/numbers
        if re.search(r"[A-Z0-9]", k[1:]):
            spaced = re.sub(r"(?<!^)(?=[A-Z0-9])", " ", k)
            words[k] = spaced
        else:
            words[k] = k
    
    words_key = f"{game}_words"
    session[words_key] = words
    return jsonify(session.get(words_key, {}))


def format_raildle_guess(result, command):
    """Format guess result for Raildle game"""
    guessed_word = command.split(" ", 1)[1] if " " in command else ""
    
    # Format character name
    if re.search(r"[A-Z0-9]", guessed_word[1:]):
        guessed_name = re.sub(r"(?<!^)(?=[A-Z0-9])", " ", guessed_word)
    else:
        guessed_name = guessed_word
    
    result["character"] = {"value": guessed_word, "name": guessed_name}
    
    # Format feedback
    formatted_feedback = {}
    for line in result["feedback"]:
        category, rest = line.split(":", 1)
        rest = rest.strip()
        
        # Parse status and value
        if "(" in rest and ")" in rest:
            status = rest.split("(")[0].strip()
            status = "wrong" if status == "\u274c" else "correct"
            
            # Extract value from parentheses
            if category.strip() == "World/Faction":
                value = rest.split("(")[1].rstrip(")")
            else:
                value = rest.split("(")[1].rstrip(")").replace(" ", "_")
        else:
            status = ""
            value = rest
        
        formatted_feedback[category.strip()] = {
            "value": value.strip(),
            "status": status
        }
    
    result["feedback"] = formatted_feedback
    
    # Set character status
    result["character"]["status"] = "wrong" if result["result"] == "continue" else "correct"
    
    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True)