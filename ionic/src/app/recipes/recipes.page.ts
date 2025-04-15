import { Component, OnInit } from '@angular/core';
import { RecipeService } from '../services/recipe.service';
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
  // Collapsible create recipe form flag.
  showCreateRecipe: boolean = false;

  // Main recipe arrays.
  recipes: any[] = [];
  filteredRecipes: any[] = [];
  // Used when selecting recipes via checkboxes (if applicable).
  selectedRecipes: any[] = [];
  // Recipes added on the left side; each recipe gets an extra property 'isExpanded'
  // for toggling detailed view.
  selectedRecipesList: any[] = [];

  // Device type flag.
  isMobile: boolean = false;
  // Edit form control.
  isEditFormOpen: boolean = false;
  // Indicates if a submission is in progress.
  isSubmitting: boolean = false;

  // New Recipe model.
  newRecipe: any = {
    author: '',
    title: '',
    ingredients: '',
    instructions: '',
    tag: ''
  };

  // Edit Recipe model.
  editRecipeData: any = {
    id: null,
    author: '',
    title: '',
    ingredients: '',
    instructions: '',
    tag: ''
  };

  constructor(
    private recipeService: RecipeService,
    private platform: Platform,
    private http: HttpClient,
    private modalCtrl: ModalController,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadRecipes();
    this.checkDeviceType();
  }

  // Checks the device type to adjust UI for mobile screens.
  checkDeviceType() {
    this.platform.ready().then(() => {
      this.isMobile = this.platform.width() <= 767;
    });
  }

  // Toggle the visibility of the create recipe form.
  toggleCreateRecipe() {
    this.showCreateRecipe = !this.showCreateRecipe;
  }

  /**
   * submitRecipe
   * Validates and sends the new recipe to the backend.
   * On success, it reloads the recipes and clears the form.
   */
  submitRecipe() {
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    const recipeData = { ...this.newRecipe };

    // Validate required fields.
    if (!recipeData.author || !recipeData.title || !recipeData.ingredients || !recipeData.instructions) {
      alert('Please fill in all required fields.');
      this.isSubmitting = false;
      return;
    }

    console.log('Submitting recipe:', recipeData);

    this.http.post<RecipeResponse>(`${environment.apiUrl}/recipes`, recipeData).subscribe(
      (response) => {
        console.log('Backend Response:', response);
        if (response.message === 'Recipe created successfully.') {
          this.loadRecipes();
          // Optionally add the newly created recipe to the left side list.
          // Here we copy recipeData and set isExpanded to false.
          this.selectedRecipesList.push({ ...recipeData, isExpanded: false });
          // Reset the form.
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
   * Also calls the setRecipes method on the service.
   */
  loadRecipes() {
    this.recipeService.getRecipes().subscribe(
      (recipes) => {

        // Ensure every recipe has a defined tag field.
        this.recipes = recipes
          .filter(recipe => recipe.pantry === false)
          .map(recipe => ({
          ...recipe,
          tag: recipe.tag || ''
        }));
        // Inform the service (if required by other parts of your app).
        this.recipeService.setRecipes(this.recipes);
        this.filteredRecipes = [...this.recipes];
      },
      (error) => {
        console.error('Error fetching recipes:', error);
      }
    );
  }

  /**
   * filterRecipes
   * Filters the recipes list based on search term (searching title and tag).
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
   * isRecipeSelected
   * Returns true if the given recipe is in the selectedRecipes array.
   */
  isRecipeSelected(recipe: any): boolean {
    return this.selectedRecipes.some(r => r.id === recipe.id);
  }

  /**
   * toggleRecipeSelection
   * Adds or removes a recipe from the selected recipes arrays based on checkbox state.
   * If the recipe has an API ID and no details yet, it fetches extra details.
   */
  toggleRecipeSelection(recipe: any, event: any) {
    if (event.detail.checked) {
      if (!this.isRecipeSelected(recipe)) {
        this.selectedRecipes.push(recipe);
      }
      if (!this.selectedRecipesList.some(r => r.id === recipe.id)) {
        this.selectedRecipesList.push({ ...recipe, isExpanded: false });
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
   * selectRecipe
   * Adds a recipe (clicked from the right container) into the left container's selected list.
   */
  selectRecipe(recipe: any) {
    if (!this.selectedRecipesList.find(r => r.id === recipe.id)) {
      this.selectedRecipesList.push({ ...recipe, isExpanded: false });
    }
  }

  /**
   * toggleRecipeDetails
   * Toggles the collapsed/expanded state of the selected recipe details.
   */
  toggleRecipeDetails(recipe: any) {
    recipe.isExpanded = !recipe.isExpanded;
  }

  /**
   * removeSelectedRecipe
   * Removes a recipe from the selected arrays.
   */
  removeSelectedRecipe(recipe: any) {
    this.selectedRecipesList = this.selectedRecipesList.filter(r => r.id !== recipe.id);
    this.selectedRecipes = this.selectedRecipes.filter(r => r.id !== recipe.id);
  }

  /**
   * fetchRecipeDetails
   * If available, retrieves extended recipe details from an external API and updates the recipe object.
   */
  fetchRecipeDetails(recipe: any) {
    if (!recipe.api_id) return;

    this.recipeService.getRecipeDetailsFromApi(recipe.api_id).subscribe(
      (response: any) => {
        if (response.meals && response.meals.length > 0) {
          const mealData = response.meals[0];
          // Attach full API details for potential later use.
          recipe.apiDetails = mealData;
          // Build an ingredients array with measurements.
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
          // Set the instructions from the API.
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
   * Opens the edit modal with the selected recipe data.
   */
  editRecipe(recipe: any) {
    this.editRecipeData = { ...recipe };
    this.openEditForm();
  }

  /**
   * updateRecipe
   * Sends the updated recipe data to the backend and reloads recipes on success.
   */
  updateRecipe() {
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
   * Deletes a recipe (after confirmation) from the backend and updates local lists.
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
   * Stores selected recipes in session storage and navigates to the calendar view.
   */
  addToCalendar() {
    // Check the array that's actually being displayed on the left
    if (this.selectedRecipesList.length === 0) {
      alert("No recipes selected! Please select recipes first.");
      return;
    }
  
    // Store those in sessionStorage
    sessionStorage.setItem('selectedRecipes', JSON.stringify(this.selectedRecipesList));
  
    // Navigate to the calendar page with that list
    this.router.navigate(['/tabs/calendar'], { state: { recipes: this.selectedRecipesList } });
  }
  

  /**
   * openEditForm and closeEditForm
   * Manage the visibility of the edit recipe modal.
   */
  openEditForm() {
    this.isEditFormOpen = true;
  }

  closeEditForm() {
    this.isEditFormOpen = false;
  }
}
