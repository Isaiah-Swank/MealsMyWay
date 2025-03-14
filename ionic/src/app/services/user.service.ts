import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  // Holds the username for the logged in user.
  private username: string = '';
  // Holds the complete user object.
  private user: any = null;

  constructor(private http: HttpClient) {}

  /**
   * Sets the username and fetches the corresponding user object from the backend.
   * Called in login.page.ts on successful login:
   *    this.userService.setUsername(this.username);
   */
  setUsername(username: string): void {
    this.username = username;
    // Fetch the user record using the provided username.
    this.fetchUserByUsername(username).subscribe({
      next: (users: any[]) => {
        if (users && users.length > 0) {
          this.user = users[0];
          console.log('[UserService] Fetched user by username:', this.user);
          // Persist the fetched user in local storage for persistence.
          sessionStorage.setItem('currentUser', JSON.stringify(this.user));
        } else {
          console.error('[UserService] No user found for username:', username);
        }
      },
      error: (err) => {
        console.error('[UserService] Error fetching user by username:', err);
      }
    });
  }

  /**
   * Returns the stored username.
   * Can be used anywhere in the application where the username is needed.
   */
  getUsername(): string {
    return this.username;
  }

  /**
   * Fetches the user record from the backend using the username.
   * This function is called by setUsername().
   */
  fetchUserByUsername(username: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/userbyusername?username=${username}`);
  }

  /**
   * Fetches the user record from the backend using the user ID.
   * This is available for use if you need to fetch by ID.
   */
  fetchUserById(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/user?id=${id}`);
  }

  /**
   * Returns the username for the provided user ID.
   * This method calls the GET /user endpoint and maps the result to return just the username.
   */
  getUsernameById(userId: number): Observable<string> {
    return this.http.get<any[]>(`${environment.apiUrl}/user?id=${userId}`).pipe(
      map(users => (users && users.length > 0 ? users[0].username : ''))
    );
  }

  /**
   * Sets the complete user object in memory and in local storage.
   * Called in login.page.ts after successful login:
   *    this.userService.setUser(response.user);
   */
  setUser(user: any) {
    this.user = user;
    sessionStorage.setItem('currentUser', JSON.stringify(user));
  }

  /**
   * Retrieves the complete user object.
   * It first checks in-memory and, if not available, retrieves from local storage.
   * This function can be used in pages like calendar.page.ts to ensure the user is loaded.
   */
  getUser(): any {
    if (!this.user) {
      const storedUser = sessionStorage.getItem('currentUser');
      if (storedUser) {
        this.user = JSON.parse(storedUser);
      }
    }
    return this.user;
  }

  /**
   * Searches for users based on the provided search query.
   * Returns an observable emitting an array of matching users.
   */
  searchUsers(query: string): Observable<any[]> {
    if (query.trim() === '') {
      return of([]);
    }
    return this.http.get<any[]>(`${environment.apiUrl}/users?username=${query}`);
  }
}
