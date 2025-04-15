// Import necessary Angular modules and services.
import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { UserService } from '../services/user.service';
import { environment } from '../../environments/environment';

// Define an interface to represent the expected structure of the backend login response.
interface LoginResponse {
  status: string;
  message: string;
  user?: any; // Optional: the user object returned from the backend.
}

// Component metadata definition.
@Component({
  selector: 'app-login',               // The component's selector to be used in templates.
  templateUrl: './login.page.html',      // URL of the component's template.
  styleUrls: ['./login.page.scss'],      // URL of the component's styles.
})
export class LoginPage {
  // Properties bound to the login form inputs.
  username: string = ''; // Holds the username entered by the user.
  password: string = ''; // Holds the password entered by the user.

  // Inject the HttpClient for making API calls, Router for navigation, and UserService for managing user state.
  constructor(
    private http: HttpClient,
    private router: Router,
    private userService: UserService
  ) {}

  /**
   * onSubmit
   * This method is triggered when the login form is submitted.
   * It performs basic validation, sends a login request to the backend,
   * handles the response (including setting user data in the service and session storage),
   * and navigates to the calendar page if login is successful.
   */
  onSubmit() {
    console.log('Username:', this.username);
    console.log('Password:', this.password);

    // Check if both username and password are provided.
    if (this.username && this.password) {
      // Send a POST request to the backend login endpoint with the user credentials.
      this.http.post<LoginResponse>(`${environment.apiUrl}/login`, {
        username: this.username,
        password: this.password
      }).subscribe(
        (response) => {
          console.log('Backend Response:', response);
          // If the backend response message indicates a successful login...
          if (response.message === 'Login successful.') {
            // Update the UserService with the username.
            this.userService.setUsername(this.username);

            // If a user object is returned from the server...
            if (response.user) {
              // Save the user object in session storage for persistence.
              sessionStorage.setItem('currentUser', JSON.stringify(response.user));
              // Update the user object stored in the UserService.
              this.userService.setUser(response.user);

              // Navigate to the calendar page, passing along the user object via navigation state.
              this.router.navigate(['/tabs/calendar'], {
                state: { user: response.user }
              });
            } else {
              // If no user object was returned, log a warning.
              console.warn('No user object returned from server');
              // Optionally, additional handling for this scenario can be added.
            }
          } else {
            // If the login was not successful, show an alert.
            alert('Invalid credentials');
          }
        },
        (error) => {
          // Log and display an error if the request fails.
          console.error('Login Error:', error);
          alert('An error occurred. Please try again later.');
        }
      );
    } else {
      // Alert the user if either the username or password field is empty.
      alert('Please enter valid credentials.');
    }
  }
}
