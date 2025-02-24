import { Component, OnInit } from '@angular/core';
import { RecipeService } from '../services/recipe.service';
import { Platform, ModalController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
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
  selectedRecipe: any = null;
  isMobile: boolean = false;
  isFormOpen: boolean = false;
  newRecipe = { // Model for new recipe data
    author: '',
    title: '',
    ingredients: '',
    instructions: ''
  };

  constructor(
    private recipeService: RecipeService,
    private platform: Platform,
    private http: HttpClient,
    private modalCtrl: ModalController
  ){}  // Inject RecipeService

  ngOnInit() {
    this.loadRecipes();  // Call the method to fetch recipes
    this.checkDeviceType();
  }

  checkDeviceType() {
    // Use Platform service to check screen size and set the isMobile flag
    this.platform.ready().then(() => {
      // Use platform to check screen width
      if (this.platform.width() <= 767) {
        this.isMobile = true;
      } else {
        this.isMobile = false;
      }
    });
  }

  openCreateRecipeForm() {
    this.isFormOpen = true; // Open the create recipe form
  }

  closeForm() {
    this.isFormOpen = false; // Close the form
  }

  submitRecipe() {
    const recipeData = {
      author: this.newRecipe.author,
      title: this.newRecipe.title,
      ingredients: this.newRecipe.ingredients,
      instructions: this.newRecipe.instructions
    };
  
    if (this.newRecipe.author && this.newRecipe.title && this.newRecipe.ingredients && this.newRecipe.instructions) {
      this.http.post<RecipeResponse>(`${environment.apiUrl}/recipes`, recipeData).subscribe(
        (response) => {
          console.log('Backend Response:', response);
          if (response && response.message === 'Recipe created successfully') {
            console.log('Recipe submitted successfully');
            this.loadRecipes(); // Refresh the recipe list
            this.closeForm();    // Close the form after submission
          } else {
            alert('Failed to add the recipe');
          }
        },
        (error) => {
          console.error('Error occurred while submitting the recipe:', error);
          alert('An error occurred. Please try again later.');
        }
      );
    } else {
      alert('Please fill in all required fields.');
    }
  }
  
  

  loadRecipes() {
    // Call the getRecipes method from the service
    this.recipeService.getRecipes().subscribe(
      (recipes) => {
        //console.log('Fetched Recipes:', recipes);  // Log the fetched recipes
        this.recipeService.setRecipes(recipes); 
        console.log(this.recipeService.recipes);  // Save the fetched recipes to the service
        this.recipes = recipes;
      },
      (error) => {
        console.error('Error fetching recipes:', error);  // Log any errors
      }
    );
  }

  selectRecipe(recipe: any) {
    // Toggle the recipe details visibility
    if (this.selectedRecipe === recipe) {
      // If the same recipe is clicked again, hide the details
      this.selectedRecipe = null;
    } else {
      // If a different recipe is clicked, display its details
      this.selectedRecipe = recipe;
  
      // If the recipe has an api_id, fetch additional details from the API
      if (recipe.api_id) {
        this.recipeService.getRecipeDetailsFromApi(recipe.api_id).subscribe(
          (response: any) => {
            const meal = response.meals[0];
            console.log(meal);
  
            // Initialize an empty array to store ingredients
            let ingredients: string[] = [];
  
            // Loop through the ingredient fields and append non-empty values
            for (let i = 1; i <= 20; i++) {
              const ingredient = meal[`strIngredient${i}`];
              if (ingredient) {
                ingredients.push(ingredient);  // Append ingredient to array
              } else {
                break;  // Stop the loop when an empty string is encountered
              }
            }
  
            // Update the selectedRecipe with the ingredients array and instructions
            this.selectedRecipe.ingredients = ingredients;  // Store ingredients as an array
            this.selectedRecipe.instructions = meal.strInstructions;  // Update the instructions
          },
          (error) => {
            console.error('Error fetching recipe details from API:', error);
          }
        );
      } else {
        // Ensure ingredients are stored as an array, even if it was initially a string
        if (typeof recipe.ingredients === 'string') {
          // Convert the comma-separated string into an array
          this.selectedRecipe.ingredients = recipe.ingredients.split(',').map((ingredient: string) => ingredient.trim());
        } else {
          this.selectedRecipe.ingredients = recipe.ingredients || [];  // Default to an empty array if not available
        }
  
        // Set the instructions (string)
        this.selectedRecipe.instructions = recipe.instructions || '';
  
        console.log(this.selectedRecipe);  // Log the selected recipe to verify the changes
      }
    }
  }
  
  
  
  


}
