// Import necessary Angular core features and services used by the RecipesPage component.
import { Component, OnInit } from '@angular/core';
import { RecipeService } from '../services/recipe.service';
import { Platform, ModalController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

interface Recipe {
  id: number;
  author: string;
  title: string;
  ingredients: string;
  instructions: string;
  tag: string;
  api_id?: string | null;
  pantry?: boolean | null;
}

interface RecipeResponse {
  message: string;
  recipe: Recipe;
}

@Component({
  selector: 'app-recipes',
  templateUrl: './recipes.page.html',
  styleUrls: ['./recipes.page.scss'],
})
export class RecipesPage implements OnInit {
  // -------------------- Flags & State Variables --------------------

  // Flag to show or hide the collapsible create recipe form.
  showCreateRecipe: boolean = false;

  // -------------------- Recipe Data Arrays --------------------

  // Array holding all recipes fetched from the backend.
  recipes: any[] = [];
  // Array of recipes that match the user's search query.
  filteredRecipes: any[] = [];
  // Array of recipes selected via checkboxes (if applicable).
  selectedRecipes: any[] = [];
  // Array of recipes added to the left container; each gets an extra 'isExpanded' property
  // for toggling detailed view display.
  selectedRecipesList: any[] = [];

  // -------------------- Device & UI Control --------------------

  // Flag to determine whether the app is running on a mobile device.
  isMobile: boolean = false;
  // Flag to control the visibility of the edit recipe modal.
  isEditFormOpen: boolean = false;
  // Indicates if a recipe submission is currently in progress to prevent duplicate submissions.
  isSubmitting: boolean = false;

  // -------------------- New Recipe Model --------------------

  // Model for a new recipe, bound to the create recipe form.
  newRecipe: any = {
    author: '',
    title: '',
    ingredients: '',
    instructions: '',
    tag: ''
  };

  // -------------------- Edit Recipe Model --------------------

  // Model for editing an existing recipe.
  editRecipeData: any = {
    id: null,
    author: '',
    title: '',
    ingredients: '',
    instructions: '',
    tag: ''
  };

  // -------------------- Constructor & Dependency Injection --------------------
  // The constructor injects required services, HTTP client, modal controller, router, etc.
  constructor(
    private recipeService: RecipeService,
    private platform: Platform,
    private http: HttpClient,
    private modalCtrl: ModalController,
    private router: Router
  ) {}

  // -------------------- Lifecycle Hook --------------------
  // Called when the component is initialized.
  ngOnInit() {
    // Load all recipes from the backend.
    this.loadRecipes();
    // Check the device type to adjust UI elements for mobile if needed.
    this.checkDeviceType();
  }

  // Checks the device type using Ionic Platform. Sets isMobile flag for small screens.
  checkDeviceType() {
    this.platform.ready().then(() => {
      this.isMobile = this.platform.width() <= 767;
    });
  }

  // -------------------- UI Toggling Methods --------------------

  // Toggles the visibility of the create recipe form.
  toggleCreateRecipe() {
    this.showCreateRecipe = !this.showCreateRecipe;
  }

  /**
   * submitRecipe
   * Validates the new recipe form and sends a POST request to the backend.
   * On success, reloads recipes, adds the new recipe to the selected list, and resets the form.
   */
  submitRecipe() {
    // Prevent duplicate submissions.
    if (this.isSubmitting) return;
    this.isSubmitting = true;
  
    const recipeData = { ...this.newRecipe };
  
    // 🧹 Clean and format ingredients
    recipeData.ingredients = recipeData.ingredients
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .map((line: string) => line.replace(/,/g, ''))
      .join(', ');
  
    // Validate required fields after cleaning
    if (!recipeData.author || !recipeData.title || !recipeData.ingredients || !recipeData.instructions) {
      alert('Please fill in all required fields.');
      this.isSubmitting = false;
      return;
    }
  
    console.log('Submitting recipe:', recipeData);
  
    this.http.post<RecipeResponse>(`${environment.apiUrl}/recipes`, recipeData).subscribe(
      (response) => {
        console.log('Backend Response:', response);
        if (response.message === 'Recipe created successfully.' && response['recipe']) {
          const newRecipeWithId = { ...(response as any).recipe, isExpanded: false };
          this.selectedRecipes.push(newRecipeWithId);
          this.selectedRecipesList.push(newRecipeWithId);
          this.loadRecipes();
          this.newRecipe = { author: '', title: '', ingredients: '', instructions: '', tag: '' };
        } else {
          alert('Failed to add the recipe');
        }
        this.isSubmitting = false;
      },
      (error) => {
        console.error('Error occurred while submitting the recipe:', error);
        alert('An error occurred. Please try again later.');
        this.isSubmitting = false;
      }
    );
  }
  

  /**
   * loadRecipes
   * Retrieves recipes from the backend via the RecipeService.
   * Filters out recipes that have the pantry flag set to true and ensures a tag exists.
   * Also updates the service with the fetched recipes and synchronizes the filtered list.
   */
  loadRecipes() {
    this.recipeService.getRecipes().subscribe(
      (recipes) => {
        // Filter out pantry recipes and ensure every recipe has a tag (empty string if not provided).
        this.recipes = recipes
          .filter(recipe => recipe.pantry != true)
          .map(recipe => ({
            ...recipe,
            tag: recipe.tag || ''
          }));
        // Optionally inform other parts of the app by updating the recipe service.
        this.recipeService.setRecipes(this.recipes);
        // Initialize the filtered recipes with all recipes.
        this.filteredRecipes = [...this.recipes];
      },
      (error) => {
        console.error('Error fetching recipes:', error);
      }
    );
  }

  /**
   * filterRecipes
   * Filters the list of recipes as the user types in the search bar.
   * It matches the search term against both the recipe title and tag.
   */
  filterRecipes(event: any) {
    const searchTerm = event.target.value.toLowerCase();
    if (searchTerm) {
      this.filteredRecipes = this.recipes.filter(recipe =>
        recipe.title.toLowerCase().includes(searchTerm) ||
        (recipe.tag && recipe.tag.toLowerCase().includes(searchTerm))
      );
    } else {
      // If no search term, reset the filtered list to contain all recipes.
      this.filteredRecipes = [...this.recipes];
    }
  }

  /**
   * isRecipeSelected
   * Checks if the given recipe exists in the selectedRecipes array.
   * Returns true if found, false otherwise.
   */
  isRecipeSelected(recipe: any): boolean {
    return this.selectedRecipes.some(r => r.id === recipe.id);
  }

  /**
   * toggleRecipeSelection
   * Adds or removes a recipe from the selection arrays when the corresponding checkbox is toggled.
   * If adding a recipe that has an API ID but missing details, it triggers fetching additional details.
   */
  toggleRecipeSelection(recipe: any, event: any) {
    if (event.detail.checked) {
      // If the recipe is checked, add it to the selectedRecipes array if not already present.
      if (!this.isRecipeSelected(recipe)) {
        this.selectedRecipes.push(recipe);
      }
      // Also add the recipe to the selectedRecipesList for detailed view if not already added.
      if (!this.selectedRecipesList.some(r => r.id === recipe.id)) {
        this.selectedRecipesList.push({ ...recipe, isExpanded: false });
        // If the recipe has an API ID and missing API details, fetch extra details.
        if (recipe.api_id && !recipe.apiDetails) {
          this.fetchRecipeDetails(recipe);
        }
      }
    } else {
      // If unchecked, remove the recipe from both selected arrays.
      this.selectedRecipes = this.selectedRecipes.filter(r => r.id !== recipe.id);
      this.selectedRecipesList = this.selectedRecipesList.filter(r => r.id !== recipe.id);
    }
  }

  /**
   * selectRecipe
   * Called when a recipe (e.g., clicked from the right container) should be added
   * to the left container's selected list.
   */
  selectRecipe(recipe: any) {
    if (!this.selectedRecipesList.find(r => r.id === recipe.id)) {
      this.selectedRecipesList.push({ ...recipe, isExpanded: false });
    }
  }

  /**
   * toggleRecipeDetails
   * Toggles the 'isExpanded' property on a recipe to show or hide its detailed view.
   */
  toggleRecipeDetails(recipe: any) {
    recipe.isExpanded = !recipe.isExpanded;
  }

  /**
   * removeSelectedRecipe
   * Removes a recipe from both the selectedRecipesList and selectedRecipes arrays.
   */
  removeSelectedRecipe(recipe: any) {
    this.selectedRecipesList = this.selectedRecipesList.filter(r => r.id !== recipe.id);
    this.selectedRecipes = this.selectedRecipes.filter(r => r.id !== recipe.id);
  }

  /**
   * fetchRecipeDetails
   * If the recipe has an API ID, this method fetches extended details from the external API
   * and updates the recipe object with additional fields like ingredients and instructions.
   */
  fetchRecipeDetails(recipe: any) {
    if (!recipe.api_id) return;

    this.recipeService.getRecipeDetailsFromApi(recipe.api_id).subscribe(
      (response: any) => {
        if (response.meals && response.meals.length > 0) {
          const mealData = response.meals[0];
          // Store the complete API response for potential further use.
          recipe.apiDetails = mealData;
          // Build an ingredients array with measurement details.
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
          // Update the recipe's ingredients and instructions.
          recipe.ingredients = ingredients;
          recipe.instructions = mealData.strInstructions;
        }
      },
      (error) => {
        console.error('Error fetching recipe details:', error);
      }
    );
  }

  /**
   * editRecipe
   * Opens the edit modal by copying the selected recipe data into the editRecipeData model.
   */
  editRecipe(recipe: any) {
    this.editRecipeData = {
      ...recipe,
      ingredients: recipe.ingredients.split(',').map((line: string) => line.trim()).join('\n')
    };
    this.openEditForm();
  }

  /**
   * updateRecipe
   * Sends the updated recipe data to the backend and, upon success, reloads the recipes and closes the edit modal.
   */
  updateRecipe() {
    // Convert ingredients from newlines → cleaned, comma-separated string
    this.editRecipeData.ingredients = this.editRecipeData.ingredients
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .map((line: string) => line.replace(/,/g, ''))
      .join(', ');
  
    console.log('Updating recipe with data:', this.editRecipeData);
  
    this.http.put(`${environment.apiUrl}/recipes/${this.editRecipeData.id}`, this.editRecipeData)
      .subscribe(
        (response) => {
          console.log('Recipe updated:', response);
          this.loadRecipes();
          this.closeEditForm();
        },
        (error) => {
          console.error('Error updating recipe:', error);
          alert('Failed to update recipe.');
        }
      );
  }
  

  /**
   * deleteRecipe
   * Prompts for confirmation before deleting a recipe from the backend.
   * On success, reloads the recipes and removes the recipe from the selected lists.
   */
  deleteRecipe(recipeId: number) {
    if (confirm('Are you sure you want to delete this recipe?')) {
      this.http.delete(`${environment.apiUrl}/recipes/${recipeId}`).subscribe(
        () => {
          console.log('Recipe deleted successfully');
          this.loadRecipes();
          this.selectedRecipesList = this.selectedRecipesList.filter(r => r.id !== recipeId);
          this.selectedRecipes = this.selectedRecipes.filter(r => r.id !== recipeId);
        },
        (error) => {
          console.error('Error deleting recipe:', error);
          alert('Failed to delete recipe.');
        }
      );
    }
  }

  /**
   * addToCalendar
   * Merges the selected recipes from the left container with any existing recipes in session storage,
   * then navigates to the calendar view with the updated recipe list.
   */
  addToCalendar() {
    if (this.selectedRecipesList.length === 0) {
      alert("No recipes selected! Please select recipes first.");
      return;
    }
  
    // Retrieve any existing recipes stored in session storage.
    let existingRecipes: any[] = [];
    const storedRecipes = sessionStorage.getItem('selectedRecipes');
    if (storedRecipes) {
      existingRecipes = JSON.parse(storedRecipes);
    }
  
    // Merge the new selected recipes with the existing ones, avoiding duplicates.
    const mergedRecipes = [...existingRecipes];
    this.selectedRecipesList.forEach(newRecipe => {
      if (!mergedRecipes.some(recipe => recipe.id === newRecipe.id)) {
        mergedRecipes.push(newRecipe);
      }
    });
  
    // Update session storage with the merged list.
    sessionStorage.setItem('selectedRecipes', JSON.stringify(mergedRecipes));
  
    // Navigate to the calendar page, passing the merged recipe list as state.
    this.router.navigate(['/tabs/calendar'], { state: { recipes: mergedRecipes } });
  }
  
  // -------------------- Edit Modal Control Methods --------------------

  // Opens the edit recipe modal.
  openEditForm() {
    this.isEditFormOpen = true;
  }

  // Closes the edit recipe modal.
  closeEditForm() {
    this.isEditFormOpen = false;
  }
}
