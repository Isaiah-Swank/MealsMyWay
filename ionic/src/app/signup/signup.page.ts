// Import necessary modules from Angular core, HTTP client, and routing.
import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

// Define the component metadata.
// - selector: the tag name used to reference this component in templates.
// - templateUrl: the path to the HTML template for the component.
// - styleUrls: the path(s) to the SCSS stylesheet(s) for the component.
@Component({
  selector: 'app-signup',
  templateUrl: './signup.page.html',
  styleUrls: ['./signup.page.scss'],
})
export class SignupPage {
  // Component properties bound to the signup form input fields.
  username: string = ''; // Stores the entered username.
  password: string = ''; // Stores the entered password.
  email: string = '';    // Stores the entered email address.

  // Inject the HttpClient for API calls and the Router for navigation.
  constructor(private http: HttpClient, private router: Router) {}

  /**
   * onSubmit
   * Triggered when the signup form is submitted.
   * It validates that the required fields (username and password) are provided,
   * sends the sign-up request to the backend including the email field,
   * and handles the backend response.
   */
  onSubmit() {
    // Check that both username and password fields are filled.
    if (this.username && this.password) {
      // Construct the request payload including username, password, and email.
      this.http.post(`${environment.apiUrl}/signup`, {
        username: this.username,
        password: this.password,
        email: this.email, // Include the email field in the signup request.
      }).subscribe(
        // Handle the backend's response.
        (response: any) => {
          console.log('Backend Response:', response);
          // If the response indicates that the user was created successfully...
          if (response.message === 'User created successfully.') {
            // Navigate to the login page.
            this.router.navigate(['/login']);
          } else {
            // Display an error message from the backend.
            alert(response.message);
          }
        },
        // Handle any errors that occur during the HTTP request.
        (error) => {
          console.error('Sign-Up Error:', error);
          alert('An error occurred. Please try again later.');
        }
      );
    } else {
      // If either username or password is missing, alert the user.
      alert('Please enter valid credentials.');
    }
  }
}
