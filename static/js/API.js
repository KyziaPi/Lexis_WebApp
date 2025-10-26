// API Communication
function sendCommand(cmd, game) {
    return $.ajax({
        url: `/run/${game}`,
        type: "POST",
        contentType: "application/json",
        data: JSON.stringify({ command: cmd }),
        success: function(res) {
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
        await sendCommand(`file ${game}`, game);
        await sendCommand("start", game);
        await sendCommand(`max_guesses ${max_guesses}`, game);
        await sendCommand(`word ${secret_word}`, game);
        await sendCommand("show", game);
        await sendCommand("words", game);
        
        return 
    } catch (err) {
        console.error("Error starting game:", err);
    }
}