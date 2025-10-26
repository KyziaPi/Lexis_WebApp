$(document).ready(function () {    
    // Initialize game features
    initGame("raildle", 5);
    var triesCounter = 0;

    // Initialize select2
    $('#character-select').select2({
        placeholder: "Enter Character Name",
        allowClear: true,
        dropdownParent: $('body'),
        templateResult: formatOption,
        matcher: matchStart // Custom matcher for start-of-word matching
    });

    // Show winstreak
    $("#winstreak-counter").text(getWinstreak("raildle"));
    console.log(getWinstreak("raildle"));

    $('#character-select').on('select2:select', function (e) {
        const selectedId = e.params.data.id;
        
        // disable the selected option so it can't be chosen again
        $(this).find(`option[value="${selectedId}"]`).prop('disabled', true);
        $(this).trigger('change.select2');

        // Update the tries counter
        triesCounter++;
        document.getElementById("tries-counter").textContent = triesCounter;

        // Update Table
        sendCommand(`guess ${selectedId}`, "raildle");
        $('#character-select').val(null).trigger('change'); // Clear the selection
    });

   
});

// Custom matcher: matches start of any word
function matchStart(params, data) {
    // If there are no search terms, return all data
    if ($.trim(params.term) === '') {
        return data;
    }

    // Do not display the item if there is no 'text' property
    if (typeof data.text === 'undefined') {
        return null;
    }

    // Search term
    var term = params.term.toLowerCase();
    var text = data.text.toLowerCase();

    // Split text into words
    var words = text.split(/\s+/);

    // Check if any word starts with the search term
    for (var i = 0; i < words.length; i++) {
        if (words[i].indexOf(term) === 0) {
            return data;
        }
    }

    // Return null if the term should not be displayed
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

    $playAgain = 
        `<form id="playAgainForm" action="/raildle/play-again" method="post">
            <button class="raildle-tries-card__play-again-btn">Play Again</button>
        </form>`;

    $(".raildle-main-card__dropdown-container").append($playAgain);
    
}

function btnToDropdown(){
    $("#playAgainForm").hide();
    $('#character-select').next('.select2').show();

    // post for restart
}

function addOptions(res){
    let options = "";
    for (const [value, name] of Object.entries(res)) {
    options += `<option value="${value}" 
                    data-img="static/images/raildle/character/${value}.png">
                  ${name}
                </option>`;
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
    console.log(feedbacks);
    $tableData = 
            `<tr>
                <td class="table-items--chara-img">
                    <img src="static/images/raildle/character/${res['character']['value']}.png">
                </td>
                <td class="table-items--${res['character']['status']}" style="font-size:1.2rem; font-weight: bold;">
                    ${res['character']['name']}
                </td>
                <td class="table-items--${feedbacks["Path"].status}">
                    <img src="static/images/raildle/path/${feedbacks["Path"].value}.webp">
                </td>
                <td class="table-items--${feedbacks["Element"].status}">
                    <img src="static/images/raildle/element/${feedbacks["Element"].value}.webp">
                </td>
                <td class="table-items--${feedbacks["World/Faction"].status}">
                    ${feedbacks["World/Faction"].value}
                </td>
                <td class="table-items--${feedbacks["Weekly Boss"].status}">
                    <img src="static/images/raildle/boss_drop/${feedbacks["Weekly Boss"].value}.webp">
                </td>
            </tr>`;
    $("#answers-table tr:first").after($tableData);

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
    dropdownToBtn();
    
    // Handle winstreak based on result
    if (isWin) {
        incrementWinstreak("raildle");
    } else {
        resetWinstreak("raildle");
    }
    
    // Show updated winstreak
    $("#winstreak-counter").text(getWinstreak("raildle"));
    
    // You can customize the HTML based on win/lose
    htmlUpdate =
        `<div class="raildle-tries-card__result-container">
            <div class="raildle-tries-card__img-result-container">
                <img src="static/images/raildle/character/${secret_value}.png">
            </div>`;

    htmlUpdate += isWin ? 
            `<div class="raildle-tries-card__result-bg result-bg-win">
                    <h1 class="raildle-tries-card__title">You won!</h1>
                    <h1 class="raildle-tries-card__title">The character was ${secret_name}</h1>
            </div>` : 
            `<div class="raildle-tries-card__result-bg result-bg-lose">
                    <h1 class="raildle-tries-card__title">You lost! </h1>
                    <h1 class="raildle-tries-card__title">The character was ${secret_name}</h1>
        </div>`;
    
    $(".raildle-tries-card").append(htmlUpdate);
}