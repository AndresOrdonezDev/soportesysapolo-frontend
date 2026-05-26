import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CasoInterno } from '../models/caso-interno.model';
import { User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class CasosInternosService {
  private apiUrl = `${environment.apiUrl}/casos-internos`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<CasoInterno[]> {
    return this.http.get<CasoInterno[]>(this.apiUrl);
  }

  getOne(id: number): Observable<CasoInterno> {
    return this.http.get<CasoInterno>(`${this.apiUrl}/${id}`);
  }

  getEquipo(): Observable<Pick<User, 'id' | 'nombre' | 'role'>[]> {
    return this.http.get<Pick<User, 'id' | 'nombre' | 'role'>[]>(
      `${this.apiUrl}/equipo`,
    );
  }

  create(formData: FormData): Observable<CasoInterno> {
    return this.http.post<CasoInterno>(this.apiUrl, formData);
  }

  addMensaje(casoId: number, formData: FormData): Observable<CasoInterno> {
    return this.http.post<CasoInterno>(
      `${this.apiUrl}/${casoId}/mensajes`,
      formData,
    );
  }

  update(
    id: number,
    data: {
      visibilidad?: string;
      asignadoAIds?: number[];
      estado?: string;
    },
  ): Observable<CasoInterno> {
    return this.http.patch<CasoInterno>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  getAdjuntoBlob(adjuntoId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/adjuntos/${adjuntoId}`, {
      responseType: 'blob',
    });
  }

  downloadAdjunto(adjuntoId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/adjuntos/${adjuntoId}/download`, {
      responseType: 'blob',
    });
  }
}
