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
  // NEW: Pending invites are now stored as objects with id and senderUsername
  sharedInvites: { id: number, senderUsername: string }[] = [];

  // Flags for toggling details
  showEmail: boolean = false;
  showPassword: boolean = false;
  showPrivacy: boolean = false;
  showSharedPlans: boolean = false; // This now controls the Shared Users panel

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

  // Toggle Shared Users panel and load pending invites.
  toggleSharedPlans() {
    this.showSharedPlans = !this.showSharedPlans;
    if (this.showSharedPlans) {
      const currentUser = this.userService.getUser();
      if (currentUser && currentUser.id) {
        // Retrieve pending invites as an array of sender IDs.
        this.profileService.getPendingInvites(currentUser.id).subscribe((invites: number[]) => {
          if (invites && invites.length > 0) {
            // Convert each sender ID to an object with senderUsername.
            forkJoin(
              invites.map(id => this.userService.getUsernameById(id))
            ).subscribe((usernames: string[]) => {
              this.sharedInvites = invites.map((id, index) => ({
                id: id,
                senderUsername: usernames[index]
              }));
            });
          } else {
            this.sharedInvites = [];
          }
        }, error => {
          console.error('Error fetching pending invites:', error);
        });
      }
    }
  }

  // Accept an invite. Build a payload with senderId and recipientId.
  acceptInvite(invite: { id: number, senderUsername: string }) {
    const currentUser = this.userService.getUser();
    if (!currentUser || !currentUser.id) {
      alert('User not logged in');
      return;
    }
    const payload = {
      senderId: invite.id,
      recipientId: currentUser.id
    };
    this.profileService.acceptSharedInvite(payload).subscribe(response => {
      console.log('Invite accepted', response);
      // Remove the accepted invite from the list.
      this.sharedInvites = this.sharedInvites.filter(i => i.id !== invite.id);
      // Update sender's calendars so that shared users are added.
      this.profileService.updateSenderCalendars(invite.id).subscribe(calResponse => {
        console.log('Calendars updated with shared user:', calResponse);
      }, calError => {
        console.error('Error updating sender calendars:', calError);
      });
    }, error => {
      console.error('Error accepting invite:', error);
    });
  }

  // Decline an invite by removing it from the recipient's invites.
  declineInvite(invite: { id: number, senderUsername: string }) {
    const currentUser = this.userService.getUser();
    if (!currentUser || !currentUser.id) {
      alert('User not logged in');
      return;
    }
    const payload = {
      senderId: invite.id,
      recipientId: currentUser.id
    };
    this.profileService.declineSharedInvite(payload).subscribe(response => {
      console.log('Invite declined', response);
      // Remove the declined invite from the list.
      this.sharedInvites = this.sharedInvites.filter(i => i.id !== invite.id);
      alert('Invite declined');
    }, error => {
      console.error('Error declining invite:', error);
    });
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
    // Reset user in UserService.
    this.userService.setUser({ id: 0, username: '', email: '', privacy: true });
    // Navigate to login page.
    window.location.href = '/login';
  }
  
  updatePassword() {
    const currentUser = this.userService.getUser();
    if (currentUser && currentUser.id) {
      this.profileService.updatePassword(currentUser.id, this.oldPassword, this.newPassword).subscribe(response => {
        console.log('Password updated:', response);
        // Clear inputs and hide panel.
        this.oldPassword = '';
        this.newPassword = '';
        this.showPassword = false;
      });
    }
  }
}
