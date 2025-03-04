import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * CalendarPayload Interface
 * Defines the shape of the data object used when saving or updating a calendar.
 */
export interface CalendarPayload {
  user_ids: number[];  // List of user IDs sharing the calendar
  week: {
    sunday: any[],
    monday: any[],
    tuesday: any[],
    wednesday: any[],
    thursday: any[],
    friday: any[],
    saturday: any[],
    grocery?: any[]     // Optional property for the grocery list
  };
  start_date: string;  // ISO string date for the week start
}

/**
 * CalendarService
 * Provides methods to save, load, and update calendar data on the server.
 */
@Injectable({
  providedIn: 'root'
})
export class CalendarService {

  constructor(private http: HttpClient) { }

  /**
   * saveCalendar
   * Sends a POST request to save the entire calendar (including the shopping list) to the server.
   * @param payload - The calendar data matching CalendarPayload interface.
   */
  saveCalendar(payload: CalendarPayload): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/calendar`, payload);
  }

  /**
   * loadCalendar
   * Retrieves calendar data for a specific user and start date.
   * @param userId - The ID of the user whose calendar to load.
   * @param startDate - The ISO date string representing the week start.
   */
  loadCalendar(userId: number, startDate: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/calendar?start_date=${startDate}&user_id=${userId}`);
  }

  /**
   * updateCalendar
   * Sends a PUT request to update calendar data on the server.
   * @param payload - The updated calendar data.
   */
  updateCalendar(payload: CalendarPayload): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${environment.apiUrl}/calendar`, payload);
  }

  /**
   * addUserToCalendar
   * Helper method to add a new user to an existing calendar.
   * If the user's ID is not present in the calendar, it is added and the calendar is updated.
   * @param userId - The ID of the user to add.
   * @param calendar - The current calendar data.
   * @param startDate - The week start date as an ISO string.
   */
  addUserToCalendar(userId: number, calendar: any, startDate: string): Observable<{ message: string }> {
    if (!calendar.user_ids) {
      calendar.user_ids = [];
    }
    if (!calendar.user_ids.includes(userId)) {
      calendar.user_ids.push(userId);
    }
    const payload: CalendarPayload = {
      user_ids: calendar.user_ids,
      week: calendar,
      start_date: startDate
    };
    return this.updateCalendar(payload);
  }
}
