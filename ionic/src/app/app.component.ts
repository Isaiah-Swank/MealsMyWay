import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  // Optional: you could track current theme and label if needed
  currentThemeIndex: number = 0;
  currentThemeLabel: string = 'Light Theme';

  // List of all themes you support
  themeList = [
    { label: 'Light Theme', value: 'light-theme' },
    { label: 'Dark Theme', value: 'dark-theme' },
    { label: 'Beach Theme', value: 'beach-theme' },
    { label: 'One Pride', value: 'onepride-theme' },
    { label: 'Lumberjack', value: 'lumberjack-theme' },
  ];

  constructor() {
    this.restoreTheme();
  }

  /**
   * Restores the saved theme on app launch
   */
  restoreTheme() {
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
}
