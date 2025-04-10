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
  oldPassword: string = '';
  newPassword: string = '';

  // Flags for toggling details
  showEmail: boolean = false;
  showPassword: boolean = false;
  showPrivacy: boolean = false;

  // New properties for shared plans functionality
  showSharedPlans: boolean = false;
  mySharedPlans: any[] = [];   // Details of users that the current user is sharing with
  sharedWithMe: any[] = [];    // Details of users that include the current user in their shared_plans

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
      // The currentUser object is also expected to include a shared_plans field (an array of user IDs)
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

  onPrivacyChange() {
    const currentUser = this.userService.getUser();
    if (currentUser && currentUser.id) {
      this.profileService.updatePrivacy(currentUser.id, this.privacy).subscribe(response => {
        console.log('Privacy updated:', response);
      });
    }
  }

  logout() {
    // Clear session storage and reset user data
    sessionStorage.clear();
    this.userService.setUser({ id: 0, username: '', email: '', privacy: true });
    window.location.href = '/login';
  }
  
  updatePassword() {
    const currentUser = this.userService.getUser();
    if (currentUser && currentUser.id) {
      this.profileService.updatePassword(currentUser.id, this.oldPassword, this.newPassword).subscribe(response => {
        console.log('Password updated:', response);
        // Clear password fields and hide password panel.
        this.oldPassword = '';
        this.newPassword = '';
        this.showPassword = false;
      });
    }
  }

  // New method to toggle the shared plans display
  toggleSharedPlans() {
    this.showSharedPlans = !this.showSharedPlans;
    if (this.showSharedPlans) {
      this.fetchMySharedPlans();
      this.fetchSharedWithMe();
    }
  }

  // Fetch details of users that the current user is sharing with using the shared_plans array from the user object.
  fetchMySharedPlans() {
    const currentUser = this.userService.getUser();
    if (currentUser && currentUser.shared_plans && currentUser.shared_plans.length > 0) {
      this.profileService.getUsersByIds(currentUser.shared_plans).subscribe(users => {
        this.mySharedPlans = users;
      }, error => {
        console.error('Error fetching my shared plans:', error);
      });
    } else {
      this.mySharedPlans = [];
    }
  }

  // Fetch details of users that have included the current user in their shared_plans arrays.
  fetchSharedWithMe() {
    const currentUser = this.userService.getUser();
    if (currentUser && currentUser.id) {
      this.profileService.getUsersSharingWithMe(currentUser.id).subscribe(users => {
        this.sharedWithMe = users;
      }, error => {
        console.error('Error fetching shared with me:', error);
      });
    }
  }
}
