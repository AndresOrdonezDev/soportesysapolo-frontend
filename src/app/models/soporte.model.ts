import { User } from './user.model';

export interface SoporteAdjunto {
  id: number;
  mensajeId: number;
  nombre: string;
  tipo: 'image' | 'pdf' | 'word' | 'excel' | 'otro';
  mimeType: string;
  tamanio: number;
}

export interface SoporteMensaje {
  id: number;
  soporteId: number;
  usuarioId: number;
  usuario: User;
  texto: string;
  fechaCreacion: string;
  adjuntos: SoporteAdjunto[];
}

export interface Soporte {
  id: number;
  titulo?: string;
  estado: 'pendiente' | 'resuelto';
  fechaSolicitud: string;
  usuarioId: number;
  usuario: User;
  entidadId?: number;
  entidad?: { id: number; nombre: string; estado: boolean };
  mensajes: SoporteMensaje[];
}
