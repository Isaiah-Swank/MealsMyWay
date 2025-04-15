import { Component, OnInit } from '@angular/core';
import { UserService } from '../services/user.service';
import { ProfileService } from '../services/profile.service';

@Component({
  selector: 'app-tab3',
  templateUrl: 'profile.page.html',
  styleUrls: ['profile.page.scss']
})
export class Tab3Page implements OnInit {
  // User profile properties
  username: string = '';
  userEmail: string = '';
  privacy: boolean = true;
  oldPassword: string = '';
  newPassword: string = '';

  // Flags for toggling display of individual sections
  showEmail: boolean = false;
  showPassword: boolean = false;
  showPrivacy: boolean = false;

  // New properties for shared plans functionality:
  // - mySharedPlans: Users that the current user is sharing plans with.
  // - sharedWithMe: Users that have shared their plans with the current user.
  showSharedPlans: boolean = false;
  mySharedPlans: any[] = [];
  sharedWithMe: any[] = [];

  // -------------------- Constructor & Dependency Injection --------------------
  // Inject UserService to obtain user data and ProfileService for updating profile details.
  constructor(
    private userService: UserService,
    private profileService: ProfileService
  ) {}

  // -------------------- Lifecycle Hook --------------------
  ngOnInit() {
    // Retrieve the current user's data from the user service
    const currentUser = this.userService.getUser();
    if (currentUser) {
      this.username = currentUser.username;
      this.userEmail = currentUser.email;
      this.privacy = currentUser.privacy;
      // Note: The currentUser object is expected to include a shared_plans field (an array of user IDs)
    }
  }

  // -------------------- Toggle Methods for UI Sections --------------------

  // Toggle display of the user's email details.
  toggleEmail() {
    this.showEmail = !this.showEmail;
  }

  // Toggle display of the password update form.
  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  // Toggle display of the privacy setting details.
  togglePrivacy() {
    this.showPrivacy = !this.showPrivacy;
  }

  // -------------------- Profile Update Methods --------------------

  // Called when the privacy toggle is changed to update the user's privacy setting on the backend.
  onPrivacyChange() {
    const currentUser = this.userService.getUser();
    if (currentUser && currentUser.id) {
      // Call the profile service to update the privacy flag for the user
      this.profileService.updatePrivacy(currentUser.id, this.privacy).subscribe(response => {
        console.log('Privacy updated:', response);
      });
    }
  }

  // Logs out the user by clearing session storage and resetting user data, then redirects to login.
  logout() {
    sessionStorage.clear();
    this.userService.setUser({ id: 0, username: '', email: '', privacy: true });
    window.location.href = '/login';
  }

  // Called when the user updates the password.
  // Sends the old and new passwords to the backend and resets the form on success.
  updatePassword() {
    const currentUser = this.userService.getUser();
    if (currentUser && currentUser.id) {
      this.profileService.updatePassword(currentUser.id, this.oldPassword, this.newPassword).subscribe(response => {
        console.log('Password updated:', response);
        // Clear the password fields and hide the password form on success.
        this.oldPassword = '';
        this.newPassword = '';
        this.showPassword = false;
      });
    }
  }

  // -------------------- Shared Plans Methods --------------------

  // Toggles the display of the shared plans section.
  // When enabled, it fetches the shared plans details.
  toggleSharedPlans() {
    this.showSharedPlans = !this.showSharedPlans;
    if (this.showSharedPlans) {
      this.fetchMySharedPlans();
      this.fetchSharedWithMe();
    }
  }

  // Fetches details of users that the current user is sharing plans with,
  // using the shared_plans array from the current user object.
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

  // Fetches details of users that have included the current user in their shared_plans arrays.
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
