import { Component, OnInit } from '@angular/core';
import { RecipeService } from '../services/recipe.service';
import { AlertController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tab2',
  templateUrl: 'calendar.page.html',
  styleUrls: ['calendar.page.scss']
})
export class Tab2Page implements OnInit {
  // Date object representing the start (Sunday) of the current week.
  currentWeekStart!: Date;
  // Array of past week start dates (including current week).
  plans: Date[] = [];
  // The week currently selected by the user.
  selectedPlan!: Date;
  // Array holding all available recipes fetched from the backend.
  recipes: any[] = [];
  // The meal (recipe) currently selected by the user.
  selectedMeal: any = null;
  // The day (e.g., 'monday', 'tuesday') selected for adding a meal.
  selectedDay: string = '';
  // Object storing events for each week and day.
  // Format: { [weekDateString]: { sunday: [], monday: [], ... } }
  events: { [week: string]: { [day: string]: any[] } } = {};
  // Recipe details that appear when the user hovers over a recipe.
  hoveredRecipe: any = null;
  // Aggregated shopping list for the current week (ingredient: count).
  shoppingList: { [ingredient: string]: number } = {};
  // Shopping lists stored for different weeks.
  shoppingLists: { [week: string]: { [ingredient: string]: number } } = {};
  // Boolean flag to indicate if the shopping list should be displayed.
  showShoppingList: boolean = false;
  // Currently logged in user, passed from the login page.
  currentUser: any = null;

  constructor(
    private recipeService: RecipeService,
    private alertController: AlertController,
    private http: HttpClient,
    private router: Router
  ) {}

  // Lifecycle hook that runs once the component is initialized.
  ngOnInit() {
    // Set the start of the current week (Sunday).
    this.setCurrentWeekStart();
    // By default, select the current week.
    this.selectedPlan = this.currentWeekStart;
    // Generate a list of past weeks for the calendar plans.
    this.generatePlans();
    // Load all available recipes from the backend.
    this.loadRecipes();

    // Retrieve the current user from the router's state (passed from the login page).
    const nav = this.router.getCurrentNavigation();
    if (nav && nav.extras && nav.extras.state && nav.extras.state['user']) {
      this.currentUser = nav.extras.state['user'];
      console.log('Calendar page got user from navigation:', this.currentUser);
      // Load the calendar data for the selected week.
      this.loadCalendar();
    } else {
      console.warn('No user passed from login to Calendar. Calendar not loaded.');
    }
  }

  // Sets currentWeekStart to the most recent Sunday.
  setCurrentWeekStart() {
    const today = new Date();
    // Get the current day of the week (0 = Sunday, 1 = Monday, etc.)
    const dayOfWeek = today.getDay();
    const sunday = new Date(today);
    // Adjust the date backward by the day index to reach Sunday.
    sunday.setDate(today.getDate() - dayOfWeek);
    this.currentWeekStart = sunday;
  }

  // Generates an array of past week start dates (including the current week).
  generatePlans() {
    // Start with the current week.
    this.plans.push(this.currentWeekStart);
    const numberOfPreviousWeeks = 19;
    for (let i = 1; i <= numberOfPreviousWeeks; i++) {
      // Create a new Date for each previous Sunday.
      const previousSunday = new Date(this.currentWeekStart);
      previousSunday.setDate(this.currentWeekStart.getDate() - 7 * i);
      this.plans.push(previousSunday);
    }
  }

  // Loads recipes from the RecipeService.
  loadRecipes() {
    this.recipeService.getRecipes().subscribe(
      (recipes) => {
        this.recipes = recipes;
      },
      (error) => {
        console.error('Error fetching recipes:', error);
      }
    );
  }

  // Getter that returns the events for the currently selected week.
  // If events for the week don't exist, it initializes an empty structure.
  get currentWeekEvents() {
    const weekKey = this.selectedPlan.toDateString();
    // Initialize the week object if it doesn't exist yet.
    if (!this.events[weekKey]) {
      this.events[weekKey] = {
        sunday: [],
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: []
      };
    }
    return this.events[weekKey];
  }

  // Adds a selected meal to the selected day.
  addMeal() {
    // Ensure both a meal and day have been selected.
    if (!this.selectedMeal || !this.selectedDay) {
      alert('Please select both a meal and a day.');
      return;
    }
    // Check if the meal lacks ingredients and instructions (common for external API data).
    if (
      (!this.selectedMeal.ingredients || this.selectedMeal.ingredients.length === 0) &&
      this.selectedMeal.api_id &&
      !this.selectedMeal.instructions
    ) {
      // Fetch the full details of the meal from the API.
      this.recipeService.getRecipeDetailsFromApi(this.selectedMeal.api_id).subscribe(
        (response: any) => {
          const mealData = response.meals[0];
          const ingredients: string[] = [];
          // Loop through possible ingredient keys until no more ingredients are found.
          for (let i = 1; i <= 20; i++) {
            const ingredient = mealData[`strIngredient${i}`];
            if (ingredient) {
              ingredients.push(ingredient);
            } else {
              break;
            }
          }
          // Assign the fetched ingredients and instructions to the selected meal.
          this.selectedMeal.ingredients = ingredients;
          this.selectedMeal.instructions = mealData.strInstructions;
          // Proceed to add the meal to the calendar.
          this.pushMeal();
        },
        (error) => {
          console.error('Error fetching recipe details:', error);
          // Even if there's an error, attempt to push the meal without additional details.
          this.pushMeal();
        }
      );
    } else {
      // If the meal already has details, add it directly.
      this.pushMeal();
    }
  }

  // Pushes the selected meal to the events of the selected week and day.
  pushMeal() {
    const weekKey = this.selectedPlan.toDateString();
    // Initialize week events if they don't exist.
    if (!this.events[weekKey]) {
      this.events[weekKey] = {
        sunday: [],
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: []
      };
    }
    // Clone the meal object to avoid direct reference issues.
    const mealClone = JSON.parse(JSON.stringify(this.selectedMeal));
    // Add the meal clone to the specific day within the week's events.
    this.events[weekKey][this.selectedDay].push(mealClone);
    // Reset the selected meal and day after adding.
    this.selectedMeal = null;
    this.selectedDay = '';
  }

  // Handles hovering over a recipe to display its details.
  onRecipeHover(recipe: any) {
    if (recipe) {
      // If the recipe comes from an API and is missing instructions, fetch details.
      if (recipe.api_id && !recipe.instructions) {
        this.recipeService.getRecipeDetailsFromApi(recipe.api_id).subscribe(
          (response: any) => {
            const mealData = response.meals[0];
            const ingredients: string[] = [];
            // Retrieve ingredients from the fetched data.
            for (let i = 1; i <= 20; i++) {
              const ingredient = mealData[`strIngredient${i}`];
              if (ingredient) {
                ingredients.push(ingredient);
              } else {
                break;
              }
            }
            recipe.ingredients = ingredients;
            recipe.instructions = mealData.strInstructions;
            // Set this recipe as the one being hovered over.
            this.hoveredRecipe = recipe;
          },
          (error) => {
            console.error('Error fetching recipe details from API:', error);
            this.hoveredRecipe = recipe;
          }
        );
      } else {
        // If ingredients are stored as a comma-separated string, split them into an array.
        if (typeof recipe.ingredients === 'string') {
          recipe.ingredients = recipe.ingredients
            .split(',')
            .map((ingredient: string) => ingredient.trim());
        } else {
          // Ensure ingredients is at least an empty array.
          recipe.ingredients = recipe.ingredients || [];
        }
        // Ensure instructions property is set (even if empty).
        recipe.instructions = recipe.instructions || '';
        // Set the hovered recipe.
        this.hoveredRecipe = recipe;
      }
    } else {
      // Clear the hovered recipe when no recipe is being hovered.
      this.hoveredRecipe = null;
    }
  }

  // Returns a promise that resolves to an array of ingredients for a given meal.
  getIngredientsForMeal(meal: any): Promise<string[]> {
    return new Promise((resolve) => {
      // If the meal already has ingredients:
      if (meal.ingredients) {
        if (typeof meal.ingredients === 'string') {
          let ingredients: string[] = [];
          // Check for comma-separated values.
          if (meal.ingredients.indexOf(',') > -1) {
            ingredients = meal.ingredients.split(',').map((ingredient: string) => ingredient.trim());
          } 
          // Check for newline-separated values.
          else if (meal.ingredients.indexOf('\n') > -1) {
            ingredients = meal.ingredients.split('\n').map((ingredient: string) => ingredient.trim());
          } else {
            ingredients = [meal.ingredients];
          }
          // Filter out any empty strings.
          ingredients = ingredients.filter(Boolean);
          resolve(ingredients);
          return;
        }
        if (Array.isArray(meal.ingredients)) {
          // Trim each ingredient and remove any empty strings.
          const ingredients = meal.ingredients.map((ing: string) => ing.trim()).filter(Boolean);
          resolve(ingredients);
          return;
        }
      }
      // If the meal is from an API and missing instructions, fetch the details.
      if (meal.api_id && !meal.instructions) {
        this.recipeService.getRecipeDetailsFromApi(meal.api_id).subscribe(
          (response: any) => {
            const mealData = response.meals[0];
            const ingredients: string[] = [];
            for (let i = 1; i <= 20; i++) {
              const ingredient = mealData[`strIngredient${i}`];
              if (ingredient) {
                ingredients.push(ingredient.trim());
              } else {
                break;
              }
            }
            // Update meal with the fetched ingredients and instructions.
            meal.ingredients = ingredients;
            meal.instructions = mealData.strInstructions;
            resolve(ingredients);
          },
          (error) => {
            console.error('Error fetching details for meal', meal.title, error);
            resolve([]);
          }
        );
      } else {
        resolve([]);
      }
    });
  }

  // Getter for the keys (ingredients) in the shopping list.
  get shoppingListKeys() {
    return Object.keys(this.shoppingList);
  }

  // Displays a confirmation alert before generating the shopping list.
  async generateShoppingList() {
    const alert = await this.alertController.create({
      header: 'Confirm',
      message: 'Are you sure you want to create your shopping list? The items in your pantry will be removed.',
      buttons: [
        {
          text: 'Wait a minute',
          role: 'cancel',
          handler: () => {
            console.log('Shopping list creation cancelled.');
          }
        },
        {
          text: 'Create List',
          handler: () => {
            // Proceed to create the shopping list if confirmed.
            this.createShoppingList();
          }
        }
      ]
    });
    await alert.present();
  }

  // Aggregates ingredients from all meals in the selected week to create a shopping list.
  async createShoppingList() {
    const weekKey = this.selectedPlan.toDateString();
    const aggregatedList: { [ingredient: string]: number } = {};
    const weekEvents = this.currentWeekEvents;
    const ingredientPromises: Promise<string[]>[] = [];

    // Loop over each day in the week and collect promises for fetching ingredients.
    for (const day in weekEvents) {
      if (weekEvents.hasOwnProperty(day)) {
        for (const meal of weekEvents[day]) {
          ingredientPromises.push(this.getIngredientsForMeal(meal));
        }
      }
    }

    // Wait for all ingredient arrays to be fetched.
    const allIngredientsArrays = await Promise.all(ingredientPromises);
    // Aggregate counts for each ingredient.
    allIngredientsArrays.forEach((ingredients) => {
      ingredients.forEach((ingredient) => {
        const key = ingredient.trim().toLowerCase();
        if (key) {
          aggregatedList[key] = (aggregatedList[key] || 0) + 1;
        }
      });
    });

    // Save the aggregated list to the shoppingLists object for this week.
    this.shoppingLists[weekKey] = aggregatedList;
    // Update the current shoppingList to be displayed.
    this.shoppingList = aggregatedList;
    console.log('Generated Shopping List for', weekKey, ':', aggregatedList);
    this.showShoppingList = true;

    // Ensure the user is loaded before saving the calendar.
    if (!this.currentUser || !this.currentUser.id) {
      console.error('User details not loaded. Cannot save calendar.');
      return;
    }
    // Format the start date to YYYY-MM-DD.
    const startDateString = this.selectedPlan.toISOString().split('T')[0];
    // Prepare the payload to save the shopping list as a calendar entry.
    const payload = {
      user_ids: [this.currentUser.id],
      week: aggregatedList,
      start_date: startDateString
    };

    // POST the shopping list to the server.
    this.http.post<{ message: string }>('http://localhost:3000/calendar', payload)
      .subscribe(
        (response) => {
          console.log('Calendar saved successfully:', response);
        },
        (error) => {
          console.error('Error saving calendar:', error);
        }
      );
  }

  // Displays the shopping list if one has been generated for the selected week.
  viewShoppingList() {
    const weekKey = this.selectedPlan.toDateString();
    if (!this.shoppingLists[weekKey] || Object.keys(this.shoppingLists[weekKey]).length === 0) {
      alert('No shopping list has been generated yet for this week. Please generate a shopping list first.');
    } else {
      this.shoppingList = this.shoppingLists[weekKey];
      this.showShoppingList = true;
    }
  }

  // Saves the calendar events for the selected week.
  saveCalendar() {
    if (!this.currentUser || !this.currentUser.id) {
      console.error('User details not loaded. Cannot save calendar.');
      return;
    }
    const weekKey = this.selectedPlan.toDateString();
    // Get the events for the selected week, or initialize an empty calendar if none exist.
    const calendarData = this.events[weekKey] || {
      sunday: [],
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: []
    };
    // Format the start date to a YYYY-MM-DD string.
    const startDateString = this.selectedPlan.toISOString().split('T')[0];
    // Prepare the payload to be sent to the server.
    const payload = {
      user_ids: [this.currentUser.id],
      week: calendarData,
      start_date: startDateString
    };

    console.log('About to POST this payload:', payload);

    // Send a POST request to save the calendar.
    this.http.post<{ message: string }>('http://localhost:3000/calendar', payload)
      .subscribe(
        (response) => {
          console.log('Calendar saved successfully:', response);
        },
        (error) => {
          console.error('Error saving calendar:', error);
        }
      );
  }

  // Loads the calendar data for the selected week from the server.
  loadCalendar() {
    if (!this.currentUser || !this.currentUser.id) {
      console.error('User details not loaded. Cannot load calendar.');
      return;
    }
    // Format the selected plan's date to "YYYY-MM-DD" to match the saved format.
    const weekParam = this.selectedPlan.toISOString().split('T')[0];
    // Send a GET request with the start_date and user_id as query parameters.
    this.http.get<any[]>(`http://localhost:3000/calendar?start_date=${weekParam}&user_id=${this.currentUser.id}`)
      .subscribe(
        (response) => {
          // If a calendar entry is found, update the events for the selected week.
          if (response.length > 0) {
            const calendarData = response[0];
            this.events[this.selectedPlan.toDateString()] = calendarData.week;
          } else {
            // If not found, initialize an empty calendar for the week.
            this.events[this.selectedPlan.toDateString()] = {
              sunday: [],
              monday: [],
              tuesday: [],
              wednesday: [],
              thursday: [],
              friday: [],
              saturday: []
            };
          }
          console.log('Loaded Calendar!');
        },
        (error) => {
          console.error('Error loading calendar:', error);
        }
      );
  }

  // Called when the user selects a different week from the dropdown.
  onPlanChange() {
    this.loadCalendar();
  }
}
