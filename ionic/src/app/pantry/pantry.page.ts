import { Component, OnInit } from '@angular/core';
import { PantryService, PantryPayload } from '../services/pantry.service';
import { UserService } from '../services/user.service';
import { AlertController } from '@ionic/angular';

@Component({
  selector: 'app-pantry',
  templateUrl: './pantry.page.html',
  styleUrls: ['./pantry.page.scss']
})
export class PantryPage implements OnInit {
  pantryItems: any[] = [];
  freezerItems: any[] = [];
  userId: number = -1;
  editMode: boolean = false;
  freezerEditMode: boolean = false;
  spiceEditMode: boolean = false;

  constructor(
    private pantryService: PantryService,
    private userService: UserService,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    this.loadUser();
    this.pantryService.pantryUpdated$.subscribe(() => {
      this.loadPantryItems();
    });
  }
  
  ionViewWillEnter() {
    console.log('[PANTRY] ionViewWillEnter triggered — refreshing pantry items');
    this.loadPantryItems(); // 👈 Re-fetch the latest pantry and freezer items
  }
  

  /**
   * Loads the current user from the UserService and fetches pantry items.
   */
  loadUser() {
    const user = this.userService.getUser();
    if (user && typeof user.id === 'number') {
      this.userId = user.id;
      console.log(`[PANTRY] User loaded: ID=${this.userId}, Username="${user.username}"`);
      this.loadPantryItems();
    } else {
      console.warn(`[PANTRY] WARNING - No valid user found. Pantry cannot be loaded.`);
      this.userId = -1;  // Reset to default when no valid user is found.
    }
  }

  /**
   * Opens a prompt to add a pantry item.
   */
  async openAddItemPrompt() {
    const alert = await this.alertCtrl.create({
      header: 'Add Pantry Item',
      inputs: [
        { name: 'itemName', type: 'text', placeholder: 'Item Name' },
        { name: 'quantity', type: 'number', placeholder: 'Quantity (oz)' }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add Item',
          handler: async (data) => {
            if (data.itemName && data.quantity) {
              await this.addPantryItem(data.itemName, parseInt(data.quantity));
            } else {
              console.warn(`[PANTRY] WARNING - Invalid item entry. Name and quantity required.`);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  /**
   * Adds a new item to the pantry.
   */
  async addPantryItem(name: string, quantity: number) {
    console.log(`[PANTRY] addPantryItem called with Name="${name}", Quantity=${quantity}`);
    if (this.userId === -1) {
      console.error(`[PANTRY] ERROR - User not loaded. Cannot add item.`);
      return;
    }

    // Add the item locally
    this.pantryItems.push({ name, quantity });
    console.log(`[PANTRY] Adding pantry item: User ID=${this.userId}, Name="${name}", Quantity=${quantity}oz`);

    const payload: PantryPayload = {
      user_id: this.userId,
      pf_flag: false, // false indicates a pantry record
      item_list: { pantry: this.pantryItems, freezer: this.freezerItems }
    };

    console.log(`[PANTRY] Payload sent to database:`, JSON.stringify(payload, null, 2));

    await this.pantryService.updatePantry(payload).toPromise();
    console.log(`[PANTRY] SUCCESS - Pantry updated for user ID=${this.userId}`);
  }

  /**
   * Opens a prompt to add a freezer item.
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
              console.warn(`[FREEZER] WARNING - Invalid item entry. Name and portions required.`);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  /**
   * Adds a new item to the freezer.
   */
  async addFreezerItem(name: string, quantity: number) {
    console.log(`[FREEZER] addFreezerItem called with Name="${name}", Portions=${quantity}`);
    if (this.userId === -1) {
      console.error(`[FREEZER] ERROR - User not loaded. Cannot add item.`);
      return;
    }

    // Add the item locally
    this.freezerItems.push({ name, quantity });
    console.log(`[FREEZER] Adding item: User ID=${this.userId}, Name="${name}", Portions=${quantity}`);

    const payload: PantryPayload = {
      user_id: this.userId,
      pf_flag: false, // still using false for the record
      item_list: { pantry: this.pantryItems, freezer: this.freezerItems }
    };

    console.log(`[FREEZER] Payload sent to database:`, JSON.stringify(payload, null, 2));

    await this.pantryService.updatePantry(payload).toPromise();
    console.log(`[FREEZER] SUCCESS - Freezer updated for user ID=${this.userId}`);
  }

  /**
   * Increments the portion count for a freezer item.
   */
  async incrementFreezerItem(index: number) {
    if (index < 0 || index >= this.freezerItems.length) return;
    this.freezerItems[index].quantity++;
    console.log(`[FREEZER] Incremented item "${this.freezerItems[index].name}" to ${this.freezerItems[index].quantity} Portion(s)`);
    await this.updateFreezer();
  }

  /**
   * Decrements the portion count for a freezer item (if above 0).
   */
  async decrementFreezerItem(index: number) {
    if (index < 0 || index >= this.freezerItems.length) return;
    if (this.freezerItems[index].quantity > 0) {
      this.freezerItems[index].quantity--;
      console.log(`[FREEZER] Decremented item "${this.freezerItems[index].name}" to ${this.freezerItems[index].quantity} Portion(s)`);
      await this.updateFreezer();
    }
  }

  /**
   * Updates the freezer data by sending an updated payload.
   */
  async updateFreezer() {
    if (this.userId === -1) {
      console.error(`[FREEZER] ERROR - User not loaded. Cannot update freezer.`);
      return;
    }
    const payload: PantryPayload = {
      user_id: this.userId,
      pf_flag: false,
      item_list: { pantry: this.pantryItems, freezer: this.freezerItems }
    };
    console.log(`[FREEZER] Updating freezer with payload:`, JSON.stringify(payload, null, 2));
    await this.pantryService.updatePantry(payload).toPromise();
    console.log(`[FREEZER] SUCCESS - Freezer updated for user ID=${this.userId}`);
  }

  /**
   * Deletes an item from the pantry.
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
            console.log(`[PANTRY] Removing item: User ID=${this.userId}, Name="${itemToDelete.name}"`);

            const payload: PantryPayload = {
              user_id: this.userId,
              pf_flag: false,
              item_list: { pantry: this.pantryItems, freezer: this.freezerItems }
            };

            console.log(`[PANTRY] Payload sent after deletion:`, JSON.stringify(payload, null, 2));

            await this.pantryService.updatePantry(payload).toPromise();
            console.log(`[PANTRY] SUCCESS - Item removed for user ID=${this.userId}`);
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Loads pantry items (both pantry and freezer) for the current user.
   */
  async loadPantryItems() {
    if (this.userId === -1) {
      console.error(`[PANTRY] ERROR - User not loaded. Cannot fetch pantry.`);
      return;
    }

    console.log(`[PANTRY] Fetching pantry for user ID=${this.userId}...`);
    this.pantryService.loadPantry(this.userId).subscribe(
      (data) => {
        this.pantryItems = data.item_list?.pantry || [];
        this.freezerItems = data.item_list?.freezer || [];
        console.log(`[PANTRY] SUCCESS - Pantry loaded for user ID=${this.userId}.`);
        console.log(`[PANTRY] Current state:`, JSON.stringify({ pantry: this.pantryItems, freezer: this.freezerItems }, null, 2));
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
            console.log(`[FREEZER] Removing item: User ID=${this.userId}, Name="${itemToDelete.name}"`);
            await this.updateFreezer();
            console.log(`[FREEZER] SUCCESS - Item removed for user ID=${this.userId}`);
          }
        }
      ]
    });
    await alert.present();
  }
  
}
