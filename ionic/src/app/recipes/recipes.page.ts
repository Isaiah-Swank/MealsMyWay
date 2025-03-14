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
  recipes: any[] = [];
  filteredRecipes: any[] = [];
  selectedRecipesList: any[] = []; 
  selectedRecipes: any[] = []; 
  isMobile: boolean = false;
  isFormOpen: boolean = false;
  isEditFormOpen: boolean = false;
  isSubmitting: boolean = false;

  // New Recipe Model
  newRecipe = {
    author: '',
    title: '',
    ingredients: [],
    instructions: '',
    tag: ''
  };

  // Edit Recipe Model
  editRecipeData = {
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

  checkDeviceType() {
    this.platform.ready().then(() => {
      this.isMobile = this.platform.width() <= 767;
    });
  }

  openCreateRecipeForm() {
    this.isFormOpen = true;
  }

  closeForm() {
    this.isFormOpen = false;
  }

  openEditForm() {
    this.isEditFormOpen = true;
  }

  closeEditForm() {
    this.isEditFormOpen = false;
  }

  submitRecipe() {
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    const recipeData = { ...this.newRecipe };

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
          this.closeForm();
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
  

  loadRecipes() {
    this.recipeService.getRecipes().subscribe(
      (recipes) => {
        this.recipeService.setRecipes(recipes);
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

  isRecipeSelected(recipe: any): boolean {
    return this.selectedRecipes.some(r => r.id === recipe.id);
  }

  toggleRecipeSelection(recipe: any, event: any) {
    if (event.detail.checked) {
      if (!this.isRecipeSelected(recipe)) {
        this.selectedRecipes.push(recipe);
      }
  
      if (!this.selectedRecipesList.some(r => r.id === recipe.id)) {
        this.selectedRecipesList.push(recipe);
  
        // Fetch API details if it has an api_id
        if (recipe.api_id && !recipe.apiDetails) {
          this.fetchRecipeDetails(recipe);
        }
      }
    } else {
      this.selectedRecipes = this.selectedRecipes.filter(r => r.id !== recipe.id);
      this.selectedRecipesList = this.selectedRecipesList.filter(r => r.id !== recipe.id);
    }
  }

  fetchRecipeDetails(recipe: any) {
    if (!recipe.api_id) return;
  
    this.recipeService.getRecipeDetailsFromApi(recipe.api_id).subscribe(
      (response: any) => {
        if (response.meals && response.meals.length > 0) {
          recipe.apiDetails = response.meals[0]; // Attach API data to the recipe
        }
      },
      (error) => {
        console.error('Error fetching recipe details:', error);
      }
    );
  }
  

  removeSelectedRecipe(recipe: any) {
    this.selectedRecipesList = this.selectedRecipesList.filter(r => r.id !== recipe.id);
    
    // Also uncheck the checkbox when removing manually
    this.selectedRecipes = this.selectedRecipes.filter(r => r.id !== recipe.id);
  }

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

  editRecipe(recipe: any) {
    this.editRecipeData = { ...recipe };
    this.openEditForm();
  }

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

  addToCalendar() {
    console.log("Checked recipes before navigating:", this.selectedRecipes);

    if (this.selectedRecipes.length === 0) {
      alert("No recipes selected! Please select recipes first.");
      return;
    }

    sessionStorage.setItem('selectedRecipes', JSON.stringify(this.selectedRecipes));
    this.router.navigate(['/tabs/calendar'], { state: { recipes: this.selectedRecipes } });
  }



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
}


