import { Component, OnInit } from '@angular/core';
import { PantryService, PantryPayload, PantryItem } from '../services/pantry.service';
import { UserService } from '../services/user.service';
import { AlertController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { RecipeService } from '../services/recipe.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-pantry',
  templateUrl: './pantry.page.html',
  styleUrls: ['./pantry.page.scss']
})
export class PantryPage implements OnInit {
  pantryItems: PantryItem[] = [];
  freezerItems: any[] = [];
  spiceItems: any[] = [];

  userId: number = -1;
  username: string = '';

  editMode: boolean = false;
  freezerEditMode: boolean = false;
  spiceEditMode: boolean = false;

  // This array holds recipes created from pantry items.
  selectedRecipesList: any[] = [];

  constructor(
    private pantryService: PantryService,
    private userService: UserService,
    private alertCtrl: AlertController,
    private http: HttpClient,
    private recipeService: RecipeService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadUser();
    this.pantryService.pantryUpdated$.subscribe(() => {
      this.loadPantryItems();
    });
  }
  
  ionViewWillEnter() {
    console.log('[PANTRY] ionViewWillEnter triggered — refreshing pantry items');
    this.loadPantryItems();
  }

  // Modified to store the username.
  loadUser() {
    const user = this.userService.getUser();
    if (user && typeof user.id === 'number') {
      this.userId = user.id;
      this.username = user.username;
      console.log(`[PANTRY] User loaded: ID=${this.userId}, Username="${user.username}"`);
      this.loadPantryItems();
    } else {
      console.warn(`[PANTRY] WARNING - No valid user found. Pantry cannot be loaded.`);
      this.userId = -1;
    }
  }

  async addToRecipeList(index: number) {
    const item = this.pantryItems[index];
    if (!item) {
      console.error('[PANTRY] Error: Pantry item not found.');
      return;
    }
    
    // Force unit to always be 1.
    const unitValue = 1;
    let ingredientLine = '';
    if (item.measurement && item.measurement.trim() !== '') {
      ingredientLine = `${unitValue}${item.measurement} - ${item.name}`;
    } else {
      ingredientLine = `${unitValue} ${item.name}`;
    }
    
    // Check the database for an existing recipe with the same name (case-insensitive)
    this.recipeService.getRecipes().subscribe(
      (recipes: any[]) => {
        const matchingRecipe = recipes.find(recipe => 
          recipe.title.toLowerCase() === item.name.toLowerCase()
        );
        if (matchingRecipe) {
          // If a matching recipe is found, use it instead of creating a new one.
          console.log('[PANTRY] Recipe already exists for item:', matchingRecipe);
          const createdRecipe = { ...matchingRecipe, isExpanded: false };
          this.selectedRecipesList.push(createdRecipe);
          sessionStorage.setItem('selectedRecipes', JSON.stringify(this.selectedRecipesList));
          this.router.navigate(['/tabs/calendar'], { state: { recipes: this.selectedRecipesList } });
        } else {
          // If no matching recipe is found, create a new recipe as usual.
          const newRecipe = {
            title: item.name,
            author: this.username || 'Unknown',
            ingredients: ingredientLine,
            instructions: 'eat and enjoy',
            tag: 'snacks',
            pantry: true
          };
          console.log('[PANTRY] Adding new recipe from pantry item:', newRecipe);
          
          this.recipeService.addRecipe(newRecipe).subscribe(
            (response: any) => {
              console.log('[PANTRY] Successfully added recipe from pantry item.', response);
              const createdRecipe = { ...newRecipe, id: response.id || undefined, isExpanded: false };
              this.selectedRecipesList.push(createdRecipe);
              sessionStorage.setItem('selectedRecipes', JSON.stringify(this.selectedRecipesList));
              this.router.navigate(['/tabs/calendar'], { state: { recipes: this.selectedRecipesList } });
            },
            (error) => {
              console.error('[PANTRY] Failed to add recipe:', error);
            }
          );
        }
      },
      (error) => {
        console.error('[PANTRY] Error fetching recipes for duplicate check:', error);
      }
    );
  }
  


  /**
   * Opens a prompt to add a pantry item.
   * Users will fill out:
   *  - Name  (e.g. "Flour")
   *  - Measurement (text, e.g. "oz")
   *  - Unit (number, e.g. 14)
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
          handler: async (data) => {
            if (data.itemName) {
              // Parse the numeric unit if provided
              const unitVal = data.unit ? parseInt(data.unit, 10) : 0;
              // measurement remains a string (can be blank, e.g. "")
              await this.addPantryItem(data.itemName, data.measurement, unitVal);
            } else {
              console.warn(`[PANTRY] WARNING - Item name is required.`);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async incrementPantryItem(index: number) {
    const item = this.pantryItems?.[index];
    if (!item) return;
  
    const currentUnit = item.unit ?? 0;
    item.unit = currentUnit + 1;
  
    console.log(`[PANTRY] Incremented "${item.name}" to ${item.unit}`);
    await this.updatePantry();
  }
  
  async decrementPantryItem(index: number) {
    const item = this.pantryItems?.[index];
    if (!item) return;
  
    const currentUnit = item.unit ?? 0;
    if (currentUnit > 0) {
      item.unit = currentUnit - 1;
      console.log(`[PANTRY] Decremented "${item.name}" to ${item.unit}`);
      await this.updatePantry();
    }
  }
  
  
  
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
    await this.pantryService.updatePantry(payload).toPromise();
    console.log(`[PANTRY] SUCCESS - Pantry updated for user ID=${this.userId}`);
  }
  

  /**
   * Creates and stores a new pantry item.
   *  - name: e.g. "Flour", "Onions"
   *  - measurement: e.g. "oz", or ""
   *  - unit: e.g. 14 or 2
   */
  async addPantryItem(name: string, measurement: string, unit: number) {
    console.log(`[PANTRY] addPantryItem called with Name="${name}", Measurement="${measurement}", Unit=${unit}`);
    if (this.userId === -1) {
      console.error(`[PANTRY] ERROR - User not loaded. Cannot add item.`);
      return;
    }

    const newItem: PantryItem = { name };
    if (measurement && measurement.trim() !== '') {
      newItem.measurement = measurement.trim();
    }
    if (unit && unit > 0) {
      newItem.unit = unit;
    }

    this.pantryItems.push(newItem);
    console.log(`[PANTRY] Adding pantry item:`, newItem);

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

    await this.pantryService.updatePantry(payload).toPromise();
    console.log(`[PANTRY] SUCCESS - Pantry updated for user ID=${this.userId}`);
  }

  /**
   * Opens a prompt to add a freezer item.
   * (Unchanged functionality)
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
   * (Unchanged)
   */
  async addFreezerItem(name: string, quantity: number) {
    console.log(`[FREEZER] addFreezerItem called with Name="${name}", Portions=${quantity}`);
    if (this.userId === -1) {
      console.error(`[FREEZER] ERROR - User not loaded. Cannot add item.`);
      return;
    }

    this.freezerItems.push({ name, quantity });
    console.log(`[FREEZER] Added item: Name="${name}", Portions=${quantity}`);

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

    await this.pantryService.updatePantry(payload).toPromise();
    console.log(`[FREEZER] SUCCESS - Freezer updated for user ID=${this.userId}`);
  }

  /**
   * Increment portion count for a freezer item.
   * (Unchanged)
   */
  async incrementFreezerItem(index: number) {
    if (index < 0 || index >= this.freezerItems.length) return;
    this.freezerItems[index].quantity++;
    console.log(`[FREEZER] Incremented to ${this.freezerItems[index].quantity}`);
    await this.updateFreezer();
  }

  /**
   * Decrement portion count for a freezer item (if above 0).
   * (Unchanged)
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
   * Update the freezer data by sending an updated payload.
   * (Unchanged)
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
   * (Unchanged)
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
   * (Unchanged)
   */
  async addSpiceItem(name: string, quantity: number) {
    console.log(`[SPICE] addSpiceItem called with Name="${name}"`);
    if (this.userId === -1) {
      console.error(`[SPICE] ERROR - User not loaded. Cannot add item.`);
      return;
    }

    this.spiceItems.push({ name, quantity });
    console.log(`[SPICE] Added spice: Name="${name}", Quantity=${quantity}oz`);

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

    await this.pantryService.updatePantry(payload).toPromise();
    console.log(`[SPICE] SUCCESS - Spice rack updated for user ID=${this.userId}`);
  }

  /**
   * Increment portion count for a spice item.
   */
  async incrementSpiceItem(index: number) {
    if (index < 0 || index >= this.spiceItems.length) return;
    this.spiceItems[index].quantity++;
    console.log(`[SPICE] Incremented to ${this.spiceItems[index].quantity}`);
    await this.updateSpice();
  }

  /**
   * Decrement portion count for a spice item (if above 0).
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
   * Update the spice data by sending an updated payload.
   * (Unchanged)
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
   * (Unchanged, references item by index)
   */
  async deletePantryItem(index: number) {
    if (this.userId === -1) {
      console.error(`[PANTRY] ERROR - User not loaded. Cannot delete item.`);
      return;
    }

    const itemToDelete = this.pantryItems[index];

    const alert = await this.alertCtrl.create({
      header: 'Confirm Deletion',
      message: `Are you sure you want to remove "${itemToDelete.name}" from your pantry?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          handler: async () => {
            this.pantryItems.splice(index, 1);
            console.log(`[PANTRY] Removing item: "${itemToDelete.name}"`);

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

            await this.pantryService.updatePantry(payload).toPromise();
            console.log(`[PANTRY] SUCCESS - Item removed for user ID=${this.userId}`);
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Loads pantry (pantryItems, freezerItems, spiceItems) for the user.
   */
  async loadPantryItems() {
    if (this.userId === -1) {
      console.error(`[PANTRY] ERROR - User not loaded. Cannot fetch pantry.`);
      return;
    }

    console.log(`[PANTRY] Fetching pantry for user ID=${this.userId}...`);
    this.pantryService.loadPantry(this.userId).subscribe(
      (data) => {
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
   * Toggles pantry edit mode.
   */
  toggleEditMode() {
    this.editMode = !this.editMode;
    console.log(`[PANTRY] Edit Mode: ${this.editMode ? 'ON' : 'OFF'}`);
  }

  /**
   * Toggles freezer edit mode.
   */
  toggleFreezerEditMode() {
    this.freezerEditMode = !this.freezerEditMode;
    console.log(`[FREEZER] Edit Mode: ${this.freezerEditMode ? 'ON' : 'OFF'}`);
  }

  /**
   * Toggles spice rack edit mode.
   */
  toggleSpiceEditMode() {
    this.spiceEditMode = !this.spiceEditMode;
    console.log(`[SPICE] Edit Mode: ${this.spiceEditMode ? 'ON' : 'OFF'}`);
  }

  /**
   * Delete an item from the freezer (unchanged).
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
   * Delete an item from the spice rack (unchanged).
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
