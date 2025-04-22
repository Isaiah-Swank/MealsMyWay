// Import necessary Angular modules and services used by the PantryPage component.
import { Component, OnInit } from '@angular/core';
import { PantryService, PantryPayload, PantryItem } from '../services/pantry.service';
import { UserService } from '../services/user.service';
import { AlertController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { RecipeService } from '../services/recipe.service';
import { Router } from '@angular/router';

// Decorator that marks the class as an Angular component and sets up metadata such as selector, template, and style files.
@Component({
  selector: 'app-pantry', // The HTML tag to use for this component.
  templateUrl: './pantry.page.html', // The HTML file that defines the component's view.
  styleUrls: ['./pantry.page.scss'] // The SCSS file that defines component-specific styling.
})
export class PantryPage implements OnInit {
  // Arrays to hold pantry items, freezer items, and spice items. Pantry items have a defined interface.
  pantryItems: PantryItem[] = [];
  freezerItems: any[] = [];
  spiceItems: any[] = [];

  // Stores the current user's id and username. The userId is initialized to -1 to indicate not loaded.
  userId: number = -1;
  username: string = '';

  // Flags to toggle edit mode on pantry, freezer, and spice lists.
  editMode: boolean = false;
  freezerEditMode: boolean = false;
  spiceEditMode: boolean = false;

  // Array used to hold recipes that are generated from pantry items. This list can then be passed to another page.
  selectedRecipesList: any[] = [];

  // The constructor uses Angular's dependency injection to make services available within the component.
  constructor(
    private pantryService: PantryService, // Service for updating and retrieving pantry data.
    private userService: UserService, // Service to manage and retrieve user information.
    private alertCtrl: AlertController, // Controller for creating alert dialogs (pop-ups) for user interaction.
    private http: HttpClient, // Angular HTTP client for potential API calls.
    private recipeService: RecipeService, // Service used to manage recipes.
    private router: Router // Router service for navigation between routes/pages.
  ) {}

  // Lifecycle hook that runs when the component is initialized.
  ngOnInit() {
    // Load the current user information.
    this.loadUser();
    // Subscribe to pantry updates; when pantryUpdated$ is emitted, refresh the pantry items.
    this.pantryService.pantryUpdated$.subscribe(() => {
      this.loadPantryItems();
    });
  }
  
  // Ionic lifecycle method that gets called every time the view is about to be entered.
  ionViewWillEnter() {
    console.log('[PANTRY] ionViewWillEnter triggered — refreshing pantry items');
    this.loadPantryItems();
  }

  // Loads the user information from the UserService.
  // If a valid user is found, their id and username are stored and the pantry items are loaded.
  // Otherwise, a warning is logged.
  loadUser() {
    const user = this.userService.getUser();
    if (user && typeof user.id === 'number') {
      this.userId = user.id;
      this.username = user.username;
      console.log(`[PANTRY] User loaded: ID=${this.userId}, Username="${user.username}"`);
      // Once user info is available, load pantry items.
      this.loadPantryItems();
    } else {
      console.warn(`[PANTRY] WARNING - No valid user found. Pantry cannot be loaded.`);
      this.userId = -1;
    }
  }

  /**
   * Adds a pantry item to the recipe list.
   * @param index - The index of the pantry item in the pantryItems array.
   *
   * This method will:
   * - Retrieve the pantry item by its index.
   * - Build an ingredient line (with a forced unit value of 1).
   * - Check if a recipe already exists using the RecipeService.
   * - If found, it will use the existing recipe; otherwise, it creates a new recipe.
   * - Finally, it merges the new or existing recipe into a session stored list and navigates to the calendar page.
   */
  async addToRecipeList(index: number) {
    const item = this.pantryItems[index];
    if (!item) {
      console.error('[PANTRY] Error: Pantry item not found.');
      return;
    }
    
    // Force unit value to always be 1 for the purpose of recipe creation.
    const unitValue = 1;
    let ingredientLine = '';
    if (item.measurement && item.measurement.trim() !== '') {
      // Create ingredient string using measurement.
      ingredientLine = `${unitValue}${item.measurement} - ${item.name}`;
    } else {
      // Create ingredient string without measurement.
      ingredientLine = `${unitValue} ${item.name}`;
    }
    
    // Check the database for an existing recipe matching the pantry item.
    this.recipeService.getRecipes().subscribe(
      (recipes: any[]) => {
        let newRecipe: any;
        // Find a matching recipe by comparing the recipe title with the pantry item's name (case-insensitive).
        const matchingRecipe = recipes.find(recipe => 
          recipe.title.toLowerCase() === item.name.toLowerCase()
        );
        
        if (matchingRecipe) {
          console.log('[PANTRY] Recipe already exists for item:', matchingRecipe);
          // If a matching recipe exists, add an extra property for display purposes.
          newRecipe = { ...matchingRecipe, isExpanded: false };
        } else {
          // If no matching recipe exists, create a new recipe object with default instructions.
          newRecipe = {
            title: item.name,
            author: this.username || 'Unknown',
            ingredients: ingredientLine,
            instructions: 'eat and enjoy',
            tag: 'snacks',
            pantry: true,
            isExpanded: false
          };
          console.log('[PANTRY] Adding new recipe from pantry item:', newRecipe);
        }
    
        // If a new recipe was created, add it to the database via the RecipeService.
        if (!matchingRecipe) {
          this.recipeService.addRecipe(newRecipe).subscribe(
            (response: any) => {
              console.log('[PANTRY] Successfully added recipe from pantry item.', response);
              // Attach the returned id (if any) to the recipe and then merge it into our stored list.
              newRecipe = { ...newRecipe, id: response.id || undefined };
              this.mergeAndStoreRecipe(newRecipe);
            },
            (error) => {
              console.error('[PANTRY] Failed to add recipe:', error);
            }
          );
        } else {
          // If a matching recipe already exists, directly merge it into the stored recipe list.
          this.mergeAndStoreRecipe(newRecipe);
        }
      },
      (error) => {
        console.error('[PANTRY] Error fetching recipes for duplicate check:', error);
      }
    );
  }
  
  /**
   * Helper method to merge the new recipe with the recipes stored in session storage.
   * @param newRecipe - The recipe object to merge.
   *
   * This method:
   * - Retrieves the existing recipe list from session storage.
   * - Checks if the new recipe already exists by comparing the recipe id and title.
   * - If it does not exist, the recipe is added to the list.
   * - The updated list is then saved back to session storage.
   * - Finally, it navigates to the calendar page, passing along the updated recipes.
   */
  mergeAndStoreRecipe(newRecipe: any) {
    // Retrieve existing recipes from session storage.
    let existingRecipes: any[] = [];
    const storedRecipes = sessionStorage.getItem('selectedRecipes');
    if (storedRecipes) {
      try {
        existingRecipes = JSON.parse(storedRecipes);
      } catch (e) {
        console.error('[PANTRY] Error parsing existing recipes from session storage:', e);
      }
    }
    
    // Check for duplicate recipes (by id or title) before appending.
    const duplicate = existingRecipes.some(
      (recipe: any) =>
        (recipe.id && recipe.id === newRecipe.id) ||
        recipe.title.toLowerCase() === newRecipe.title.toLowerCase()
    );
    
    if (!duplicate) {
      existingRecipes.push(newRecipe);
    } else {
      console.log('[PANTRY] Skipping merge: Recipe already exists in the current list.');
    }
    
    // Save the merged list back to session storage.
    sessionStorage.setItem('selectedRecipes', JSON.stringify(existingRecipes));
    
    // Optionally update the local selectedRecipesList variable.
    this.selectedRecipesList = existingRecipes;
    
    // Navigate to the calendar page while passing the updated recipe list in the router's state.
    this.router.navigate(['/tabs/calendar'], { state: { recipes: existingRecipes } });
  }
  
  /**
   * Opens a prompt that allows users to add a new pantry item.
   * Users are asked to provide:
   *  - Name (e.g. "Flour")
   *  - Measurement (e.g. "oz", optional)
   *  - Unit (quantity as a number, e.g. 14)
   *
   * This method uses an alert dialog for user input.
   */
  async openAddItemPrompt() {
    const alert = await this.alertCtrl.create({
      header: 'Add Pantry Item',
      inputs: [
        {
          name: 'itemName',
          type: 'text',
          placeholder: 'Ingredient Name (required)'
        },
        {
          name: 'measurement',
          type: 'text',
          placeholder: '(e.g., "oz", or leave blank)'
        },
        {
          name: 'unit',
          type: 'number',
          placeholder: 'Unit count (e.g., 14)'
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add Item',
          // Handler called when user confirms adding the item.
          handler: async (data) => {
            if (data.itemName) {
              // Parse the numeric unit if provided; default to 0 if not.
              const unitVal = parseInt(data.unit, 10);
              const finalUnit = isNaN(unitVal) ? 0 : unitVal;
              // Calls addPantryItem with the provided data.
              await this.addPantryItem(data.itemName, data.measurement, finalUnit);
            } else {
              console.warn(`[PANTRY] WARNING - Item name is required.`);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  /**
   * Increments the unit count of a pantry item.
   * @param index - Index of the pantry item in the pantryItems array.
   */
  async incrementPantryItem(index: number) {
    const item = this.pantryItems?.[index];
    if (!item) return;
  
    // Increment the unit count. If unit is undefined, defaults to 0.
    const currentUnit = item.unit ?? 0;
    item.unit = currentUnit + 1;
  
    console.log(`[PANTRY] Incremented "${item.name}" to ${item.unit}`);
    // Update the pantry on the server.
    await this.updatePantry();
  }
  
  /**
   * Decrements the unit count of a pantry item, but ensures it does not drop below zero.
   * @param index - Index of the pantry item in the pantryItems array.
   */
  async decrementPantryItem(index: number) {
    const item = this.pantryItems?.[index];
    if (!item) return;
  
    const currentUnit = item.unit ?? 0;
    // Decrement only if the current unit count is above zero.
    if (currentUnit > 0) {
      item.unit = currentUnit - 1;
      console.log(`[PANTRY] Decremented "${item.name}" to ${item.unit}`);
      await this.updatePantry();
    }
  }
  
  /**
   * Updates the pantry data on the server.
   * Constructs a payload that contains user_id, a flag (pf_flag) and
   * an object of all item lists (pantry, freezer, spice).
   */
  async updatePantry() {
    if (this.userId === -1) {
      console.error(`[PANTRY] ERROR - User not loaded. Cannot update pantry.`);
      return;
    }
  
    const payload: PantryPayload = {
      user_id: this.userId,
      pf_flag: false,
      item_list: {
        pantry: this.pantryItems,
        freezer: this.freezerItems,
        spice: this.spiceItems
      }
    };
  
    console.log(`[PANTRY] Updating pantry with payload:`, JSON.stringify(payload, null, 2));
    // Update the pantry data via the pantryService.
    await this.pantryService.updatePantry(payload).toPromise();
    console.log(`[PANTRY] SUCCESS - Pantry updated for user ID=${this.userId}`);
  }
  
  /**
   * Creates and stores a new pantry item.
   * @param name - Name of the pantry item (e.g., "Flour", "Onions").
   * @param measurement - Measurement unit as a string (e.g., "oz", or an empty string).
   * @param unit - Quantity (e.g., 14 or 2).
   *
   * The function creates a new PantryItem, pushes it into the local pantryItems array,
   * then updates the server with the new complete list.
   */
  async addPantryItem(name: string, measurement: string, unit: number) {
    console.log(`[PANTRY] addPantryItem called with Name="${name}", Measurement="${measurement}", Unit=${unit}`);
    if (this.userId === -1) {
      console.error(`[PANTRY] ERROR - User not loaded. Cannot add item.`);
      return;
    }

    // Create a new PantryItem using the provided name.
    const newItem: PantryItem = { name };
    if (measurement && measurement.trim() !== '') {
      newItem.measurement = measurement.trim();
    }
    newItem.unit = unit;

    // Add the new item to the local list.
    this.pantryItems.push(newItem);
    console.log(`[PANTRY] Adding pantry item:`, newItem);

    // Construct the payload for updating the pantry on the server.
    const payload: PantryPayload = {
      user_id: this.userId,
      pf_flag: false,
      item_list: {
        pantry: this.pantryItems,
        freezer: this.freezerItems,
        spice: this.spiceItems
      }
    };

    console.log(`[PANTRY] Payload to database:`, JSON.stringify(payload, null, 2));

    // Send the update to the server.
    await this.pantryService.updatePantry(payload).toPromise();
    console.log(`[PANTRY] SUCCESS - Pantry updated for user ID=${this.userId}`);
  }

  /**
   * Opens a prompt to add a freezer item.
   * This functionality remains unchanged.
   *
   * Users are asked to provide:
   *  - Item Name
   *  - Portions (as a number)
   */
  async openAddFreezerItemPrompt() {
    const alert = await this.alertCtrl.create({
      header: 'Add Freezer Item',
      inputs: [
        { name: 'itemName', type: 'text', placeholder: 'Item Name' },
        { name: 'quantity', type: 'number', placeholder: 'Portions' }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add Item',
          handler: async (data) => {
            if (data.itemName && data.quantity) {
              await this.addFreezerItem(data.itemName, parseInt(data.quantity));
            } else {
              console.warn(`[FREEZER] WARNING - Invalid entry. Name & portions required.`);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  /**
   * Adds a new item to the freezer.
   * @param name - The name of the freezer item.
   * @param quantity - The portion count for the freezer item.
   *
   * This method updates the local freezerItems array and sends an update to the server.
   */
  async addFreezerItem(name: string, quantity: number) {
    console.log(`[FREEZER] addFreezerItem called with Name="${name}", Portions=${quantity}`);
    if (this.userId === -1) {
      console.error(`[FREEZER] ERROR - User not loaded. Cannot add item.`);
      return;
    }

    // Add the new freezer item to the local array.
    this.freezerItems.push({ name, quantity });
    console.log(`[FREEZER] Added item: Name="${name}", Portions=${quantity}`);

    // Build the payload including all item lists.
    const payload: PantryPayload = {
      user_id: this.userId,
      pf_flag: false,
      item_list: {
        pantry: this.pantryItems,
        freezer: this.freezerItems,
        spice: this.spiceItems
      }
    };

    console.log(`[FREEZER] Payload:`, JSON.stringify(payload, null, 2));

    // Update the freezer data on the server.
    await this.pantryService.updatePantry(payload).toPromise();
    console.log(`[FREEZER] SUCCESS - Freezer updated for user ID=${this.userId}`);
  }

  /**
   * Increments the portion count for a freezer item.
   * @param index - The index of the item in the freezerItems array.
   */
  async incrementFreezerItem(index: number) {
    if (index < 0 || index >= this.freezerItems.length) return;
    this.freezerItems[index].quantity++;
    console.log(`[FREEZER] Incremented to ${this.freezerItems[index].quantity}`);
    await this.updateFreezer();
  }

  /**
   * Decrements the portion count for a freezer item, ensuring it does not drop below zero.
   * @param index - The index of the item in the freezerItems array.
   */
  async decrementFreezerItem(index: number) {
    if (index < 0 || index >= this.freezerItems.length) return;
    if (this.freezerItems[index].quantity > 0) {
      this.freezerItems[index].quantity--;
      console.log(`[FREEZER] Decremented to ${this.freezerItems[index].quantity}`);
      await this.updateFreezer();
    }
  }

  /**
   * Updates the freezer data on the server.
   * Similar to updatePantry, it builds a payload for all items and sends it via pantryService.
   */
  async updateFreezer() {
    if (this.userId === -1) {
      console.error(`[FREEZER] ERROR - User not loaded. Cannot update freezer.`);
      return;
    }
    const payload: PantryPayload = {
      user_id: this.userId,
      pf_flag: false,
      item_list: {
        pantry: this.pantryItems,
        freezer: this.freezerItems,
        spice: this.spiceItems
      }
    };
    console.log(`[FREEZER] Updating freezer with payload:`, JSON.stringify(payload, null, 2));
    await this.pantryService.updatePantry(payload).toPromise();
    console.log(`[FREEZER] SUCCESS - Freezer updated for user ID=${this.userId}`);
  }

  /**
   * Opens a prompt to add a spice item.
   * The functionality remains unchanged.
   *
   * Users only need to provide the item name.
   */
  async openAddSpiceItemPrompt() {
    const alert = await this.alertCtrl.create({
      header: 'Add Spice Item',
      inputs: [
        { name: 'itemName', type: 'text', placeholder: 'Item Name' }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add Item',
          handler: async (data) => {
            if (data.itemName) {
              await this.addSpiceItem(data.itemName, 100);
            } else {
              console.warn(`[SPICE] WARNING - Invalid entry. Name required.`);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  /**
   * Adds a new item to the spice rack.
   * @param name - The name of the spice.
   * @param quantity - The quantity of the spice in ounces.
   *
   * This method updates the local spiceItems array and sends an update to the server.
   */
  async addSpiceItem(name: string, quantity: number) {
    console.log(`[SPICE] addSpiceItem called with Name="${name}"`);
    if (this.userId === -1) {
      console.error(`[SPICE] ERROR - User not loaded. Cannot add item.`);
      return;
    }

    // Add the new spice item to the local array.
    this.spiceItems.push({ name, quantity });
    console.log(`[SPICE] Added spice: Name="${name}", Quantity=${quantity}oz`);

    // Create the payload with the updated item lists.
    const payload: PantryPayload = {
      user_id: this.userId,
      pf_flag: false,
      item_list: {
        pantry: this.pantryItems,
        freezer: this.freezerItems,
        spice: this.spiceItems
      }
    };

    console.log(`[SPICE] Payload:`, JSON.stringify(payload, null, 2));

    // Send update to the server.
    await this.pantryService.updatePantry(payload).toPromise();
    console.log(`[SPICE] SUCCESS - Spice rack updated for user ID=${this.userId}`);
  }

  /**
   * Increments the quantity of a spice item.
   * @param index - Index of the spice item in the spiceItems array.
   */
  async incrementSpiceItem(index: number) {
    if (index < 0 || index >= this.spiceItems.length) return;
    this.spiceItems[index].quantity++;
    console.log(`[SPICE] Incremented to ${this.spiceItems[index].quantity}`);
    await this.updateSpice();
  }

  /**
   * Decrements the quantity of a spice item, ensuring it does not drop below zero.
   * @param index - Index of the spice item in the spiceItems array.
   */
  async decrementSpiceItem(index: number) {
    if (index < 0 || index >= this.spiceItems.length) return;

    if (this.spiceItems[index].quantity > 0) {
      this.spiceItems[index].quantity--;
      console.log(`[SPICE] Decremented to ${this.spiceItems[index].quantity}`);
      await this.updateSpice();
    }
  }

  /**
   * Updates the spice rack data on the server.
   * Constructs a payload similar to updatePantry and updateFreezer, then sends it using pantryService.
   */
  async updateSpice() {
    if (this.userId === -1) {
      console.error(`[SPICE] ERROR - User not loaded. Cannot update spice rack.`);
      return;
    }
    const payload: PantryPayload = {
      user_id: this.userId,
      pf_flag: false,
      item_list: {
        pantry: this.pantryItems,
        freezer: this.freezerItems,
        spice: this.spiceItems
      }
    };
    console.log(`[SPICE] Updating spice rack with payload:`, JSON.stringify(payload, null, 2));
    await this.pantryService.updatePantry(payload).toPromise();
    console.log(`[SPICE] SUCCESS - Spice rack updated for user ID=${this.userId}`);
  }

  /**
   * Deletes an item from the pantry.
   * @param index - The index of the pantry item to be deleted.
   *
   * This method prompts the user for confirmation before deleting the item.
   * After deletion, it updates the server with the new list.
   */
  async deletePantryItem(index: number) {
    if (this.userId === -1) {
      console.error(`[PANTRY] ERROR - User not loaded. Cannot delete item.`);
      return;
    }

    // Reference the item that will be deleted.
    const itemToDelete = this.pantryItems[index];

    // Create a confirmation alert before deletion.
    const alert = await this.alertCtrl.create({
      header: 'Confirm Deletion',
      message: `Are you sure you want to remove "${itemToDelete.name}" from your pantry?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          handler: async () => {
            // Remove the item from the local pantryItems array.
            this.pantryItems.splice(index, 1);
            console.log(`[PANTRY] Removing item: "${itemToDelete.name}"`);

            // Construct updated payload after deletion.
            const payload: PantryPayload = {
              user_id: this.userId,
              pf_flag: false,
              item_list: {
                pantry: this.pantryItems,
                freezer: this.freezerItems,
                spice: this.spiceItems
              }
            };

            console.log(`[PANTRY] Payload after deletion:`, JSON.stringify(payload, null, 2));

            // Update the pantry on the server.
            await this.pantryService.updatePantry(payload).toPromise();
            console.log(`[PANTRY] SUCCESS - Item removed for user ID=${this.userId}`);
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Loads all pantry data (pantry items, freezer items, spice items) for the current user.
   * Uses pantryService.loadPantry to fetch data from the server.
   */
  async loadPantryItems() {
    if (this.userId === -1) {
      console.error(`[PANTRY] ERROR - User not loaded. Cannot fetch pantry.`);
      return;
    }

    console.log(`[PANTRY] Fetching pantry for user ID=${this.userId}...`);
    // Subscribe to the data returned from the pantry service.
    this.pantryService.loadPantry(this.userId).subscribe(
      (data) => {
        // Use the optional chaining operator and fallback to empty arrays if properties are missing.
        this.pantryItems  = data.item_list?.pantry  || [];
        this.freezerItems = data.item_list?.freezer || [];
        this.spiceItems   = data.item_list?.spice   || [];
        console.log(`[PANTRY] SUCCESS - Pantry loaded for user ID=${this.userId}`);
        console.log(`[PANTRY] Current state:`, JSON.stringify({
          pantry: this.pantryItems,
          freezer: this.freezerItems,
          spice: this.spiceItems
        }, null, 2));
      },
      (error) => {
        console.error(`[PANTRY] ERROR - Failed to load pantry for user ID=${this.userId}:`, error);
      }
    );
  }

  /**
   * Toggles edit mode for the pantry list.
   * When enabled, the user may be able to edit or rearrange the pantry items.
   */
  toggleEditMode() {
    this.editMode = !this.editMode;
    console.log(`[PANTRY] Edit Mode: ${this.editMode ? 'ON' : 'OFF'}`);
  }

  /**
   * Toggles edit mode for the freezer list.
   * When enabled, the user may be able to modify the freezer items.
   */
  toggleFreezerEditMode() {
    this.freezerEditMode = !this.freezerEditMode;
    console.log(`[FREEZER] Edit Mode: ${this.freezerEditMode ? 'ON' : 'OFF'}`);
  }

  /**
   * Toggles edit mode for the spice rack list.
   * When enabled, the user may be able to modify the spice items.
   */
  toggleSpiceEditMode() {
    this.spiceEditMode = !this.spiceEditMode;
    console.log(`[SPICE] Edit Mode: ${this.spiceEditMode ? 'ON' : 'OFF'}`);
  }

  /**
   * Deletes an item from the freezer.
   * @param index - The index of the freezer item to be deleted.
   *
   * Prompts the user for confirmation, then updates the freezer list and server data.
   */
  async deleteFreezerItem(index: number) {
    if (this.userId === -1) {
      console.error(`[FREEZER] ERROR - User not loaded. Cannot delete item.`);
      return;
    }
    const itemToDelete = this.freezerItems[index];
    const alert = await this.alertCtrl.create({
      header: 'Confirm Deletion',
      message: `Are you sure you want to remove "${itemToDelete.name}" from your freezer?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          handler: async () => {
            this.freezerItems.splice(index, 1);
            console.log(`[FREEZER] Removing item: "${itemToDelete.name}"`);
            await this.updateFreezer();
            console.log(`[FREEZER] SUCCESS - Item removed for user ID=${this.userId}`);
          }
        }
      ]
    });
    await alert.present();
  }

  /**
   * Deletes an item from the spice rack.
   * @param index - The index of the spice item to be deleted.
   *
   * Prompts the user for confirmation, then updates the spice list and server data.
   */
  async deleteSpiceItem(index: number) {
    if (this.userId === -1) {
      console.error(`[SPICE] ERROR - User not loaded. Cannot delete item.`);
      return;
    }
    const itemToDelete = this.spiceItems[index];
    const alert = await this.alertCtrl.create({
      header: 'Confirm Deletion',
      message: `Are you sure you want to remove "${itemToDelete.name}" from your spice rack?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          handler: async () => {
            this.spiceItems.splice(index, 1);
            console.log(`[SPICE] Removing item: "${itemToDelete.name}"`);
            await this.updateSpice();
            console.log(`[SPICE] SUCCESS - Item removed for user ID=${this.userId}`);
          }
        }
      ]
    });
    await alert.present();
  }
}
