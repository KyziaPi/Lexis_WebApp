$(document).ready(function () {    
    // initialize variables
    var game = "raildle";
    var max_guesses = 5;
    var secret_word = "";
    var selectedCharacters = [];
    
    // Initialize game features
    initGame(game, max_guesses, secret_word);

    // Initialize select2
    $('#character-select').select2({
        placeholder: "Enter Character Name",
        allowClear: true,
        dropdownParent: $('body'),
        templateResult: formatOption,
        matcher: matchStart // Custom matcher for start-of-word matching
    });

    // Show winstreak
    $("#winstreak-counter").text(getWinstreak(game));

    $('#character-select').on('select2:select', function (e) {
        const selectedId = e.params.data.id;
        selectedCharacters.push(selectedId);
        
        // disable the selected option so it can't be chosen again
        $(this).find(`option[value="${selectedId}"]`).prop('disabled', true);
        $(this).trigger('change.select2');

        // Update Table
        sendCommand(`guess ${selectedId}`, game);
        $('#character-select').val(null).trigger('change'); // Clear the selection
    });

    $("#reset_game").click(async function() {
        try {
            // Set game as inactive and clear session
            await resetGame(game)

            // Reset counter
            $("#tries-counter").text(0);

            // Restart game function
            await initGame(game, max_guesses, secret_word); 

            // Edit html features
            btnToDropdown();
            $("#answers-table tr").not(":first").remove();
            $(".raildle-tries-card__result-container").remove();

            // Reset disabled dropdown options
            for (var chara of selectedCharacters){
                $('#character-select').find(`option[value="${chara}"]`).prop('disabled', false);
                $('#character-select').trigger('change.select2');
            }
        } catch (error) {
            console.error("Error restarting game:", error);
        }
    })
});

// Custom matcher: matches consecutive words in order
function matchStart(params, data) {
    // If there are no search terms, return all data
    if ($.trim(params.term) === '') {
        return data;
    }
    // Do not display the item if there is no 'text' property
    if (typeof data.text === 'undefined') {
        return null;
    }
    
    var term = params.term.toLowerCase().trim();
    var text = data.text.toLowerCase();
    
    // Split search term and text into words
    var searchWords = term.split(/\s+/);
    var textWords = text.split(/\s+/);
    
    // Try to find consecutive matches starting from each text word
    for (var i = 0; i <= textWords.length - searchWords.length; i++) {
        var allMatch = true;
        
        // Check if all search words match consecutively
        for (var j = 0; j < searchWords.length; j++) {
            if (textWords[i + j].indexOf(searchWords[j]) !== 0) {
                allMatch = false;
                break;
            }
        }
        
        if (allMatch) {
            return data;
        }
    }
    
    // Return null if no consecutive match found
    return null;
}

function formatOption(option) {
    if (!option.id) return option.text;
    
    const img = $(option.element).data('img');
    if (!img) return option.text;
    
    return $(
        `<div style="display: flex; align-items: center; padding: 0.2rem;">
            <img src="${img}" style="width: 4rem; height: auto; margin-right: .4rem; background-color: var(--raildle-chara-img-bg); border: .2rem solid var(--raildle-main);">
            <span style="font-size: 1.2rem;">${option.text}</span>
        </div>`
    );
}

function dropdownToBtn(){
    $('#character-select').next('.select2').hide();
    $('#reset_game').show();
}

function btnToDropdown(){
    $("#reset_game").hide();
    $('#character-select').next('.select2').show();
}

function addOptions(res){
    let options = "";
    for (const [value, name] of Object.entries(res)) {
        options += `<option value="${value}" data-img="static/images/raildle/character/${value}.png">${name}</option>`;
    }
    $("#character-select").html(options);
    $('#character-select').val(null).trigger('change');
}

function addTableData(res){
    const values = Object.values(res.feedback).map(item => item.value);
    
    const feedbacks = {};
    if (res.feedback && typeof res.feedback === "object") {
        Object.entries(res.feedback).forEach(([category, item]) => {
            feedbacks[category] = {
            value: item.value,
            status: item.status
            };
        });
    }

    var tableData = 
            `<tr>
                <td class="table-items--chara-img fade-in">
                    <img src="static/images/raildle/character/${res['character']['value']}.png">
                </td>
                <td class="table-items--${res['character']['status']} fade-in" style="font-size:1.2rem; font-weight: bold;">
                    ${res['character']['name']}
                </td>
                <td class="table-items--${feedbacks["Path"].status} fade-in">
                    <img src="static/images/raildle/path/${feedbacks["Path"].value}.webp">
                </td>
                <td class="table-items--${feedbacks["Element"].status} fade-in">
                    <img src="static/images/raildle/element/${feedbacks["Element"].value}.webp">
                </td>
                <td class="table-items--${feedbacks["World/Faction"].status} fade-in">
                    ${feedbacks["World/Faction"].value}
                </td>
                <td class="table-items--${feedbacks["Weekly Boss"].status} fade-in">
                    <img src="static/images/raildle/boss_drop/${feedbacks["Weekly Boss"].value}.webp">
                </td>
            </tr>`;

    const $row = $(tableData).insertAfter("#answers-table tr:first");
    applyFadeInSequence($row);

    if (res["result"] == "win") {
        raildleEnd(true, res["secret"]["name"], res["secret"]["value"]); 
        return;
    }
    
    if (res["result"] == "lose") {
        raildleEnd(false, res["secret"]["name"], res["secret"]["value"]);
        return;
    }
}

function raildleEnd(isWin, secret_name, secret_value) {
    var game = "raildle";
    dropdownToBtn();
    
    // Handle winstreak based on result
    if (isWin) {
        incrementWinstreak(game);
    } else {
        resetWinstreak(game);
    }

    // Set game as over to prevent winstreak from increasing after reload
    setGameOver(game, true);
    
    // Show updated winstreak
    $("#winstreak-counter").text(getWinstreak(game));
    
    // Customize HTML based on win/lose
    htmlUpdate =
        `<div class="raildle-tries-card__result-container">
            <div class="raildle-tries-card__img-result-container fade-in">
                <img src="static/images/raildle/character/${secret_value}.png">
            </div>`;

    htmlUpdate += isWin ? 
            `<div class="raildle-tries-card__result-bg result-bg-win fade-in">
                    <h1 class="raildle-tries-card__title">You won!</h1>
                    <h1 class="raildle-tries-card__title">The character was ${secret_name}</h1>
            </div>` : 
            `<div class="raildle-tries-card__result-bg result-bg-lose fade-in">
                    <h1 class="raildle-tries-card__title">You lost! </h1>
                    <h1 class="raildle-tries-card__title">The character was ${secret_name}</h1>
            </div>
        </div>`;
    
    const $result = $(htmlUpdate).appendTo(".raildle-tries-card");
    applyFadeInSequence($result);
}

function applyFadeInSequence($element) {
    $element.find(".fade-in").css("opacity", 0).each(function(index) {
    // stagger each fade-in with setTimeout
    const el = $(this);
    setTimeout(() => {
        el.animate({ opacity: 1 }, 400);
    }, index * 300); // delay between each cell
    });
}