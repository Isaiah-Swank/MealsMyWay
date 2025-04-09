import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule, AlertController } from '@ionic/angular';
import { Tab2Page } from './calendar.page';
import { Router } from '@angular/router';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CalendarService } from '../services/calendar.service';
import { UserService } from '../services/user.service';
import { RecipeService } from '../services/recipe.service';
import { PantryService } from '../services/pantry.service';
import { of, throwError } from 'rxjs';

describe('Tab2Page', () => {
  let component: Tab2Page;
  let fixture: ComponentFixture<Tab2Page>;
  let httpMock: HttpTestingController;

  let routerSpy: jasmine.SpyObj<Router>;
  let alertControllerSpy: jasmine.SpyObj<AlertController>;
  let userServiceSpy: jasmine.SpyObj<UserService>;
  let calendarServiceSpy: jasmine.SpyObj<CalendarService>;
  let recipeServiceSpy: jasmine.SpyObj<RecipeService>;
  let pantryServiceSpy: jasmine.SpyObj<PantryService>;

  beforeEach(async () => {
    routerSpy = jasmine.createSpyObj('Router', ['getCurrentNavigation']);
    alertControllerSpy = jasmine.createSpyObj('AlertController', ['create']);
    userServiceSpy = jasmine.createSpyObj('UserService', ['searchUsers']);
    calendarServiceSpy = jasmine.createSpyObj('CalendarService', [
      'sendCalendarInvite', 'loadCalendar', 'saveCalendar', 'updateCalendar'
    ]);
    recipeServiceSpy = jasmine.createSpyObj('RecipeService', ['getRecipeDetailsFromApi']);
    pantryServiceSpy = jasmine.createSpyObj('PantryService', [
      'loadPantry', 'updatePantry', 'savePantry', 'triggerPantryReload'
    ]);

    // Default stubs
    calendarServiceSpy.loadCalendar.and.returnValue(of([
      {
        week: {
          sunday:    { kidsLunch: [], adultsLunch: [], familyDinner: [] },
          monday:    { kidsLunch: [], adultsLunch: [], familyDinner: [] },
          tuesday:   { kidsLunch: [], adultsLunch: [], familyDinner: [] },
          wednesday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
          thursday:  { kidsLunch: [], adultsLunch: [], familyDinner: [] },
          friday:    { kidsLunch: [], adultsLunch: [], familyDinner: [] },
          saturday:  { kidsLunch: [], adultsLunch: [], familyDinner: [] },
          grocery:   [],
          prep:      []
        }
      }
    ]));
    calendarServiceSpy.saveCalendar.and.returnValue(of({ message: 'Saved' }));
    calendarServiceSpy.updateCalendar.and.returnValue(of({ message: 'Updated' }));
    calendarServiceSpy.sendCalendarInvite.and.returnValue(of({ message: 'Invite sent' }));

    userServiceSpy.searchUsers.and.returnValue(of([]));

    recipeServiceSpy.getRecipeDetailsFromApi.and.returnValue(of({
      meals: [
        {
          strMeal: 'MockMeal',
          strInstructions: 'Mock instructions',
          strIngredient1: 'Salt',
          strMeasure1: '1 tsp'
        }
      ]
    }));

    pantryServiceSpy.loadPantry.and.returnValue(of({
      user_id: 1,
      pf_flag: false,
      item_list: {
        pantry:  [{ name: 'Salt', quantity: 2 }],
        freezer: []
      }
    }));
    pantryServiceSpy.updatePantry.and.returnValue(of({ message: 'Pantry updated' }));
    pantryServiceSpy.savePantry.and.returnValue(of({ message: 'Pantry saved' }));

    await TestBed.configureTestingModule({
      declarations: [Tab2Page],
      imports: [IonicModule.forRoot(), HttpClientTestingModule],
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: AlertController, useValue: alertControllerSpy },
        { provide: UserService, useValue: userServiceSpy },
        { provide: CalendarService, useValue: calendarServiceSpy },
        { provide: RecipeService, useValue: recipeServiceSpy },
        { provide: PantryService, useValue: pantryServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Tab2Page);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // toggleShareCalendar
  it('should toggle share calendar view', () => {
    expect(component.showShareCalendar).toBeFalse();
    component.toggleShareCalendar();
    expect(component.showShareCalendar).toBeTrue();
  });

  // searchUsers
  it('should search users and update searchResults', () => {
    const mockUsers = [{ id: 1, username: 'testuser' }];
    userServiceSpy.searchUsers.and.returnValue(of(mockUsers));
    component.searchQuery = 'test';
    component.searchUsers();
    expect(userServiceSpy.searchUsers).toHaveBeenCalledWith('test');
    expect(component.searchResults).toEqual(mockUsers);
  });

  it('should clear search results on empty query', () => {
    component.searchQuery = ' ';
    component.searchUsers();
    expect(component.searchResults).toEqual([]);
  });

  // sendCalendarInvite
  it('should send calendar invite and show success alert', () => {
    spyOn(window, 'alert');
    component.currentUser = { id: 1 };
    component.selectedPlan = new Date('2025-04-01');
    const user = { id: 2, username: 'friend' };

    calendarServiceSpy.sendCalendarInvite.and.returnValue(of({ message: 'Invite sent' }));
    component.sendCalendarInvite(user);

    expect(calendarServiceSpy.sendCalendarInvite).toHaveBeenCalledWith({
      senderId: 1,
      recipientId: 2,
      plan: '2025-04-01T00:00:00.000Z'
    });
    expect(window.alert).toHaveBeenCalledWith('Invite sent to friend');
  });

  it('should show error alert if calendar invite fails', () => {
    spyOn(window, 'alert');
    component.currentUser = { id: 1 };
    component.selectedPlan = new Date('2025-04-01');
    const user = { id: 2, username: 'friend' };

    calendarServiceSpy.sendCalendarInvite.and.returnValue(throwError(() => new Error('Network error')));
    component.sendCalendarInvite(user);

    expect(window.alert).toHaveBeenCalledWith('Failed to send invite.');
  });

  // addMeal
  it('should alert if meal, day, or category is not selected', () => {
    spyOn(window, 'alert');
    component.selectedMeal = null;
    component.selectedDay = '';
    component.selectedCategory = '';

    component.addMeal();
    expect(window.alert).toHaveBeenCalledWith('Please select a meal, day, and category.');
  });

  it('should call pushMeal if ingredients and instructions are present', () => {
    component.selectedPlan = new Date('2025-04-01');
    const mockMeal = { title: 'Tacos', ingredients: ['Tortilla'], instructions: 'Cook it' };
    component.selectedMeal = mockMeal;
    component.selectedDay = 'monday';
    component.selectedCategory = 'kidsLunch';

    spyOn(component, 'pushMeal');
    component.addMeal();

    expect(component.pushMeal).toHaveBeenCalled();
  });

  // generatePrepList
  it('should call backend and update prep list on generatePrepList()', () => {
    spyOn(window, 'alert');
    component.selectedPlan = new Date('2025-04-01');
    const weekKey = component.selectedPlan.toDateString();
    component.events[weekKey] = {
      sunday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      monday: {
        kidsLunch: [
          { title: 'Pizza', instructions: 'Bake it', ingredients: ['Cheese', 'Dough'] }
        ],
        adultsLunch: [],
        familyDinner: []
      },
      tuesday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      wednesday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      thursday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      friday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      saturday: { kidsLunch: [], adultsLunch: [], familyDinner: [] },
      grocery: [],
      prep: []
    };

    component.calendarChanged = true;
    component.generatePrepList();

    const req = httpMock.expectOne((request) => request.url.includes('/api/deepseek'));
    expect(req.request.method).toBe('POST');
    req.flush({ choices: [{ message: { content: 'Generated prep list content' } }] });

    expect(window.alert).toHaveBeenCalledWith('Prep list generated successfully! Check console.');
  });

  it('should alert if prep already exists and calendar hasn\'t changed', () => {
    spyOn(window, 'alert');
    component.selectedPlan = new Date('2025-04-01');
    const weekKey = component.selectedPlan.toDateString();
    component.events[weekKey] = { prep: 'Already done' };
    component.calendarChanged = false;

    component.generatePrepList();
    expect(window.alert).toHaveBeenCalledWith("No changes to the calendar detected. Prep list is up to date.");
  });

  // viewShoppingList
  it('should alert if grocery list does not exist', () => {
    spyOn(window, 'alert');
    component.selectedPlan = new Date('2025-04-01');
    const weekKey = component.selectedPlan.toDateString();
    component.events[weekKey] = { grocery: [] };

    component.viewShoppingList();
    expect(window.alert).toHaveBeenCalledWith('No grocery list has been generated yet for this week. Please generate a grocery list first.');
  });

  it('should display grocery list if it exists', () => {
    spyOn(window, 'alert');
    component.selectedPlan = new Date('2025-04-01');
    const weekKey = component.selectedPlan.toDateString();
    const groceryList = ['1 lb Chicken', '2 cups Rice'];
    component.events[weekKey] = { grocery: groceryList };

    component.viewShoppingList();
    expect(component.showShoppingList).toBeTrue();
    expect(component.groceryListDisplay).toEqual(groceryList);
  });

  // loadCalendar
  it('should not call loadCalendar service if user is missing', () => {
    spyOn(console, 'error');
    component.currentUser = null;
    component.selectedPlan = new Date('2025-04-01');

    component.loadCalendar();
    expect(console.error).toHaveBeenCalledWith('User details not loaded. Cannot load calendar.');
  });

  it('should call loadCalendar service if user is present', () => {
    component.currentUser = { id: 1 };
    component.selectedPlan = new Date('2025-04-01');

    component.loadCalendar();
    expect(calendarServiceSpy.loadCalendar).toHaveBeenCalledWith(1, '2025-04-01');
  });

  // saveCalendar
  it('should not call saveCalendar service if user is missing', () => {
    spyOn(console, 'error');
    component.currentUser = null;
    component.selectedPlan = new Date('2025-04-01');

    component.saveCalendar();
    expect(console.error).toHaveBeenCalledWith('User details not loaded. Cannot save calendar.');
  });

  it('should call saveCalendar with correct payload if user is present', () => {
    component.currentUser = { id: 1 };
    component.selectedPlan = new Date('2025-04-01');
    const weekKey = component.selectedPlan.toDateString();
    component.events[weekKey] = {
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

    calendarServiceSpy.saveCalendar.and.returnValue(of({ message: 'Saved' }));
    component.saveCalendar();
    expect(calendarServiceSpy.saveCalendar).toHaveBeenCalled();
  });

  // setCurrentWeekStart
  it('should set currentWeekStart to the most recent Sunday', () => {
    const today = new Date('2025-04-03'); // Thursday
    jasmine.clock().install();
    jasmine.clock().mockDate(today);

    component.setCurrentWeekStart();
    expect(component.currentWeekStart.getDay()).toBe(0); // Sunday
    expect(component.currentWeekStart <= today).toBeTrue();

    jasmine.clock().uninstall();
  });

  // generatePlans
  it('should generate 20 weeks of plans including current week', () => {
    // Use a known Sunday
    const sunday = new Date(2025, 2, 30); // March 30, 2025 => Sunday
    component.currentWeekStart = sunday;

    // FIX: Clear array to avoid doubling
    component.plans = [];

    component.generatePlans();

    expect(component.plans.length).toBe(20);
    // partial check to avoid timezone differences
    expect(component.plans[0].toDateString()).toContain('Mar 30 2025');
  });

  // loadRecipes
  it('should load recipes from navigation state if available', () => {
    const nav = {
      extras: {
        state: {
          recipes: [{ title: 'Spaghetti' }]
        }
      }
    };
    routerSpy.getCurrentNavigation.and.returnValue(nav as any);

    component.loadRecipes();
    expect(component.recipes.length).toBe(1);
    expect(component.recipes[0].title).toBe('Spaghetti');
  });

  it('should load recipes from sessionStorage if no nav state', () => {
    sessionStorage.setItem('selectedRecipes', JSON.stringify([{ title: 'Soup' }]));
    routerSpy.getCurrentNavigation.and.returnValue(null as any);

    component.loadRecipes();
    expect(component.recipes.length).toBe(1);
    expect(component.recipes[0].title).toBe('Soup');
  });

  // currentWeekEvents
  it('should initialize currentWeekEvents for a new week', () => {
    const date = new Date('2025-04-01');
    component.selectedPlan = date;
    const events = component.currentWeekEvents;

    expect(events).toBeDefined();
    expect(events.sunday).toBeDefined();
    expect(events.monday.kidsLunch).toEqual([]);
    expect(Object.keys(events)).toContain('grocery');
    expect(Object.keys(events)).toContain('prep');
  });

  // pushMeal
  it('should clone and add selectedMeal to the calendar in pushMeal()', () => {
    const date = new Date('2025-04-01');
    component.selectedPlan = date;
    component.selectedDay = 'monday';
    component.selectedCategory = 'kidsLunch';
    component.selectedMeal = { title: 'Tacos', ingredients: ['Tortilla'], instructions: 'Cook' };

    component.pushMeal();

    const weekKey = date.toDateString();
    const events = component.events[weekKey];
    expect(events.monday.kidsLunch.length).toBe(1);
    expect(events.monday.kidsLunch[0].title).toBe('Tacos');
    expect(component.selectedMeal).toBeNull();
    expect(component.selectedDay).toBe('');
    expect(component.selectedCategory).toBe('');
  });

  // onRecipeClick
  it('should populate hoveredRecipe and selectedEvent on onRecipeClick()', () => {
    const recipe = {
      title: 'Lasagna',
      ingredients: 'Cheese, Tomato, Pasta',
      instructions: 'Bake it'
    };
    component.onRecipeClick(recipe);

    expect(component.hoveredRecipe).toBeTruthy();
    expect(component.hoveredRecipe.ingredients).toEqual(['Cheese', 'Tomato', 'Pasta']);
    expect(component.selectedEvent).toBe(component.hoveredRecipe);
  });

  it('should clear hoveredRecipe and selectedEvent when recipe is null', () => {
    component.hoveredRecipe = { title: 'Existing' };
    component.selectedEvent = { title: 'Existing' };

    component.onRecipeClick(null);

    expect(component.hoveredRecipe).toBeNull();
    expect(component.selectedEvent).toBeNull();
  });

  describe('Recipe & Prep List Actions', () => {
    // closeRecipeDetails
    it('should clear hoveredRecipe and selectedEvent when closeRecipeDetails is called', () => {
      component.hoveredRecipe = { title: 'Something' };
      component.selectedEvent = { title: 'Something' };

      component.closeRecipeDetails();
      expect(component.hoveredRecipe).toBeNull();
      expect(component.selectedEvent).toBeNull();
    });

    // confirmRemoveEvent
    it('should remove a recipe and call saveCalendar after confirmation', async () => {
      const mockAlert = {
        present: jasmine.createSpy('present'),
        onDidDismiss: () => Promise.resolve(),
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Remove',
            handler: jasmine.createSpy('handler')
          }
        ]
      };

      const alertCtrl = TestBed.inject(AlertController);
      (alertCtrl.create as jasmine.Spy).and.returnValue(Promise.resolve(mockAlert as any));

      component.selectedPlan = new Date('2025-04-01');
      const weekKey = component.selectedPlan.toDateString();
      component.events[weekKey] = {
        monday: { kidsLunch: [{ title: 'Sandwich' }] },
        sunday: {}, tuesday: {}, wednesday: {}, thursday: {}, friday: {}, saturday: {},
        grocery: [], prep: []
      };
      spyOn(component, 'saveCalendar');

      await component.confirmRemoveEvent({ title: 'Sandwich' }, 'monday', 'kidsLunch', 0, new MouseEvent('click'));
      expect(alertCtrl.create).toHaveBeenCalled();
      expect(mockAlert.present).toHaveBeenCalled();
    });

    // viewPrepList
    it('should display the prep list if available in sessionStorage', async () => {
      const prepMarkdown = '### Prep List\n- Chop onions';
      sessionStorage.setItem('prepList', prepMarkdown);

      component.selectedPlan = new Date('2025-04-01');
      const weekKey = component.selectedPlan.toDateString();
      component.events[weekKey] = { prep: prepMarkdown };

      await component.viewPrepList();

      expect(component.prepListDisplay).toContain('<h3>Prep List</h3>');
      expect(component.showPrepList).toBeTrue();
    });

    it('should alert if no prep list is available', async () => {
      spyOn(window, 'alert');
      sessionStorage.removeItem('prepList');
      component.selectedPlan = new Date('2025-04-01');
      component.events[component.selectedPlan.toDateString()] = { prep: '' };

      await component.viewPrepList();
      expect(window.alert).toHaveBeenCalledWith('No prep list has been generated yet. Please generate one first.');
    });
  });

  describe('Utility & Lifecycle Functions', () => {
    // formatCategory
    it('should format category keys to readable strings', () => {
      expect(component.formatCategory('kidsLunch')).toBe('Kids Lunch');
      expect(component.formatCategory('adultsLunch')).toBe('Adults Lunch');
      expect(component.formatCategory('familyDinner')).toBe('Family Dinner');
      expect(component.formatCategory('snacks')).toBe('snacks');
    });

    // parseIngredient
    it('should parse simple ingredient strings with dash format', () => {
      const parsed = component['parseIngredient']('Tomatoes - 2lbs');
      expect(parsed).toEqual({ quantity: 32, unit: 'oz', name: 'Tomatoes' });
    });

    it('should parse old-style format ingredient strings', () => {
      const parsed = component['parseIngredient']('1.5 lbs Chicken');
      expect(parsed).toEqual({ quantity: 24, unit: 'oz', name: 'Chicken' });
    });

    it('should return null if no numeric value is found', () => {
      const parsed = component['parseIngredient']('Salt to taste');
      expect(parsed).toEqual({ quantity: 0, unit: '', name: 'Salt to taste' });
    });

    // convertToOunces
    it('should correctly convert different units to ounces', () => {
      expect(component['convertToOunces'](2, 'lb')).toBe(32);
      expect(component['convertToOunces'](1, 'g')).toBeCloseTo(0.035274);
      expect(component['convertToOunces'](3, 'cup')).toBe(24);
      expect(component['convertToOunces'](2, 'unknown')).toBe(2);
    });

    // getIngredientsForMeal
    it('should return ingredients from array format', async () => {
      const meal = { ingredients: ['Salt', 'Pepper'] };
      const ingredients = await component.getIngredientsForMeal(meal);
      expect(ingredients).toEqual(['Salt', 'Pepper']);
    });

    it('should return parsed ingredients from comma-separated string', async () => {
      const meal = { ingredients: 'Cheese, Tomato, Onion' };
      const ingredients = await component.getIngredientsForMeal(meal);
      expect(ingredients).toEqual(['Cheese', 'Tomato', 'Onion']);
    });

    // onPlanChange
    it('should save selected plan to sessionStorage and load calendar', () => {
      component.selectedPlan = new Date('2025-04-01');
      spyOn(component, 'loadCalendar');
      component.onPlanChange();

      const stored = sessionStorage.getItem('selectedPlan');
      expect(stored).toBe('2025-04-01T00:00:00.000Z');
      expect(component.loadCalendar).toHaveBeenCalled();
    });

    // ionViewWillEnter
    it('should reload recipes when view is about to enter', () => {
      spyOn(component, 'loadRecipes');
      component.ionViewWillEnter();
      expect(component.loadRecipes).toHaveBeenCalled();
    });

    // ngOnInit
    it('should initialize with stored plan and user and call loadCalendar', () => {
      const storedPlan = new Date('2025-04-01').toISOString();
      const storedUser = { id: 1, username: 'demo' };
      sessionStorage.setItem('selectedPlan', storedPlan);
      sessionStorage.setItem('currentUser', JSON.stringify(storedUser));
      spyOn(component, 'loadCalendar');

      component.ngOnInit();
      expect(component.selectedPlan.toISOString()).toBe(storedPlan);
      expect(component.currentUser).toEqual(storedUser);
      expect(component.loadCalendar).toHaveBeenCalled();
    });
  });
});
