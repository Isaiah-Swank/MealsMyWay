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
   */
  acceptSharedInvite(payload: { senderId: number; recipientId: number; }): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/user/accept-invite`, payload);
  }

  /**
   * Declines a shared invite.
   */
  declineSharedInvite(payload: { senderId: number; recipientId: number; }): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/user/decline-invite`, payload);
  }

  /**
   * Updates all calendars for the sender with the shared users.
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

  /**
   * Retrieves details of users by an array of user IDs.
   * This supports the shared plans feature where we need to show detailed user information.
   */
  getUsersByIds(ids: number[]): Observable<any[]> {
    const idsParam = ids.join(',');
    return this.http.get<any[]>(`${this.apiUrl}/user/multiple?ids=${idsParam}`);
  }

  /**
   * Retrieves users who have added the current user to their shared_plans array.
   * This is used to display "You are sharing someone else's plans" in the UI.
   */
  getUsersSharingWithMe(userId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/user/shared-with?userId=${userId}`);
  }
}
