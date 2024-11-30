import { Component, OnInit } from '@angular/core';
import { UserService } from '../services/user.service';  // Import UserService

@Component({
  selector: 'app-tab3',
  templateUrl: 'profile.page.html',
  styleUrls: ['profile.page.scss']
})
export class Tab3Page implements OnInit {
  username: string = '';  // Variable to store the username

  constructor(private userService: UserService) {}

  ngOnInit() {
    this.username = this.userService.getUsername();  // Retrieve the username from the UserService
  }
}
