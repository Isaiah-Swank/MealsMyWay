import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';  // Import HttpClient
import { Router } from '@angular/router';  // If you are using routing for navigation
import { UserService } from '../services/user.service';
import { environment } from '../../environments/environment';

interface LoginResponse {
  status: string;
  message: string;
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
    private http: HttpClient,  // Inject HttpClient
    private router: Router,  // Inject Router to navigate after successful login
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
          if (response.message === 'Login successful') {
            this.userService.setUsername(this.username);
            // Navigate to calendar/home if successful
            this.router.navigate(['/tabs/calendar']);
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
