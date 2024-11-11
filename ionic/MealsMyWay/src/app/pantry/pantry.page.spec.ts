import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PantryPage } from './pantry.page';

describe('PantryPage', () => {
  let component: PantryPage;
  let fixture: ComponentFixture<PantryPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PantryPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
