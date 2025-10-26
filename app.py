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


@app.route("/")
def homepage():
    """Homepage"""
    return render_template("index.html", page="homepage")


@app.route("/game-redirect", methods=["POST"])
def gameRedirect():
    """Game redirector"""
    game = request.form.get("game")
    
    if game not in routes:
        abort(400, "Invalid game selected")
        
    route = routes[game]
    
    return redirect(route)  # Redirect to game


@app.route("/tutorial-redirect", methods=["POST"])
def tutorialRedirect():
    """Tutorial redirector"""
    game = request.form.get("game")
    
    if game not in routes:
        abort(400, "Invalid game selected")
    
    route = routes[game]
    
    return redirect(f"{route}/tutorial") # Redirect to tutorial for chosen game


@app.route("/<game>/tutorial")
def tutorialPage(game): 
    """Tutorial page"""
    if game not in games or game not in htmls:
        abort(404)
        return "Invalid game", 400
    
    return render_template(f"{game}_help.html", page=game)


@app.route("/<game>", methods=["GET"])
def game_page(game):
    """Game routes"""
    if game not in games or game not in htmls:
        abort(404)
    
    session_key = f"{game}_loaded"
    if not session.get(session_key):
        session[session_key] = True  
       
    return render_template(htmls[game], page=game)
    

@app.route("/fetch/session/<game>", methods=["POST"])
def fetch_session(game):
    """Fetch stored session commands formatted for batch execution"""
    try:
        commands = session.get(f"{game}_commands", [])
        
        # Return in the same format that sendBatchCommands expects
        return jsonify({
            "commands": commands
        })
        
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Error fetching session: {str(e)}"
        }), 500


@app.route("/run/<game>", methods=["POST"])
def run(game):
    """Main command router for single commands"""
    try:
        data = request.get_json(force=True)
        command = data.get("command", "").strip()
        if not command:
            return jsonify({"status": "error", "message": "No command provided"}), 400
            
        # Save the commands in current game session
        if not session.get(f"{game}_commands"):
            session[f"{game}_commands"] = []
        
        # Set game loaded as false
        if session.get(f'{game}_loaded'):
            session[f"{game}_loaded"] = False
            
        # Get a fresh copy of the commands list
        commands_list = session.get(f"{game}_commands", [])
        commands_list.append(command)
        session[f"{game}_commands"] = commands_list
        session.modified = True  # Force Flask to recognize the change
        
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


@app.route("/run/<game>/batch", methods=["POST"])
def run_batch(game):
    """Execute multiple commands in sequence"""
    try:
        data = request.get_json(force=True)
        commands = data.get("commands", [])
        
        if not commands:
            return jsonify({"status": "error", "message": "No commands provided"}), 400
        
        # Initialize commands list for this game session
        session[f"{game}_commands"] = []
        results = []
        
        # Set game loaded as false
        if session.get(f'{game}_loaded'):
            session[f"{game}_loaded"] = False
            
        # Reset tries count
        session[f"{game}_triesCount"] = 0
        
        for command in commands:
            command = command.strip()
            if not command:
                continue
            
            # Save command to session
            commands_list = session.get(f"{game}_commands", [])
            commands_list.append(command)
            session[f"{game}_commands"] = commands_list
            
            # Execute command and get result
            try:
                if command == "show":
                    result = handle_show(game)
                elif command == "words":
                    result = handle_words(game)
                elif command.startswith("guess"):
                    result = handle_guess(game, command)
                else:
                    result = handle_generic_command(command)
                
                # Extract JSON data from Flask response
                result_data = result.get_json() if hasattr(result, 'get_json') else result
                
                results.append({
                    "command": command,
                    "result": result_data
                })
                
            except Exception as cmd_error:
                results.append({
                    "command": command,
                    "result": {"status": "error", "message": str(cmd_error)}
                })
        
        session.modified = True
        
        return jsonify({"status": "success", "results": results})
        
    except InterpreterError as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": f"Runtime error: {e}"}), 500


@app.route("/reset_game/<game>", methods=["POST"])
def reset_game(game):
    """Resets session values of given game"""
    session.pop(f"{game}_commands", None)
    session.pop(f"{game}_secret_word", None)
    session.pop(f"{game}_words", None)
    session.pop(f"{game}_triesCount]", None)
    return f"{game}: Game session cleared"


def handle_show(game):
    """Handle 'show' command - save secret word"""
    result = interp.run_once("show")
    secret_word = result.split(":", 1)[1].strip()
    secret_key = f"{game}_secret_word"
    session[secret_key] = secret_word
    
    # update saved session command "word" to have the secret word
    game_commands = session[f"{game}_commands"]
    target = "word"
    index = next((i for i, w in enumerate(game_commands) if target in w), -1)
    
    if index != -1:
        game_commands[index] = f"word {secret_word}"
        session[f"{game}_commands"] = game_commands
        session.modified = True
        
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
    
    # Add number of tries in session
    if not session.get(f"{game}_triesCount"):
        session[f"{game}_triesCount"] = 0
    session[f"{game}_triesCount"] += 1
    
    # Parse and format result
    result = json.loads(result)
    
    # Append tries count to result
    result["tries"] = session[f"{game}_triesCount"]
    
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
    result["character"]["status"] = "wrong" if result["result"] == "continue" or result["result"] == "lose" else "correct"
    
    # Set secret word if result is win/lose
    if result["result"] == "win" or result["result"] == "lose":
        secret_value = session.get(f"{game}_secret_word")
        result["secret"] = {"value": secret_value}
        result["secret"]["name"] = re.sub(r"(?<!^)(?=[A-Z0-9])", " ", secret_value) if re.search(r"[A-Z0-9]", secret_value[1:]) else secret_value
    
    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True)