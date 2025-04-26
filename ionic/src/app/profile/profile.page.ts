import { Component, OnInit } from '@angular/core';
import { UserService } from '../services/user.service';
import { ProfileService } from '../services/profile.service';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-tab3',
  templateUrl: 'profile.page.html',
  styleUrls: ['profile.page.scss']
})
export class Tab3Page implements OnInit {
  // -------------------- User Profile Properties --------------------
  username: string = '';
  userEmail: string = '';
  privacy: boolean = true;
  oldPassword: string = '';
  newPassword: string = '';

  // -------------------- UI State Flags --------------------
  showEmail: boolean = false;
  showPassword: boolean = false;
  showPrivacy: boolean = false;
  showSharedPlans: boolean = false;
  mySharedPlans: any[] = [];
  sharedWithMe: any[] = [];

  // -------------------- Theme Control --------------------
  currentThemeIndex: number = 0;
  currentThemeLabel: string = 'Light';
  themeList: { value: string; label: string }[] = [
    { value: 'light-theme', label: 'Standard' },
    { value: 'dark-theme', label: 'Dark' },
    { value: 'beach-theme', label: 'Beach' },
    { value: 'onepride-theme', label: 'One Pride' },
    { value: 'lumberjack-theme', label: 'Lumberjack' }

  ];

  // -------------------- Constructor --------------------
  constructor(
    private userService: UserService,
    private profileService: ProfileService,
    private toastController: ToastController
  ) {}

  // -------------------- Lifecycle Hook --------------------
  ngOnInit() {
    const currentUser = this.userService.getUser();
    if (currentUser) {
      this.username = currentUser.username;
      this.userEmail = currentUser.email;
      this.privacy = currentUser.privacy;
    }

    // Restore saved theme
  const savedTheme = sessionStorage.getItem('user-theme');
  if (savedTheme) {
    const index = this.themeList.findIndex(t => t.value === savedTheme);
    if (index !== -1) {
      this.currentThemeIndex = index;
      this.currentThemeLabel = this.themeList[index].label;
      document.body.className = savedTheme;
    }
  }
  }

  

  // -------------------- Theme Methods --------------------

  /**
   * cycleTheme
   * Cycles through available themes.
   */
  cycleTheme() {
    this.currentThemeIndex = (this.currentThemeIndex + 1) % this.themeList.length;
    const nextTheme = this.themeList[this.currentThemeIndex];
    document.body.className = nextTheme.value;
    this.currentThemeLabel = nextTheme.label;
    sessionStorage.setItem('user-theme', nextTheme.value);
    this.presentToast(`Theme changed to ${nextTheme.label}`);
  }

  /**
   * presentToast
   * Simple toast message after changing theme.
   */
  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'top',
      cssClass: 'my-custom-toast'
    });
    await toast.present();
  }

  // -------------------- Toggle UI Sections --------------------
  toggleEmail() { this.showEmail = !this.showEmail; }
  togglePassword() { this.showPassword = !this.showPassword; }
  togglePrivacy() { this.showPrivacy = !this.showPrivacy; }

  // -------------------- Profile Update Methods --------------------
  onPrivacyChange() {
    const currentUser = this.userService.getUser();
    if (currentUser && currentUser.id) {
      this.profileService.updatePrivacy(currentUser.id, this.privacy).subscribe();
    }
  }

  logout() {
    sessionStorage.clear();
    this.userService.setUser({ id: 0, username: '', email: '', privacy: true });
    window.location.href = '/login';
  }

  updatePassword() {
    const currentUser = this.userService.getUser();
    if (currentUser && currentUser.id) {
      this.profileService.updatePassword(currentUser.id, this.oldPassword, this.newPassword).subscribe(response => {
        this.oldPassword = '';
        this.newPassword = '';
        this.showPassword = false;
      });
    }
  }

  // -------------------- Shared Plans Methods --------------------
  toggleSharedPlans() {
    this.showSharedPlans = !this.showSharedPlans;
    if (this.showSharedPlans) {
      this.fetchMySharedPlans();
      this.fetchSharedWithMe();
    }
  }

  fetchMySharedPlans() {
    const currentUser = this.userService.getUser();
    if (currentUser?.shared_plans?.length) {
      this.profileService.getUsersByIds(currentUser.shared_plans).subscribe(users => {
        this.mySharedPlans = users;
      }, error => console.error(error));
    } else {
      this.mySharedPlans = [];
    }
  }

  fetchSharedWithMe() {
    const currentUser = this.userService.getUser();
    if (currentUser?.id) {
      this.profileService.getUsersSharingWithMe(currentUser.id).subscribe(users => {
        this.sharedWithMe = users;
      }, error => console.error(error));
    }
  }
}
