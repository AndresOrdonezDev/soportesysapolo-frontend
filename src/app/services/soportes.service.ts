import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Soporte } from '../models/soporte.model';

@Injectable({ providedIn: 'root' })
export class SoportesService {
  private apiUrl = `${environment.apiUrl}/soportes`;

  constructor(private http: HttpClient) {}

  getAll(params?: { estado?: string; entidadId?: number }): Observable<Soporte[]> {
    let httpParams = new HttpParams();
    if (params?.estado && params.estado !== 'todos') httpParams = httpParams.set('estado', params.estado);
    if (params?.entidadId) httpParams = httpParams.set('entidadId', String(params.entidadId));
    return this.http.get<Soporte[]>(this.apiUrl, { params: httpParams });
  }

  getOne(id: number): Observable<Soporte> {
    return this.http.get<Soporte>(`${this.apiUrl}/${id}`);
  }

  create(formData: FormData): Observable<Soporte> {
    return this.http.post<Soporte>(this.apiUrl, formData);
  }

  addMensaje(soporteId: number, formData: FormData): Observable<Soporte> {
    return this.http.post<Soporte>(`${this.apiUrl}/${soporteId}/mensajes`, formData);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  getAdjuntoBlob(adjuntoId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/adjuntos/${adjuntoId}`, { responseType: 'blob' });
  }

  downloadAdjunto(adjuntoId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/adjuntos/${adjuntoId}/download`, { responseType: 'blob' });
  }

  exportExcel(desde: string, hasta: string, entidades?: number[]): Observable<Blob> {
    let params = new HttpParams().set('desde', desde).set('hasta', hasta);
    if (entidades?.length) params = params.set('entidades', entidades.join(','));
    return this.http.get(`${this.apiUrl}/export/excel`, { params, responseType: 'blob' });
  }
}
