let currentWeekStart = new Date(); // Start with today's date

// Initialize the calendar with the current week
function initCalendar() {
    setWeekDates(currentWeekStart);
}

// Set dates of the week based on the given start date
function setWeekDates(startDate) {
    const weekElement = document.getElementById('current-week');
    const days = document.querySelectorAll('.day');
    let currentDay = new Date(startDate);

    // Set start of the week to Sunday
    currentDay.setDate(currentDay.getDate() - currentDay.getDay());
    weekElement.innerHTML = `Week of: ${currentDay.toDateString()}`;

    // Loop through each day div and set its date
    days.forEach(day => {
        day.querySelector('h3').innerText = `${day.id.charAt(0).toUpperCase() + day.id.slice(1)} (${currentDay.getDate()})`;
        currentDay.setDate(currentDay.getDate() + 1); // Move to the next day
    });
}

// Navigate to the previous week
function prevWeek() {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    setWeekDates(currentWeekStart);
}

// Navigate to the next week
function nextWeek() {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    setWeekDates(currentWeekStart);
}

// Add event to the specified day
function addEvent() {
    const eventName = document.getElementById('event-name').value;
    const eventDay = document.getElementById('event-day').value;
    
    if (eventName) {
        const dayElement = document.getElementById(eventDay).querySelector('.events');
        const eventItem = document.createElement('div');
        eventItem.className = 'event-item';
        eventItem.textContent = eventName;

        dayElement.appendChild(eventItem);
        document.getElementById('event-name').value = ''; // Clear input
    } else {
        alert('Please enter an event name.');
    }
}

// Initialize the calendar on page load
window.onload = initCalendar;

// Add or remove items from the Pantry and Freezer
function editPantry() {
    let pantryList = document.querySelector('.pantry ul');
    let item = prompt('Enter the item to add to the Pantry (or leave blank to remove the last item):');

    if (item) {
        // Add a new item to the pantry
        let listItem = document.createElement('li');
        listItem.textContent = item;
        pantryList.appendChild(listItem);
    } else if (pantryList.children.length > 0) {
        // Remove the last item from the pantry if no input is provided
        pantryList.removeChild(pantryList.lastChild);
    } else {
        alert('The pantry is already empty.');
    }
}

function editFreezer() {
    let freezerList = document.querySelector('.freezer ul');
    let item = prompt('Enter the item to add to the Freezer (or leave blank to remove the last item):');

    if (item) {
        // Add a new item to the freezer
        let listItem = document.createElement('li');
        listItem.textContent = item;
        freezerList.appendChild(listItem);
    } else if (freezerList.children.length > 0) {
        // Remove the last item from the freezer if no input is provided
        freezerList.removeChild(freezerList.lastChild);
    } else {
        alert('The freezer is already empty.');
    }
}

// Attach event listeners to "Edit Pantry" and "Edit Freezer" buttons
document.querySelector('.edit-button-pantry').addEventListener('click', editPantry);
document.querySelector('.edit-button-freezer').addEventListener('click', editFreezer);
