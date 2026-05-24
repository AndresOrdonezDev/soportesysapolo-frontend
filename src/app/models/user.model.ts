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
  telefono?: string;
  activo?: boolean;
  createdAt?: string;
  scope?: ScopeItem[];
}

export interface AuthResponse {
  access_token: string;
  user: User;
}
