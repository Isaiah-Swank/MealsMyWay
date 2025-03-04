import { Component, OnInit } from '@angular/core';
import { RecipeService } from '../services/recipe.service';
import { AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CalendarService } from '../services/calendar.service';
import { UserService } from '../services/user.service';
import { environment } from '../../environments/environment';

/**
 * Tab2Page Component (Calendar Page)
 * This component manages the weekly meal prep calendar.
 * It allows users to view, add, and manage meals; generate a shopping list;
 * and share the calendar with other users.
 */
@Component({
  selector: 'app-tab2',
  templateUrl: 'calendar.page.html',
  styleUrls: ['calendar.page.scss']
})
export class Tab2Page implements OnInit {
  // ------------------------- Component Properties -------------------------
  currentWeekStart!: Date;                         // The starting date (Sunday) of the current week.
  plans: Date[] = [];                              // Array of week start dates (current & previous weeks).
  selectedPlan!: Date;                             // The currently selected week.
  recipes: any[] = [];                             // List of available recipes.
  selectedMeal: any = null;                        // The meal selected to be added.
  selectedDay: string = '';                        // The day (e.g. "monday") where the meal will be scheduled.
  events: { [week: string]: { [day: string]: any[] } } = {}; // Mapping of week (by date) to daily meal events.
  hoveredRecipe: any = null;                       // Recipe that is currently hovered for details.
  shoppingList: { [ingredient: string]: number } = {};      // Aggregated shopping list for the week.
  shoppingLists: { [week: string]: { [ingredient: string]: number } } = {}; // Saved shopping lists per week.
  showShoppingList: boolean = false;               // Flag to toggle display of shopping list view.
  groceryListDisplay: string[] = [];               // List of grocery items to display.
  currentUser: any = null;                         // The logged-in user.
  searchQuery: string = '';                        // Input string for user search.
  searchResults: any[] = [];                       // List of users found via search.
  showShareCalendar: boolean = false;              // Flag to show/hide calendar sharing interface.

  // ------------------------- Constructor & Dependency Injection -------------------------
  constructor(
    private recipeService: RecipeService,
    private alertController: AlertController,
    private router: Router,
    private calendarService: CalendarService,
    private http: HttpClient,
    private userService: UserService  // Injecting the UserService for user search and management.
  ) {}

  // ------------------------- Lifecycle Hook -------------------------
  /**
   * ngOnInit
   * Initializes the component:
   * - Sets the starting date of the current week.
   * - Generates the list of available week plans.
   * - Loads recipes.
   * - Retrieves the logged-in user either from navigation state or local storage.
   * - Loads the calendar for the current user.
   */
  ngOnInit() {
    this.setCurrentWeekStart();
    this.selectedPlan = this.currentWeekStart;
    this.generatePlans();
    this.loadRecipes();

    // Try to retrieve user from router navigation state first...
    const nav = this.router.getCurrentNavigation();
    if (nav && nav.extras && nav.extras.state && nav.extras.state['user']) {
      this.currentUser = nav.extras.state['user'];
      console.log('Calendar page got user from navigation:', this.currentUser);
    } else {
      // ...or fall back to local storage
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        this.currentUser = JSON.parse(storedUser);
        console.log('Calendar page loaded user from local storage:', this.currentUser);
      } else {
        console.warn('No user found from login or local storage. Calendar not loaded.');
      }
    }

    // If a user is available, load their calendar
    if (this.currentUser) {
      this.loadCalendar();
    }
  }

  // ------------------------- Helper Methods -------------------------
  /**
   * setCurrentWeekStart
   * Determines the most recent Sunday (start of the current week) and sets it.
   */
  setCurrentWeekStart() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // Sunday = 0, Monday = 1, etc.
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek);
    this.currentWeekStart = sunday;
  }

  /**
   * generatePlans
   * Populates the list of week plans including the current week and a set number of previous weeks.
   */
  generatePlans() {
    this.plans.push(this.currentWeekStart);
    const numberOfPreviousWeeks = 19;
    for (let i = 1; i <= numberOfPreviousWeeks; i++) {
      const previousSunday = new Date(this.currentWeekStart);
      previousSunday.setDate(this.currentWeekStart.getDate() - 7 * i);
      this.plans.push(previousSunday);
    }
  }

  /**
   * loadRecipes
   * Calls the RecipeService to fetch available recipes and assigns them to the local recipes array.
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
   * currentWeekEvents (getter)
   * Retrieves the events for the currently selected week.
   * If the events for that week are not initialized, they are set up with empty arrays for each day.
   */
  get currentWeekEvents() {
    const weekKey = this.selectedPlan.toDateString();
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

  /**
   * shoppingListKeys (getter)
   * Returns the list of ingredient keys in the current shopping list.
   */
  get shoppingListKeys() {
    return Object.keys(this.shoppingList);
  }

  // ------------------------- Meal & Recipe Handling -------------------------
  /**
   * addMeal
   * Handles adding a meal to the calendar.
   * - Validates that both a meal and day are selected.
   * - If necessary, fetches detailed recipe info before adding.
   */
  addMeal() {
    if (!this.selectedMeal || !this.selectedDay) {
      alert('Please select both a meal and a day.');
      return;
    }
    if (
      (!this.selectedMeal.ingredients || this.selectedMeal.ingredients.length === 0) &&
      this.selectedMeal.api_id &&
      !this.selectedMeal.instructions
    ) {
      // Fetch details if missing
      this.recipeService.getRecipeDetailsFromApi(this.selectedMeal.api_id).subscribe(
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
      this.pushMeal();
    }
  }

  /**
   * pushMeal
   * Clones the selected meal and pushes it into the calendar events for the selected day.
   * Also resets the meal and day selection.
   */
  pushMeal() {
    const weekKey = this.selectedPlan.toDateString();
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
    const mealClone = JSON.parse(JSON.stringify(this.selectedMeal));
    this.events[weekKey][this.selectedDay].push(mealClone);
    this.selectedMeal = null;
    this.selectedDay = '';
  }

  /**
   * onRecipeHover
   * When a recipe is hovered, this method ensures the detailed information is loaded
   * (fetching it if needed) and sets it as the hoveredRecipe.
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
        // Ensure ingredients are in array format
        if (typeof recipe.ingredients === 'string') {
          recipe.ingredients = recipe.ingredients.split(',').map((ingredient: string) => ingredient.trim());
        } else {
          recipe.ingredients = recipe.ingredients || [];
        }
        recipe.instructions = recipe.instructions || '';
        this.hoveredRecipe = recipe;
      }
    } else {
      this.hoveredRecipe = null;
    }
  }

  /**
   * onRecipeClick
   * Handles a recipe click by ensuring the recipe details are properly formatted and sets it as hoveredRecipe.
   */
  onRecipeClick(recipe: any) {
    if (recipe) {
      if (typeof recipe.ingredients === 'string') {
        recipe.ingredients = recipe.ingredients.split(',').map((ingredient: string) => ingredient.trim());
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
   * getIngredientsForMeal
   * Returns a promise resolving to the list of ingredients for a meal.
   * If ingredients are not already available, attempts to fetch them from the API.
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
   * generateShoppingList
   * Displays a confirmation alert and, upon confirmation, creates the shopping list for the week.
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
   * createShoppingList
   * Aggregates ingredients from all meals in the current week and generates a shopping list.
   * Also saves the calendar with the generated grocery list.
   */
  async createShoppingList() {
    const weekKey = this.selectedPlan.toDateString();
    const aggregatedList: { [ingredient: string]: number } = {};
    const weekEvents = this.currentWeekEvents;
    const ingredientPromises: Promise<string[]>[] = [];

    // Gather ingredient lists from all meals
    for (const day in weekEvents) {
      if (weekEvents.hasOwnProperty(day)) {
        for (const meal of weekEvents[day]) {
          ingredientPromises.push(this.getIngredientsForMeal(meal));
        }
      }
    }

    const allIngredientsArrays = await Promise.all(ingredientPromises);
    allIngredientsArrays.forEach((ingredients) => {
      ingredients.forEach((ingredient) => {
        const key = ingredient.trim().toLowerCase();
        if (key) {
          aggregatedList[key] = (aggregatedList[key] || 0) + 1;
        }
      });
    });

    // Save and display the aggregated shopping list
    this.shoppingLists[weekKey] = aggregatedList;
    this.shoppingList = aggregatedList;
    console.log('Generated Shopping List for', weekKey, ':', aggregatedList);
    this.showShoppingList = true;

    // Ensure the week events are initialized and store grocery keys
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
    this.events[weekKey]['grocery'] = Object.keys(aggregatedList);

    // Save the calendar if user details exist
    if (!this.currentUser || !this.currentUser.id) {
      console.error('User details not loaded. Cannot save calendar.');
      return;
    }
    const startDateString = this.selectedPlan.toISOString().split('T')[0];
    const weekData = this.events[weekKey] || {
      sunday: [],
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: []
    };
    const payload = {
      user_ids: [this.currentUser.id],
      week: {
        sunday: weekData['sunday'] || [],
        monday: weekData['monday'] || [],
        tuesday: weekData['tuesday'] || [],
        wednesday: weekData['wednesday'] || [],
        thursday: weekData['thursday'] || [],
        friday: weekData['friday'] || [],
        saturday: weekData['saturday'] || [],
        grocery: weekData['grocery'] || []
      },
      start_date: startDateString
    };

    // Save calendar via CalendarService
    this.calendarService.saveCalendar(payload).subscribe(
      (response) => {
        console.log('Calendar saved successfully:', response);
      },
      (error) => {
        console.error('Error saving calendar:', error);
      }
    );
  }

  /**
   * viewShoppingList
   * Invokes the display function to show the grocery list for the week.
   */
  viewShoppingList() {
    this.displayGroceryList();
  }

  /**
   * saveCalendar
   * Saves the current calendar events for the selected week via the CalendarService.
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
    const weekData = calendarData || {
      sunday: [],
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: []
    };
    const payload = {
      user_ids: [this.currentUser.id],
      week: {
        sunday: weekData['sunday'] || [],
        monday: weekData['monday'] || [],
        tuesday: weekData['tuesday'] || [],
        wednesday: weekData['wednesday'] || [],
        thursday: weekData['thursday'] || [],
        friday: weekData['friday'] || [],
        saturday: weekData['saturday'] || [],
        grocery: weekData['grocery'] || []
      },
      start_date: startDateString
    };

    this.calendarService.saveCalendar(payload).subscribe(
      response => console.log('Calendar saved successfully:', response),
      error => console.error('Error saving calendar:', error)
    );
  }

  /**
   * loadCalendar
   * Loads calendar events for the selected week from the backend using the CalendarService.
   */
  loadCalendar() {
    if (!this.currentUser || !this.currentUser.id) {
      console.error('User details not loaded. Cannot load calendar.');
      return;
    }
    const weekParam = this.selectedPlan.toISOString().split('T')[0];
    this.calendarService.loadCalendar(this.currentUser.id, weekParam).subscribe(
      (response) => {
        const weekKey = this.selectedPlan.toDateString();
        if (response.length > 0) {
          const calendarData = response[0];
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
   * onPlanChange
   * Called when the user selects a different week; triggers reloading of the calendar data.
   */
  onPlanChange() {
    this.loadCalendar();
  }

  /**
   * displayGroceryList
   * Displays the grocery list for the current week if available.
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
   * toggleShareCalendar
   * Toggles the visibility of the calendar sharing interface.
   */
  toggleShareCalendar() {
    this.showShareCalendar = !this.showShareCalendar;
  }

  /**
   * searchUsers
   * Wrapper method for user search.
   * Delegates the search request to the UserService and assigns results to searchResults.
   */
  searchUsers() {
    if (this.searchQuery.trim() === '') {
      this.searchResults = [];
      return;
    }
    this.userService.searchUsers(this.searchQuery).subscribe(
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
   * addUserToCalendar
   * Adds a selected user to the calendar's shared user list.
   * Updates the calendar locally and calls the CalendarService to save the changes.
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
      user_ids: [this.currentUser.id]
    };

    if (!calendarData['user_ids']) {
      calendarData['user_ids'] = [this.currentUser.id];
    }

    if (!calendarData['user_ids'].includes(user.id)) {
      calendarData['user_ids'].push(user.id);
    }

    const startDateString = this.selectedPlan.toISOString().split('T')[0];

    this.calendarService.addUserToCalendar(user.id, calendarData, startDateString).subscribe(
      (response) => {
        console.log('User added to calendar successfully:', response);
      },
      (error) => {
        console.error('Error adding user to calendar:', error);
      }
    );
  }
}
