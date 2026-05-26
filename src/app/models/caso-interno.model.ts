import { User } from './user.model';

export interface CasoInternoAdjunto {
  id: number;
  mensajeId: number;
  nombre: string;
  tipo: 'image' | 'pdf' | 'word' | 'otro';
  mimeType: string;
  tamanio: number;
}

export interface CasoInternoMensaje {
  id: number;
  casoId: number;
  usuarioId: number;
  usuario: User;
  texto: string;
  fechaCreacion: string;
  adjuntos: CasoInternoAdjunto[];
}

export interface CasoInterno {
  id: number;
  titulo: string;
  estado: 'abierto' | 'cerrado';
  fechaCreacion: string;
  creadoPorId: number;
  creadoPor: User;
  visibilidad: 'todos' | 'individual';
  asignadoA: User[];
  mensajes: CasoInternoMensaje[];
}
