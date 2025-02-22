import { Component, OnInit } from '@angular/core';
import { RecipeService } from '../services/recipe.service';
import { AlertController } from '@ionic/angular';

@Component({
  selector: 'app-tab2',
  templateUrl: 'calendar.page.html',
  styleUrls: ['calendar.page.scss']
})
export class Tab2Page implements OnInit {
  /**
   * The date (Sunday) that starts the "current" week.
   */
  currentWeekStart!: Date;

  /**
   * Array of weeks (each starts on a Sunday) including the current week and previous weeks.
   */
  plans: Date[] = [];

  /**
   * The selected plan/week from the dropdown; defaults to the current week's start date.
   */
  selectedPlan!: Date;

  /**
   * All recipes loaded from RecipeService.
   */
  recipes: any[] = [];

  /**
   * Currently selected recipe (for the add-meal form).
   */
  selectedMeal: any = null;

  /**
   * Currently selected day of the week (for the add-meal form).
   */
  selectedDay: string = '';

  /**
   * Event storage structure:
   * {
   *   'WeekKey (toDateString)': {
   *       sunday: [{...mealObj}, ...],
   *       monday: [...],
   *       ...
   *   },
   *   ...
   * }
   */
  events: { [week: string]: { [day: string]: any[] } } = {};

  /**
   * The recipe the user is currently hovering over, used to display recipe details in the UI.
   */
  hoveredRecipe: any = null;

  /**
   * Displayed shopping list for the currently selected week.
   */
  shoppingList: { [ingredient: string]: number } = {};

  /**
   * Stores shopping lists for each week, keyed by week date string.
   */
  shoppingLists: { [week: string]: { [ingredient: string]: number } } = {};

  /**
   * Flag to indicate whether to display the shopping list in the details panel.
   */
  showShoppingList: boolean = false;

  constructor(private recipeService: RecipeService,
              private alertController: AlertController) {}

  ngOnInit() {
    this.setCurrentWeekStart();
    this.selectedPlan = this.currentWeekStart;
    this.generatePlans();
    this.loadRecipes();
  }

  /**
   * Calculates the date of the most recent Sunday (start of the current week).
   */
  setCurrentWeekStart() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // Sunday=0, Monday=1, ...
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek);
    this.currentWeekStart = sunday;
  }

  /**
   * Generate an array of weeks: current week plus 19 previous weeks.
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
   * Fetches recipes from the RecipeService and populates this.recipes.
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

  /**
   * Returns events for the selected week.
   * If none, initializes an empty structure.
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
   * Adds the chosen meal to the current week's events under the chosen day.
   * If the selected meal lacks ingredients, it fetches them first.
   */
  addMeal() {
    if (!this.selectedMeal || !this.selectedDay) {
      alert('Please select both a meal and a day.');
      return;
    }
    if ((!this.selectedMeal.ingredients || this.selectedMeal.ingredients.length === 0) &&
         this.selectedMeal.api_id && !this.selectedMeal.instructions) {
      this.recipeService.getRecipeDetailsFromApi(this.selectedMeal.api_id).subscribe(
        (response: any) => {
          const mealData = response.meals[0];
          let ingredients: string[] = [];
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
   * Pushes a deep-cloned copy of the selected meal into the events storage.
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
   * On hover, fetch extra details if needed (similar to addMeal) and display in hoveredRecipe.
   */
  onRecipeHover(recipe: any) {
    if (recipe) {
      if (recipe.api_id && !recipe.instructions) {
        this.recipeService.getRecipeDetailsFromApi(recipe.api_id).subscribe(
          (response: any) => {
            const mealData = response.meals[0];
            let ingredients: string[] = [];
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
          recipe.ingredients = recipe.ingredients.split(',').map((ing: string) => ing.trim());
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
   * Helper method that returns a Promise resolving to the ingredients array for a meal.
   * If the meal's ingredients are provided as a string, it splits them into an array.
   * If the meal lacks ingredients and has an API ID, it fetches the details.
   */
  getIngredientsForMeal(meal: any): Promise<string[]> {
    return new Promise((resolve) => {
      if (meal.ingredients) {
        // If ingredients is a string, split on commas or newlines.
        if (typeof meal.ingredients === 'string') {
          let ingredients: string[] = [];
          if (meal.ingredients.indexOf(',') > -1) {
            ingredients = meal.ingredients.split(',');
          } else if (meal.ingredients.indexOf('\n') > -1) {
            ingredients = meal.ingredients.split('\n');
          } else {
            ingredients = [meal.ingredients];
          }
          ingredients = ingredients.map(ing => ing.trim()).filter(Boolean);
          resolve(ingredients);
          return;
        }
        // If ingredients is an array, trim each element.
        if (Array.isArray(meal.ingredients)) {
          const ingredients = meal.ingredients
            .map((ing: string) => ing.trim())
            .filter(Boolean);
          resolve(ingredients);
          return;
        }
      }
      // If no ingredients exist but an API ID is available, fetch details.
      if (meal.api_id && !meal.instructions) {
        this.recipeService.getRecipeDetailsFromApi(meal.api_id).subscribe(
          (response: any) => {
            const mealData = response.meals[0];
            let ingredients: string[] = [];
            for (let i = 1; i <= 20; i++) {
              const ingredient = mealData[`strIngredient${i}`];
              if (ingredient) {
                ingredients.push(ingredient.trim());
              } else {
                break;
              }
            }
            // Update the meal object with fetched details.
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
   * Getter to return the keys of the shopping list for display.
   */
  get shoppingListKeys() {
    return Object.keys(this.shoppingList);
  }

  /**
   * Opens a confirmation pop-up before generating the shopping list.
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
   * Asynchronously aggregates ingredients from all meals in the current week.
   * The resulting list is saved in shoppingLists under the current week's key.
   */
  async createShoppingList() {
    const weekKey = this.selectedPlan.toDateString();
    const aggregatedList: { [ingredient: string]: number } = {};
    const weekEvents = this.currentWeekEvents;
    const ingredientPromises: Promise<string[]>[] = [];

    // Collect ingredient arrays for every meal.
    for (const day in weekEvents) {
      if (weekEvents.hasOwnProperty(day)) {
        for (const meal of weekEvents[day]) {
          ingredientPromises.push(this.getIngredientsForMeal(meal));
        }
      }
    }

    const allIngredientsArrays = await Promise.all(ingredientPromises);
    allIngredientsArrays.forEach(ingredients => {
      ingredients.forEach(ingredient => {
        // Normalize ingredient (trim and convert to lowercase) to handle duplicates.
        const key = ingredient.trim().toLowerCase();
        if (key) {
          aggregatedList[key] = (aggregatedList[key] || 0) + 1;
        }
      });
    });

    // Save the aggregated list for this week and update the displayed list.
    this.shoppingLists[weekKey] = aggregatedList;
    this.shoppingList = aggregatedList;
    console.log('Generated Shopping List for', weekKey, ':', aggregatedList);
    this.showShoppingList = true;
  }

  /**
   * Displays the shopping list for the currently selected week.
   */
  viewShoppingList() {
    const weekKey = this.selectedPlan.toDateString();
    if (!this.shoppingLists[weekKey] || Object.keys(this.shoppingLists[weekKey]).length === 0) {
      alert('No shopping list has been generated yet for this week. Please generate a shopping list first.');
    } else {
      this.shoppingList = this.shoppingLists[weekKey];
      this.showShoppingList = true;
    }
  }
}
