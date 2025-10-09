from flask import Flask, render_template, request, jsonify, abort, redirect, session
#from Lexis import run # Mini programming language

app = Flask(__name__)

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

# NOTE: session will be utilized in the future to keep track of game progress

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
@app.route("/snuzzle", methods=["GET", "POST"])
def snuzzle():
    
    # if request.method == "POST":
        # game functions
    
    if request.method == "GET":
        
        # Lexis commands: filename, mode, word, max_guesses
        
        return render_template(htmls["snuzzle"], page="snuzzle")


# Game: Filmster
@app.route("/filmster", methods=["GET", "POST"])
def filmster():
    
    # if request.method == "POST":
        # game functions
        
    if request.method == "GET":
                
        # Lexis commands: filename, mode, word, max_guesses
        
        return render_template(htmls["filmster"], page="filmster")


# Game: Raildle
@app.route("/raildle", methods=["GET", "POST"])
def raildle():
    # if request.method == "POST":
        # game functions
    
    if request.method == "GET":
                
        # Lexis commands: filename, mode, word, max_guesses
        
        return render_template(htmls["raildle"], page="raildle")
    
    
@app.route("/raildle/fetch-characters", methods=["POST"])
def fetchWords():
    # Lexis command: words
    
    return # all words in the word bank in a dictionary {name:img_name} for dropdown


@app.route("/raildle/guess/<character>", methods=["POST"])
def guessCharacter(character):
    # Lexis command: guess <character>
    
    # update tries-card

    return # returns the result of guessing character (red or green)


@app.route("/raildle/correct", methods=["POST"])
def raildleCorrect():
    # UI updates winning (prolly gonna be mainly js) + play again btn
    
    return # win screen


@app.route("/raildle/play-again", methods=["POST"])
def raildlePlayAgain():
    # will add session, for now just simple reload
    
    return redirect("/raildle")