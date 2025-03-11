import { Component, OnInit } from '@angular/core';
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
  oldPassword: string = ''; // New field for old password
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
          this.sharedPlans = calendars.filter(calendar => calendar.user_ids.length > 1);
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
