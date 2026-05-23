export type UserArea =
  | 'Contabilidad'
  | 'Presupuesto'
  | 'Despacho'
  | 'Tesorería'
  | 'Rentas'
  | 'Pensiones'
  | 'General'
  | 'Otra';

export const USER_AREAS: UserArea[] = [
  'Contabilidad',
  'Presupuesto',
  'Despacho',
  'Tesorería',
  'Rentas',
  'Pensiones',
  'General',
  'Otra',
];

export interface ScopeItem {
  id: number;
  usuarioId: number;
  entidadId: number;
  areaId: number | null;
  entidad?: { id: number; nombre: string; estado: boolean };
  area?: { id: number; nombre: string } | null;
}

export interface User {
  id: number;
  nombre: string;
  alias: string;
  role: 'admin' | 'soporte' | 'user';
  area?: UserArea;
  telefono?: string;
  activo?: boolean;
  createdAt?: string;
  scope?: ScopeItem[];
}

export interface AuthResponse {
  access_token: string;
  user: User;
}
