import { Component, OnInit } from '@angular/core';
import { RecipeService } from '../services/recipe.service';
import { UserService } from '../services/user.service';
import { Platform, ModalController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

interface RecipeResponse {
  message: string;
}

@Component({
  selector: 'app-recipes',
  templateUrl: './recipes.page.html',
  styleUrls: ['./recipes.page.scss'],
})
export class RecipesPage implements OnInit {
  recipes: any[] = [];
  filteredRecipes: any[] = [];
  selectedRecipesList: any[] = []; 
  selectedRecipes: any[] = []; 
  isMobile: boolean = false;
  // Removed isFormOpen flag since we are not using a modal for recipe creation
  isEditFormOpen: boolean = false;
  isSubmitting: boolean = false;

  // New Recipe Model
  // Changed 'ingredients' from an array to a string to match the inline form input (comma-separated values)
  newRecipe = {
    author: '',
    title: '',
    ingredients: '',
    instructions: '',
    tag: ''
  };

  // Edit Recipe Model remains unchanged
  editRecipeData = {
    id: null,
    author: '',
    title: '',
    ingredients: '',
    instructions: '',
    tag: ''
  };

  constructor(
    private userService: UserService,
    private recipeService: RecipeService,
    private platform: Platform,
    private http: HttpClient,
    private modalCtrl: ModalController,
    private router: Router
  ) {}

  ngOnInit() {
    const user = this.userService.getUser();
    console.log(user);
    if (user && user.username) {
      this.newRecipe.author = user.username;
    }
    this.loadRecipes();
    this.checkDeviceType();
  }

  // Check the device type to adjust UI for mobile screens
  checkDeviceType() {
    this.platform.ready().then(() => {
      this.isMobile = this.platform.width() <= 767;
    });
  }

  /**
   * submitRecipe
   * ------------
   * Validates the new recipe form and sends the data to the backend.
   * If any required field is missing, an alert is shown.
   */
  submitRecipe() {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
  
    const recipeData = { ...this.newRecipe };
  
    // Validate required fields
    if (!recipeData.author || !recipeData.title || !recipeData.ingredients || !recipeData.instructions) {
      alert('Please fill in all required fields.');
      this.isSubmitting = false;
      return;
    }
  
    // Transform ingredients: remove blank lines, remove commas, join with commas
    const cleanedIngredients = recipeData.ingredients
      .split('\n')                             // split by newline
      .map(line => line.trim())                // trim each line
      .filter(line => line.length > 0)         // remove empty lines
      .map(line => line.replace(/,/g, ''))     // remove existing commas
      .join(', ');                             // join into a single string with commas
  
    recipeData.ingredients = cleanedIngredients;
  
    console.log('Submitting recipe:', recipeData);
  
    this.http.post<RecipeResponse>(`${environment.apiUrl}/recipes`, recipeData).subscribe(
      (response) => {
        console.log('Backend Response:', response);
        if (response.message === 'Recipe created successfully.') {
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
   * -----------
   * Loads recipes from the backend via the recipe service.
   */
  loadRecipes() {
    this.recipeService.getRecipes().subscribe(
      (recipes) => {
        this.recipeService.setRecipes(recipes);
        // Ensure every recipe has a tag field defined (empty string if not provided)
        this.recipes = recipes.map(recipe => ({
          ...recipe,
          tag: recipe.tag || ''
        }));
        this.filteredRecipes = [...this.recipes];
      },
      (error) => {
        console.error('Error fetching recipes:', error);
      }
    );
  }

  /**
   * isRecipeSelected
   * ----------------
   * Checks if a given recipe is in the selected recipes list.
   */
  isRecipeSelected(recipe: any): boolean {
    return this.selectedRecipes.some(r => r.id === recipe.id);
  }

  /**
   * toggleRecipeSelection
   * ---------------------
   * Adds or removes a recipe from the selected recipes list based on the checkbox state.
   * Also fetches additional API details if the recipe has an api_id.
   */
  toggleRecipeSelection(recipe: any, event: any) {
    if (event.detail.checked) {
      if (!this.isRecipeSelected(recipe)) {
        this.selectedRecipes.push(recipe);
      }
  
      if (!this.selectedRecipesList.some(r => r.id === recipe.id)) {
        this.selectedRecipesList.push(recipe);
  
        // Fetch API details if available
        if (recipe.api_id && !recipe.apiDetails) {
          this.fetchRecipeDetails(recipe);
        }
      }
    } else {
      this.selectedRecipes = this.selectedRecipes.filter(r => r.id !== recipe.id);
      this.selectedRecipesList = this.selectedRecipesList.filter(r => r.id !== recipe.id);
    }
  }

  /**
   * fetchRecipeDetails
   * ------------------
   * Fetches extended recipe details from an external API (TheMealDB)
   * and attaches them to the recipe object.
   */
  fetchRecipeDetails(recipe: any) {
    if (!recipe.api_id) return;
  
    this.recipeService.getRecipeDetailsFromApi(recipe.api_id).subscribe(
      (response: any) => {
        if (response.meals && response.meals.length > 0) {
          const mealData = response.meals[0];
          // Attach full API details for potential later use
          recipe.apiDetails = mealData;
          // Build the ingredients array with measurements
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
          recipe.ingredients = ingredients;
          // Set the instructions from the API
          recipe.instructions = mealData.strInstructions;
        }
      },
      (error) => {
        console.error('Error fetching recipe details:', error);
      }
    );
  }

  /**
   * removeSelectedRecipe
   * --------------------
   * Removes a recipe from the selected recipes list.
   */
  removeSelectedRecipe(recipe: any) {
    this.selectedRecipesList = this.selectedRecipesList.filter(r => r.id !== recipe.id);
    // Also uncheck the recipe by removing it from the selected recipes array
    this.selectedRecipes = this.selectedRecipes.filter(r => r.id !== recipe.id);
  }

  /**
   * filterRecipes
   * -------------
   * Filters the list of recipes based on the search term entered in the search bar.
   */
  filterRecipes(event: any) {
    const searchTerm = event.target.value.toLowerCase();
    if (searchTerm) {
      this.filteredRecipes = this.recipes.filter(recipe =>
        recipe.title.toLowerCase().includes(searchTerm) ||
        (recipe.tag && recipe.tag.toLowerCase().includes(searchTerm))
      );
    } else {
      this.filteredRecipes = [...this.recipes];
    }
  }

  /**
   * editRecipe
   * ----------
   * Opens the edit recipe modal by setting the edit model data.
   */
  editRecipe(recipe: any) {
    // Copy the whole recipe as-is
    this.editRecipeData = { ...recipe };
  
    // But transform just the ingredients field for better readability
    this.editRecipeData.ingredients = recipe.ingredients
      ? recipe.ingredients
          .split(',')
          .map((item: string) => item.trim())
          .filter((item: string) => item.length > 0)
          .join('\n\n')  // Replace commas with newlines
      : '';
  
    this.openEditForm();
  }
  

  /**
   * updateRecipe
   * ------------
   * Submits the updated recipe data to the backend.
   */
  updateRecipe() {
    const cleanedIngredients = this.editRecipeData.ingredients
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .map((line: string) => line.replace(/,/g, ''))
      .join(', ');
  
    this.editRecipeData.ingredients = cleanedIngredients;
  
    console.log('Updating recipe with data:', this.editRecipeData);
  
    this.http.put(`${environment.apiUrl}/recipes/${this.editRecipeData.id}`, this.editRecipeData)
      .subscribe(
        (response) => {
          console.log('Recipe updated:', response);
  
          // Update the full recipe list
          this.loadRecipes();
  
          // ✅ Update the selected recipes with new data
          this.selectedRecipes = this.selectedRecipes.map(r =>
            r.id === this.editRecipeData.id ? { ...r, ...this.editRecipeData } : r
          );
  
          this.selectedRecipesList = this.selectedRecipesList.map(r =>
            r.id === this.editRecipeData.id ? { ...r, ...this.editRecipeData } : r
          );
  
          // ✅ Optionally close the form
          this.closeEditForm();
        },
        (error) => {
          console.error('Error updating recipe:', error);
          alert('Failed to update recipe.');
        }
      );
  }
  
  

  /**
   * addToCalendar
   * -------------
   * Stores selected recipes in session storage and navigates to the calendar view.
   */
  addToCalendar() {
    console.log("Checked recipes before navigating:", this.selectedRecipes);

    if (this.selectedRecipes.length === 0) {
      alert("No recipes selected! Please select recipes first.");
      return;
    }

    sessionStorage.setItem('selectedRecipes', JSON.stringify(this.selectedRecipes));
    this.router.navigate(['/tabs/calendar'], { state: { recipes: this.selectedRecipes } });
  }

  /**
   * deleteRecipe
   * ------------
   * Deletes a recipe after user confirmation.
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
   * openEditForm and closeEditForm
   * ------------------------------
   * Methods to manage the edit recipe modal visibility.
   */
  openEditForm() {
    this.isEditFormOpen = true;
  }

  closeEditForm() {
    this.isEditFormOpen = false;
  }
}
