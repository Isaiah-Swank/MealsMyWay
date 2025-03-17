import { Component, OnInit } from '@angular/core';
import { RecipeService } from '../services/recipe.service';
import { AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CalendarService } from '../services/calendar.service';
import { UserService } from '../services/user.service';
import { PantryService } from '../services/pantry.service';
import { environment } from '../../environments/environment';
import { marked } from 'marked';

/**
 * Tab2Page Component
 * --------------------
 * This component manages the weekly meal prep calendar.
 * It allows users to:
 * - View and select a week (plan) for scheduling meals.
 * - Add meals to a specific day of the week.
 * - View recipe details and generate shopping lists.
 * - Remove a meal from the calendar using a confirmation dialog.
 * - Share the calendar with other users.
 */
@Component({
  selector: 'app-tab2',
  templateUrl: 'calendar.page.html',
  styleUrls: ['calendar.page.scss']
})
export class Tab2Page implements OnInit {
  // -------------------- Component Properties --------------------
  // Calendar and plan management
  currentWeekStart!: Date;       // Date representing the most recent Sunday
  plans: Date[] = [];            // Array of available week plans (current + previous weeks)
  selectedPlan!: Date;           // Currently selected week/plan

  // Recipe and meal management
  recipes: any[] = [];           // Array of available recipes
  selectedMeal: any = null;      // Recipe selected to add to the calendar
  selectedDay: string = '';      // The day (e.g., "monday") to add the selected meal

  // Calendar events storage
  events: { [week: string]: { [day: string]: any[] } } = {}; // Stores meals for each day by week
  hoveredRecipe: any = null;     // Recipe whose details are currently shown
  selectedEvent: any = null;     // Tracks which calendar event is selected (to display red X for removal)

  // Shopping list properties
  shoppingList: string[] = [];   // Formatted shopping list for display
  shoppingLists: { [week: string]: string[] } = {}; // Saved shopping lists by week key
  groceryListRaw: { [ingredient: string]: { quantity: number, unit: string } } = {}; // Aggregated raw grocery data
  showShoppingList: boolean = false; // Flag to toggle shopping list view
  groceryListDisplay: string[] = [];   // Display version of the grocery list

  // User and sharing management
  currentUser: any = null;       // Currently logged in user
  searchQuery: string = '';      // Input string for searching users to share the calendar with
  searchResults: any[] = [];     // Array of users found during search
  showShareCalendar: boolean = false; // Toggles display of the calendar sharing interface

  prepListDisplay: string = ''; // Stores HTML version of prep list
  showPrepList: boolean = false; // Toggles prep list visibility

  // -------------------- Constructor & Dependency Injection --------------------
  constructor(
    private recipeService: RecipeService,
    private alertController: AlertController,
    private router: Router,
    private calendarService: CalendarService,
    private http: HttpClient,
    private userService: UserService,
    private pantryService: PantryService
  ) {}

  // -------------------- Lifecycle Hook --------------------
  /**
   * ngOnInit
   * -------------
   * Initializes the component:
   * - Sets the current week start date.
   * - Generates available week plans.
   * - Loads recipes and user information.
   * - Loads the calendar for the current user if available.
   */
  ngOnInit() {
    this.setCurrentWeekStart();
    this.selectedPlan = this.currentWeekStart;
    this.generatePlans();
    this.loadRecipes();

    const nav = this.router.getCurrentNavigation();
    if (nav && nav.extras && nav.extras.state && nav.extras.state['user']) {
      this.currentUser = nav.extras.state['user'];
      console.log('Calendar page got user from navigation:', this.currentUser);
    } else {
      const storedUser = sessionStorage.getItem('currentUser');
      if (storedUser) {
        this.currentUser = JSON.parse(storedUser);
        console.log('Calendar page loaded user from session storage:', this.currentUser);
      } else {
        console.warn('No user found from login or session storage. Calendar not loaded.');
      }
    }

    if (this.currentUser) {
      this.loadCalendar();
    }
  }

  // -------------------- Calendar Initialization Methods --------------------
  /**
   * setCurrentWeekStart
   * ----------------------
   * Determines the most recent Sunday (start of the week) and sets it as currentWeekStart.
   */
  setCurrentWeekStart() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek);
    this.currentWeekStart = sunday;
  }

  /**
   * generatePrepList
   * ---------------------------
   * Collects recipe instructions from all meals in the currently selected calendar week
   * and formats them into an API call to DeepSeek.
   */
  generatePrepList() {
    const weekKey = this.selectedPlan.toDateString();
    const weekEvents = this.events[weekKey] || {};
    
    let prepInstructions: string[] = [];
  
    // Collect instructions from all meals
    for (const day in weekEvents) {
      if (weekEvents.hasOwnProperty(day) && day !== 'grocery') {
        for (const meal of weekEvents[day]) {
          if (meal.instructions) {
            prepInstructions.push(`Recipe: ${meal.title}\nIngredients: ${meal.ingredients}\nInstructions: ${meal.instructions}`);
          }
        }
      }
    }
  
    if (prepInstructions.length === 0) {
      alert("No recipes with instructions found for the selected week.");
      return;
    }
  
    // Format API request
    const requestBody = {
      prompt: `Generate a combined prep list for the following recipes. 
      Combine overlapping ingredients (e.g., chicken, onions) into a single step. 
      Format the output as a numbered list with clear, concise instructions. 
      Group ingredients by type (e.g., proteins, vegetables, dry ingredients) 
      and specify quantities for each recipe:\n\n${prepInstructions.join('\n\n')}`,
      max_tokens: 8192,
      temperature: 0.7
    };

    console.log("Sending request to backend:", requestBody);
  
    // Call your backend instead of DeepSeek directly
    this.http.post(`${environment.apiUrl}/api/deepseek`, requestBody).subscribe(
      (response: any) => {
        const prepListMarkdown = response.choices[0].message.content;
        console.log("DeepSeek response:", prepListMarkdown);

        // Store in sessionStorage
        sessionStorage.setItem('prepList', prepListMarkdown);

        alert("Prep list generated successfully! Check console.");
      },
      (error) => {
        console.error("Error:", error);
        alert("Failed to generate prep list.");
      }
    );
  }

  async viewPrepList() {
    const prepListMarkdown = sessionStorage.getItem('prepList');

    if (!prepListMarkdown) {
        alert('No prep list has been generated yet. Please generate one first.');
        return;
    }

    console.log("Loaded Prep List from sessionStorage:", prepListMarkdown);

    // Convert Markdown to HTML asynchronously
    this.prepListDisplay = await marked(prepListMarkdown);
    this.showPrepList = true;
  }

  /**
   * generatePlans
   * ----------------------
   * Generates an array of week start dates:
   * Includes the current week and the previous 19 weeks.
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
   * ----------------------
   * Loads available recipes from navigation state or session storage.
   */
  loadRecipes() {
    const nav = this.router.getCurrentNavigation();
    let selectedRecipes = [];
    if (nav && nav.extras && nav.extras.state && nav.extras.state['recipes']) {
      selectedRecipes = nav.extras.state['recipes'];
      sessionStorage.setItem('selectedRecipes', JSON.stringify(selectedRecipes));
    } else {
      selectedRecipes = JSON.parse(sessionStorage.getItem('selectedRecipes') || '[]');
    }
    this.recipes = selectedRecipes;
    console.log("Updated recipes in Calendar:", this.recipes);
  }

  /**
   * Getter: currentWeekEvents
   * ---------------------------
   * Returns the calendar events for the currently selected week.
   * Initializes the event object if it does not exist.
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

  // -------------------- Meal & Recipe Management --------------------
  /**
   * addMeal
   * ---------------------------
   * Adds a selected meal to the calendar on the chosen day.
   * If the selected meal lacks detailed ingredients or instructions,
   * it fetches the details from the API before adding.
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
      this.recipeService.getRecipeDetailsFromApi(this.selectedMeal.api_id).subscribe(
        (response: any) => {
          const mealData = response.meals[0];
          const ingredients: string[] = [];
          // Extract both measurement and ingredient values
          for (let i = 1; i <= 20; i++) {
            const ingredient = mealData[`strIngredient${i}`];
            const measure = mealData[`strMeasure${i}`];
            if (ingredient && ingredient.trim()) {
              ingredients.push(`${measure ? measure.trim() + ' ' : ''}${ingredient.trim()}`);
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
   * ---------------------------
   * Clones the selected meal and adds it to the calendar events for the selected day.
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
   * ---------------------------
   * When hovering over a recipe, fetches and displays its detailed information.
   * If the recipe data is incomplete, it attempts to retrieve details from the API.
   */
  onRecipeHover(recipe: any) {
    if (recipe) {
      if (recipe.api_id && !recipe.instructions) {
        this.recipeService.getRecipeDetailsFromApi(recipe.api_id).subscribe(
          (response: any) => {
            const mealData = response.meals[0];
            const ingredients: string[] = [];
            // Combine measurement with ingredient name
            for (let i = 1; i <= 20; i++) {
              const ingredient = mealData[`strIngredient${i}`];
              const measure = mealData[`strMeasure${i}`];
              if (ingredient && ingredient.trim()) {
                ingredients.push(`${measure ? measure.trim() + ' ' : ''}${ingredient.trim()}`);
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
   * ---------------------------
   * Handles the click on a recipe in the calendar.
   * Sets the hovered recipe details and marks the recipe as selected (to display the red X).
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
      // Set the selected event so the red "X" appears only for this recipe.
      this.selectedEvent = recipe;
    } else {
      this.hoveredRecipe = null;
      this.selectedEvent = null;
    }
  }

  /**
   * closeRecipeDetails
   * ---------------------------
   * Clears the displayed recipe details and resets the selected event.
   * This method is called when the user presses the "Close" button in the recipe details section.
   */
  closeRecipeDetails() {
    this.hoveredRecipe = null;
    this.selectedEvent = null;
  }

  /**
   * confirmRemoveEvent
   * ---------------------------
   * Displays a confirmation alert to remove a recipe from the calendar.
   * If confirmed, removes the recipe from the appropriate day's event list,
   * clears the selected event, and saves the updated calendar.
   *
   * @param event - The recipe event to remove.
   * @param day - The day of the week from which the recipe will be removed.
   * @param index - The index of the recipe in the day's event array.
   * @param ev - The click event (used to stop propagation).
   */
  async confirmRemoveEvent(event: any, day: string, index: number, ev: Event) {
    ev.stopPropagation();
    const alert = await this.alertController.create({
      header: 'Confirm Removal',
      message: `Are you sure you want to remove the recipe "${event.title}" from the calendar?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Remove',
          handler: () => {
            const weekKey = this.selectedPlan.toDateString();
            this.events[weekKey][day].splice(index, 1);
            // Clear the selected event after removal.
            this.selectedEvent = null;
            this.saveCalendar();
          }
        }
      ]
    });
    await alert.present();
  }

  // -------------------- Ingredient and Unit Conversion --------------------
  /**
   * getIngredientsForMeal
   * ---------------------------
   * Retrieves and returns an array of ingredient strings for a given meal.
   * If the meal's ingredients are missing, it fetches them from the API.
   *
   * @param meal - The meal object.
   * @returns Promise resolving to an array of ingredient strings.
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
            // Combine measurement and ingredient name when fetching details
            for (let i = 1; i <= 20; i++) {
              const ingredient = mealData[`strIngredient${i}`];
              const measure = mealData[`strMeasure${i}`];
              if (ingredient && ingredient.trim()) {
                ingredients.push(`${measure ? measure.trim() + ' ' : ''}${ingredient.trim()}`);
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

  /**
   * convertToOunces
   * ---------------------------
   * Converts a given quantity from various units to ounces.
   *
   * @param quantity - The numeric quantity.
   * @param unit - The unit of measurement.
   * @returns The quantity converted to ounces.
   */
  private convertToOunces(quantity: number, unit: string): number {
    const normalizedUnit = unit.toLowerCase();
    const conversionMap: { [unit: string]: number } = {
      'oz': 1,
      'ounce': 1,
      'ounces': 1,
      'lb': 16,
      'lbs': 16,
      'pound': 16,
      'pounds': 16,
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
      'g': 0.035274,
      'gram': 0.035274,
      'grams': 0.035274,
      'kg': 35.274,
      'kilogram': 35.274,
      'kilograms': 35.274,
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
   * ---------------------------
   * Parses an ingredient string to extract the quantity, unit, and ingredient name.
   * Supports formats like "32 oz Flour" or "Peanuts - 200g".
   *
   * @param ingredientStr - The raw ingredient string.
   * @returns An object containing the quantity (in ounces), unit (always 'oz'), and name,
   *          or null if parsing fails.
   */
  private parseIngredient(ingredientStr: string): { quantity: number, unit: string, name: string } | null {
    if (!ingredientStr.match(/\d/)) {
      return { quantity: 0, unit: '', name: ingredientStr.trim() };
    }
    const regexNew = /^(.+?)\s*[-:]\s*(\d+(?:\.\d+)?)(\w+)$/;
    let match = ingredientStr.match(regexNew);
    if (match) {
      const name = match[1].trim();
      const quantity = parseFloat(match[2]);
      const unit = match[3];
      const convertedQuantity = this.convertToOunces(quantity, unit);
      return { quantity: convertedQuantity, unit: 'oz', name };
    }
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

  // -------------------- Shopping List Generation --------------------
  /**
   * generateShoppingList
   * ---------------------------
   * Prompts the user to confirm generating a shopping list.
   * On confirmation, calls createShoppingList to process and update the list.
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
   * ---------------------------
   * Aggregates ingredients from the unprocessed meals in the calendar,
   * adjusts quantities based on the current pantry items, and formats the final grocery list.
   * Finally, it updates the pantry and saves the updated calendar.
   */
  async createShoppingList() {
    const weekKey = this.selectedPlan.toDateString();
    const weekEvents = this.currentWeekEvents;
    let newAggregated: { [ingredient: string]: { quantity: number, unit: string } } = {};

    // Aggregate ingredients from each meal (skip the grocery key if present)
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
                  newAggregated[key] = { quantity: 0, unit: '' };
                } else {
                  if (newAggregated[key] !== undefined) {
                    newAggregated[key].quantity += parsed.quantity;
                  } else {
                    newAggregated[key] = { quantity: parsed.quantity, unit: parsed.unit };
                  }
                }
              } else {
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

    // Adjust new aggregated ingredients based on current pantry items
    for (let key in newAggregated) {
      const newReq = newAggregated[key].quantity;
      if (newReq === 0) {
        this.groceryListRaw[key] = { quantity: 0, unit: '' };
      } else {
        if (this.groceryListRaw[key] !== undefined && this.groceryListRaw[key].quantity !== 0) {
          this.groceryListRaw[key].quantity += newReq;
          newAggregated[key].quantity = 0;
        } else {
          let remaining = newReq;
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

    for (let key in newAggregated) {
      if (newAggregated[key].quantity === 0) {
        delete newAggregated[key];
      }
    }

    const updatedPantryItems = pantryItems.filter(item => item.quantity > 0);

    // Update the pantry on the backend after adjusting quantities
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

    // Format the final grocery list for display
    const formattedGroceryList = Object.entries(this.groceryListRaw).map(([name, details]) => {
      const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
      if (details.quantity === 0) {
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

  // -------------------- Shopping List and Calendar Saving --------------------
  /**
   * viewShoppingList
   * ---------------------------
   * Displays the shopping list for the current week.
   * If no shopping list exists, alerts the user to generate one.
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
   * ---------------------------
   * Persists the current calendar (including scheduled meals and grocery list)
   * to the backend server.
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
   * ---------------------------
   * Loads the calendar data for the selected week from the backend server.
   * If no calendar is found, initializes an empty calendar for the week.
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

  // -------------------- Calendar Navigation & Sharing --------------------
  /**
   * onPlanChange
   * ---------------------------
   * Triggered when the user selects a different week plan.
   * Loads the calendar for the new plan.
   */
  onPlanChange() {
    this.loadCalendar();
  }

  /**
   * toggleShareCalendar
   * ---------------------------
   * Toggles the display of the calendar sharing search interface.
   */
  toggleShareCalendar() {
    this.showShareCalendar = !this.showShareCalendar;
  }

  /**
   * searchUsers
   * ---------------------------
   * Searches for users matching the search query.
   * Updates the searchResults property with the results.
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
   * ---------------------------
   * Adds the specified user to the current calendar's shared user list.
   *
   * @param user - The user object to add.
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
