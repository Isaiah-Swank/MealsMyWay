// Import Angular core features and required services/components for the calendar page.
import { Component, OnInit, ViewChild, TemplateRef } from '@angular/core';
import { RecipeService } from '../services/recipe.service';
import { AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CalendarService } from '../services/calendar.service';
import { UserService } from '../services/user.service';
import { PantryService } from '../services/pantry.service';
import { environment } from '../../environments/environment';
import { marked } from 'marked'; // Markdown parser for converting markdown to HTML.
import { PopoverController } from '@ionic/angular';
import { DatePopoverComponent } from '../date-popover/date-popover.component';
import { ToastController } from '@ionic/angular';
import { LoadingController } from '@ionic/angular';

// Decorator to define the component metadata.
@Component({
  selector: 'app-tab2',
  templateUrl: 'calendar.page.html',
  styleUrls: ['calendar.page.scss']
})
export class Tab2Page implements OnInit {

  // -------------------- Calendar & Plan Management --------------------

  // Reference to the date picker popover template (using ViewChild).
  @ViewChild('datePickerPopover') datePickerPopover!: TemplateRef<any>;
  // Stores the start date of the current week (most recent Sunday).
  currentWeekStart!: Date;
  // Array of Date objects representing the current and previous weeks for planning.
  plans: Date[] = [];
  // Currently selected week (as Date) for which the calendar is displayed.
  selectedPlan!: Date;

  // -------------------- Meal Management --------------------

  // List of recipes available for selection.
  recipes: any[] = [];
  // Holds the selected recipes (e.g., [{ title: 'Recipe 1' }, { title: 'Recipe 2' }]).
  selectedRecipes: any[] = [];
  // Holds the selected days (e.g., ['monday', 'wednesday']).
  selectedDays: string[] = [];
  // Selected categories for the meal (can select multiple, e.g., 'kidsLunch').
  selectedCategories: string[] = [];

  // Array of category keys used for meal selection and display.
  categoryList: string[] = ['kidsLunch', 'adultsLunch', 'familyDinner'];

  // -------------------- Calendar Events Storage --------------------

  // Object to store calendar events; each key (week) contains days, which in turn contain category arrays plus grocery & prep lists.
  events: { [week: string]: any } = {};
  // Holds the recipe currently hovered over for detailed display.
  hoveredRecipe: any = null;
  // Holds the selected event (meal) for actions like removal.
  selectedEvent: any = null;

  // -------------------- Shopping List Properties --------------------

  // Final shopping/grocery list for display.
  shoppingList: string[] = [];
  // Object to store grocery lists per week.
  shoppingLists: { [week: string]: string[] } = {};
  // Aggregated grocery list object that holds unit amounts, measurement, and ingredient names.
  groceryListRaw: { [ingredient: string]: { unit: number, measurement: string, name: string } } = {};
  // Flag to show/hide the shopping list UI.
  showShoppingList: boolean = false;
  // Display version of the grocery list.
  groceryListDisplay: string[] = [];
  // Flag to enable edit mode for the grocery list.
  editGroceryMode: boolean = false;
  // Holds the edited grocery list text.
  editedGroceryText: string = '';

  // -------------------- Prep List Properties --------------------

  // Holds the rendered (HTML) prep list details.
  prepListDisplay: string = '';
  // Flag to show/hide the prep list.
  showPrepList: boolean = false;
  // Flag to track if the calendar has been updated (to trigger prep list regeneration).
  calendarChanged: boolean = false;

  // -------------------- User & Sharing Management --------------------

  // Currently logged-in user information.
  currentUser: any = null;
  // Search query for finding users to share the calendar with.
  searchQuery: string = '';
  // Search results array from user search.
  searchResults: any[] = [];
  // Flag to show/hide the share calendar search interface.
  showShareCalendar: boolean = false;
  // Flag to toggle editing mode (used for prep list editing).
  editMode: boolean = false;
  // Holds the edited prep list markdown text.
  editedPrepMarkdown: string = '';
  // Flag to show or hide the date picker.
  showDatePicker = false;

  // -------------------- Constructor & Dependency Injection --------------------
  // Inject necessary controllers and services via the constructor.
  constructor(
    private loadingController: LoadingController,
    private toastController: ToastController,
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
  // Called when the component is initialized.
  ngOnInit() {
    // Try to load the selected plan (week) from session storage.
    const storedPlan = sessionStorage.getItem('selectedPlan');
    if (storedPlan) {
      this.selectedPlan = new Date(storedPlan);
      // Set currentWeekStart based on the stored plan.
      this.setCurrentWeekStart();
    } else {
      // If no plan is stored, initialize current week and use it as the selected plan.
      this.setCurrentWeekStart();
      this.selectedPlan = this.currentWeekStart;
    }
    // Generate a list of week plans.
    this.generatePlans();
    // Load available recipes into the component.
    this.loadRecipes();

    // Load current user information either from navigation state or session storage.
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
    // If a user is loaded, load the calendar events.
    if (this.currentUser) {
      this.loadCalendar();
    }
  }

  // Called every time the view will enter; reloads recipes.
  ionViewWillEnter() {
    this.loadRecipes();
  }
  
  // -------------------- Methods Required by the Template --------------------

  // Called when the user changes the selected plan/week.
  onPlanChange() {
    // Save the selected plan (as ISO string) into session storage.
    sessionStorage.setItem('selectedPlan', this.selectedPlan.toISOString());
    // Reload the calendar for the selected week.
    this.loadCalendar();
  }

  // Toggles the visibility of the share calendar search interface.
  toggleShareCalendar() {
    this.showShareCalendar = !this.showShareCalendar;
  }

  // Searches for users using the userService based on the searchQuery.
  searchUsers() {
    // If the search query is empty, clear search results.
    if (this.searchQuery.trim() === '') {
      this.searchResults = [];
      return;
    }
    // Otherwise, perform a search.
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

  /**
   * Presents an alert offering to share either only the current calendar or all calendars.
   * Calls the addUserToCalendar method, updates shared plans, and saves the calendar.
   * @param user - The user with whom the calendar is to be shared.
   */
  async shareCalendar(user: any) {
    const alert = await this.alertController.create({
      header: 'Share Calendar',
      message: 'Do you want to share only this calendar or all your calendars with this user? Single Sharing is for one week and meant for users wanting to share with many people.\nAll Calendar sharing is meant for connecting 2 users within a household, when you share all calendars you and this user will be locked together',
      buttons: [
        {
          text: 'Only This Calendar',
          handler: () => {
            // Share only the current calendar.
            this.addUserToCalendar(user);
            this.saveCalendar(false); // Save without showing toast.
            this.presentToast(`Calendar shared successfully with ${user.username} (only this calendar).`);
          }
        },
        {
          text: 'All Calendars',
          handler: () => {
            // Share all calendars.
            this.addUserToCalendar(user);
            if (!this.currentUser.shared_plans) {
              this.currentUser.shared_plans = [];
            }
            if (!this.currentUser.shared_plans.includes(user.id)) {
              this.currentUser.shared_plans.push(user.id);
              sessionStorage.setItem('currentUser', JSON.stringify(this.currentUser));
              this.userService.updateSharedPlans(this.currentUser.id, this.currentUser.shared_plans)
                .subscribe(response => {
                  console.log('Shared plans updated on backend:', response);
                }, error => {
                  console.error('Error updating shared plans:', error);
                });
            }
            this.calendarService.updateSenderCalendars(this.currentUser.id)
              .subscribe(response => {
                console.log('Calendars updated with shared users:', response);
              }, error => {
                console.error('Error updating calendars:', error);
              });
            this.saveCalendar(false); // Save calendar without showing toast.
            this.presentToast(`All calendars shared successfully with ${user.username}.`);
          }
        }
      ]
    });
    await alert.present();
  }    

  // Adds the specified user to the calendar's shared user list.
  addUserToCalendar(user: any) {
    // Use formatted date as key for storing events.
    const weekKey = this.formatDateLocal(this.selectedPlan);
    let calendarData: any = this.events[weekKey];
    if (!calendarData) {
      // If no calendar data exists, initialize default structure.
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
      // If calendar data exists but no user_ids, initialize them.
      if (!calendarData.user_ids) {
        calendarData.user_ids = [this.currentUser.id];
      }
    }
    // Add the user id to the list if not already present.
    if (!calendarData.user_ids.includes(user.id)) {
      calendarData.user_ids.push(user.id);
    }
    // Use the formatted date string as the start date.
    const startDateString = this.formatDateLocal(this.selectedPlan);
    // Call the calendar service to add the user to the calendar.
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

  // Determines the most recent Sunday for the current week.
  setCurrentWeekStart() {
    const today = new Date();
    this.currentWeekStart = this.getStartOfWeek(today);
  }

  // Returns the Date for the start of the week (Sunday) for a given date.
  getStartOfWeek(date: Date): Date {
    const day = date.getDay(); // 0 corresponds to Sunday.
    const diff = date.getDate() - day; // Calculate difference to reach Sunday.
    return new Date(date.getFullYear(), date.getMonth(), diff);
  }

  // Generates an array of week plans (current week and previous 19 weeks).
  generatePlans() {
    this.plans.push(this.currentWeekStart);
    const numberOfPreviousWeeks = 19;
    for (let i = 1; i <= numberOfPreviousWeeks; i++) {
      const previousSunday = new Date(this.currentWeekStart);
      previousSunday.setDate(this.currentWeekStart.getDate() - 7 * i);
      this.plans.push(previousSunday);
    }
  }

  // Loads recipes from session storage.
  loadRecipes() {
    this.recipes = JSON.parse(sessionStorage.getItem('selectedRecipes') || '[]');
    console.log('Updated recipes in Calendar:', this.recipes);
  }
  
  // Getter that returns calendar events for the selected week,
  // initializing a default structure if none exist.
  get currentWeekEvents() {
    const weekKey = this.formatDateLocal(this.selectedPlan);
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

  // Handler for date selection from a date picker.
  onDateSelected(event: any) {
    const selectedDate = new Date(event.detail.value);
    const day = selectedDate.getDay();
    // Calculate the most recent Sunday from the selected date.
    const sunday = new Date(selectedDate);
    sunday.setDate(selectedDate.getDate() - day);
  
    this.selectedPlan = sunday;
    sessionStorage.setItem('selectedPlan', sunday.toISOString());
    this.loadCalendar();
  }

  // Opens the date picker popover.
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
  
    // When the popover is dismissed, update the selected date.
    popover.onDidDismiss().then((data) => {
      const selectedDate = data?.data?.value;
      if (selectedDate) {
        this.onDateSelected({ detail: { value: selectedDate } });
      }
    });
  
    await popover.present();
  }  

  // -------------------- Meal & Recipe Management --------------------

  // Adds a meal to the calendar; validates selections and fetches API details if necessary.
  addMeal() {
    // Ensure at least one recipe, one day, and one category are selected.
    if (!this.selectedRecipes || this.selectedRecipes.length === 0 || !this.selectedDays || this.selectedDays.length === 0 || !this.selectedCategories || this.selectedCategories.length === 0) {
      alert('Please select at least one recipe, one day, and one category.');
      return;
    }
  
    // Loop through each selected recipe.
    this.selectedRecipes.forEach((recipe) => {
      // If the recipe is missing ingredients/instructions but has an API id, fetch details from the API.
      if ((!recipe.ingredients || recipe.ingredients.length === 0) && recipe.api_id && !recipe.instructions) {
        this.recipeService.getRecipeDetailsFromApi(recipe.api_id).subscribe(
          response => {
            const mealData = (response as any).meals[0];
            const ingredients: string[] = [];
            // Loop through potential ingredient fields.
            for (let i = 1; i <= 20; i++) {
              const ingredient = mealData[`strIngredient${i}`];
              const measure = mealData[`strMeasure${i}`];
              if (ingredient && ingredient.trim()) {
                ingredients.push(`${ingredient.trim()} - ${measure ? measure.trim() : ''}`);
              } else {
                break;
              }
            }
            // Assign fetched ingredients and instructions to the recipe.
            recipe.ingredients = ingredients;
            recipe.instructions = mealData.strInstructions;
            this.pushMeal(recipe);
          },
          error => {
            console.error('Error fetching recipe details:', error);
            this.pushMeal(recipe);
          }
        );
      } else {
        // If details are already present, directly add the recipe.
        this.pushMeal(recipe);
      }
    });
  }
  
  // Clones the selected meal and adds it to the calendar under each chosen category.
  pushMeal(recipe: any) {
    const weekKey = this.formatDateLocal(this.selectedPlan);
    // Initialize week events if they do not exist.
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
  
    // Loop through each selected day and category to add the recipe.
    this.selectedDays.forEach((day: string) => {
      this.selectedCategories.forEach((category: string) => {
        const mealClone = JSON.parse(JSON.stringify(recipe)); // Deep clone the recipe.
        mealClone.processedForGrocery = false;
  
        // Ensure the category array exists for the selected day.
        if (!this.events[weekKey][day][category]) {
          this.events[weekKey][day][category] = [];
        }
        // Add the cloned recipe into the specified day and category.
        this.events[weekKey][day][category].push(mealClone);
      });
    });
  
    // Mark that changes have been made to the calendar.
    this.calendarChanged = true;

    this.saveCalendar(); // Save the calendar after adding the meal.
  }
  
  // When a recipe is clicked, show its details by setting it as hovered.
  onRecipeClick(recipe: any) {
    if (recipe) {
      // If ingredients are a string, split them into an array.
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

  // Closes the recipe details view.
  closeRecipeDetails() {
    this.hoveredRecipe = null;
    this.selectedEvent = null;
  }

  // Prompts the user for confirmation before removing a meal event from the calendar.
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
            const weekKey = this.formatDateLocal(this.selectedPlan);
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

  // Prompts for confirmation before removing a recipe from the recipe list.
  async confirmRemoveRecipe(recipe: any, index: number, ev: Event) {
    ev.stopPropagation(); // Prevent the click from triggering recipe detail view.
    const alert = await this.alertController.create({
      header: 'Confirm Removal',
      message: `Are you sure you want to remove "${recipe.title}" from your recipe list?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Remove',
          handler: () => {
            // Remove the recipe from the list.
            this.recipes.splice(index, 1);
            // Update session storage to persist the change.
            sessionStorage.setItem('selectedRecipes', JSON.stringify(this.recipes));
          }
        }
      ]
    });
    await alert.present();
  }
  
  // -------------------- Prep List Generation --------------------

  // Generates a combined prep list based on the recipes in the calendar.
  async generatePrepList() {
    const weekKey = this.formatDateLocal(this.selectedPlan);
    const weekEvents = this.events[weekKey] || {};
    // Check if a prep list already exists and if the calendar hasn't changed.
    const prepExists = weekEvents['prep'] && weekEvents['prep'].toString().trim() !== '';
  
    if (prepExists && !this.calendarChanged) {
      alert("No changes to the calendar detected. Prep list is up to date.");
      return;
    }
  
    let prepInstructions: string[] = [];
    // Loop through each day in the week (excluding grocery & prep sections).
    for (const day in weekEvents) {
      if (day === 'grocery' || day === 'prep') continue;
      if (weekEvents.hasOwnProperty(day)) {
        // Loop through each category on that day.
        for (const category in weekEvents[day]) {
          for (const meal of weekEvents[day][category]) {
            if (meal.instructions) {
              // Assemble instructions for each meal.
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
  
    // Construct the prompt to send to the backend for generating a prep list.
    const requestBody = {
      prompt: `Generate a combined prep list for the following recipes. 
  Combine overlapping ingredients (e.g., chicken, onions) into a single step. 
  Format the output as a numbered list with clear, concise instructions. 
  Group ingredients by type (e.g., proteins, vegetables, dry ingredients) and specify quantities for each recipe:\n\n${prepInstructions.join('\n\n')}`,
      max_tokens: 8192,
      temperature: 0.7
    };
  
    // Show a loading spinner while waiting for the backend response.
    const loading = await this.loadingController.create({
      message: 'Generating prep list... please wait',
      spinner: 'crescent'
    });
    await loading.present();
  
    console.log("Sending request to backend:", requestBody);
    // Post the request to the backend API.
    this.http.post(`${environment.apiUrl}/api/deepseek`, requestBody).subscribe(
      async (response: any) => {
        // Dismiss the spinner on response.
        await loading.dismiss();
  
        // Extract the generated markdown prep list.
        const prepListMarkdown = response.choices[0].message.content;
        console.log("DeepSeek response:", prepListMarkdown);
        sessionStorage.setItem('prepList', prepListMarkdown);
        
        // Ensure the week events structure exists.
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
        // Save the generated prep list in the events object.
        this.events[weekKey]['prep'] = prepListMarkdown;
        // Mark calendar as unchanged.
        this.calendarChanged = false;
        this.saveCalendar(false);
  
        // Show a toast message indicating success.
        this.presentToast('Prep list generated successfully! It is now ready.');
      },
      async (error) => {
        await loading.dismiss();
        console.error("Error generating prep list:", error);
        this.presentToast("Failed to generate prep list. Please try again.");
      }
    );
  }
  
  // Loads and displays the prep list.
  async viewPrepList() {
    let prepListMarkdown: string = sessionStorage.getItem('prepList') || "";
    const weekKey = this.formatDateLocal(this.selectedPlan);
  
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
    // Render the markdown prep list into HTML.
    this.prepListDisplay = await marked(prepListMarkdown);
    this.editedPrepMarkdown = prepListMarkdown;
    this.showPrepList = true;
  }

  // Saves the edited prep list markdown.
  async saveEditedPrepList() {
    const weekKey = this.formatDateLocal(this.selectedPlan);
    this.events[weekKey]['prep'] = this.editedPrepMarkdown;
    this.prepListDisplay = await marked(this.editedPrepMarkdown);    
    sessionStorage.setItem('prepList', this.editedPrepMarkdown); 
    this.saveCalendar(); 
    this.editMode = false;  
  }
  
  // -------------------- Grocery List Generation --------------------

  // Initiates grocery list generation with a confirmation alert.
  async generateShoppingList() {
    const alert = await this.alertController.create({
      header: 'Confirm',
      message: 'Are you sure you want to create your shopping list? This will remove ingredients from your pantry if there is a match. If you are generating a new list over an old one, just the new recipe ingredeints will be removed from the pantry.',
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

  // Helper method to format a Date as a local string (YYYY-MM-DD).
  private formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  }
  
  // Generates and aggregates the grocery list based on the current week's events.
  async createShoppingList() {
    const weekKey = this.formatDateLocal(this.selectedPlan);
    const weekEvents = this.currentWeekEvents;
  
    // Array to track names of items used from the freezer.
    let freezerUsed: string[] = [];
  
    // Ensure groceryListRaw exists.
    if (!this.groceryListRaw) {
      this.groceryListRaw = {};
    }
  
    // Load pantry data from the backend.
    let pantryData;
    try {
      pantryData = await this.pantryService.loadPantry(this.currentUser.id).toPromise();
    } catch (error) {
      console.error("Error loading pantry data", error);
      pantryData = { item_list: { pantry: [], freezer: [], spice: [] } };
    }
    // Extract freezer and spice items from pantry data.
    const freezerItems: any[] = pantryData?.item_list?.freezer || [];
    const spiceItems: any[] = pantryData?.item_list?.spice || [];
  
    // Create an object to aggregate required ingredients.
    let newAggregated: { [ingredient: string]: { unit: number, measurement: string, name: string } } = {};
  
    // Loop through each day (excluding 'grocery' & 'prep') and each category.
    for (const day in weekEvents) {
      if (day === 'grocery' || day === 'prep') continue;
      if (weekEvents.hasOwnProperty(day)) {
        for (const category in weekEvents[day]) {
          for (const meal of weekEvents[day][category]) {
            // Check if the meal exists in the freezer with quantity > 0.
            if (meal.title) {
              const freezerMatch = freezerItems.find(
                item => item.name.toLowerCase() === meal.title.toLowerCase() && (item.quantity ?? 0) > 0
              );
              if (freezerMatch) {
                console.log(`Skipping meal "${meal.title}" as it is available in the freezer.`);
                // Record the freezer item usage if not already recorded.
                if (!freezerUsed.includes(freezerMatch.name)) {
                  freezerUsed.push(freezerMatch.name);
                }
                // Decrement the freezer quantity.
                freezerMatch.quantity = Math.max((freezerMatch.quantity ?? 0) - 1, 0);
                continue; // Skip processing this meal.
              }
            }
            // Process the meal if it hasn't been processed for grocery list yet.
            if (!meal.processedForGrocery) {
              const ingredients = await this.getIngredientsForMeal(meal);
              ingredients.forEach((ingredientStr) => {
                const parsed = this.parseIngredient(ingredientStr);
                if (parsed && parsed.unit > 0) {
                  // Use lower-case version of the ingredient name as a key.
                  const key = parsed.name.toLowerCase();
                  if (newAggregated[key] !== undefined) {
                    newAggregated[key].unit += parsed.unit;
                  } else {
                    newAggregated[key] = {
                      unit: parsed.unit,
                      measurement: parsed.measurement,
                      name: parsed.name
                    };
                  }
                }
              });
              // Mark meal as processed for grocery to avoid duplicate processing.
              meal.processedForGrocery = true;
            }
          }
        }
      }
    }
  
    // Process each aggregated ingredient to subtract any available pantry quantities.
    for (let key in newAggregated) {
      const newReq = newAggregated[key].unit;
      const measurement = newAggregated[key].measurement;
      const originalName = newAggregated[key].name;
      let remaining = newReq;
      let foundMatch = false;
  
      // --- 1. Direct Match Check ---
      for (const item of pantryData!.item_list.pantry) {
        if ((item.name || '').toLowerCase() === key) {
          // If the measurement also matches.
          if (((item.measurement || '').toLowerCase()) === measurement.toLowerCase()) {
            if ((item.unit ?? 0) >= remaining) {
              item.unit = (item.unit ?? 0) - remaining;
              remaining = 0;
              foundMatch = true;
              break;
            } else {
              remaining -= (item.unit ?? 0);
              item.unit = 0;
              foundMatch = true;
              break;
            }
          } else {
            // If measurements mismatch, invoke a conversion popup.
            const conversionResult = await this.showGroceryConversionPopup(
              newAggregated[key].name,
              measurement,
              item.measurement || '',
              (item.unit ?? 0),
              remaining,
              item.name // Use pantry ingredient name.
            );
            item.unit = Math.max((item.unit ?? 0) - (conversionResult.pantryDeduction || 0), 0);
            remaining = conversionResult.groceryPurchase || 0;
            foundMatch = true;
            break;
          }
        }
      }
  
      // --- 2. Substring Match Check ---
      if (!foundMatch) {
        for (const item of pantryData!.item_list.pantry) {
          const recipeName = newAggregated[key].name.toLowerCase();
          const pantryName = (item.name || '').toLowerCase();
          if (recipeName.includes(pantryName) || pantryName.includes(recipeName)) {
            const conversionResult = await this.showGroceryConversionPopup(
              newAggregated[key].name,
              measurement,
              item.measurement || '',
              (item.unit ?? 0),
              remaining,
              item.name // Use pantry ingredient name.
            );
            item.unit = Math.max((item.unit ?? 0) - (conversionResult.pantryDeduction || 0), 0);
            remaining = conversionResult.groceryPurchase || 0;
            foundMatch = true;
            break;
          }
        }
      }
  
      // --- 3. Merge remaining quantity into the aggregated grocery list if any remains.
      if (remaining > 0) {
        if (this.groceryListRaw[key] !== undefined) {
          this.groceryListRaw[key].unit += remaining;
        } else {
          this.groceryListRaw[key] = { unit: remaining, measurement: measurement, name: originalName };
        }
      }
    }
  
    // ------------------ Process Spice Items ------------------
    for (let key in newAggregated) {
      if (newAggregated.hasOwnProperty(key)) {
        const spiceMatch = spiceItems.find(item => item.name.toLowerCase() === key);
        if (spiceMatch && (spiceMatch.quantity ?? 0) > 0) {
          console.log(`Spice "${spiceMatch.name}" decremented by 1. Remaining: ${(spiceMatch.quantity ?? 0) - 1}`);
          // Decrement one unit from the spice rack.
          spiceMatch.quantity = (spiceMatch.quantity ?? 0) - 1;
          // Optionally remove from grocery list if already present.
          if (this.groceryListRaw[key]) {
            delete this.groceryListRaw[key];
          }
        }
      }
    }
  
    // ------------------ Format the Aggregated Grocery List ------------------
    const filteredGrocery = Object.entries(this.groceryListRaw)
      .filter(([k, v]) => (v.unit ?? 0) > 0);
    const formattedGroceryList = filteredGrocery.map(([key, details]) => {
      const displayName = details.name || (key.charAt(0).toUpperCase() + key.slice(1));
      if (details.measurement.trim() === '' && details.unit === 1) {
        return displayName;
      }
      return `${details.unit} ${details.measurement ? details.measurement + ' ' : ''}${displayName}`;
    });
  
    // Update the weekly shopping list state.
    this.shoppingLists[weekKey] = formattedGroceryList;
    this.shoppingList = formattedGroceryList;
    this.groceryListDisplay = formattedGroceryList;
    this.editedGroceryText = formattedGroceryList.join('\n');
    console.log('Updated Grocery List for', weekKey, ':', formattedGroceryList);
    this.showShoppingList = true;
  
    // Ensure events for the week exist; if not, initialize default structure.
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
    // Update the grocery field for the week.
    this.events[weekKey]['grocery'] = formattedGroceryList;
  
    // ------------------ Update Pantry Data in the Backend ------------------
    // Filter out pantry items with zero unit.
    const updatedPantryItems = pantryData!.item_list.pantry;
    const pantryPayload = {
      user_id: this.currentUser.id,
      pf_flag: false,
      item_list: {
        pantry: updatedPantryItems,
        freezer: pantryData!.item_list.freezer || [],
        spice: spiceItems
      }
    };
    try {
      await this.pantryService.updatePantry(pantryPayload).toPromise();
      this.pantryService.triggerPantryReload();
      console.log('Pantry updated successfully after adjusting for new grocery list.');
    } catch (error) {
      console.error('Error updating pantry:', error);
    }
  
    // ------------------ Save the Updated Calendar ------------------
    if (!this.currentUser || !this.currentUser.id) {
      console.error('User details not loaded. Cannot save calendar.');
      return;
    }
    const startDateString = this.formatDateLocal(this.selectedPlan);
    // Get the week's event data.
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
  
    // Build an array of user IDs including shared calendars.
    let userIds: number[] = [this.currentUser.id];
    if (this.currentUser.shared_plans && Array.isArray(this.currentUser.shared_plans)) {
      this.currentUser.shared_plans.forEach((sharedId: number) => {
        if (!userIds.includes(sharedId)) {
          userIds.push(sharedId);
        }
      });
    }
  
    const payload = {
      user_ids: userIds,
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

    // Reset calendarChanged flag
    this.calendarChanged = false;
  
    // ------------------ Toast Notification for Freezer Items Used ------------------
    if (freezerUsed.length > 0) {
      this.presentToast(`Used from freezer: ${freezerUsed.join(', ')}`);
    }
  }
  
  // -------------------- View Grocery List --------------------

  // Loads and displays the shopping list for the selected week.
  async viewShoppingList() {
    const weekKey = this.formatDateLocal(this.selectedPlan);
    const loadedWeek = this.events[weekKey];
    const groceryList = loadedWeek ? loadedWeek['grocery'] : null;
  
    if (!groceryList || groceryList.length === 0) {
      alert('No grocery list has been generated yet for this week. Please generate a grocery list first.');
    } else {
      console.log('Grocery list for the week:', groceryList);
      this.groceryListDisplay = groceryList;
      // Set an editable version of the grocery list.
      this.editedGroceryText = groceryList.join('\n');
      this.showShoppingList = true;
    }
  }

  // Saves an edited grocery list.
  saveEditedGroceryList() {
    const weekKey = this.formatDateLocal(this.selectedPlan);
    
    // Split edited text into individual non-empty lines.
    const updatedList = this.editedGroceryText
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
  
    // Update the events object with the new grocery list.
    this.events[weekKey]['grocery'] = updatedList;
    this.shoppingList = updatedList;
    this.groceryListDisplay = updatedList;
  
    this.saveCalendar();
    this.editGroceryMode = false;
    alert('Grocery list saved successfully.');
  }
  
  // -------------------- Save & Load Calendar --------------------

  // Saves the current calendar state.
  saveCalendar(showToast: boolean = true) {
    // Reload currentUser from session storage to use the latest shared plans.
    const storedUser = sessionStorage.getItem('currentUser');
    if (storedUser) {
      this.currentUser = JSON.parse(storedUser);
    } else {
      console.error('User details not loaded. Cannot save calendar.');
      return;
    }
  
    const weekKey = this.formatDateLocal(this.selectedPlan);
    console.log("Week Key:", weekKey);
  
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
  
    // Build an array of user IDs (current user + shared users).
    let userIds: number[] = [this.currentUser.id];
    if (this.currentUser.shared_plans && Array.isArray(this.currentUser.shared_plans)) {
      this.currentUser.shared_plans.forEach((sharedId: number) => {
        if (!userIds.includes(sharedId)) {
          userIds.push(sharedId);
        }
      });
    }
  
    const startDateString = this.selectedPlan.toISOString().split('T')[0];
  
    // Construct payload with user IDs, week data, and start date.
    const payload = {
      user_ids: userIds,
      week: {
        sunday: calendarData['sunday'] || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        monday: calendarData['monday'] || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        tuesday: calendarData['tuesday'] || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        wednesday: calendarData['wednesday'] || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        thursday: calendarData['thursday'] || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        friday: calendarData['friday'] || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        saturday: calendarData['saturday'] || { kidsLunch: [], adultsLunch: [], familyDinner: [] },
        grocery: calendarData['grocery'] || [],
        prep: calendarData['prep'] || []
      },
      start_date: startDateString
    };
  
    // Save the calendar data via the calendarService.
    this.calendarService.saveCalendar(payload).subscribe(
      response => {
        console.log('Calendar saved successfully:', response);
        if (showToast) {
          this.presentToast('Calendar saved successfully!');
        }
      },
      error => {
        console.error('Error saving calendar:', error);
        if (showToast) {
          this.presentToast('Error saving calendar. Please try again.');
        }
      }
    );
  }

  // Loads the calendar data for the current user and selected week.
  loadCalendar() {
    if (!this.currentUser || !this.currentUser.id) {
      console.error('User details not loaded. Cannot load calendar.');
      return;
    }
    const weekParam = this.selectedPlan.toISOString().split('T')[0];
    this.calendarService.loadCalendar(this.currentUser.id, weekParam).subscribe(
      response => {
        const weekKey = this.formatDateLocal(this.selectedPlan);
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

          // Update the shopping list and groceryListRaw for the selected week.
          this.shoppingList = this.events[weekKey]['grocery'] || [];
          this.groceryListRaw = {};
          this.shoppingList.forEach(item => {
            const parsed = this.parseIngredient(item);
            if (parsed) {
              const key = parsed.name.toLowerCase();
              if (this.groceryListRaw[key]) {
                this.groceryListRaw[key].unit += parsed.unit;
              } else {
                this.groceryListRaw[key] = {
                  unit: parsed.unit,
                  measurement: parsed.measurement,
                  name: parsed.name
                };
              }
            }
          });
        } else {
          // Initialize an empty calendar structure if no data is found.
          console.log('No calendar data found for week:', weekKey);
          this.initializeBlankCalendar(weekKey);
        }
      },
      error => {
        console.error('Error loading calendar:', error);
        const weekKey = this.formatDateLocal(this.selectedPlan);
        // Initialize a blank calendar if an error occurs.
        this.initializeBlankCalendar(weekKey);
      }
    );
  }

  // Initializes a blank calendar for the given week key.
  initializeBlankCalendar(weekKey: string) {
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
    console.log('Initialized blank calendar for week:', weekKey);

    // Reset the shopping list and groceryListRaw for the new week.
    this.shoppingList = [];
    this.groceryListRaw = {};
  }

  // -------------------- Helper Methods --------------------

  // Converts a category key (e.g., "kidsLunch") into a user-friendly label.
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
          // Determine separator (comma or newline) then split accordingly.
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
      // If ingredients are not present, fetch them from the API using the recipe service.
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

  // -------------------- Updated parseIngredient() --------------------
  // Parses an ingredient string into a structured object containing unit, measurement, and name.
  private parseIngredient(ingredientStr: string): { unit: number, measurement: string, name: string } | null {
    // If no numeric digit is found, assume a default unit of 1 (useful for spices).
    if (!ingredientStr.match(/\d/)) {
      return { unit: 1, measurement: '', name: ingredientStr.trim() };
    }
    
    // 1. Try matching the "Name - quantity measurement" (or using a colon) pattern.
    const regexNew = /^(.+?)\s*[-:]\s*(\d+(?:\.\d+)?)(?:\s*(\w+))?$/;
    let match = ingredientStr.match(regexNew);
    if (match) {
      const name = match[1].trim();
      const quantity = parseFloat(match[2]);
      let measurement = match[3] ? match[3].trim() : '';
      // Normalize measurement and check conversion map.
      const normalizedMeasurement = measurement.toLowerCase();
      const conversionMap: { [key: string]: number } = {
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
        'tsp': 0.166667
      };
      if (normalizedMeasurement && conversionMap[normalizedMeasurement]) {
        const convertedQuantity = this.convertToOunces(quantity, measurement);
        return { unit: convertedQuantity, measurement: 'oz', name };
      } else {
        return { unit: quantity, measurement: measurement, name };
      }
    }
    
    // 2. Try matching the "quantity measurement name" format (e.g., "1 oz Olive Oil").
    const regexStandard = /^(\d+(?:\.\d+)?)\s*(\w+)\s+(.*)$/;
    match = ingredientStr.match(regexStandard);
    if (match) {
      const quantity = parseFloat(match[1]);
      const measurement = match[2].trim();
      const name = match[3].trim();
      const normalizedMeasurement = measurement.toLowerCase();
      const conversionMap: { [key: string]: number } = {
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
        'tsp': 0.166667
      };
      if (normalizedMeasurement && conversionMap[normalizedMeasurement]) {
        const convertedQuantity = this.convertToOunces(quantity, measurement);
        return { unit: convertedQuantity, measurement: 'oz', name };
      } else {
        return { unit: quantity, measurement: measurement, name };
      }
    }
    
    // 3. Fallback: try matching a simple pattern like "1 Cucumber".
    const regexOld = /^(\d+(?:\.\d+)?)\s+(.*)$/;
    match = ingredientStr.match(regexOld);
    if (match) {
      const quantity = parseFloat(match[1]);
      const name = match[2].trim();
      return { unit: quantity, measurement: '', name };
    }
    
    return null;
  }
  
  // Converts a given quantity from the specified unit to ounces.
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
   * Displays an alert to help convert grocery items when measurements differ.
   * @param recipeIngredientName - Ingredient name from recipe.
   * @param recipeUnit - Unit from recipe.
   * @param pantryMeasurement - Measurement unit in the pantry.
   * @param availablePantryQuantity - Quantity available in the pantry.
   * @param requiredQuantity - Quantity required by the recipe.
   * @param pantryItemName - (Optional) Pantry ingredient name.
   * @returns A promise resolving to an object containing the pantry deduction and additional grocery purchase required.
   */
  async showGroceryConversionPopup(
    recipeIngredientName: string,
    recipeUnit: string,
    pantryMeasurement: string,
    availablePantryQuantity: number,
    requiredQuantity: number,
    pantryItemName?: string
  ): Promise<{ pantryDeduction: number, groceryPurchase: number }> {
    return new Promise(async (resolve, reject) => {
      const alert = await this.alertController.create({
        header: 'Grocery Conversion',
        message: `The recipe calls for ${requiredQuantity} ${recipeUnit} ${recipeIngredientName}, 
  but you have ${availablePantryQuantity} ${pantryMeasurement} ${pantryItemName ? pantryItemName : 'the ingredient'} in your pantry.
  How much would you like to use?`,
        inputs: [
          {
            name: 'pantryDeduction',
            type: 'number',
            placeholder: `Use from pantry (max ${availablePantryQuantity})`
          },
          {
            name: 'groceryPurchase',
            type: 'number',
            placeholder: `Amount to buy`
          }
        ],
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => {
              resolve({ pantryDeduction: 0, groceryPurchase: 0 });
            }
          },
          {
            text: 'Send',
            handler: (data) => {
              const pantryDeduction = parseFloat(data.pantryDeduction);
              const groceryPurchase = parseFloat(data.groceryPurchase);
              resolve({
                pantryDeduction: isNaN(pantryDeduction) ? 0 : pantryDeduction,
                groceryPurchase: isNaN(groceryPurchase) ? 0 : groceryPurchase
              });
            }
          }
        ]
      });
      await alert.present();
    });
  }

  // Presents a toast message at the middle of the screen.
  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      position: 'middle',
      cssClass: 'my-custom-toast' // Custom CSS class for toast styling.
    });
    toast.present();
  }
  
}