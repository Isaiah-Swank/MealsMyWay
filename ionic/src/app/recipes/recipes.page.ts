// Import necessary Angular core features and services used by the RecipesPage component.
import { Component, OnInit } from '@angular/core';
import { RecipeService } from '../services/recipe.service';
import { Platform, ModalController } from '@ionic/angular';
import { UserService } from '../services/user.service';
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
  selectedRecipesList: any[] = []; // or the right type
  
  selectAllRecipes() {
    this.selectedRecipesList = [...this.filteredRecipes];
  }
  
  deselectAllRecipes() {
    this.selectedRecipesList = [];
  }
  

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
  constructor(
    private userService: UserService,
    private recipeService: RecipeService,
    private platform: Platform,
    private http: HttpClient,
    private modalCtrl: ModalController,
    private router: Router
  ) {}

  // -------------------- Lifecycle Hook --------------------
  ngOnInit() {
    const user = this.userService.getUser();
    console.log(user);
    if (user && user.username) {
      this.newRecipe.author = user.username;
    }
    // Load all recipes from the backend.
    this.loadRecipes();
    // Check the device type to adjust UI elements for mobile if needed.
    this.checkDeviceType();
  }

  /**
   * checkDeviceType
   * Determines if the app is on a mobile device (screen width <= 767px).
   */
  checkDeviceType() {
    this.platform.ready().then(() => {
      this.isMobile = this.platform.width() <= 767;
    });
  }

  // -------------------- UI Toggling Methods --------------------

  /**
   * toggleCreateRecipe
   * Shows or hides the create recipe form.
   */
  toggleCreateRecipe() {
    this.showCreateRecipe = !this.showCreateRecipe;
  }

  /**
   * submitRecipe
   * Validates the new recipe form and sends a POST request to the backend.
   * On success, reloads recipes, adds the new recipe to the selected list, and resets form fields (except author).
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

          // Clear only title, ingredients, instructions & tag (keep author)
          this.newRecipe.title = '';
          this.newRecipe.ingredients = '';
          this.newRecipe.instructions = '';
          this.newRecipe.tag = '';
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
   */
  loadRecipes() {
    this.recipeService.getRecipes().subscribe(
      (recipes) => {
        this.recipes = recipes
          .filter(recipe => recipe.pantry != true)
          .map(recipe => ({
            ...recipe,
            tag: recipe.tag || ''
          }));
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
   * Filters the list of recipes as the user types in the search bar.
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
   */
  isRecipeSelected(recipe: any): boolean {
    // Use the correct property name for unique ID (id, _id, or title if that's unique)
    return this.selectedRecipesList.some(r => r.id === recipe.id);
  }
  /**
   * toggleRecipeSelection
   */
  toggleRecipeSelection(recipe: any, event?: Event) {
    // Optionally prevent default behavior
    if (event) event.preventDefault();
  
    if (this.isRecipeSelected(recipe)) {
      // Remove from selected
      this.selectedRecipesList = this.selectedRecipesList.filter(r => r.id !== recipe.id);
    } else {
      // Add to selected
      this.selectedRecipesList = [...this.selectedRecipesList, recipe];
    }
  }
  

  /**
   * selectRecipe
   */
  selectRecipe(recipe: any) {
    if (!this.selectedRecipesList.find(r => r.id === recipe.id)) {
      this.selectedRecipesList.push({ ...recipe, isExpanded: false });
    }
  }

  /**
   * toggleRecipeDetails
   */
  toggleRecipeDetails(recipe: any) {
    recipe.isExpanded = !recipe.isExpanded;
  }

  /**
   * removeSelectedRecipe
   */
  removeSelectedRecipe(recipe: any) {
    this.selectedRecipesList = this.selectedRecipesList.filter(r => r.id !== recipe.id);
    this.selectedRecipes = this.selectedRecipes.filter(r => r.id !== recipe.id);
  }

  /**
   * fetchRecipeDetails
   */
  fetchRecipeDetails(recipe: any) {
    if (!recipe.api_id) return;

    this.recipeService.getRecipeDetailsFromApi(recipe.api_id).subscribe(
      (response: any) => {
        if (response.meals && response.meals.length > 0) {
          const mealData = response.meals[0];
          recipe.apiDetails = mealData;
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
   */
  updateRecipe() {
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
   */
  addToCalendar() {
    if (this.selectedRecipesList.length === 0) {
      alert("No recipes selected! Please select recipes first.");
      return;
    }
  
    let existingRecipes: any[] = [];
    const storedRecipes = sessionStorage.getItem('selectedRecipes');
    if (storedRecipes) {
      existingRecipes = JSON.parse(storedRecipes);
    }
  
    const mergedRecipes = [...existingRecipes];
    this.selectedRecipesList.forEach(newRecipe => {
      if (!mergedRecipes.some(recipe => recipe.id === newRecipe.id)) {
        mergedRecipes.push(newRecipe);
      }
    });
  
    sessionStorage.setItem('selectedRecipes', JSON.stringify(mergedRecipes));
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
