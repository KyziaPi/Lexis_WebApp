from flask import Flask, request, jsonify, render_template, abort, redirect, session
import json
from os import urandom
import re
from queue import Queue
import threading
import time
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
        
        # Route to specific handlers based on command
        if command == "show":
            return handle_show(game)
        elif command == "words":
            return handle_words(game)
        elif command.startswith("guess"):
            return handle_guess(game, command)
        else:
            return handle_generic_command(command)

    except InterpreterError as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": f"Runtime error: {e}"}), 500


def handle_show(game):
    """Handle 'show' command - save secret word"""
    result = interp.run_once("show")
    secret_word = result.split(":", 1)[1].strip()
    secret_key = f"{game}_secret_word"
    session[secret_key] = secret_word
    
    return jsonify("Secret word has been saved.")


def handle_words(game):
    """Handle 'words' command - retrieve and format word list"""
    result = interp.run_once("words")
    
    if game == "raildle":
        return format_raildle_words(game, result)
    
    return jsonify(result)


def handle_guess(game, command):
    """Handle 'guess' command - process and store guess"""
    result = interp.run_once(command)
    
    # Only process successful guesses
    if result.startswith("Error:"):
        return jsonify(result)
    
    # Parse and format result
    result = json.loads(result)
    
    if game == "raildle":
        return format_raildle_guess(result, command, game)
    
    return jsonify(result)


def handle_generic_command(command):
    """Handle all other commands"""
    result = interp.run_once(command)
    return jsonify(result)


# Helper functions


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


def format_raildle_guess(result, command, game):
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
    
    # Set secret word if result is win/lose
    if result["result"] == "win" or result["result"] == "lose":
        secret_value = session.get(f"{game}_secret_word")
        result["secret"] = {"value": secret_value}
        result["secret"]["name"] = re.sub(r"(?<!^)(?=[A-Z0-9])", " ", secret_value) if re.search(r"[A-Z0-9]", secret_value[1:]) else secret_value
    
    return jsonify(result)

@app.route("/reset_game/<game>")
def reset_game(game):
    session.pop(f"{game}_commands", None)
    return "Game session cleared"

if __name__ == "__main__":
    app.run(debug=True)