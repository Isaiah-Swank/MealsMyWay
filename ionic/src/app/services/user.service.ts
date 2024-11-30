import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private username: string = '';

  constructor() {}

  // Set the username
  setUsername(username: string): void {
    this.username = username;
  }

  // Get the username
  getUsername(): string {
    return this.username;
  }
}
