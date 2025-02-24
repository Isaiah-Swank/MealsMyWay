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
  currentWeekStart!: Date;
  plans: Date[] = [];
  selectedPlan!: Date;
  recipes: any[] = [];
  selectedMeal: any = null;
  selectedDay: string = '';
  events: { [week: string]: { [day: string]: any[] } } = {};
  hoveredRecipe: any = null;
  shoppingList: { [ingredient: string]: number } = {};
  shoppingLists: { [week: string]: { [ingredient: string]: number } } = {};
  showShoppingList: boolean = false;
  currentUser: any = null; // Will be passed from the login page

  constructor(
    private recipeService: RecipeService,
    private alertController: AlertController,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit() {
    this.setCurrentWeekStart();
    this.selectedPlan = this.currentWeekStart;
    this.generatePlans();
    this.loadRecipes();

    // Retrieve the user from the router state (provided in login.page.ts or wherever you navigate from)
    const nav = this.router.getCurrentNavigation();
    if (nav && nav.extras && nav.extras.state && nav.extras.state['user']) {
      this.currentUser = nav.extras.state['user'];
      console.log('Calendar page got user from navigation:', this.currentUser);
      this.loadCalendar();
    } else {
      console.warn('No user passed from login to Calendar. Calendar not loaded.');
    }
  }

  setCurrentWeekStart() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek);
    this.currentWeekStart = sunday;
  }

  generatePlans() {
    this.plans.push(this.currentWeekStart);
    const numberOfPreviousWeeks = 19;
    for (let i = 1; i <= numberOfPreviousWeeks; i++) {
      const previousSunday = new Date(this.currentWeekStart);
      previousSunday.setDate(this.currentWeekStart.getDate() - 7 * i);
      this.plans.push(previousSunday);
    }
  }

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

  addMeal() {
    if (!this.selectedMeal || !this.selectedDay) {
      alert('Please select both a meal and a day.');
      return;
    }
    // If the meal is missing ingredients (i.e., it came from the external API and was never fully fetched)
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
        // If ingredients are stored as a string, split them
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
      this.hoveredRecipe = null;
    }
  }

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

  get shoppingListKeys() {
    return Object.keys(this.shoppingList);
  }

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

  async createShoppingList() {
    const weekKey = this.selectedPlan.toDateString();
    const aggregatedList: { [ingredient: string]: number } = {};
    const weekEvents = this.currentWeekEvents;
    const ingredientPromises: Promise<string[]>[] = [];

    // Gather all ingredient arrays
    for (const day in weekEvents) {
      if (weekEvents.hasOwnProperty(day)) {
        for (const meal of weekEvents[day]) {
          ingredientPromises.push(this.getIngredientsForMeal(meal));
        }
      }
    }

    // Resolve all ingredient-promises
    const allIngredientsArrays = await Promise.all(ingredientPromises);
    allIngredientsArrays.forEach((ingredients) => {
      ingredients.forEach((ingredient) => {
        const key = ingredient.trim().toLowerCase();
        if (key) {
          aggregatedList[key] = (aggregatedList[key] || 0) + 1;
        }
      });
    });

    this.shoppingLists[weekKey] = aggregatedList;
    this.shoppingList = aggregatedList;
    console.log('Generated Shopping List for', weekKey, ':', aggregatedList);
    this.showShoppingList = true;

    if (!this.currentUser || !this.currentUser.id) {
      console.error('User details not loaded. Cannot save calendar.');
      return;
    }
    const payload = {
      user_ids: [this.currentUser.id],
      week: aggregatedList,
      start_date: this.selectedPlan
    };

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

  viewShoppingList() {
    const weekKey = this.selectedPlan.toDateString();
    if (!this.shoppingLists[weekKey] || Object.keys(this.shoppingLists[weekKey]).length === 0) {
      alert('No shopping list has been generated yet for this week. Please generate a shopping list first.');
    } else {
      this.shoppingList = this.shoppingLists[weekKey];
      this.showShoppingList = true;
    }
  }

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
    const payload = {
      user_ids: [this.currentUser.id],
      week: calendarData,
      start_date: this.selectedPlan
    };

    console.log('About to POST this payload:', payload);

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

  loadCalendar() {
    if (!this.currentUser || !this.currentUser.id) {
      console.error('User details not loaded. Cannot load calendar.');
      return;
    }
    const weekParam = this.selectedPlan.toISOString().split('T')[0];
    this.http.get<any[]>(`http://localhost:3000/calendar?start_date=${weekParam}&user_id=${this.currentUser.id}`)
      .subscribe(
        (response) => {
          if (response.length > 0) {
            const calendarData = response[0];
            this.events[this.selectedPlan.toDateString()] = calendarData.week;
          } else {
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
        },
        (error) => {
          console.error('Error loading calendar:', error);
        }
      );
  }

  onPlanChange() {
    this.loadCalendar();
  }
}
