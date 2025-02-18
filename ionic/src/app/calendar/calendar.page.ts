import { Component, OnInit } from '@angular/core';
import { RecipeService } from '../services/recipe.service';

@Component({
  selector: 'app-tab2',
  templateUrl: 'calendar.page.html',
  styleUrls: ['calendar.page.scss']
})
export class Tab2Page implements OnInit {
  // The current week's Sunday
  currentWeekStart!: Date;
  // Array of weeks including the current week and previous weeks (each starting on Sunday)
  plans: Date[] = [];
  // The selected week (defaults to the current week)
  selectedPlan!: Date;

  // --- New properties for meals ---
  recipes: any[] = [];
  selectedMeal: any = null;
  selectedDay: string = '';
  // Events are stored per week (keyed by the week's date string), then per day.
  events: { [week: string]: { [day: string]: any[] } } = {};

  constructor(private recipeService: RecipeService) {}

  ngOnInit() {
    this.setCurrentWeekStart();
    // Initialize selectedPlan to the current week.
    this.selectedPlan = this.currentWeekStart;
    this.generatePlans();
    this.loadRecipes();
  }

  // Calculate and set the current week's Sunday.
  setCurrentWeekStart() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // Sunday = 0, Monday = 1, etc.
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek);
    this.currentWeekStart = sunday;
  }

  // Generate an array of plans including the current week and previous weeks.
  generatePlans() {
    // Include the current week at the top.
    this.plans.push(this.currentWeekStart);
    // Generate 19 previous weeks so the dropdown has a total of 20 weeks.
    const numberOfPreviousWeeks = 19;
    for (let i = 1; i <= numberOfPreviousWeeks; i++) {
      const previousSunday = new Date(this.currentWeekStart);
      previousSunday.setDate(this.currentWeekStart.getDate() - 7 * i);
      this.plans.push(previousSunday);
    }
  }

  // Load recipes from RecipeService
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

  // Helper getter to retrieve the events for the currently selected week.
  get currentWeekEvents() {
    const weekKey = this.selectedPlan.toDateString();
    if (!this.events[weekKey]) {
      // Initialize the week if it doesn't exist.
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

  // Add the selected meal to the chosen day's events for the current week.
  addMeal() {
    if (!this.selectedMeal || !this.selectedDay) {
      alert('Please select both a meal and a day.');
      return;
    }
    const weekKey = this.selectedPlan.toDateString();
    // Ensure the week exists in events.
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
    // Add a copy of the selectedMeal to the events array for the selected day.
    this.events[weekKey][this.selectedDay].push({ ...this.selectedMeal });
    // Clear the selections.
    this.selectedMeal = null;
    this.selectedDay = '';
  }
}
