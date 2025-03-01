// Importing required modules and services from Angular and Ionic frameworks
import { Component, OnInit } from '@angular/core';
import { RecipeService } from '../services/recipe.service';
import { AlertController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

// Component decorator which defines the metadata for this page/component
@Component({
  selector: 'app-tab2',
  templateUrl: 'calendar.page.html',
  styleUrls: ['calendar.page.scss']
})
// Exporting the Tab2Page class which implements the OnInit lifecycle hook
export class Tab2Page implements OnInit {
  // Declaration of class properties
  currentWeekStart!: Date;  // Date representing the start of the current week
  plans: Date[] = [];       // Array to hold multiple week start dates (plans)
  selectedPlan!: Date;      // Currently selected week's start date
  recipes: any[] = [];      // Array to store recipes fetched from the RecipeService
  selectedMeal: any = null; // Currently selected meal
  selectedDay: string = ''; // Day selected in the calendar
  // Object to store events for each week, mapped by day names
  events: { [week: string]: { [day: string]: any[] } } = {};
  hoveredRecipe: any = null; // Recipe currently hovered by the user (for preview details)
  shoppingList: { [ingredient: string]: number } = {};  // Aggregated shopping list for current week
  // Object to store shopping lists for each week
  shoppingLists: { [week: string]: { [ingredient: string]: number } } = {};
  showShoppingList: boolean = false;  // Flag to toggle shopping list display
  groceryListDisplay: string[] = [];  // Array to hold grocery items for display
  currentUser: any = null;  // Object to store current user's data

  // Dependency injection of required services in the constructor
  constructor(
    private recipeService: RecipeService,
    private alertController: AlertController,
    private http: HttpClient,
    private router: Router
  ) {}

  // Lifecycle hook called after component initialization
  ngOnInit() {
    // Set the starting date of the current week
    this.setCurrentWeekStart();
    // Initialize selectedPlan to current week start
    this.selectedPlan = this.currentWeekStart;
    // Generate previous weeks plans
    this.generatePlans();
    // Load available recipes from the service
    this.loadRecipes();

    // Try to retrieve the user from router navigation state
    const nav = this.router.getCurrentNavigation();
    if (nav && nav.extras && nav.extras.state && nav.extras.state['user']) {
      this.currentUser = nav.extras.state['user'];
      console.log('Calendar page got user from navigation:', this.currentUser);
    } else {
      // Fallback: retrieve the user from local storage if not passed through navigation
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        this.currentUser = JSON.parse(storedUser);
        console.log('Calendar page loaded user from local storage:', this.currentUser);
      } else {
        console.warn('No user found from login or local storage. Calendar not loaded.');
      }
    }

    // Load the calendar events if a user is available
    if (this.currentUser) {
      this.loadCalendar();
    }
  }

  // Method to set currentWeekStart to the most recent Sunday
  setCurrentWeekStart() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // Sunday is 0, Monday is 1, etc.
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek); // Calculate previous Sunday's date
    this.currentWeekStart = sunday;
  }

  // Generate an array of week start dates (current week + previous weeks)
  generatePlans() {
    this.plans.push(this.currentWeekStart);
    const numberOfPreviousWeeks = 19; // Number of past weeks to generate
    for (let i = 1; i <= numberOfPreviousWeeks; i++) {
      const previousSunday = new Date(this.currentWeekStart);
      previousSunday.setDate(this.currentWeekStart.getDate() - 7 * i);
      this.plans.push(previousSunday);
    }
  }

  // Load recipes using RecipeService and assign them to the recipes array
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

  // Getter to retrieve or initialize the events for the selected week
  get currentWeekEvents() {
    const weekKey = this.selectedPlan.toDateString();
    if (!this.events[weekKey]) {
      // Initialize each day of the week with an empty array for events
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

  // Add a meal to the selected day after checking that meal and day are selected
  addMeal() {
    if (!this.selectedMeal || !this.selectedDay) {
      alert('Please select both a meal and a day.');
      return;
    }
    // If the selected meal lacks ingredients and instructions, fetch details from the API
    if (
      (!this.selectedMeal.ingredients || this.selectedMeal.ingredients.length === 0) &&
      this.selectedMeal.api_id &&
      !this.selectedMeal.instructions
    ) {
      this.recipeService.getRecipeDetailsFromApi(this.selectedMeal.api_id).subscribe(
        (response: any) => {
          const mealData = response.meals[0];
          const ingredients: string[] = [];
          // Loop to extract up to 20 ingredients from the API response
          for (let i = 1; i <= 20; i++) {
            const ingredient = mealData[`strIngredient${i}`];
            if (ingredient) {
              ingredients.push(ingredient);
            } else {
              break;
            }
          }
          // Set the fetched ingredients and instructions on the selectedMeal object
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
      // If details already exist, directly push the meal to the events
      this.pushMeal();
    }
  }

  // Helper method to add the selected meal to the current week's events on the chosen day
  pushMeal() {
    const weekKey = this.selectedPlan.toDateString();
    // Ensure that the week is initialized in the events object
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
    // Clone the meal object to avoid reference issues
    const mealClone = JSON.parse(JSON.stringify(this.selectedMeal));
    // Add the meal to the specific day of the week
    this.events[weekKey][this.selectedDay].push(mealClone);
    // Reset selectedMeal and selectedDay after adding
    this.selectedMeal = null;
    this.selectedDay = '';
  }

  // Handle the hover event on a recipe to fetch and display its details
  onRecipeHover(recipe: any) {
    if (recipe) {
      // If the recipe is from an API and lacks instructions, fetch its details
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
        // If recipe details exist, ensure ingredients are in array format
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
      // If no recipe is hovered, clear the hoveredRecipe variable
      this.hoveredRecipe = null;
    }
  }

  onRecipeClick(recipe: any) {
    if (recipe) {
      this.hoveredRecipe = recipe;
    } else {
      this.hoveredRecipe = null;
    }
  }

  // Retrieve the list of ingredients for a meal, handling different formats
  getIngredientsForMeal(meal: any): Promise<string[]> {
    return new Promise((resolve) => {
      // If ingredients are already available on the meal object
      if (meal.ingredients) {
        if (typeof meal.ingredients === 'string') {
          let ingredients: string[] = [];
          // Split by comma if available, otherwise by newline, or take the entire string
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
      // If ingredients are not present and meal comes from an API, fetch details
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

  // Getter to retrieve the keys for the shopping list items (ingredients)
  get shoppingListKeys() {
    return Object.keys(this.shoppingList);
  }

  // Method to generate a shopping list after user confirmation via an alert dialog
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

  // Create a shopping list by aggregating ingredients from meals across the week
  async createShoppingList() {
    const weekKey = this.selectedPlan.toDateString();
    const aggregatedList: { [ingredient: string]: number } = {};
    const weekEvents = this.currentWeekEvents;
    const ingredientPromises: Promise<string[]>[] = [];

    // Loop through each day of the week and add promises for fetching ingredients
    for (const day in weekEvents) {
      if (weekEvents.hasOwnProperty(day)) {
        for (const meal of weekEvents[day]) {
          ingredientPromises.push(this.getIngredientsForMeal(meal));
        }
      }
    }

    // Resolve all promises and aggregate ingredient counts
    const allIngredientsArrays = await Promise.all(ingredientPromises);
    allIngredientsArrays.forEach((ingredients) => {
      ingredients.forEach((ingredient) => {
        const key = ingredient.trim().toLowerCase();
        if (key) {
          aggregatedList[key] = (aggregatedList[key] || 0) + 1;
        }
      });
    });

    // Save the generated shopping list into the corresponding objects
    this.shoppingLists[weekKey] = aggregatedList;
    this.shoppingList = aggregatedList;
    console.log('Generated Shopping List for', weekKey, ':', aggregatedList);
    this.showShoppingList = true;

    // Ensure that the week events are initialized
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
    // Store the list of ingredients as 'grocery' items in the events object
    this.events[weekKey]['grocery'] = Object.keys(aggregatedList);

    // Check if user details are available before saving the calendar
    if (!this.currentUser || !this.currentUser.id) {
      console.error('User details not loaded. Cannot save calendar.');
      return;
    }
    // Prepare payload with calendar data to be saved
    const startDateString = this.selectedPlan.toISOString().split('T')[0];
    const payload = {
      user_ids: [this.currentUser.id],
      week: this.events[weekKey],
      start_date: startDateString
    };

    // Send a POST request to save the calendar on the server
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

  // Display the shopping list for the selected week
  viewShoppingList() {
    this.displayGroceryList();
  }

  // Save the current calendar events to the server
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

    // Send the calendar data to the server via a POST request
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

  // Load calendar events for the selected week from the server
  loadCalendar() {
    if (!this.currentUser || !this.currentUser.id) {
      console.error('User details not loaded. Cannot load calendar.');
      return;
    }
    const weekParam = this.selectedPlan.toISOString().split('T')[0];
    this.http.get<any[]>(`${environment.apiUrl}/calendar?start_date=${weekParam}&user_id=${this.currentUser.id}`)
      .subscribe(
        (response) => {
          const weekKey = this.selectedPlan.toDateString();
          if (response.length > 0) {
            const calendarData = response[0];
            // Merge loaded week data with a fallback for grocery items
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
          } else {
            // Initialize empty events if no data is returned
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
          }
          console.log('Loaded Calendar!', this.events[weekKey]);
        },
        (error) => {
          console.error('Error loading calendar:', error);
        }
      );
  }

  // Called when the user changes the plan (week), triggering a calendar load
  onPlanChange() {
    this.loadCalendar();
  }

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
}
