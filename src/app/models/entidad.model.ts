export interface Entidad {
  id: number;
  nombre: string;
  estado: boolean;
  correosNotificacion: string[];
  fechaVencimientoSoporte: string | null;
  createdAt: string;
  areas?: Area[];
}

export interface Area {
  id: number;
  nombre: string;
  entidadId: number;
  entidad?: Entidad;
  createdAt: string;
}
