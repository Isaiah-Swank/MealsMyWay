import { Component, OnInit } from '@angular/core';
import { Platform } from '@ionic/angular';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss']
})
export class TabsPage implements OnInit {
  tabPlacement: 'top' | 'bottom' = 'bottom';

  constructor(private platform: Platform) {}

  ngOnInit() {
    console.log('Platform Info:', this.platform.platforms());
  
    if (this.platform.is('mobile') || this.platform.is('mobileweb')) {
      this.tabPlacement = 'bottom';
    } else {
      this.tabPlacement = 'top';
    }
  }
}
