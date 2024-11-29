document.addEventListener('DOMContentLoaded', () => {
    // Recipe Modal and Form Functionality
    const recipeModal = document.querySelector('#recipe-modal');
    const recipeForm = document.querySelector('#recipe-form');
    const recipeList = document.querySelector('#new-recipe-list');
    const createRecipeButton = document.querySelector('.create-new-recipe');
    const closeModalButton = document.querySelector('ion-button[slot="end"]');

    if (recipeModal && recipeForm && recipeList && createRecipeButton && closeModalButton) {
        // Open Modal
        function openRecipeModal() {
            recipeModal.isOpen = true; // Open Ionic modal
        }

        // Close Modal
        function closeRecipeModal() {
            recipeModal.isOpen = false; // Close Ionic modal
        }

        // Add Recipe to List
        function addRecipe(event) {
            event.preventDefault();

            const recipeName = document.querySelector('#recipe-name').value.trim();
            const recipeSteps = document.querySelector('#recipe-steps').value.trim();
            const recipeIngredients = document.querySelector('#recipe-ingredients').value.trim();
            const recipeAuthor = document.querySelector('#recipe-author').value.trim();

            if (recipeName && recipeSteps && recipeIngredients && recipeAuthor) {
                const newRecipeItem = document.createElement('ion-item');
                const recipeLabel = document.createElement('ion-label');
                recipeLabel.textContent = `${recipeName} by ${recipeAuthor}`;
                newRecipeItem.appendChild(recipeLabel);
                recipeList.appendChild(newRecipeItem);

                recipeForm.reset(); // Clear the form fields
                closeRecipeModal(); // Close the modal
            } else {
                alert('Please fill out all fields before adding a recipe.');
            }
        }

        // Event Listeners
        createRecipeButton.addEventListener('click', openRecipeModal);
        closeModalButton.addEventListener('click', closeRecipeModal);
        recipeForm.addEventListener('submit', addRecipe);
    }

    // Search Functionality in All Recipes
    const searchBar = document.querySelector('.search-bar');
    const allRecipesList = document.querySelector('.recipes-container ion-list');

    if (searchBar && allRecipesList) {
        function filterRecipes() {
            const searchTerm = searchBar.value.toLowerCase();
            const recipes = allRecipesList.querySelectorAll('ion-item');

            recipes.forEach(recipe => {
                const recipeText = recipe.querySelector('ion-label').textContent.toLowerCase();
                recipe.style.display = recipeText.includes(searchTerm) ? '' : 'none';
            });
        }

        searchBar.addEventListener('input', filterRecipes);
    }

    // Pantry and Freezer Edit Functionality
    const pantryEditButton = document.querySelector('.edit-button-pantry');
    const freezerEditButton = document.querySelector('.edit-button-freezer');

    if (pantryEditButton && freezerEditButton) {
        function editList(listSelector) {
            const list = document.querySelector(listSelector);
            const item = prompt('Enter the item to add (or leave blank to remove the last item):');

            if (item) {
                const listItem = document.createElement('ion-item');
                listItem.textContent = item;
                list.appendChild(listItem);
            } else if (list.children.length > 0) {
                list.removeChild(list.lastChild);
            } else {
                alert('The list is already empty.');
            }
        }

        pantryEditButton.addEventListener('click', () => editList('.pantry ion-list'));
        freezerEditButton.addEventListener('click', () => editList('.freezer ion-list'));
    }

    // Calendar Navigation Functionality
    const prevWeekButton = document.querySelector('#prev-week');
    const nextWeekButton = document.querySelector('#next-week');
    const currentWeekDisplay = document.querySelector('#current-week');
    const days = document.querySelectorAll('.day');

    if (prevWeekButton && nextWeekButton && currentWeekDisplay && days) {
        let currentWeekStart = new Date(); // Start with today's date

        function setWeekDates(startDate) {
            const weekStart = new Date(startDate);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            currentWeekDisplay.textContent = `Week of: ${weekStart.toDateString()}`;

            let currentDay = new Date(weekStart);
            days.forEach(day => {
                const dayLabel = day.querySelector('h3');
                dayLabel.textContent = `${day.id.charAt(0).toUpperCase() + day.id.slice(1)} (${currentDay.getDate()})`;
                currentDay.setDate(currentDay.getDate() + 1);
            });
        }

        function prevWeek() {
            currentWeekStart.setDate(currentWeekStart.getDate() - 7);
            setWeekDates(currentWeekStart);
        }

        function nextWeek() {
            currentWeekStart.setDate(currentWeekStart.getDate() + 7);
            setWeekDates(currentWeekStart);
        }

        // Initialize Calendar
        setWeekDates(currentWeekStart);

        // Attach Event Listeners
        prevWeekButton.addEventListener('click', prevWeek);
        nextWeekButton.addEventListener('click', nextWeek);
    }
});
