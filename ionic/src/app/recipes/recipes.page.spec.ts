import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { RecipesPage } from './recipes.page';
import { RecipeService } from '../services/recipe.service';
import { Platform, ModalController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

describe('RecipesPage', () => {
  let component: RecipesPage;
  let fixture: ComponentFixture<RecipesPage>;
  let recipeServiceSpy: jasmine.SpyObj<RecipeService>;
  let platformSpy: jasmine.SpyObj<Platform>;
  let httpSpy: jasmine.SpyObj<HttpClient>;
  let modalCtrlSpy: jasmine.SpyObj<ModalController>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    recipeServiceSpy = jasmine.createSpyObj('RecipeService', ['getRecipes', 'setRecipes', 'getRecipeDetailsFromApi']);
    platformSpy = jasmine.createSpyObj('Platform', ['ready', 'width']);
    httpSpy = jasmine.createSpyObj('HttpClient', ['post', 'put', 'delete']);
    modalCtrlSpy = jasmine.createSpyObj('ModalController', ['create']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    // Set default spy behaviors
    recipeServiceSpy.getRecipes.and.returnValue(of([]));
    // Return a string "ready" to satisfy Promise<string>
    platformSpy.ready.and.returnValue(Promise.resolve('ready'));
    // Simulate mobile device: width 500px
    platformSpy.width.and.returnValue(500);
    // For getRecipeDetailsFromApi, return a fake meal response:
    recipeServiceSpy.getRecipeDetailsFromApi.and.returnValue(of({
      meals: [{
        strIngredient1: 'Chicken',
        strMeasure1: '1 lb',
        strIngredient2: 'Salt',
        strMeasure2: '1 tsp',
        strIngredient3: '',
        strMeasure3: '',
        strInstructions: 'Cook it well'
      }]
    }));
    
    await TestBed.configureTestingModule({
      declarations: [RecipesPage],
      providers: [
        { provide: RecipeService, useValue: recipeServiceSpy },
        { provide: Platform, useValue: platformSpy },
        { provide: HttpClient, useValue: httpSpy },
        { provide: ModalController, useValue: modalCtrlSpy },
        { provide: Router, useValue: routerSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RecipesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit and checkDeviceType', () => {
    it('should load recipes and check device type on init', fakeAsync(() => {
      spyOn(component, 'loadRecipes');
      spyOn(component, 'checkDeviceType');
      component.ngOnInit();
      tick(); // wait for promises
      expect(component.loadRecipes).toHaveBeenCalled();
      expect(component.checkDeviceType).toHaveBeenCalled();
    }));

    it('should set isMobile based on platform width', fakeAsync(() => {
      platformSpy.width.and.returnValue(700);
      component.checkDeviceType();
      tick();
      expect(component.isMobile).toBeFalse();
      
      platformSpy.width.and.returnValue(600);
      component.checkDeviceType();
      tick();
      expect(component.isMobile).toBeTrue();
    }));
  });

  describe('submitRecipe', () => {
    beforeEach(() => {
      // Set up a valid new recipe
      component.newRecipe = {
        author: 'John Doe',
        title: 'Test Recipe',
        ingredients: 'Chicken, Salt',
        instructions: 'Cook well',
        tag: 'Dinner'
      };
    });

    it('should alert if required fields are missing', () => {
      spyOn(window, 'alert');
      component.newRecipe = { author: '', title: '', ingredients: '', instructions: '', tag: '' };
      component.submitRecipe();
      expect(window.alert).toHaveBeenCalledWith('Please fill in all required fields.');
      expect(component.isSubmitting).toBeFalse();
    });

    it('should submit recipe and reset form on successful response', fakeAsync(() => {
      const response = { message: 'Recipe created successfully.' };
      httpSpy.post.and.returnValue(of(response));
      spyOn(component, 'loadRecipes');
      component.submitRecipe();
      tick();
      expect(httpSpy.post).toHaveBeenCalledWith(`${environment.apiUrl}/recipes`, jasmine.any(Object));
      expect(component.loadRecipes).toHaveBeenCalled();
      expect(component.newRecipe).toEqual({ author: '', title: '', ingredients: '', instructions: '', tag: '' });
      expect(component.isSubmitting).toBeFalse();
    }));

    it('should alert if submission response is not successful', fakeAsync(() => {
      const response = { message: 'Some error occurred' };
      httpSpy.post.and.returnValue(of(response));
      spyOn(window, 'alert');
      component.submitRecipe();
      tick();
      expect(window.alert).toHaveBeenCalledWith('Failed to add the recipe');
      expect(component.isSubmitting).toBeFalse();
    }));

    it('should alert on submission error', fakeAsync(() => {
      httpSpy.post.and.returnValue(throwError(() => new Error('Network Error')));
      spyOn(window, 'alert');
      component.submitRecipe();
      tick();
      expect(window.alert).toHaveBeenCalledWith('An error occurred. Please try again later.');
      expect(component.isSubmitting).toBeFalse();
    }));
  });

  describe('loadRecipes', () => {
    it('should load recipes and set them correctly', () => {
      const recipesMock = [
        { id: 1, title: 'Recipe 1', tag: 'Lunch' },
        { id: 2, title: 'Recipe 2' }
      ];
      recipeServiceSpy.getRecipes.and.returnValue(of(recipesMock));
      component.loadRecipes();
      expect(recipeServiceSpy.getRecipes).toHaveBeenCalled();
      expect(recipeServiceSpy.setRecipes).toHaveBeenCalledWith(recipesMock);
      expect(component.recipes).toEqual([
        { id: 1, title: 'Recipe 1', tag: 'Lunch' },
        { id: 2, title: 'Recipe 2', tag: '' }
      ]);
      expect(component.filteredRecipes).toEqual(component.recipes);
    });

    it('should log error on loadRecipes failure', () => {
      spyOn(console, 'error');
      recipeServiceSpy.getRecipes.and.returnValue(throwError(() => new Error('Error')));
      component.loadRecipes();
      expect(console.error).toHaveBeenCalledWith('Error fetching recipes:', jasmine.any(Error));
    });
  });

  describe('isRecipeSelected', () => {
    it('should return true if recipe is selected', () => {
      component.selectedRecipes = [{ id: 1 }];
      expect(component.isRecipeSelected({ id: 1 })).toBeTrue();
    });

    it('should return false if recipe is not selected', () => {
      component.selectedRecipes = [{ id: 1 }];
      expect(component.isRecipeSelected({ id: 2 })).toBeFalse();
    });
  });

  describe('toggleRecipeSelection', () => {
    const recipe: any = { id: 1, api_id: '123' };
    let event: any;

    beforeEach(() => {
      component.selectedRecipes = [];
      component.selectedRecipesList = [];
      event = { detail: { checked: true } };
    });

    it('should add recipe to selected arrays and fetch API details if applicable', () => {
      spyOn(component, 'fetchRecipeDetails').and.callThrough();
      component.toggleRecipeSelection(recipe, event);
      expect(component.selectedRecipes).toContain(recipe);
      expect(component.selectedRecipesList).toContain(recipe);
      expect(component.fetchRecipeDetails).toHaveBeenCalledWith(recipe);
    });

    it('should remove recipe from selected arrays when unchecked', () => {
      component.selectedRecipes = [recipe];
      component.selectedRecipesList = [recipe];
      event.detail.checked = false;
      component.toggleRecipeSelection(recipe, event);
      expect(component.selectedRecipes).not.toContain(recipe);
      expect(component.selectedRecipesList).not.toContain(recipe);
    });
  });

  describe('fetchRecipeDetails', () => {
    it('should fetch recipe details and update recipe object', () => {
      const recipe: any = { id: 1, api_id: '123' }; // cast as any
      component.fetchRecipeDetails(recipe);
      expect(recipeServiceSpy.getRecipeDetailsFromApi).toHaveBeenCalledWith('123');
      // Using type assertion to bypass TS type errors:
      expect((recipe as any).apiDetails).toBeDefined();
      expect((recipe as any).ingredients).toContain('Chicken - 1 lb');
      expect((recipe as any).instructions).toEqual('Cook it well');
    });

    it('should not fetch details if no api_id', () => {
      const recipe = { id: 2 };
      spyOn(recipeServiceSpy, 'getRecipeDetailsFromApi');
      component.fetchRecipeDetails(recipe);
      expect(recipeServiceSpy.getRecipeDetailsFromApi).not.toHaveBeenCalled();
    });
  });

  describe('removeSelectedRecipe', () => {
    it('should remove a recipe from selected arrays', () => {
      const recipe = { id: 1 };
      component.selectedRecipes = [recipe];
      component.selectedRecipesList = [recipe];
      component.removeSelectedRecipe(recipe);
      expect(component.selectedRecipes).not.toContain(recipe);
      expect(component.selectedRecipesList).not.toContain(recipe);
    });
  });

  describe('filterRecipes', () => {
    it('should filter recipes based on search term', () => {
      component.recipes = [
        { id: 1, title: 'Chicken Soup', tag: 'Dinner' },
        { id: 2, title: 'Beef Stew', tag: 'Lunch' }
      ];
      const event = { target: { value: 'chicken' } };
      component.filterRecipes(event);
      expect(component.filteredRecipes).toEqual([{ id: 1, title: 'Chicken Soup', tag: 'Dinner' }]);
    });

    it('should reset filteredRecipes if search term is empty', () => {
      component.recipes = [
        { id: 1, title: 'Chicken Soup', tag: 'Dinner' },
        { id: 2, title: 'Beef Stew', tag: 'Lunch' }
      ];
      const event = { target: { value: '' } };
      component.filterRecipes(event);
      expect(component.filteredRecipes).toEqual(component.recipes);
    });
  });

  describe('editRecipe and open/closeEditForm', () => {
    it('should set editRecipeData and open edit form', () => {
      // Provide a complete recipe object with all required properties.
      const recipe: any = { 
        id: 1, 
        author: 'Test Author', 
        title: 'Test Recipe', 
        ingredients: 'Chicken, Salt', 
        instructions: 'Cook it well', 
        tag: 'Lunch' 
      };
      spyOn(component, 'openEditForm').and.callThrough();
      component.editRecipe(recipe);
      expect(component.editRecipeData).toEqual(recipe as any);
      expect(component.openEditForm).toHaveBeenCalled();
      expect(component.isEditFormOpen).toBeTrue();
    });

    it('should open and close edit form', () => {
      component.openEditForm();
      expect(component.isEditFormOpen).toBeTrue();
      component.closeEditForm();
      expect(component.isEditFormOpen).toBeFalse();
    });
  });

  describe('updateRecipe', () => {
    it('should update recipe and refresh recipes on success', fakeAsync(() => {
      // Create a full recipe data object. Cast as any to bypass type mismatches.
      const recipeData: any = { id: 1, author: 'John Doe', title: 'Updated Recipe', ingredients: 'X', instructions: 'Y', tag: 'Dinner' };
      component.editRecipeData = recipeData;
      spyOn(component, 'loadRecipes');
      httpSpy.put.and.returnValue(of({ message: 'Updated' }));
      component.updateRecipe();
      tick();
      expect(httpSpy.put).toHaveBeenCalledWith(`${environment.apiUrl}/recipes/1`, recipeData);
      expect(component.loadRecipes).toHaveBeenCalled();
      expect(component.isEditFormOpen).toBeFalse();
    }));

    it('should alert if updateRecipe fails', fakeAsync(() => {
      const recipeData: any = { id: 1, author: 'John Doe', title: 'Updated Recipe', ingredients: 'X', instructions: 'Y', tag: 'Dinner' };
      component.editRecipeData = recipeData;
      httpSpy.put.and.returnValue(throwError(() => new Error('Error')));
      spyOn(window, 'alert');
      component.updateRecipe();
      tick();
      expect(window.alert).toHaveBeenCalledWith('Failed to update recipe.');
    }));
  });

  describe('addToCalendar', () => {
    it('should alert if no recipes are selected', () => {
      spyOn(window, 'alert');
      component.selectedRecipes = [];
      component.addToCalendar();
      expect(window.alert).toHaveBeenCalledWith("No recipes selected! Please select recipes first.");
    });

    it('should set sessionStorage and navigate if recipes are selected', () => {
      component.selectedRecipes = [{ id: 1, title: 'Test Recipe' }];
      spyOn(sessionStorage, 'setItem');
      component.addToCalendar();
      expect(sessionStorage.setItem).toHaveBeenCalledWith('selectedRecipes', JSON.stringify(component.selectedRecipes));
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/tabs/calendar'], { state: { recipes: component.selectedRecipes } });
    });
  });

  describe('deleteRecipe', () => {
    it('should delete recipe when confirmed', fakeAsync(() => {
      spyOn(window, 'confirm').and.returnValue(true);
      const recipesMock = [{ id: 1, title: 'Test Recipe' }, { id: 2, title: 'Another Recipe' }];
      component.recipes = recipesMock;
      component.selectedRecipes = [{ id: 1, title: 'Test Recipe' }];
      component.selectedRecipesList = [{ id: 1, title: 'Test Recipe' }];
      httpSpy.delete.and.returnValue(of({}));
      spyOn(component, 'loadRecipes');
      component.deleteRecipe(1);
      tick();
      expect(httpSpy.delete).toHaveBeenCalledWith(`${environment.apiUrl}/recipes/1`);
      expect(component.loadRecipes).toHaveBeenCalled();
      expect(component.selectedRecipes).not.toContain(jasmine.objectContaining({ id: 1 }));
      expect(component.selectedRecipesList).not.toContain(jasmine.objectContaining({ id: 1 }));
    }));

    it('should not delete recipe when confirmation is cancelled', () => {
      spyOn(window, 'confirm').and.returnValue(false);
      component.deleteRecipe(1);
      expect(httpSpy.delete).not.toHaveBeenCalled();
    });

    it('should alert on delete error', fakeAsync(() => {
      spyOn(window, 'confirm').and.returnValue(true);
      httpSpy.delete.and.returnValue(throwError(() => new Error('Error')));
      spyOn(window, 'alert');
      component.deleteRecipe(1);
      tick();
      expect(window.alert).toHaveBeenCalledWith('Failed to delete recipe.');
    }));
  });

  describe('openEditForm and closeEditForm', () => {
    it('should open the edit form', () => {
      component.openEditForm();
      expect(component.isEditFormOpen).toBeTrue();
    });

    it('should close the edit form', () => {
      component.closeEditForm();
      expect(component.isEditFormOpen).toBeFalse();
    });
  });
});
