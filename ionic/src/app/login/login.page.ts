import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { UserService } from '../services/user.service';
import { environment } from '../../environments/environment';

interface LoginResponse {
  status: string;
  message: string;
  user?: any; // We'll assume 'user' is returned from the backend
}

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage {
  username: string = '';
  password: string = '';

  constructor(
    private http: HttpClient,
    private router: Router,
    private userService: UserService
  ) {}

  onSubmit() {
    console.log('Username:', this.username);
    console.log('Password:', this.password);

    if (this.username && this.password) {
      // Send the credentials to the backend
      this.http.post<LoginResponse>(`${environment.apiUrl}/login`, {
        username: this.username,
        password: this.password
      }).subscribe(
        (response) => {
          console.log('Backend Response:', response);
          // Handle response and navigate if authentication is successful
          if (response.message === 'Login successful.') {
            // Set the username and user in the UserService
            this.userService.setUsername(this.username);

            if (response.user) {
              // Save user to local storage for persistence across refreshes
              localStorage.setItem('currentUser', JSON.stringify(response.user));
              // Also update the UserService's user object
              this.userService.setUser(response.user);

              // Pass the user object via navigation state as before
              this.router.navigate(['/tabs/calendar'], {
                state: { user: response.user }
              });
            } else {
              console.warn('No user object returned from server');
              // Optionally handle this scenario
            }
          } else {
            alert('Invalid credentials');
          }
        },
        (error) => {
          console.error('Login Error:', error);
          alert('An error occurred. Please try again later.');
        }
      );
    } else {
      alert('Please enter valid credentials.');
    }
  }
}
