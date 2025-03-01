import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.page.html',
  styleUrls: ['./signup.page.scss'],
})
export class SignupPage {
  username: string = '';
  password: string = '';
  email: string = '';  // Added email field

  constructor(private http: HttpClient, private router: Router) {}

  onSubmit() {
    if (this.username && this.password) {
      // Send sign-up request to backend
      this.http.post(`${environment.apiUrl}/signup`, {
        username: this.username,
        password: this.password,
        email: this.email,  // Include email in the request
      }).subscribe(
        (response: any) => {
          console.log('Backend Response:', response);
          if (response.message === 'User created successfully.') {
            // Redirect to login page after successful sign up
            this.router.navigate(['/login']);
          } else {
            alert(response.message);  // Show error message from backend
          }
        },
        (error) => {
          console.error('Sign-Up Error:', error);
          alert('An error occurred. Please try again later.');
        }
      );
    } else {
      alert('Please enter valid credentials.');
    }
  }
}
