import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private apiUrl = environment.apiUrl; // e.g., http://localhost:3000

  constructor(private http: HttpClient) {}

  /**
   * Updates the user's privacy setting.
   */
  updatePrivacy(userId: number, privacy: boolean): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/user/privacy`, { userId, privacy });
  }

  /**
   * Updates the user's password.
   */
  updatePassword(userId: number, oldPassword: string, newPassword: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/user/password`, { userId, oldPassword, newPassword });
  }

  /**
   * Retrieves calendar entries for the user.
   */
  getSharedPlans(userId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/calendar?user_id=${userId}`);
  }
}
