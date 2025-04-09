import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Represents a single pantry item with user-input fields:
 * - name: e.g. "Flour" or "Onions"
 * - measurement?: a text label for unit type, e.g. "oz"
 * - unit?: a numeric value, e.g. 14 or 2
 */
export interface PantryItem {
  name: string;
  measurement?: string;  // e.g. "oz" (may be empty)
  unit?: number;         // e.g. 14 (for 14oz), or 2 (for 2 Onions)
}

export interface PantryPayload {
  user_id: number; 
  pf_flag: boolean;  // For pantry records, use false (per server route)
  item_list: {
    // Pantry is strongly typed as PantryItem[]. Freezer & spice remain unchanged.
    pantry: PantryItem[];
    freezer: any[];
    spice: any[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class PantryService {
  private apiUrl = `${environment.apiUrl}/pantry`;

  private pantryUpdatedSource = new BehaviorSubject<void>(undefined);
  pantryUpdated$ = this.pantryUpdatedSource.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Saves (creates) the pantry list.
   * Used for initial creation if no record exists.
   */
  savePantry(payload: PantryPayload): Observable<{ message: string }> {
    console.log(`[PANTRY] Sending POST request to ${this.apiUrl} with payload:`, JSON.stringify(payload, null, 2));
    return this.http.post<{ message: string }>(this.apiUrl, payload);
  }

  /**
   * Notify any subscribers that the pantry data needs reloading.
   */
  triggerPantryReload() {
    this.pantryUpdatedSource.next();
  }

  /**
   * Updates the pantry data for an existing record.
   */
  updatePantry(payload: PantryPayload): Observable<{ message: string }> {
    console.log(`[PANTRY] Sending PUT request to ${this.apiUrl} with payload:`, JSON.stringify(payload, null, 2));
    return this.http.put<{ message: string }>(this.apiUrl, payload);
  }

  /**
   * Loads the pantry data for a specific user.
   * The server GET route expects only the userId (pf_flag = false is internal).
   */
  loadPantry(userId: number): Observable<PantryPayload> {
    return this.http.get<PantryPayload>(`${this.apiUrl}?userId=${userId}`);
  }
}
