import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { UserService } from '../services/user.service';

interface LoginResponse {
  status: string;
  message: string;
  user?: any; // <-- We'll assume 'user' is returned from the backend
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
      this.http.post<LoginResponse>('http://localhost:3000/login', {
        username: this.username,
        password: this.password
      }).subscribe(
        (response) => {
          console.log('Backend Response:', response);
          // Handle response and navigate if authentication is successful
          if (response.message === 'Login successful') {
            // Optional: store username in your UserService
            this.userService.setUsername(this.username);

            // If the backend also returns a "user" object:
            //   e.g. response.user = { id: 3, username: 'iswank', ... }
            if (response.user) {
              // Pass the user object to the Calendar page via router state
              this.router.navigate(['/tabs/calendar'], {
                state: { user: response.user }
              });
            } else {
              // If there's no user object in the response, handle accordingly
              console.warn('No user object returned from server');
              // Just navigate or show an error, depending on your needs
              // this.router.navigate(['/tabs/calendar']);
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
