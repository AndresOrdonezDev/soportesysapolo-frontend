import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { User, ScopeItem } from '../models/user.model';

export interface ScopePayloadItem {
  entidadId: number;
  areaId?: number;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private apiUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl);
  }

  create(data: Partial<User>): Observable<User> {
    return this.http.post<User>(this.apiUrl, data);
  }

  update(id: number, data: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${id}`, data);
  }

  resetPassword(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/reset-password`, {});
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  getScope(userId: number): Observable<ScopeItem[]> {
    return this.http.get<ScopeItem[]>(`${this.apiUrl}/${userId}/scope`);
  }

  setScope(userId: number, scopes: ScopePayloadItem[]): Observable<ScopeItem[]> {
    return this.http.put<ScopeItem[]>(`${this.apiUrl}/${userId}/scope`, { scopes });
  }
}
