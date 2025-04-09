import { Component, Input } from '@angular/core';
import { PopoverController } from '@ionic/angular';

@Component({
  selector: 'app-date-popover',
  templateUrl: './date-popover.component.html',
  styleUrls: ['./date-popover.component.scss']
})
export class DatePopoverComponent {
  @Input() selectedDate!: string;

  constructor(private popoverCtrl: PopoverController) {}

  dismiss(value: string | string[] | undefined) {
    const selected = Array.isArray(value) ? value[0] : value;
    console.log('[DatePopover] Selected value to dismiss:', selected);
    this.popoverCtrl.dismiss({ value: selected });
  }  
}
