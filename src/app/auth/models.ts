export type Role =
  | 'superuser'
  | 'admin'
  | 'viewer';

export type Permission =
  | 'clients:create'
  | 'clients:manage'
  | 'clients:view'
  | 'inventory:view'
  | 'inventory:create'
  | 'inventory:edit'
  | 'inventory:delete'
  | 'sales:view'
  | 'sales:create'
  | 'sales:edit'
  | 'sales:delete'
  | 'sales:manage'
  | 'cash:view'
  | 'cash:create'
  | 'cash:edit'
  | 'cash:delete'
  | 'remisiones:view'
  | 'remisiones:create'
  | 'remisiones:edit'
  | 'remisiones:delete'
  | 'reports:view'
  | 'users:manage'
  | 'inventory:manage'
  | 'read:all'
  | 'cash:manage'
  | 'remisiones:manage';

export interface User {
  id: string;
  username: string;
  displayName: string;
  clientId?: string | null;
  role: Role;
  permissions: Permission[];
}

export interface LoginResult {
  ok: boolean;
  message?: string;
}
