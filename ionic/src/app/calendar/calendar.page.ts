import { Component, OnInit, ViewChild, TemplateRef } from '@angular/core';
import { RecipeService } from '../services/recipe.service';
import { AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CalendarService } from '../services/calendar.service';
import { UserService } from '../services/user.service';
import { PantryService } from '../services/pantry.service';
import { environment } from '../../environments/environment';
import { marked } from 'marked';
import { PopoverController } from '@ionic/angular';
import { DatePopoverComponent } from '../date-popover/date-popover.component';


@Component({
  selector: 'app-tab2',
  templateUrl: 'calendar.page.html',
  styleUrls: ['calendar.page.scss']
})
export class Tab2Page implements OnInit {
  // -------------------- Calendar & Plan Management --------------------
  @ViewChild('datePickerPopover') datePickerPopover!: TemplateRef<any>;
  currentWeekStart!: Date;       // Most recent Sunday
  plans: Date[] = [];            // Current + previous weeks
  selectedPlan!: Date;           // Currently selected week

  // -------------------- Meal Management --------------------
  recipes: any[] = [];           // Available recipes
  selectedMeal: any = null;      // Recipe to add to calendar
  selectedDay: string = '';      // Day to add the meal (e.g., "monday")
  selectedCategory: string = ''; // NEW: Category (e.g., 'kidsLunch')

  // List of categories for meal selection and display
  categoryList: string[] = ['kidsLunch', 'adultsLunch', 'familyDinner'];

  // -------------------- Calendar Events Storage --------------------
  // Each week key contains days as objects with category arrays plus grocery & prep lists.
  events: { [week: string]: any } = {};
  hoveredRecipe: any = null;     // Recipe details currently shown
  selectedEvent: any = null;     // Recipe selected (for removal, etc.)

  // -------------------- Shopping List Properties --------------------
  shoppingList: string[] = [];   // Final grocery list for display
  shoppingLists: { [week: string]: string[] } = {};
  groceryListRaw: { [ingredient: string]: { quantity: number, unit: string } } = {};
  showShoppingList: boolean = false;
  groceryListDisplay: string[] = [];

  // -------------------- Prep List Properties --------------------
  prepListDisplay: string = '';
  showPrepList: boolean = false;

  // Flag to mark changes in calendar for prep list regeneration
  calendarChanged: boolean = false;

  // -------------------- User & Sharing Management --------------------
  currentUser: any = null;
  searchQuery: string = '';
  searchResults: any[] = [];
  showShareCalendar: boolean = false;
  editMode: boolean = false;
  editedPrepMarkdown: string = '';
  showDatePicker = false;


  // -------------------- Constructor & Dependency Injection --------------------
  constructor(
    private popoverController: PopoverController,
    private recipeService: RecipeService,
    private alertController: AlertController,
    private router: Router,
    private calendarService: CalendarService,
    private http: HttpClient,
    private userService: UserService,
    private pantryService: PantryService
  ) {}

  // -------------------- Lifecycle Hook --------------------
  ngOnInit() {
    const storedPlan = sessionStorage.getItem('selectedPlan');
    if (storedPlan) {
      this.selectedPlan = new Date(storedPlan);
      this.setCurrentWeekStart(); // Still needed to generate plans
    } else {
      this.setCurrentWeekStart();
      this.selectedPlan = this.currentWeekStart;
    }
    this.generatePlans();
    this.loadRecipes();

    // Load current user from navigation state or session storage.
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

  ionViewWillEnter() {
    this.loadRecipes();
  }
  

  // -------------------- (Optional) View Lifecycle Methods --------------------
  // If you prefer to reload recipes when the view enters or save the selected plan when leaving,
  // you can add ionViewWillEnter and ionViewWillLeave. In this version we are not including these.

  // -------------------- Methods Required by the Template --------------------

  // Called when a new plan is selected from the dropdown.
  onPlanChange() {
    sessionStorage.setItem('selectedPlan', this.selectedPlan.toISOString());
    this.loadCalendar();
  }

  // Toggles the calendar-sharing search interface.
  toggleShareCalendar() {
    this.showShareCalendar = !this.showShareCalendar;
  }

  // Searches for users based on the search query.
  searchUsers() {
    if (this.searchQuery.trim() === '') {
      this.searchResults = [];
      return;
    }
    this.userService.searchUsers(this.searchQuery).subscribe(
      response => {
        this.searchResults = response;
      },
      error => {
        console.error('Error searching users:', error);
        this.searchResults = [];
      }
    );
  }

  // Adds the specified user to the calendar's shared user list.
  addUserToCalendar(user: any) {
    const weekKey = this.selectedPlan.toDateString();
    let calendarData: any = this.events[weekKey];
    if (!calendarData) {
      calendarData = {
        sunday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        monday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        tuesday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        wednesday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        thursday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        friday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        saturday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        grocery: [],
        prep: [],
        user_ids: [this.currentUser.id]
      };
    } else {
      if (!calendarData.user_ids) {
        calendarData.user_ids = [this.currentUser.id];
      }
    }
    if (!calendarData.user_ids.includes(user.id)) {
      calendarData.user_ids.push(user.id);
    }
    const startDateString = this.selectedPlan.toISOString().split('T')[0];
    this.calendarService.addUserToCalendar(user.id, calendarData, startDateString).subscribe(
      response => {
        console.log('User added to calendar successfully:', response);
      },
      error => {
        console.error('Error adding user to calendar:', error);
      }
    );
  }

  // -------------------- Calendar Initialization --------------------

  // Determines the most recent Sunday (start of the week).
  setCurrentWeekStart() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek);
    this.currentWeekStart = sunday;
  }

  // Generates an array of week start dates (current + previous 19 weeks).
  generatePlans() {
    this.plans.push(this.currentWeekStart);
    const numberOfPreviousWeeks = 19;
    for (let i = 1; i <= numberOfPreviousWeeks; i++) {
      const previousSunday = new Date(this.currentWeekStart);
      previousSunday.setDate(this.currentWeekStart.getDate() - 7 * i);
      this.plans.push(previousSunday);
    }
  }

  // Loads recipes from navigation state or session storage.
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
    console.log('Updated recipes in Calendar:', this.recipes);
  }

  // Returns the calendar events for the selected week.
  get currentWeekEvents() {
    const weekKey = this.selectedPlan.toDateString();
    if (!this.events[weekKey]) {
      this.events[weekKey] = {
        sunday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        monday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        tuesday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        wednesday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        thursday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        friday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        saturday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        grocery: [],
        prep: []
      };
    }
    return this.events[weekKey];
  }

  onDateSelected(event: any) {
    const selectedDate = new Date(event.detail.value);
    const day = selectedDate.getDay();
    const sunday = new Date(selectedDate);
    sunday.setDate(selectedDate.getDate() - day);
  
    this.selectedPlan = sunday;
    sessionStorage.setItem('selectedPlan', sunday.toISOString());
    this.loadCalendar();
  }  

  async openDatePopover(ev: any) {
    const popover = await this.popoverController.create({
      component: DatePopoverComponent,
      event: ev,
      translucent: true,
      showBackdrop: true,
      componentProps: {
        selectedDate: this.selectedPlan?.toISOString(),
      },
    });
  
    popover.onDidDismiss().then((data) => {
      const selectedDate = data?.data?.value;
      if (selectedDate) {
        this.onDateSelected({ detail: { value: selectedDate } });
      }
    });
  
    await popover.present();
  }  
  
  
  

  // -------------------- Meal & Recipe Management --------------------

  // Called when a user adds a meal. Ensures a meal, day, and category are selected.
  addMeal() {
    if (!this.selectedMeal || !this.selectedDay || !this.selectedCategory) {
      alert('Please select a meal, day, and category.');
      return;
    }
    // If API details are missing, fetch them first.
    if ((!this.selectedMeal.ingredients || this.selectedMeal.ingredients.length === 0) &&
         this.selectedMeal.api_id && !this.selectedMeal.instructions) {
      this.recipeService.getRecipeDetailsFromApi(this.selectedMeal.api_id).subscribe(
        response => {
          const mealData = (response as any).meals[0];
          const ingredients: string[] = [];
          for (let i = 1; i <= 20; i++) {
            const ingredient = mealData[`strIngredient${i}`];
            const measure = mealData[`strMeasure${i}`];
            if (ingredient && ingredient.trim()) {
              ingredients.push(`${ingredient.trim()} - ${measure ? measure.trim() : ''}`);
            } else {
              break;
            }
          }
          this.selectedMeal.ingredients = ingredients;
          this.selectedMeal.instructions = mealData.strInstructions;
          this.pushMeal();
        },
        error => {
          console.error('Error fetching recipe details:', error);
          this.pushMeal();
        }
      );
    } else {
      this.pushMeal();
    }
  }

  // Clones the selected meal and adds it under the specified day and category.
  pushMeal() {
    const weekKey = this.selectedPlan.toDateString();
    if (!this.events[weekKey]) {
      this.events[weekKey] = {
        sunday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        monday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        tuesday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        wednesday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        thursday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        friday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        saturday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        grocery: [],
        prep: []
      };
    }
    const mealClone = JSON.parse(JSON.stringify(this.selectedMeal));
    mealClone.processedForGrocery = false;
    this.events[weekKey][this.selectedDay][this.selectedCategory].push(mealClone);
    this.calendarChanged = true;
    // Clear selections after adding.
    this.selectedMeal = null;
    this.selectedDay = '';
    this.selectedCategory = '';
  }

  // When a recipe is clicked, set it as hovered for details display.
  onRecipeClick(recipe: any) {
    if (recipe) {
      if (typeof recipe.ingredients === 'string') {
        recipe.ingredients = recipe.ingredients.split(',').map((ing: string) => ing.trim());
      } else {
        recipe.ingredients = recipe.ingredients || [];
      }
      recipe.instructions = recipe.instructions || '';
      this.hoveredRecipe = recipe;
      this.selectedEvent = recipe;
    } else {
      this.hoveredRecipe = null;
      this.selectedEvent = null;
    }
  }

  closeRecipeDetails() {
    this.hoveredRecipe = null;
    this.selectedEvent = null;
  }

  // Prompts for confirmation and removes a meal from the specified day and category.
  async confirmRemoveEvent(event: any, day: string, category: string, index: number, ev: Event) {
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
            this.events[weekKey][day][category].splice(index, 1);
            this.calendarChanged = true;
            this.selectedEvent = null;
            this.saveCalendar();
          }
        }
      ]
    });
    await alert.present();
  }

  // -------------------- Prep List Generation --------------------

  generatePrepList() {
    const weekKey = this.selectedPlan.toDateString();
    const weekEvents = this.events[weekKey] || {};
    const prepExists = weekEvents['prep'] && weekEvents['prep'].toString().trim() !== '';

    if (prepExists && !this.calendarChanged) {
      alert("No changes to the calendar detected. Prep list is up to date.");
      return;
    }

    let prepInstructions: string[] = [];
    // Loop through each day (excluding grocery & prep) and each category.
    for (const day in weekEvents) {
      if (day === 'grocery' || day === 'prep') continue;
      if (weekEvents.hasOwnProperty(day)) {
        for (const category in weekEvents[day]) {
          for (const meal of weekEvents[day][category]) {
            if (meal.instructions) {
              prepInstructions.push(`Recipe: ${meal.title}\nIngredients: ${meal.ingredients}\nInstructions: ${meal.instructions}`);
            }
          }
        }
      }
    }

    if (prepInstructions.length === 0) {
      alert("No recipes with instructions found for the selected week.");
      return;
    }

    const requestBody = {
      prompt: `Generate a combined prep list for the following recipes. 
Combine overlapping ingredients (e.g., chicken, onions) into a single step. 
Format the output as a numbered list with clear, concise instructions. 
Group ingredients by type (e.g., proteins, vegetables, dry ingredients) and specify quantities for each recipe:\n\n${prepInstructions.join('\n\n')}`,
      max_tokens: 8192,
      temperature: 0.7
    };

    console.log("Sending request to backend:", requestBody);

    this.http.post(`${environment.apiUrl}/api/deepseek`, requestBody).subscribe(
      (response: any) => {
        const prepListMarkdown = response.choices[0].message.content;
        console.log("DeepSeek response:", prepListMarkdown);
        sessionStorage.setItem('prepList', prepListMarkdown);
        if (!this.events[weekKey]) {
          this.events[weekKey] = {
            sunday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
            monday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
            tuesday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
            wednesday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
            thursday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
            friday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
            saturday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
            grocery: [],
            prep: []
          };
        }
        this.events[weekKey]['prep'] = prepListMarkdown;
        this.calendarChanged = false;
        this.saveCalendar();
        alert("Prep list generated successfully! Check console.");
      },
      (error) => {
        console.error("Error generating prep list:", error);
        alert("Failed to generate prep list.");
      }
    );
  }

  async viewPrepList() {
    let prepListMarkdown: string = sessionStorage.getItem('prepList') || "";
    const weekKey = this.selectedPlan.toDateString();
  
    if (!prepListMarkdown && this.events[weekKey] && this.events[weekKey]['prep']) {
      const prepFromEvent = this.events[weekKey]['prep'];
      prepListMarkdown = Array.isArray(prepFromEvent) ? "" : prepFromEvent as string;
      sessionStorage.setItem('prepList', prepListMarkdown);
    }
  
    if (prepListMarkdown === "") {
      alert('No prep list has been generated yet. Please generate one first.');
      return;
    }
  
    console.log("Loaded Prep List:", prepListMarkdown);
    this.prepListDisplay = await marked(prepListMarkdown);
    this.editedPrepMarkdown = prepListMarkdown;
    this.showPrepList = true;
  }

  async saveEditedPrepList() {
    const weekKey = this.selectedPlan.toDateString();
    this.events[weekKey]['prep'] = this.editedPrepMarkdown;
    this.prepListDisplay = await marked(this.editedPrepMarkdown);    
    sessionStorage.setItem('prepList', this.editedPrepMarkdown); 
    this.saveCalendar(); 
    this.editMode = false;  
  }
  
  
  

  // -------------------- Grocery List Generation --------------------

  async generateShoppingList() {
    const alert = await this.alertController.create({
      header: 'Confirm',
      message: 'Are you sure you want to create your shopping list? Only new ingredients will remove items from the pantry.',
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
    const weekEvents = this.currentWeekEvents;
    let newAggregated: { [ingredient: string]: { quantity: number, unit: string } } = {};

    // Aggregate ingredients from meals (excluding grocery & prep)
    for (const day in weekEvents) {
      if (day === 'grocery' || day === 'prep') continue;
      if (weekEvents.hasOwnProperty(day)) {
        for (const category in weekEvents[day]) {
          for (const meal of weekEvents[day][category]) {
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
      pantryData = { item_list: { pantry: [], freezer: [], spice: [] } };
    }
    const pantryItems: any[] = pantryData?.item_list?.pantry || [];

    // Append new ingredients to existing groceryListRaw.
    for (let key in newAggregated) {
      const newReq = newAggregated[key].quantity;
      if (newReq === 0) {
        if (!this.groceryListRaw[key]) {
          this.groceryListRaw[key] = { quantity: 0, unit: '' };
        }
      } else {
        if (this.groceryListRaw[key] !== undefined) {
          // Ingredient already exists: simply add the new quantity.
          this.groceryListRaw[key].quantity += newReq;
          newAggregated[key].quantity = 0;
        } else {
          // New ingredient: subtract from the pantry.
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

    const updatedPantryItems = pantryItems.filter(item => item.quantity > 0);
    const pantryPayload = {
      user_id: this.currentUser.id,
      pf_flag: false,
      item_list: { pantry: updatedPantryItems, freezer: pantryData?.item_list?.freezer || [] , spice: pantryData?.item_list?.spice || [] }
    };
    try {
      await this.pantryService.updatePantry(pantryPayload).toPromise();
      this.pantryService.triggerPantryReload();
      console.log('Pantry updated successfully after adjusting for new grocery list.');
    } catch (error) {
      console.error('Error updating pantry:', error);
    }

    // Format the final grocery list for display.
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
      this.events[weekKey] = {
        sunday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        monday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        tuesday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        wednesday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        thursday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        friday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        saturday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        grocery: [],
        prep: []
      };
    }
    this.events[weekKey]['grocery'] = formattedGroceryList;

    if (!this.currentUser || !this.currentUser.id) {
      console.error('User details not loaded. Cannot save calendar.');
      return;
    }
    const startDateString = this.selectedPlan.toISOString().split('T')[0];
    const weekData = this.events[weekKey] || {
      sunday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      monday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      tuesday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      wednesday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      thursday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      friday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      saturday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      grocery: [],
      prep: []
    };
    const payload = {
      user_ids: [this.currentUser.id],
      week: {
        sunday: weekData['sunday'] || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        monday: weekData['monday'] || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        tuesday: weekData['tuesday'] || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        wednesday: weekData['wednesday'] || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        thursday: weekData['thursday'] || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        friday: weekData['friday'] || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        saturday: weekData['saturday'] || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        grocery: weekData['grocery'] || [],
        prep: weekData['prep'] || []
      },
      start_date: startDateString
    };

    this.calendarService.saveCalendar(payload).subscribe(
      response => console.log('Calendar saved successfully:', response),
      error => console.error('Error saving calendar:', error)
    );
  }

  // -------------------- View Grocery List --------------------

  async viewShoppingList() {
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

  // -------------------- Save & Load Calendar --------------------

  saveCalendar() {
    if (!this.currentUser || !this.currentUser.id) {
      console.error('User details not loaded. Cannot save calendar.');
      return;
    }
    const weekKey = this.selectedPlan.toDateString();
    const calendarData = this.events[weekKey] || {
      sunday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      monday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      tuesday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      wednesday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      thursday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      friday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      saturday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      grocery: [],
      prep: []
    };
    const startDateString = this.selectedPlan.toISOString().split('T')[0];
    const weekData = calendarData || {
      sunday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      monday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      tuesday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      wednesday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      thursday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      friday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      saturday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      grocery: [],
      prep: []
    };
    const payload = {
      user_ids: [this.currentUser.id],
      week: {
        sunday: weekData['sunday'] || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        monday: weekData['monday'] || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        tuesday: weekData['tuesday'] || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        wednesday: weekData['wednesday'] || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        thursday: weekData['thursday'] || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        friday: weekData['friday'] || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        saturday: weekData['saturday'] || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        grocery: weekData['grocery'] || [],
        prep: weekData['prep'] || []
      },
      start_date: startDateString
    };

    this.calendarService.saveCalendar(payload).subscribe(
      response => console.log('Calendar saved successfully:', response),
      error => console.error('Error saving calendar:', error)
    );
  }

  loadCalendar() {
    if (!this.currentUser || !this.currentUser.id) {
      console.error('User details not loaded. Cannot load calendar.');
      return;
    }
    const weekParam = this.selectedPlan.toISOString().split('T')[0];
    this.calendarService.loadCalendar(this.currentUser.id, weekParam).subscribe(
      response => {
        const weekKey = this.selectedPlan.toDateString();
        if (response.length > 0) {
          const calendarData = response[0];
          this.events[weekKey] = {
            sunday: calendarData.week.sunday || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
            monday: calendarData.week.monday || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
            tuesday: calendarData.week.tuesday || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
            wednesday: calendarData.week.wednesday || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
            thursday: calendarData.week.thursday || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
            friday: calendarData.week.friday || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
            saturday: calendarData.week.saturday || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
            grocery: calendarData.week.grocery || [],
            prep: calendarData.week.prep || []
          };
          console.log('Loaded Calendar for week:', weekKey);
          if (this.events[weekKey]['grocery'] && this.events[weekKey]['grocery'].length > 0) {
            this.shoppingList = this.events[weekKey]['grocery'];
          }
        } else {
          this.events[weekKey] = {
            sunday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
            monday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
            tuesday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
            wednesday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
            thursday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
            friday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
            saturday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
            grocery: [],
            prep: []
          };
          console.log('No calendar data found for week:', weekKey);
        }
        console.log('Loaded Calendar!', this.events[weekKey]);
      },
      error => {
        console.error('Error loading calendar:', error);
      }
    );
  }

  // -------------------- Helper Methods --------------------

  // Converts a category key to a user-friendly name.
  formatCategory(cat: string): string {
    if (cat === 'kidsLunch') return 'Kids Lunch';
    if (cat === 'adultsLunch') return 'Adults Lunch';
    if (cat === 'familyDinner') return 'Family Dinner';
    return cat;
  }

  // Returns an array of ingredients for a given meal.
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
              const measure = mealData[`strMeasure${i}`];
              if (ingredient && ingredient.trim()) {
                ingredients.push(`${ingredient.trim()} - ${measure ? measure.trim() : ''}`);
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

  // Parses an ingredient string to extract quantity, unit, and name.
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

  // Converts a given quantity from various units to ounces.
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
}
