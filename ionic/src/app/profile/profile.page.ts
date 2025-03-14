import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { UserService } from '../services/user.service';
import { ProfileService } from '../services/profile.service';

@Component({
  selector: 'app-tab3',
  templateUrl: 'profile.page.html',
  styleUrls: ['profile.page.scss']
})
export class Tab3Page implements OnInit {
  username: string = '';
  userEmail: string = '';
  privacy: boolean = true;
  oldPassword: string = '';
  newPassword: string = '';
  sharedPlans: any[] = [];

  // Flags for toggling details
  showEmail: boolean = false;
  showPassword: boolean = false;
  showPrivacy: boolean = false;
  showSharedPlans: boolean = false;

  constructor(
    private userService: UserService,
    private profileService: ProfileService
  ) {}

  ngOnInit() {
    // Retrieve user information from local storage or service
    const currentUser = this.userService.getUser();
    if (currentUser) {
      this.username = currentUser.username;
      this.userEmail = currentUser.email;
      this.privacy = currentUser.privacy;
    }
  }

  toggleEmail() {
    this.showEmail = !this.showEmail;
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  togglePrivacy() {
    this.showPrivacy = !this.showPrivacy;
  }

  toggleSharedPlans() {
    this.showSharedPlans = !this.showSharedPlans;
    if (this.showSharedPlans) {
      const currentUser = this.userService.getUser();
      if (currentUser && currentUser.id) {
        this.profileService.getSharedPlans(currentUser.id).subscribe((calendars: any[]) => {
          // Filter for calendars that include the current user and have more than one user in user_ids.
          this.sharedPlans = calendars
            .filter(calendar =>
              calendar.user_ids &&
              calendar.user_ids.length > 1 &&
              calendar.user_ids.includes(currentUser.id)
            )
            .map(calendar => ({
              ...calendar,
              // Initially, sharedWith is the list of IDs (excluding current user's id)
              sharedWith: calendar.user_ids.filter((id: number) => id !== currentUser.id)
            }));

          // For each calendar, convert the sharedWith array from user IDs to usernames
          this.sharedPlans.forEach((calendar, index) => {
            if (calendar.sharedWith.length > 0) {
              forkJoin<string[]>(
                calendar.sharedWith.map((userId: number) => this.userService.getUsernameById(userId))
              ).subscribe((usernames: string[]) => {
                this.sharedPlans[index].sharedWith = usernames;
              });
            }
          });
        });
      }
    }
  }

  onPrivacyChange() {
    const currentUser = this.userService.getUser();
    if (currentUser && currentUser.id) {
      this.profileService.updatePrivacy(currentUser.id, this.privacy).subscribe(response => {
        console.log('Privacy updated:', response);
      });
    }
  }

  logout() {
    // Clear session storage
    sessionStorage.clear();
  
    // Reset user ID in the UserService (or localStorage if needed)
    this.userService.setUser({ id: 0, username: '', email: '', privacy: true });
  
    // Navigate to the login page
    window.location.href = '/login'; // Full reload to ensure session is cleared
  }
  

  updatePassword() {
    const currentUser = this.userService.getUser();
    if (currentUser && currentUser.id) {
      this.profileService.updatePassword(currentUser.id, this.oldPassword, this.newPassword).subscribe(response => {
        console.log('Password updated:', response);
        // Reset input fields and hide the password panel after update
        this.oldPassword = '';
        this.newPassword = '';
        this.showPassword = false;
      });
    }
  }
}
