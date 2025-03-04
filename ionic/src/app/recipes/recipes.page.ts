import { Component, OnInit } from '@angular/core';
import { RecipeService } from '../services/recipe.service';
import { Platform, ModalController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router'; // ✅ Import Router
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
  selectedRecipe: any = null;
  isMobile: boolean = false;
  isFormOpen: boolean = false;
  isEditFormOpen: boolean = false;
  selectedRecipes: any[] = [];
  isSubmitting: boolean = false; // ✅ Prevent double submission

  // New Recipe Model
  newRecipe = {
    author: '',
    title: '',
    ingredients: '',
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
    private router: Router // ✅ Inject Router
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
    if (this.isSubmitting) return; // ✅ Prevent duplicate submission
    this.isSubmitting = true;

    const recipeData = { ...this.newRecipe };

    if (!recipeData.author || !recipeData.title || !recipeData.ingredients || !recipeData.instructions) {
      alert('Please fill in all required fields.');
      this.isSubmitting = false;
      return;
    }

    console.log('Submitting recipe:', recipeData); // ✅ Debugging

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

  selectRecipe(recipe: any) {
    if (this.selectedRecipe === recipe) {
      this.selectedRecipe = null;
    } else {
      this.selectedRecipe = recipe;

      if (recipe.api_id) {
        this.recipeService.getRecipeDetailsFromApi(recipe.api_id).subscribe(
          (response: any) => {
            const meal = response.meals[0];
            console.log(meal);

            let ingredients: string[] = [];
            for (let i = 1; i <= 20; i++) {
              const ingredient = meal[`strIngredient${i}`];
              if (ingredient) {
                ingredients.push(ingredient);
              } else {
                break;
              }
            }

            this.selectedRecipe.ingredients = ingredients;
            this.selectedRecipe.instructions = meal.strInstructions;
          },
          (error) => {
            console.error('Error fetching recipe details from API:', error);
          }
        );
      } else {
        if (typeof recipe.ingredients === 'string') {
          this.selectedRecipe.ingredients = recipe.ingredients.split(',').map((ingredient: string) => ingredient.trim());
        } else {
          this.selectedRecipe.ingredients = recipe.ingredients || [];
        }
        this.selectedRecipe.instructions = recipe.instructions || '';
      }
    }
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

  closeRecipe() {
    this.selectedRecipe = null;
  }

  toggleRecipeSelection(recipe: any) {
    const index = this.selectedRecipes.findIndex(r => r.id === recipe.id);
    if (index > -1) {
      this.selectedRecipes.splice(index, 1); // Remove if already selected
    } else {
      this.selectedRecipes.push(recipe); // Add if not selected
    }
  }

  addToCalendar() {
  console.log("Selected recipes before navigating:", this.selectedRecipes);

  if (this.selectedRecipes.length === 0) {
    alert("No recipes selected! Please select recipes first.");
    return;
  }

  this.router.navigate(['/calendar'], { state: { recipes: this.selectedRecipes } });
}

  deleteRecipe(recipeId: number) {
    if (confirm('Are you sure you want to delete this recipe?')) {
      this.http.delete(`${environment.apiUrl}/recipes/${recipeId}`).subscribe(
        () => {
          console.log('Recipe deleted successfully');
          this.loadRecipes();
          this.selectedRecipe = null;
        },
        (error) => {
          console.error('Error deleting recipe:', error);
          alert('Failed to delete recipe.');
        }
      );
    }
  }
}


