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
   * Retrieves pending invites for the user.
   * The endpoint returns the invites column (an array of sender IDs).
   */
  getPendingInvites(userId: number): Observable<number[]> {
    return this.http.get<number[]>(`${this.apiUrl}/user/pending-invites?userId=${userId}`);
  }

  /**
   * Accepts a shared invite.
   * The payload should include senderId and recipientId.
   */
  acceptSharedInvite(payload: { senderId: number; recipientId: number; }): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/user/accept-invite`, payload);
  }

  /**
   * Declines a shared invite.
   * The payload should include senderId and recipientId.
   */
  declineSharedInvite(payload: { senderId: number; recipientId: number; }): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/user/decline-invite`, payload);
  }

  /**
   * Updates all calendars for the sender with the shared users.
   * Adds all user IDs from the sender's shared_users column to each calendar's user_ids.
   */
  updateSenderCalendars(senderId: number): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/calendar/update-shared`, { senderId });
  }

  /**
   * Retrieves shared plans for the user.
   * (Optional method if needed.)
   */
  getSharedPlans(userId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/calendar?user_id=${userId}`);
  }
}
