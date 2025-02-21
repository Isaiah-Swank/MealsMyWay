import { Component, OnInit } from '@angular/core';
import { RecipeService } from '../services/recipe.service';

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
   * Array of weeks (each starts on a Sunday) 
   * including the current week and previous weeks.
   */
  plans: Date[] = [];

  /**
   * The selected plan/week from the dropdown;
   * defaults to the current week's start date.
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
   * The recipe the user is currently hovering over,
   * used to display recipe details in the UI.
   */
  hoveredRecipe: any = null;

  constructor(private recipeService: RecipeService) {}

  /**
   * Lifecycle hook:
   * - Sets current week's start date (Sunday)
   * - Initializes selectedPlan to current week
   * - Builds list of previous weeks
   * - Loads recipes from the service
   */
  ngOnInit() {
    this.setCurrentWeekStart();
    this.selectedPlan = this.currentWeekStart;
    this.generatePlans();
    this.loadRecipes();
  }

  /**
   * Calculates the date of the most recent Sunday
   * (start of the current week).
   */
  setCurrentWeekStart() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // Sunday=0, Monday=1, ...
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek);
    this.currentWeekStart = sunday;
  }

  /**
   * Generate an array of weeks:
   * - Current week is first
   * - Followed by 19 previous weeks
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
   * Fetches recipes from the RecipeService 
   * and populates this.recipes.
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
   * Return events for the selected week.
   * If none, initialize an empty structure.
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
   * Adds the chosen meal to the current week's 
   * events object under the chosen day.
   */
  addMeal() {
    if (!this.selectedMeal || !this.selectedDay) {
      alert('Please select both a meal and a day.');
      return;
    }
    const weekKey = this.selectedPlan.toDateString();

    // Ensure the week exists.
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

    // Push a copy of the selected meal into the correct day array
    this.events[weekKey][this.selectedDay].push({ ...this.selectedMeal });

    // Clear form selections
    this.selectedMeal = null;
    this.selectedDay = '';
  }

  /**
   * On hover, fetch extra details if needed 
   * (especially if recipe has an external API ID),
   * then display in hoveredRecipe.
   */
  onRecipeHover(recipe: any) {
    if (recipe) {
      // If the recipe has an API ID but no instructions yet, fetch from API
      if (recipe.api_id && !recipe.instructions) {
        this.recipeService.getRecipeDetailsFromApi(recipe.api_id).subscribe(
          (response: any) => {
            const meal = response.meals[0];
            let ingredients: string[] = [];
            for (let i = 1; i <= 20; i++) {
              const ingredient = meal[`strIngredient${i}`];
              if (ingredient) {
                ingredients.push(ingredient);
              } else {
                break;
              }
            }
            recipe.ingredients = ingredients;
            recipe.instructions = meal.strInstructions;
            this.hoveredRecipe = recipe;
          },
          (error) => {
            console.error('Error fetching recipe details from API:', error);
            this.hoveredRecipe = recipe;
          }
        );
      } else {
        // No API call needed; ensure ingredients is an array
        if (typeof recipe.ingredients === 'string') {
          recipe.ingredients = recipe.ingredients
            .split(',')
            .map((ing: string) => ing.trim());
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
}
