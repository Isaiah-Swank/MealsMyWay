import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class RecipeService {
  recipes: any[] = [];  // Variable to store the fetched recipes

  constructor(private http: HttpClient) {}

  // Fetch all recipes from the backend
  getRecipes() {
    return this.http.get<any[]>(`${environment.apiUrl}/recipes`); // Change URL to match your API
  }

  // Save recipes into the service variable
  setRecipes(recipes: any[]) {
    this.recipes = recipes;
  }

  // Fetch recipe details from the API using the api_id
  getRecipeDetailsFromApi(apiId: string) {
    return this.http.get(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${apiId}`);
  }
}
