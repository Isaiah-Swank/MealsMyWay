// Import necessary modules and services from Angular and Ionic frameworks
import { Component, OnInit } from '@angular/core';
import { RecipeService } from '../services/recipe.service';
import { AlertController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

/**
 * Component Decorator:
 * - selector: defines the custom HTML tag for this component.
 * - templateUrl: path to the component's HTML template.
 * - styleUrls: path to the component's SCSS styles.
 */
@Component({
  selector: 'app-tab2',
  templateUrl: 'calendar.page.html',
  styleUrls: ['calendar.page.scss']
})
/**
 * Tab2Page Component:
 * Implements the OnInit interface to perform initialization logic.
 * This component manages calendar events, meal planning, recipes, and shopping lists.
 */
export class Tab2Page implements OnInit {
  // ------------------------- Component Properties -------------------------

  // Date representing the start (Sunday) of the current week.
  currentWeekStart!: Date;
  // Array of week start dates (current week and previous weeks) used as plan options.
  plans: Date[] = [];
  // Currently selected week (as a Date) for which calendar events are managed.
  selectedPlan!: Date;
  // Array to store recipes fetched from the RecipeService.
  recipes: any[] = [];
  // The meal selected by the user to add to the calendar.
  selectedMeal: any = null;
  // The day (e.g., 'monday', 'tuesday') in the calendar on which the meal is to be scheduled.
  selectedDay: string = '';
  /**
   * Object mapping week keys (string representation of week start date) to daily events.
   * Each week contains keys for each day (sunday to saturday) holding arrays of meals/events.
   */
  events: { [week: string]: { [day: string]: any[] } } = {};
  // Holds the recipe details when a recipe is hovered over for preview.
  hoveredRecipe: any = null;
  // Aggregated shopping list for the current week; keys are ingredients and values are counts.
  shoppingList: { [ingredient: string]: number } = {};
  /**
   * Object mapping week keys to their corresponding shopping lists.
   * This stores shopping list data for different week plans.
   */
  shoppingLists: { [week: string]: { [ingredient: string]: number } } = {};
  // Flag to toggle the display of the shopping list.
  showShoppingList: boolean = false;
  // Array holding grocery items for display purposes.
  groceryListDisplay: string[] = [];
  // Stores the current logged-in user's data.
  currentUser: any = null;
  // Search query input for filtering or searching users.
  searchQuery: string = '';
  // Array to store the results of a user search.
  searchResults: any[] = [];
  // Flag to toggle the display of calendar sharing options.
  showShareCalendar: boolean = false;

  // ------------------------- Constructor & Dependency Injection -------------------------

  /**
   * Constructor: Injects required services.
   * - recipeService: Handles recipe-related API calls.
   * - alertController: Displays alert dialogs.
   * - http: Performs HTTP requests.
   * - router: Manages navigation between components.
   */
  constructor(
    private recipeService: RecipeService,
    private alertController: AlertController,
    private http: HttpClient,
    private router: Router
  ) {}

  // ------------------------- Lifecycle Hook -------------------------

  /**
   * ngOnInit:
   * Called after the component is initialized.
   * - Determines the current week start date.
   * - Sets up the selected week and generates a list of available week plans.
   * - Loads recipes and calendar events.
   * - Retrieves current user information from navigation state or local storage.
   */
  ngOnInit() {
    // Set the starting date (most recent Sunday) for the current week.
    this.setCurrentWeekStart();
    // Initialize selectedPlan to the current week.
    this.selectedPlan = this.currentWeekStart;
    // Generate week plans (current + previous weeks).
    this.generatePlans();
    // Load available recipes from the RecipeService.
    this.loadRecipes();

    // Retrieve current user from router navigation state (if available).
    const nav = this.router.getCurrentNavigation();
    if (nav && nav.extras && nav.extras.state && nav.extras.state['user']) {
      this.currentUser = nav.extras.state['user'];
      console.log('Calendar page got user from navigation:', this.currentUser);
    } else {
      // Fallback: retrieve the user from local storage if not passed via navigation.
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        this.currentUser = JSON.parse(storedUser);
        console.log('Calendar page loaded user from local storage:', this.currentUser);
      } else {
        console.warn('No user found from login or local storage. Calendar not loaded.');
      }
    }

    // Load calendar events for the current week if user information is available.
    if (this.currentUser) {
      this.loadCalendar();
    }
  }

  // ------------------------- Helper Methods -------------------------

  /**
   * setCurrentWeekStart:
   * Sets the 'currentWeekStart' property to the date of the most recent Sunday.
   */
  setCurrentWeekStart() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0: Sunday, 1: Monday, etc.
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek); // Calculate previous Sunday's date.
    this.currentWeekStart = sunday;
  }

  /**
   * generatePlans:
   * Generates an array of week start dates, including the current week and a number of previous weeks.
   * These dates are stored in the 'plans' array for user selection.
   */
  generatePlans() {
    // Add the current week start to the plans.
    this.plans.push(this.currentWeekStart);
    const numberOfPreviousWeeks = 19; // Number of previous weeks to generate.
    for (let i = 1; i <= numberOfPreviousWeeks; i++) {
      const previousSunday = new Date(this.currentWeekStart);
      previousSunday.setDate(this.currentWeekStart.getDate() - 7 * i);
      this.plans.push(previousSunday);
    }
  }

  /**
   * loadRecipes:
   * Fetches recipes using the RecipeService and stores them in the 'recipes' array.
   * Logs any errors encountered during the fetch.
   */
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

  // ------------------------- Getters -------------------------

  /**
   * currentWeekEvents (getter):
   * Retrieves the calendar events for the currently selected week.
   * Initializes an empty event structure for the week if none exists.
   * @returns An object mapping each day (sunday to saturday) to an array of events (meals).
   */
  get currentWeekEvents() {
    const weekKey = this.selectedPlan.toDateString();
    if (!this.events[weekKey]) {
      // Initialize an empty event array for each day of the week.
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

  /**
   * shoppingListKeys (getter):
   * Retrieves the list of ingredient keys from the current shopping list.
   * @returns An array of ingredient names.
   */
  get shoppingListKeys() {
    return Object.keys(this.shoppingList);
  }

  // ------------------------- Meal & Recipe Handling -------------------------

  /**
   * addMeal:
   * Adds the selected meal to the calendar on the chosen day.
   * If the meal details (ingredients/instructions) are incomplete and the meal comes from an API,
   * the method attempts to fetch the missing details before adding the meal.
   * Alerts the user if either the meal or day is not selected.
   */
  addMeal() {
    if (!this.selectedMeal || !this.selectedDay) {
      alert('Please select both a meal and a day.');
      return;
    }
    // Check if the meal lacks ingredients and instructions, and if so, fetch details from the API.
    if (
      (!this.selectedMeal.ingredients || this.selectedMeal.ingredients.length === 0) &&
      this.selectedMeal.api_id &&
      !this.selectedMeal.instructions
    ) {
      this.recipeService.getRecipeDetailsFromApi(this.selectedMeal.api_id).subscribe(
        (response: any) => {
          const mealData = response.meals[0];
          const ingredients: string[] = [];
          // Extract up to 20 ingredients from the API response.
          for (let i = 1; i <= 20; i++) {
            const ingredient = mealData[`strIngredient${i}`];
            if (ingredient) {
              ingredients.push(ingredient);
            } else {
              break;
            }
          }
          // Update the selected meal with fetched details.
          this.selectedMeal.ingredients = ingredients;
          this.selectedMeal.instructions = mealData.strInstructions;
          this.pushMeal();
        },
        (error) => {
          console.error('Error fetching recipe details:', error);
          this.pushMeal();
        }
      );
    } else {
      // If meal details are already available, add the meal directly.
      this.pushMeal();
    }
  }

  /**
   * pushMeal:
   * Helper method that clones the selected meal and adds it to the current week's events on the selected day.
   * Resets the meal and day selections after adding.
   */
  pushMeal() {
    const weekKey = this.selectedPlan.toDateString();
    // Ensure the week's events are initialized.
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
    // Clone the meal to avoid modifying the original object.
    const mealClone = JSON.parse(JSON.stringify(this.selectedMeal));
    // Add the cloned meal to the selected day.
    this.events[weekKey][this.selectedDay].push(mealClone);
    // Reset the selected meal and day.
    this.selectedMeal = null;
    this.selectedDay = '';
  }

  /**
   * onRecipeHover:
   * Handles the hover event on a recipe to fetch and display detailed information.
   * If the recipe originates from an API and lacks complete details, it attempts to fetch them.
   * Ensures the recipe's ingredients are in an array format before updating the hoveredRecipe.
   * @param recipe The recipe object being hovered over.
   */
  onRecipeHover(recipe: any) {
    if (recipe) {
      if (recipe.api_id && !recipe.instructions) {
        this.recipeService.getRecipeDetailsFromApi(recipe.api_id).subscribe(
          (response: any) => {
            const mealData = response.meals[0];
            const ingredients: string[] = [];
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
            this.hoveredRecipe = recipe;
          },
          (error) => {
            console.error('Error fetching recipe details from API:', error);
            this.hoveredRecipe = recipe;
          }
        );
      } else {
        // Ensure the ingredients are an array.
        if (typeof recipe.ingredients === 'string') {
          recipe.ingredients = recipe.ingredients
            .split(',')
            .map((ingredient: string) => ingredient.trim());
        } else {
          recipe.ingredients = recipe.ingredients || [];
        }
        recipe.instructions = recipe.instructions || '';
        this.hoveredRecipe = recipe;
      }
    } else {
      // Clear the hovered recipe if none is provided.
      this.hoveredRecipe = null;
    }
  }

  /**
   * onRecipeClick:
   * Processes a click on a recipe to ensure its details (ingredients/instructions) are properly formatted.
   * Updates the hoveredRecipe property with the clicked recipe.
   * @param recipe The recipe object that was clicked.
   */
  onRecipeClick(recipe: any) {
    if (recipe) {
      if (typeof recipe.ingredients === 'string') {
        recipe.ingredients = recipe.ingredients
          .split(',')
          .map((ingredient: string) => ingredient.trim());
      } else {
        recipe.ingredients = recipe.ingredients || [];
      }
      recipe.instructions = recipe.instructions || '';
      this.hoveredRecipe = recipe;
    } else {
      this.hoveredRecipe = null;
    }
  }

  /**
   * getIngredientsForMeal:
   * Retrieves the list of ingredients for a meal, handling different data formats.
   * If the ingredients are not already present and the meal comes from an API,
   * it attempts to fetch the details. Returns a Promise that resolves to an array of ingredients.
   * @param meal The meal object for which ingredients are to be retrieved.
   * @returns Promise that resolves to an array of ingredient strings.
   */
  getIngredientsForMeal(meal: any): Promise<string[]> {
    return new Promise((resolve) => {
      if (meal.ingredients) {
        if (typeof meal.ingredients === 'string') {
          let ingredients: string[] = [];
          if (meal.ingredients.indexOf(',') > -1) {
            ingredients = meal.ingredients.split(',').map((ingredient: string) => ingredient.trim());
          } else if (meal.ingredients.indexOf('\n') > -1) {
            ingredients = meal.ingredients.split('\n').map((ingredient: string) => ingredient.trim());
          } else {
            ingredients = [meal.ingredients];
          }
          ingredients = ingredients.filter(Boolean);
          resolve(ingredients);
          return;
        }
        if (Array.isArray(meal.ingredients)) {
          const ingredients = meal.ingredients.map((ing: string) => ing.trim()).filter(Boolean);
          resolve(ingredients);
          return;
        }
      }
      // Fetch ingredients from API if not present.
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

  // ------------------------- Shopping List & Calendar Saving -------------------------

  /**
   * generateShoppingList:
   * Initiates the process to create a shopping list by prompting the user for confirmation.
   * If the user confirms, calls createShoppingList() to generate and save the list.
   */
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
            this.createShoppingList();
          }
        }
      ]
    });
    await alert.present();
  }

  /**
   * createShoppingList:
   * Aggregates ingredients from all meals scheduled in the current week to generate a shopping list.
   * Saves the shopping list and calendar data to the server.
   */
  async createShoppingList() {
    const weekKey = this.selectedPlan.toDateString();
    const aggregatedList: { [ingredient: string]: number } = {};
    const weekEvents = this.currentWeekEvents;
    const ingredientPromises: Promise<string[]>[] = [];

    // Loop through each day of the week to gather ingredient promises for each meal.
    for (const day in weekEvents) {
      if (weekEvents.hasOwnProperty(day)) {
        for (const meal of weekEvents[day]) {
          ingredientPromises.push(this.getIngredientsForMeal(meal));
        }
      }
    }

    // Wait for all ingredient fetches to complete and aggregate counts.
    const allIngredientsArrays = await Promise.all(ingredientPromises);
    allIngredientsArrays.forEach((ingredients) => {
      ingredients.forEach((ingredient) => {
        const key = ingredient.trim().toLowerCase();
        if (key) {
          aggregatedList[key] = (aggregatedList[key] || 0) + 1;
        }
      });
    });

    // Save the aggregated shopping list for the current week.
    this.shoppingLists[weekKey] = aggregatedList;
    this.shoppingList = aggregatedList;
    console.log('Generated Shopping List for', weekKey, ':', aggregatedList);
    this.showShoppingList = true;

    // Ensure the current week's events are initialized.
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
    // Store grocery items (ingredient keys) in the calendar events.
    this.events[weekKey]['grocery'] = Object.keys(aggregatedList);

    // Verify user details before saving the calendar.
    if (!this.currentUser || !this.currentUser.id) {
      console.error('User details not loaded. Cannot save calendar.');
      return;
    }
    // Prepare payload with calendar data.
    const startDateString = this.selectedPlan.toISOString().split('T')[0];
    const payload = {
      user_ids: [this.currentUser.id],
      week: this.events[weekKey],
      start_date: startDateString
    };

    // Send a POST request to save the calendar (with shopping list) on the server.
    this.http.post<{ message: string }>(`${environment.apiUrl}/calendar`, payload)
      .subscribe(
        (response) => {
          console.log('Calendar saved successfully:', response);
        },
        (error) => {
          console.error('Error saving calendar:', error);
        }
      );
  }

  /**
   * viewShoppingList:
   * Displays the shopping list for the currently selected week by calling displayGroceryList().
   */
  viewShoppingList() {
    this.displayGroceryList();
  }

  /**
   * saveCalendar:
   * Saves the current calendar events for the selected week to the server.
   * Validates that user data is available, prepares a payload, and sends a POST request.
   */
  saveCalendar() {
    if (!this.currentUser || !this.currentUser.id) {
      console.error('User details not loaded. Cannot save calendar.');
      return;
    }
    const weekKey = this.selectedPlan.toDateString();
    const calendarData = this.events[weekKey] || {
      sunday: [],
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: []
    };
    const startDateString = this.selectedPlan.toISOString().split('T')[0];
    const payload = {
      user_ids: [this.currentUser.id],
      week: calendarData,
      start_date: startDateString
    };

    console.log('About to POST this payload:', payload);

    // Send a POST request to save the calendar data on the server.
    this.http.post<{ message: string }>(`${environment.apiUrl}/calendar`, payload)
      .subscribe(
        (response) => {
          console.log('Calendar saved successfully:', response);
        },
        (error) => {
          console.error('Error saving calendar:', error);
        }
      );
  }

  /**
   * loadCalendar:
   * Loads calendar events for the selected week from the server.
   * If data is found, it merges the loaded calendar data with local state; otherwise, initializes empty events.
   */
  loadCalendar() {
    if (!this.currentUser || !this.currentUser.id) {
      console.error('User details not loaded. Cannot load calendar.');
      return;
    }
    const weekParam = this.selectedPlan.toISOString().split('T')[0];
    // Send a GET request to fetch calendar data for the given week and user.
    this.http.get<any[]>(`${environment.apiUrl}/calendar?start_date=${weekParam}&user_id=${this.currentUser.id}`)
      .subscribe(
        (response) => {
          const weekKey = this.selectedPlan.toDateString();
          if (response.length > 0) {
            const calendarData = response[0];
            // Merge loaded calendar data with fallback empty arrays.
            this.events[weekKey] = {
              sunday: calendarData.week.sunday || [],
              monday: calendarData.week.monday || [],
              tuesday: calendarData.week.tuesday || [],
              wednesday: calendarData.week.wednesday || [],
              thursday: calendarData.week.thursday || [],
              friday: calendarData.week.friday || [],
              saturday: calendarData.week.saturday || [],
              grocery: calendarData.week.grocery || []
            };
            console.log('Loaded Calendar for week:', weekKey);
            console.log('User IDs in this calendar:', calendarData.user_ids);
          } else {
            // Initialize empty events if no data is returned.
            this.events[weekKey] = {
              sunday: [],
              monday: [],
              tuesday: [],
              wednesday: [],
              thursday: [],
              friday: [],
              saturday: [],
              grocery: []
            };
            console.log('No calendar data found for week:', weekKey);
          }
          console.log('Loaded Calendar!', this.events[weekKey]);
        },
        (error) => {
          console.error('Error loading calendar:', error);
        }
      );
  }

  /**
   * onPlanChange:
   * Triggered when the user selects a different week plan.
   * Loads the calendar for the newly selected week.
   */
  onPlanChange() {
    this.loadCalendar();
  }

  /**
   * displayGroceryList:
   * Displays the grocery list for the currently selected week.
   * If no grocery list is available, alerts the user.
   */
  displayGroceryList() {
    const weekKey = this.selectedPlan.toDateString();
    const loadedWeek = this.events[weekKey];
    console.log("Loaded week events for", weekKey, loadedWeek);
    const groceryList = loadedWeek ? loadedWeek['grocery'] : null;
    if (!groceryList || groceryList.length === 0) {
      alert('No grocery list has been generated yet for this week. Please generate a grocery list first.');
    } else {
      console.log('Grocery list for the week:', groceryList);
      this.groceryListDisplay = groceryList;
      this.showShoppingList = true;
    }
  }

  // ------------------------- Calendar Sharing & User Search -------------------------

  /**
   * toggleShareCalendar:
   * Toggles the display state of the calendar sharing interface.
   */
  toggleShareCalendar() {
    this.showShareCalendar = !this.showShareCalendar;
  }

  /**
   * searchUsers:
   * Searches for users based on the input search query.
   * Sends a GET request to the server to fetch matching users.
   * Clears results if the search query is empty.
   */
  searchUsers() {
    if (this.searchQuery.trim() === '') {
      this.searchResults = [];
      return;
    }
  
    this.http.get<any[]>(`${environment.apiUrl}/users?username=${this.searchQuery}`)
      .subscribe(
        (response) => {
          this.searchResults = response;
        },
        (error) => {
          console.error('Error searching users:', error);
          this.searchResults = [];
        }
      );
  }

  /**
   * addUserToCalendar:
   * Adds a selected user to the calendar's shared user list.
   * Updates the calendar data locally and sends a PUT request to update it on the server.
   * @param user The user object to be added to the calendar.
   */
  addUserToCalendar(user: any) {
    const weekKey = this.selectedPlan.toDateString();
    const calendarData = this.events[weekKey] || {
      sunday: [],
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      user_ids: [this.currentUser.id] // Initialize with the current user's ID if missing.
    };
  
    if (!calendarData['user_ids']) {
      calendarData['user_ids'] = [this.currentUser.id];
    }
  
    // Add the new user's ID if it's not already included.
    if (!calendarData['user_ids'].includes(user.id)) {
      calendarData['user_ids'].push(user.id);
    }
  
    const startDateString = this.selectedPlan.toISOString().split('T')[0];
    const payload = {
      user_ids: calendarData['user_ids'],
      week: calendarData,
      start_date: startDateString
    };
  
    // Send a PUT request to update the calendar with the added user.
    this.http.put<{ message: string }>(`${environment.apiUrl}/calendar`, payload)
      .subscribe(
        (response) => {
          console.log('User added to calendar successfully:', response);
        },
        (error) => {
          console.error('Error adding user to calendar:', error);
        }
      );
  }
}
