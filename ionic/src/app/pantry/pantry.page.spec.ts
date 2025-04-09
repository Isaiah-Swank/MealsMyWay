import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { PantryPage } from './pantry.page';
import { PantryService, PantryPayload } from '../services/pantry.service';
import { UserService } from '../services/user.service';
import { AlertController, IonicModule } from '@ionic/angular';
import { of, Subject } from 'rxjs';

describe('PantryPage', () => {
  let component: PantryPage;
  let fixture: ComponentFixture<PantryPage>;
  let pantryServiceSpy: jasmine.SpyObj<PantryService>;
  let userServiceSpy: jasmine.SpyObj<UserService>;
  let alertControllerSpy: jasmine.SpyObj<AlertController>;
  let pantryUpdatedSubject: Subject<void>;

  beforeEach(async () => {
    pantryUpdatedSubject = new Subject<void>();
    pantryServiceSpy = jasmine.createSpyObj('PantryService', ['updatePantry', 'loadPantry'], { 
      pantryUpdated$: pantryUpdatedSubject.asObservable() 
    });
    userServiceSpy = jasmine.createSpyObj('UserService', ['getUser']);
    alertControllerSpy = jasmine.createSpyObj('AlertController', ['create']);

    // Return a valid user.
    userServiceSpy.getUser.and.returnValue({ id: 1, username: 'testuser' });
    // Return a valid PantryPayload.
    pantryServiceSpy.loadPantry.and.returnValue(of({
      user_id: 1,
      pf_flag: false,
      item_list: { 
        pantry: [{ name: 'Salt', quantity: 10 }], 
        freezer: [{ name: 'Ice Cream', quantity: 2 }] 
      }
    }));
    pantryServiceSpy.updatePantry.and.returnValue(of({ message: 'Pantry updated' }));

    await TestBed.configureTestingModule({
      declarations: [PantryPage],
      imports: [IonicModule.forRoot()],
      providers: [
        { provide: PantryService, useValue: pantryServiceSpy },
        { provide: UserService, useValue: userServiceSpy },
        { provide: AlertController, useValue: alertControllerSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PantryPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call loadUser on ngOnInit and subscribe to pantry updates', () => {
    spyOn(component, 'loadUser').and.callThrough();
    spyOn(component, 'loadPantryItems').and.callThrough();
    component.ngOnInit();
    expect(component.loadUser).toHaveBeenCalled();

    pantryUpdatedSubject.next();
    expect(component.loadPantryItems).toHaveBeenCalled();
  });

  it('should refresh pantry items on ionViewWillEnter', () => {
    spyOn(component, 'loadPantryItems');
    component.ionViewWillEnter();
    expect(component.loadPantryItems).toHaveBeenCalled();
  });

  it('should load user and pantry items in loadUser when valid user exists', () => {
    spyOn(component, 'loadPantryItems');
    component.loadUser();
    expect(userServiceSpy.getUser).toHaveBeenCalled();
    expect(component.userId).toEqual(1);
    expect(component.loadPantryItems).toHaveBeenCalled();
  });

  it('should warn and not set userId in loadUser when no valid user is found', () => {
    userServiceSpy.getUser.and.returnValue(null);
    spyOn(console, 'warn');
    component.loadUser();
    expect(console.warn).toHaveBeenCalled();
    expect(component.userId).toEqual(-1);
  });

  it('should open add item prompt and call addPantryItem handler when valid data is provided', async () => {
    const fakeAlert = {
      present: jasmine.createSpy('present'),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { 
          text: 'Add Item', 
          handler: (data: any) => {
            return component.addPantryItem(data.itemName, parseInt(data.quantity));
          }
        }
      ]
    };
    alertControllerSpy.create.and.returnValue(Promise.resolve(fakeAlert as any));
    spyOn(component, 'addPantryItem').and.callThrough();

    await component.openAddItemPrompt();
    expect(alertControllerSpy.create).toHaveBeenCalled();
    expect(fakeAlert.present).toHaveBeenCalled();

    // Use non-null assertion operator to indicate handler is defined.
    const addButton = fakeAlert.buttons[1];
    await addButton.handler!({ itemName: 'Sugar', quantity: '5' });
    expect(component.addPantryItem).toHaveBeenCalledWith('Sugar', 5);
  });

  it('should add a pantry item and update the pantry via service', async () => {
    component.userId = 1;
    component.pantryItems = [];
    await component.addPantryItem('Sugar', 5);
    expect(component.pantryItems).toContain(jasmine.objectContaining({ name: 'Sugar', quantity: 5 }));
    expect(pantryServiceSpy.updatePantry).toHaveBeenCalled();
    const payloadArg: PantryPayload = pantryServiceSpy.updatePantry.calls.mostRecent().args[0];
    expect(payloadArg.user_id).toEqual(1);
    expect(payloadArg.item_list.pantry).toEqual(component.pantryItems);
  });

  it('should open add freezer item prompt and call addFreezerItem handler when valid data is provided', async () => {
    const fakeAlert = {
      present: jasmine.createSpy('present'),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { 
          text: 'Add Item', 
          handler: (data: any) => {
            return component.addFreezerItem(data.itemName, parseInt(data.quantity));
          }
        }
      ]
    };
    alertControllerSpy.create.and.returnValue(Promise.resolve(fakeAlert as any));
    spyOn(component, 'addFreezerItem').and.callThrough();

    await component.openAddFreezerItemPrompt();
    expect(alertControllerSpy.create).toHaveBeenCalled();
    expect(fakeAlert.present).toHaveBeenCalled();

    const addButton = fakeAlert.buttons[1];
    await addButton.handler!({ itemName: 'Frozen Peas', quantity: '3' });
    expect(component.addFreezerItem).toHaveBeenCalledWith('Frozen Peas', 3);
  });

  it('should add a freezer item and update the pantry via service', async () => {
    component.userId = 1;
    component.freezerItems = [];
    await component.addFreezerItem('Frozen Peas', 3);
    expect(component.freezerItems).toContain(jasmine.objectContaining({ name: 'Frozen Peas', quantity: 3 }));
    expect(pantryServiceSpy.updatePantry).toHaveBeenCalled();
    const payloadArg: PantryPayload = pantryServiceSpy.updatePantry.calls.mostRecent().args[0];
    expect(payloadArg.item_list.freezer).toEqual(component.freezerItems);
  });

  it('should increment freezer item quantity and update freezer', async () => {
    component.userId = 1;
    component.freezerItems = [{ name: 'Ice Cream', quantity: 2 }];
    spyOn(component, 'updateFreezer').and.callThrough();
    await component.incrementFreezerItem(0);
    expect(component.freezerItems[0].quantity).toBe(3);
    expect(pantryServiceSpy.updatePantry).toHaveBeenCalled();
  });

  it('should decrement freezer item quantity when above 0 and update freezer', async () => {
    component.userId = 1;
    component.freezerItems = [{ name: 'Ice Cream', quantity: 2 }];
    spyOn(component, 'updateFreezer').and.callThrough();
    await component.decrementFreezerItem(0);
    expect(component.freezerItems[0].quantity).toBe(1);
    expect(pantryServiceSpy.updatePantry).toHaveBeenCalled();
  });

  it('should not decrement freezer item quantity below 0', async () => {
    component.userId = 1;
    component.freezerItems = [{ name: 'Ice Cream', quantity: 0 }];
    await component.decrementFreezerItem(0);
    expect(component.freezerItems[0].quantity).toBe(0);
  });

  it('should update freezer by calling updatePantry with correct payload', async () => {
    component.userId = 1;
    component.pantryItems = [{ name: 'Salt', quantity: 10 }];
    component.freezerItems = [{ name: 'Ice Cream', quantity: 2 }];
    await component.updateFreezer();
    expect(pantryServiceSpy.updatePantry).toHaveBeenCalled();
    const payloadArg: PantryPayload = pantryServiceSpy.updatePantry.calls.mostRecent().args[0];
    expect(payloadArg.item_list.freezer).toEqual(component.freezerItems);
    expect(payloadArg.item_list.pantry).toEqual(component.pantryItems);
  });

  it('should delete a pantry item when confirmed via alert', async () => {
    component.userId = 1;
    component.pantryItems = [{ name: 'Salt', quantity: 10 }];
    const fakeAlert = {
      present: jasmine.createSpy('present'),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { 
          text: 'Delete', 
          handler: async () => {
            component.pantryItems.splice(0, 1);
            const payload: PantryPayload = {
              user_id: component.userId,
              pf_flag: false,
              item_list: { pantry: component.pantryItems, freezer: component.freezerItems }
            };
            await pantryServiceSpy.updatePantry(payload).toPromise();
          }
        }
      ]
    };
    alertControllerSpy.create.and.returnValue(Promise.resolve(fakeAlert as any));
    await component.deletePantryItem(0);
    expect(alertControllerSpy.create).toHaveBeenCalled();
    expect(fakeAlert.present).toHaveBeenCalled();
    await fakeAlert.buttons[1].handler!();
    expect(component.pantryItems.length).toBe(0);
    expect(pantryServiceSpy.updatePantry).toHaveBeenCalled();
  });

  it('should load pantry items and freezer items using PantryService', () => {
    component.userId = 1;
    component.loadPantryItems();
    expect(pantryServiceSpy.loadPantry).toHaveBeenCalledWith(1);
    expect(component.pantryItems).toEqual([{ name: 'Salt', quantity: 10 }]);
    expect(component.freezerItems).toEqual([{ name: 'Ice Cream', quantity: 2 }]);
  });

  it('should toggle editMode', () => {
    const initial = component.editMode;
    component.toggleEditMode();
    expect(component.editMode).toBe(!initial);
    component.toggleEditMode();
    expect(component.editMode).toBe(initial);
  });

  it('should toggle freezerEditMode', () => {
    const initial = component.freezerEditMode;
    component.toggleFreezerEditMode();
    expect(component.freezerEditMode).toBe(!initial);
    component.toggleFreezerEditMode();
    expect(component.freezerEditMode).toBe(initial);
  });

  it('should delete a freezer item when confirmed via alert', async () => {
    component.userId = 1;
    component.freezerItems = [{ name: 'Ice Cream', quantity: 2 }];
    const fakeAlert = {
      present: jasmine.createSpy('present'),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { 
          text: 'Delete', 
          handler: async () => {
            component.freezerItems.splice(0, 1);
            await component.updateFreezer();
          }
        }
      ]
    };
    alertControllerSpy.create.and.returnValue(Promise.resolve(fakeAlert as any));
    await component.deleteFreezerItem(0);
    expect(alertControllerSpy.create).toHaveBeenCalled();
    expect(fakeAlert.present).toHaveBeenCalled();
    await fakeAlert.buttons[1].handler!();
    expect(component.freezerItems.length).toBe(0);
    expect(pantryServiceSpy.updatePantry).toHaveBeenCalled();
  });
});
