import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Entidad, Area } from '../models/entidad.model';

@Injectable({ providedIn: 'root' })
export class EntidadesService {
  private apiEntidades = `${environment.apiUrl}/entidades`;
  private apiAreas = `${environment.apiUrl}/areas`;

  constructor(private http: HttpClient) {}

  // ── Entidades ──────────────────────────────────────────────────────────────

  getAllEntidades(): Observable<Entidad[]> {
    return this.http.get<Entidad[]>(this.apiEntidades);
  }

  createEntidad(data: Partial<Entidad>): Observable<Entidad> {
    return this.http.post<Entidad>(this.apiEntidades, data);
  }

  updateEntidad(id: number, data: Partial<Entidad>): Observable<Entidad> {
    return this.http.put<Entidad>(`${this.apiEntidades}/${id}`, data);
  }

  deleteEntidad(id: number): Observable<any> {
    return this.http.delete(`${this.apiEntidades}/${id}`);
  }

  // ── Áreas ──────────────────────────────────────────────────────────────────

  getAllAreas(entidadId?: number): Observable<Area[]> {
    const params = entidadId
      ? new HttpParams().set('entidadId', String(entidadId))
      : undefined;
    return this.http.get<Area[]>(this.apiAreas, { params });
  }

  createArea(data: { nombre: string; entidadId: number }): Observable<Area> {
    return this.http.post<Area>(this.apiAreas, data);
  }

  updateArea(id: number, data: { nombre?: string; entidadId?: number }): Observable<Area> {
    return this.http.put<Area>(`${this.apiAreas}/${id}`, data);
  }

  deleteArea(id: number): Observable<any> {
    return this.http.delete(`${this.apiAreas}/${id}`);
  }
}
