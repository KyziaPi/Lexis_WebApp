// API Communication
function sendCommand(cmd, game) {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: `/run/${game}`,
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify({ command: cmd }),
            success: function(res) {
                // Handle the current command response
                handleCommandResponse(cmd, game, res);
                resolve(res);
            },
            error: function(err) {
                console.error(`Error executing command "${cmd}":`, err);
                reject(err);
            }
        });
    });
}

function sendBatchCommands(commands, game) {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: `/run/${game}/batch`,
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify({ commands: commands }),
            success: function(res) {
                // Handle each command response
                if (res.status === "success" && res.results) {
                    res.results.forEach(item => {
                        handleCommandResponse(item.command, game, item.result);
                    });
                }
                resolve(res);
            },
            error: function(err) {
                console.error(`Error executing batch commands:`, err);
                reject(err);
            }
        });
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
        updateTriesCount(response.tries, "#tries-counter");
    }
}

// Manipulate tries element via JQUERY
function updateTriesCount(tries, element) {
    $(element).text(tries);
}

// Game initialization
async function initGame(game, max_guesses, secret_word = "") {
    try {
        //setGameActive(game, false);

        // Fetch previous session commands
        const sessionData = await getCommands(game);

        // If game is already active and a guess has been made, replay previous session
        if (isGameActive(game) && sessionData && sessionData.commands && sessionData.commands.length > 6) {
            const response = await sendBatchCommands(sessionData.commands, game);
            return response;
        }
        
        // Prepare batch commands
        const commands = [
            `file ${game}`,
            "start",
            `max_guesses ${max_guesses}`,
            `word ${secret_word}`,
            "show",
            "words"
        ];

        // Set game as active
        setGameActive(game, true);
        
        // Send all commands in a single batch request
        const response = await sendBatchCommands(commands, game);
    
        return response;
        
    } catch (err) {
        console.error("Error starting game:", err);
        throw err;
    }
}

// Clear game session
function resetGame(game) {
    $.ajax({
            url: `/reset_game/${game}`,
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify({ game: game }),
            success: function(res) {
                // Clear local state
                setGameActive(game, false)
                setGameOver(game, false)
            },
            error: function(err) {
                console.error(`Error clearing session for "${game}":`, err);
            }
    });
}

// Get commands from previous session
function getCommands(game) {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: `/fetch/session/${game}`,
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify({ game: game }),
            success: function(res) {
                resolve(res);
            },
            error: function(err) {
                console.error(`Error fetching session for "${game}":`, err);
                reject(err);
            }
        });
    });
}