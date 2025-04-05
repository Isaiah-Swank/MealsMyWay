import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { BehaviorSubject } from 'rxjs';


export interface PantryPayload {
  user_id: number; 
  pf_flag: boolean;  // For pantry records, use false (per server route)
  item_list: {
    pantry: any[];
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
   * This can be used for the initial creation if no record exists.
   */
  savePantry(payload: PantryPayload): Observable<{ message: string }> {
    console.log(`[PANTRY] Sending POST request to ${this.apiUrl} with payload:`, JSON.stringify(payload, null, 2));
    return this.http.post<{ message: string }>(this.apiUrl, payload);
  }

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
   * Note: The server GET route expects only the userId (and uses pf_flag = false internally).
   */
  loadPantry(userId: number): Observable<PantryPayload> {
    return this.http.get<PantryPayload>(`${this.apiUrl}?userId=${userId}`);
  }
}
