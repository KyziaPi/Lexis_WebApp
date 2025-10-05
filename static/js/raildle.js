$(document).ready(function () {
    const chosen = [];
    var triesCounter = 0;

    // clear any selected options
    $('#character-select').val(null).trigger('change');

    // initialize select2 after clearing
    $('#character-select').select2({
        placeholder: "Enter Character Name",
        allowClear: true,
        dropdownParent: $('body'),
        templateResult: formatOption,
        matcher: matchStart // Custom matcher for start-of-word matching
    });

    $('#character-select').on('select2:select', function (e) {
        const selectedId = e.params.data.id;
        chosen.push(selectedId) //store chosen value
        // disable the selected option so it can't be chosen again
        $(this).find(`option[value="${selectedId}"]`).prop('disabled', true);
        $(this).trigger('change.select2');

        // Update the tries counter
        triesCounter++;
        document.getElementById("tries-counter").textContent = triesCounter;

        console.log('Chosen:', chosen);
        $('#character-select').val(null).trigger('change'); // Clear the selection

        //TODO: values should update according to Lexis' output (will convert to a function in the future)
        $tableData = 
            `<tr>
                <td class="table-items--chara-img" id="photo-1">
                    <img src="static/images/raildle/character/remembrance-trailblazer.png">
                </td>
                <td class="table-items--wrong" id="name-1">
                    Remembrance Trailblazer
                </td>
                <td class="table-items--correct" id="path-1">
                    <img src="static/images/raildle/path/remembrance.webp">
                </td>
                <td class="table-items--wrong" id="element-1">
                    <img src="static/images/raildle/element/ice.webp">
                </td>
                <td class="table-items--wrong" id="world-faction-1">
                    Astral Express
                </td>
                <td class="table-items--correct" id="weekly-boss-1">
                    <img src="static/images/raildle/boss_drop/Auspice_Sliver.webp">
                </td>
            </tr>`;
        $("#answers-table").append($tableData);

        // TODO: if chosen == secret

        if (chosen.length == 5)  {
            
            // TODO: remove dropdown and replace with a play again btn
            dropdownToBtn();
            return
        }

        // TODO: show whether you won/lost in the tries-card
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
            <img src="${img}" style="width: 4rem; height: auto; margin-right: .4rem;">
            <span>${option.text}</span>
        </div>`
    );
}

function dropdownToBtn(){
    $('#character-select').next('.select2').hide();

    $playAgain = 
        `<form action="/raildle/play-again" method="post">
            <button class="raildle-tries-card__play-again-btn">Play Again</button>
        </form>`;

    $(".raildle-main-card__dropdown-container").append($playAgain);
}

function btnToDropdown(){
    $('#character-select').next('.select2').show();
}