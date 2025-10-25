// API Communication
function sendCommand(cmd, game) {
    return $.ajax({
        url: `/run/${game}`,
        type: "POST",
        contentType: "application/json",
        data: JSON.stringify({ command: cmd }),
        success: function(res) {
            // Handle replayed guesses first
            if (res.replayed && res.replayed.length > 0) {
                res.replayed.forEach(function(guessData) {
                    handleCommandResponse(`guess`, game, guessData);
                });
            }
            
            // Handle the current command response
            handleCommandResponse(cmd, game, res);
        },
        error: function(err) {
            console.error(`Error executing command "${cmd}":`, err);
        }
    });
}

function handleCommandResponse(cmd, game, response) {
    // Route to game-specific handlers
    if (game === "raildle") {
        handleRaildleResponse(cmd, response);
    }
    // Add other game handlers here as needed
    // else if (game === "snuzzle") { handleSnuzzleResponse(cmd, response); }
    // else if (game === "filmster") { handleFilmsterResponse(cmd, response); }
}

// Game-specific response handlers
function handleRaildleResponse(cmd, response) {
    if (cmd === "words") {
        addOptions(response);
    } else if (cmd.startsWith("guess")) {
        addTableData(response);
    }
}

// Game initialization
async function initGame(game, max_guesses, secret_word = "") {
    try {
        // Load game file and start
        sendCommand(`file ${game}`, game);
        sendCommand("start", game);
        sendCommand(`max_guesses ${max_guesses}`, game);
        
        setGameActive(game, false)
        // // Prevent re-initialization of new random word
        // console.log(`Raildle: ${isGameActive(game)}`)
        // if ((isGameActive(game))) {
        //     console.log(`Game "${game}" already started`);
        //     console.log(`Raildle during: ${isGameActive(game)}`)
        //     return;
        // }
        
        // // Mark as started
        // setGameActive(game, true)
        // console.log(`Game initialized: ${game}`);

        console.log(`Raildle after: ${isGameActive(game)}`)
        
        sendCommand(`word ${secret_word}`, game);
        
        // Reveal secret word to keep session
        sendCommand("show", game);   
    } catch (err) {
        console.error("Error starting game:", err);
    }
}

// Utility function to reset a game
function resetGame(game) {
    setGameActive(game, false)
    console.log(`Game "${game}" reset`);
}