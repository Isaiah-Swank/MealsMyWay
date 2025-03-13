import { Component, OnInit } from '@angular/core';
import { RecipeService } from '../services/recipe.service';
import { AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CalendarService } from '../services/calendar.service';
import { UserService } from '../services/user.service';
import { PantryService } from '../services/pantry.service';
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
  currentWeekStart!: Date; // Starting date (Sunday) of the current week.
  plans: Date[] = []; // List of week start dates (current and previous weeks).
  selectedPlan!: Date; // The currently selected week (plan).
  recipes: any[] = []; // Array to hold available recipes.
  selectedMeal: any = null; // The recipe/meal selected to add to the calendar.
  selectedDay: string = ''; // The day on which the meal is scheduled (e.g. "monday").
  // events stores meals scheduled for each day of each week (keyed by week string).
  events: { [week: string]: { [day: string]: any[] } } = {};
  hoveredRecipe: any = null; // Holds a recipe that is currently hovered to show details.
  
  // Grocery list-related properties:
  shoppingList: string[] = []; // Formatted grocery list (array of strings) for display.
  shoppingLists: { [week: string]: string[] } = {}; // Saved grocery lists keyed by week.
  // Raw aggregated grocery list for processed meals; measured ingredients store a numeric quantity,
  // non-measured ingredients default to 0.
  groceryListRaw: { [ingredient: string]: { quantity: number, unit: string } } = {};
  showShoppingList: boolean = false; // Flag to show/hide the grocery list view.
  groceryListDisplay: string[] = []; // The grocery list that gets displayed on the page.
  
  // User and search-related properties:
  currentUser: any = null; // Currently logged-in user.
  searchQuery: string = ''; // User input for searching other users.
  searchResults: any[] = []; // List of users returned by a search.
  showShareCalendar: boolean = false; // Toggle for displaying the calendar sharing interface.

  // ------------------------- Constructor & Dependency Injection -------------------------
  constructor(
    private recipeService: RecipeService,
    private alertController: AlertController,
    private router: Router,
    private calendarService: CalendarService,
    private http: HttpClient,
    private userService: UserService,
    private pantryService: PantryService
  ) {}

  // ------------------------- Lifecycle Hook -------------------------
  /**
   * ngOnInit
   * Initializes the component:
   * - Sets the starting date of the current week.
   * - Generates available week plans.
   * - Loads recipes.
   * - Retrieves the current user from navigation state or local storage.
   * - Loads the user's calendar.
   */
  ngOnInit() {
    this.setCurrentWeekStart();
    this.selectedPlan = this.currentWeekStart;
    this.generatePlans();
    this.loadRecipes();

    // Retrieve the user either from navigation state or local storage.
    const nav = this.router.getCurrentNavigation();
    if (nav && nav.extras && nav.extras.state && nav.extras.state['user']) {
      this.currentUser = nav.extras.state['user'];
      console.log('Calendar page got user from navigation:', this.currentUser);
    } else {
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        this.currentUser = JSON.parse(storedUser);
        console.log('Calendar page loaded user from local storage:', this.currentUser);
      } else {
        console.warn('No user found from login or local storage. Calendar not loaded.');
      }
    }

    if (this.currentUser) {
      this.loadCalendar();
    }
  }

  // ------------------------- Helper Methods -------------------------
  /**
   * setCurrentWeekStart
   * Calculates the most recent Sunday and sets it as the current week start.
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
   * Generates an array of week start dates (current week and 19 previous weeks).
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
   * Loads available recipes from either the navigation state or local storage.
   */
  loadRecipes() {
    const nav = this.router.getCurrentNavigation();
    let selectedRecipes = [];
    if (nav && nav.extras && nav.extras.state && nav.extras.state['recipes']) {
      selectedRecipes = nav.extras.state['recipes'];
      localStorage.setItem('selectedRecipes', JSON.stringify(selectedRecipes));
    } else {
      selectedRecipes = JSON.parse(localStorage.getItem('selectedRecipes') || '[]');
    }
    this.recipes = selectedRecipes;
    console.log("Updated recipes in Calendar:", this.recipes);
  }

  // ------------------------- Getters -------------------------
  /**
   * currentWeekEvents
   * Returns the events for the currently selected week. Initializes if not present.
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

  // ------------------------- Meal & Recipe Handling -------------------------
  /**
   * addMeal
   * Adds a selected meal to the calendar. If necessary, it fetches detailed recipe info.
   */
  addMeal() {
    if (!this.selectedMeal || !this.selectedDay) {
      alert('Please select both a meal and a day.');
      return;
    }
    // If ingredients are missing, fetch them from the API.
    if (
      (!this.selectedMeal.ingredients || this.selectedMeal.ingredients.length === 0) &&
      this.selectedMeal.api_id &&
      !this.selectedMeal.instructions
    ) {
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
   * Clones the selected meal and adds it to the appropriate day in the calendar.
   * Marks the meal as not yet processed for the grocery list.
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
    mealClone.processedForGrocery = false;
    this.events[weekKey][this.selectedDay].push(mealClone);
    this.selectedMeal = null;
    this.selectedDay = '';
  }

  /**
   * onRecipeHover
   * When a recipe is hovered over, fetches and displays its detailed information.
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
   * Handles click events on recipes, ensuring details are properly formatted.
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
   * Returns a promise that resolves with an array of ingredient strings for the given meal.
   * If ingredients are missing, it fetches them from the API.
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

  // ------------------------- Conversion Helpers -------------------------
  /**
   * convertToOunces
   * Converts a given quantity with its unit into ounces.
   * Supports various units including:
   * - Imperial weight (oz, lb, etc.)
   * - Imperial volume (cup, tablespoon, teaspoon, fluid ounce, pint, quart, gallon)
   * - Metric weight (g, kg)
   * - Metric volume (ml, l)
   */
  private convertToOunces(quantity: number, unit: string): number {
    const normalizedUnit = unit.toLowerCase();
    const conversionMap: { [unit: string]: number } = {
      // Imperial weight
      'oz': 1,
      'ounce': 1,
      'ounces': 1,
      'lb': 16,
      'lbs': 16,
      'pound': 16,
      'pounds': 16,
      // Imperial volume (fluid)
      'cup': 8,
      'cups': 8,
      'tablespoon': 0.5,
      'tablespoons': 0.5,
      'tbsp': 0.5,
      'teaspoon': 0.166667,
      'teaspoons': 0.166667,
      'tsp': 0.166667,
      'fl oz': 1,
      'fluidounce': 1,
      'fluidounces': 1,
      'pint': 16,
      'pints': 16,
      'quart': 32,
      'quarts': 32,
      'gallon': 128,
      'gallons': 128,
      // Metric weight
      'g': 0.035274,
      'gram': 0.035274,
      'grams': 0.035274,
      'kg': 35.274,
      'kilogram': 35.274,
      'kilograms': 35.274,
      // Metric volume
      'ml': 0.033814,
      'milliliter': 0.033814,
      'milliliters': 0.033814,
      'l': 33.814,
      'liter': 33.814,
      'liters': 33.814
    };
    if (conversionMap[normalizedUnit]) {
      return quantity * conversionMap[normalizedUnit];
    }
    return quantity;
  }

  /**
   * parseIngredient
   * Parses an ingredient string which can be in one of two formats:
   * 1. "32 oz Flour" – where the quantity comes first.
   * 2. "Peanuts - 200g" or "Peanuts:200g" – where the name comes first.
   * If no digits are found, it returns the ingredient name with a quantity of 0.
   * Otherwise, it converts the quantity to ounces.
   */
  private parseIngredient(ingredientStr: string): { quantity: number, unit: string, name: string } | null {
    // Check if the string contains any digits.
    if (!ingredientStr.match(/\d/)) {
      // No numeric measurement present, return quantity as 0.
      return { quantity: 0, unit: '', name: ingredientStr.trim() };
    }
    // Try new format: "Peanuts - 200g" or "Peanuts:200g"
    const regexNew = /^(.+?)\s*[-:]\s*(\d+(?:\.\d+)?)(\w+)$/;
    let match = ingredientStr.match(regexNew);
    if (match) {
      const name = match[1].trim();
      const quantity = parseFloat(match[2]);
      const unit = match[3];
      const convertedQuantity = this.convertToOunces(quantity, unit);
      return { quantity: convertedQuantity, unit: 'oz', name };
    }
    // Fallback to original format: "32 oz Flour"
    const regexOld = /^(\d+(?:\.\d+)?)\s*(\w+)\s+(.*)$/;
    match = ingredientStr.match(regexOld);
    if (match) {
      const quantity = parseFloat(match[1]);
      const unit = match[2];
      const name = match[3].trim();
      const convertedQuantity = this.convertToOunces(quantity, unit);
      return { quantity: convertedQuantity, unit: 'oz', name };
    }
    return null;
  }

  // ------------------------- Shopping List & Calendar Saving -------------------------
  /**
   * generateShoppingList
   * Displays a confirmation alert and, if confirmed, calls createShoppingList().
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
   * Aggregates ingredients from unprocessed meals, converts quantities to ounces,
   * compares against the pantry (subtracting amounts for measured ingredients),
   * and merges the new ingredients with the existing grocery list.
   * For ingredients without a measurement, it simply records the name.
   * The final grocery list is formatted (e.g., "32 oz Lettuce" or just "Water") and saved.
   */
  async createShoppingList() {
    const weekKey = this.selectedPlan.toDateString();
    const weekEvents = this.currentWeekEvents;
    let newAggregated: { [ingredient: string]: { quantity: number, unit: string } } = {};

    // Process only unprocessed meals; skip the "grocery" key.
    for (const day in weekEvents) {
      if (day === 'grocery') continue;
      if (weekEvents.hasOwnProperty(day)) {
        for (const meal of weekEvents[day]) {
          if (!meal.processedForGrocery) {
            const ingredients = await this.getIngredientsForMeal(meal);
            ingredients.forEach((ingredientStr) => {
              const parsed = this.parseIngredient(ingredientStr);
              if (parsed) {
                const key = parsed.name.toLowerCase();
                if (parsed.quantity === 0) {
                  // Non-measured ingredient; set quantity to 0.
                  newAggregated[key] = { quantity: 0, unit: '' };
                } else {
                  if (newAggregated[key] !== undefined) {
                    newAggregated[key].quantity += parsed.quantity;
                  } else {
                    newAggregated[key] = { quantity: parsed.quantity, unit: parsed.unit };
                  }
                }
              } else {
                // If parsing fails, treat as non-measured.
                const key = ingredientStr.trim().toLowerCase();
                newAggregated[key] = { quantity: 0, unit: '' };
              }
            });
            meal.processedForGrocery = true;
          }
        }
      }
    }

    if (Object.keys(newAggregated).length === 0) {
      alert("No new recipes have been added since the last grocery list generation.");
      return;
    }

    let pantryData;
    try {
      pantryData = await this.pantryService.loadPantry(this.currentUser.id).toPromise();
    } catch (error) {
      console.error("Error loading pantry data", error);
      pantryData = { item_list: { pantry: [], freezer: [] } };
    }
    const pantryItems: any[] = pantryData?.item_list?.pantry || [];

    // Merge newAggregated into groceryListRaw.
    for (let key in newAggregated) {
      const newReq = newAggregated[key].quantity;
      if (newReq === 0) {
        // Non-measured ingredient: simply assign.
        this.groceryListRaw[key] = { quantity: 0, unit: '' };
      } else {
        if (this.groceryListRaw[key] !== undefined && this.groceryListRaw[key].quantity !== 0) {
          // Add new quantity if already exists.
          this.groceryListRaw[key].quantity += newReq;
          newAggregated[key].quantity = 0;
        } else {
          let remaining = newReq;
          // Subtract from pantry for new measured ingredients.
          for (const item of pantryItems) {
            if (item.name.toLowerCase() === key) {
              if (item.quantity >= remaining) {
                item.quantity -= remaining;
                remaining = 0;
                break;
              } else {
                remaining -= item.quantity;
                item.quantity = 0;
              }
            }
          }
          if (remaining > 0) {
            this.groceryListRaw[key] = { quantity: remaining, unit: newAggregated[key].unit };
          }
        }
      }
    }

    // Remove any keys from newAggregated that now have 0 quantity.
    for (let key in newAggregated) {
      if (newAggregated[key].quantity === 0) {
        delete newAggregated[key];
      }
    }

    const updatedPantryItems = pantryItems.filter(item => item.quantity > 0);

    const pantryPayload = {
      user_id: this.currentUser.id,
      pf_flag: false,
      item_list: { pantry: updatedPantryItems, freezer: pantryData?.item_list?.freezer || [] }
    };
    try {
      await this.pantryService.updatePantry(pantryPayload).toPromise();
      console.log('Pantry updated successfully after adjusting for new grocery list.');
    } catch (error) {
      console.error('Error updating pantry', error);
    }

    // Format the raw grocery list for display.
    const formattedGroceryList = Object.entries(this.groceryListRaw).map(([name, details]) => {
      const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
      if (details.quantity === 0) {
        // If quantity is 0, display only the ingredient name.
        return `${formattedName}`;
      } else {
        return `${details.quantity} ${details.unit} ${formattedName}`;
      }
    });

    this.shoppingLists[weekKey] = formattedGroceryList;
    this.shoppingList = formattedGroceryList;
    console.log('Updated Grocery List for', weekKey, ':', formattedGroceryList);
    this.showShoppingList = true;

    if (!this.events[weekKey]) {
      this.events[weekKey] = { sunday: [], monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [] };
    }
    this.events[weekKey]['grocery'] = formattedGroceryList;

    if (!this.currentUser || !this.currentUser.id) {
      console.error('User details not loaded. Cannot save calendar.');
      return;
    }
    const startDateString = this.selectedPlan.toISOString().split('T')[0];
    const weekData = this.events[weekKey] || { sunday: [], monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [] };
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
   * Displays the grocery list in a formatted manner.
   */
  viewShoppingList() {
    const weekKey = this.selectedPlan.toDateString();
    const loadedWeek = this.events[weekKey];
    const groceryList = loadedWeek ? loadedWeek['grocery'] : null;
    if (!groceryList || groceryList.length === 0) {
      alert('No grocery list has been generated yet for this week. Please generate a grocery list first.');
    } else {
      console.log('Grocery list for the week:', groceryList);
      this.groceryListDisplay = groceryList;
      this.showShoppingList = true;
    }
  }

  /**
   * saveCalendar
   * Saves the current calendar events (including the grocery list) to the backend.
   */
  saveCalendar() {
    if (!this.currentUser || !this.currentUser.id) {
      console.error('User details not loaded. Cannot save calendar.');
      return;
    }
    const weekKey = this.selectedPlan.toDateString();
    const calendarData = this.events[weekKey] || { sunday: [], monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [] };
    const startDateString = this.selectedPlan.toISOString().split('T')[0];
    const weekData = calendarData || { sunday: [], monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [] };
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
   * Loads calendar events for the selected week from the backend and updates local state.
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
          if (this.events[weekKey]['grocery'] && this.events[weekKey]['grocery'].length > 0) {
            this.shoppingList = this.events[weekKey]['grocery'];
          }
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

  onPlanChange() {
    this.loadCalendar();
  }

  // ------------------------- Calendar Sharing & User Search -------------------------
  /**
   * toggleShareCalendar
   * Toggles the display of the calendar sharing interface.
   */
  toggleShareCalendar() {
    this.showShareCalendar = !this.showShareCalendar;
  }

  /**
   * searchUsers
   * Searches for users based on the query and updates the search results.
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
   * Adds a selected user to the shared calendar and saves the updated calendar.
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
