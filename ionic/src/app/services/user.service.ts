// user.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private username: string = '';
  private user: any = null;

  constructor(private http: HttpClient) {}

  // Let the login page set the username:
  setUsername(username: string): void {
    this.username = username;

    // As soon as we have a username, fetch the full user record
    // from your new /userbyusername endpoint:
    this.fetchUserByUsername(username).subscribe({
      next: (users: any[]) => {
        if (users && users.length > 0) {
          this.user = users[0]; // The first matching user
          console.log('[UserService] Fetched user by username:', this.user);
        } else {
          console.error('[UserService] No user found for username:', username);
        }
      },
      error: (err) => {
        console.error('[UserService] Error fetching user by username:', err);
      }
    });
  }

  getUsername(): string {
    return this.username;
  }

  // Provide a helper method to fetch user from /userbyusername
  fetchUserByUsername(username: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/userbyusername?username=${username}`);
  }

  // If you need to fetch by ID (your old approach), you still can
  fetchUserById(id: number): Observable<any[]> {
    return this.http.get<any[]>(`/user?id=${id}`);
  }

  setUser(user: any) {
    this.user = user;
  }

  getUser(): any {
    return this.user;
  }
}
