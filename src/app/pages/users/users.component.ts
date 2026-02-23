import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../admin/admin.service';
import { Role } from '../../auth/models';

interface ModuleView {
  key: string;
  name: string;
  enabled: boolean;
}

interface UserView {
  id: string;
  username: string;
  displayName: string;
  email: string;
  isActive: boolean;
  roles: Role[];
  clientName?: string | null;
  clientId?: string | null;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent implements OnInit {
  roles: Role[] = [];
  roleIds = new Map<Role, number>();
  permissions: string[] = [];
  rolePermissions: Record<number, string[]> = {};
  modules: ModuleView[] = [];
  userModules: Record<string, ModuleView[]> = {};
  openModulesUserId: string | null = null;
  users: UserView[] = [];
  loading = false;
  errorMessage = '';
  successMessage = '';
  clients: { id: string; name: string }[] = [];
  searchTerm = '';
  openClientId: string | null = null;
  editingUserId: string | null = null;
  editUser = { displayName: '', email: '', clientId: '' };
  rolesOpen = false;
  username = '';
  displayName = '';
  email = '';
  password = '';
  role: Role = 'viewer';
  clientId = '';
  permissionLabels: Record<string, string> = {
    'inventory:view': 'Inventario - Ver',
    'inventory:create': 'Inventario - Crear',
    'inventory:edit': 'Inventario - Editar',
    'inventory:delete': 'Inventario - Eliminar',
    'sales:view': 'Ventas - Ver',
    'sales:create': 'Ventas - Crear',
    'sales:edit': 'Ventas - Editar',
    'sales:delete': 'Ventas - Eliminar',
    'cash:view': 'Caja - Ver',
    'cash:create': 'Caja - Crear',
    'cash:edit': 'Caja - Editar',
    'cash:delete': 'Caja - Eliminar',
    'remisiones:view': 'Remisiones - Ver',
    'remisiones:create': 'Remisiones - Crear',
    'remisiones:edit': 'Remisiones - Editar',
    'remisiones:delete': 'Remisiones - Eliminar',
    'clients:create': 'Clientes - Crear',
    'clients:manage': 'Clientes - Administrar',
    'clients:view': 'Clientes - Ver',
    'reports:view': 'Reportes - Ver',
    'users:manage': 'Usuarios - Administrar',
    'read:all': 'Lectura total (solo lectura)',
    'inventory:manage': 'Inventario - Admin total',
    'cash:manage': 'Caja - Admin total',
    'remisiones:manage': 'Remisiones - Admin total'
  };

  constructor(
    private readonly admin: AdminService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    await Promise.resolve();
    await this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    try {
      const [roles, users, permissions, modules] = await Promise.all([
        this.admin.listRoles(),
        this.admin.listUsers(),
        this.admin.listPermissions(),
        this.admin.listModules()
      ]);
      this.roles = roles.map((item) => item.name);
      this.roleIds = new Map(roles.map((item) => [item.name, item.id]));
      this.permissions = permissions.map((item) => item.name);
      this.modules = modules.map((item) => ({
        key: item.key,
        name: item.name,
        enabled: true
      }));
      this.users = users.map((user) => ({
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        isActive: user.is_active,
        roles: user.roles,
        clientName: user.client_name ?? null,
        clientId: user.client_id ?? null
      }));
      await this.loadRolePermissions();
      try {
        const clients = await this.admin.listClients();
        this.clients = clients.map((client) => ({ id: client.id, name: client.name }));
        if (!this.clientId) {
          this.clientId = this.clients[0]?.id ?? '';
        }
      } catch {
        this.clients = [];
      }
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudieron cargar los usuarios.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async loadRolePermissions(): Promise<void> {
    const entries = await Promise.all(
      Array.from(this.roleIds.entries()).map(async ([roleName, roleId]) => {
        const permissions = await this.admin.getRolePermissions(roleId);
        return [roleId, permissions] as const;
      })
    );

    this.rolePermissions = Object.fromEntries(entries);
  }

  async onCreateUser(): Promise<void> {
    if (!this.username || !this.displayName || !this.email || !this.password) {
      this.errorMessage = 'Completa todos los campos.';
      return;
    }
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.admin.createUser({
        username: this.username.trim(),
        displayName: this.displayName.trim(),
        email: this.email.trim(),
        password: this.password,
        role: this.role,
        clientId: this.clientId || undefined
      });
      this.username = '';
      this.displayName = '';
      this.email = '';
      this.password = '';
      this.role = this.roles[0] ?? 'viewer';
      this.clientId = this.clients[0]?.id ?? '';
      await this.load();
    } catch (error: any) {
      console.error(error);
      this.errorMessage =
        error?.error?.message ?? 'No se pudo crear el usuario.';
    } finally {
      this.cdr.detectChanges();
    }
  }

  get groupedUsers(): { id: string; name: string; users: UserView[] }[] {
    const term = this.searchTerm.toLowerCase().trim();
    const map = new Map<string, { id: string; name: string; users: UserView[] }>();
    for (const user of this.users) {
      const groupId = user.clientId || 'admin-users';
      const groupName = user.clientId ? (user.clientName ?? 'Sin cliente') : 'Usuarios admin';
      if (!map.has(groupId)) {
        map.set(groupId, { id: groupId, name: groupName, users: [] });
      }
      const hay = `${user.displayName} ${user.username} ${user.email}`.toLowerCase();
      if (!term || hay.includes(term)) {
        map.get(groupId)!.users.push(user);
      }
    }
    return Array.from(map.values()).filter((g) => g.users.length);
  }

  toggleClientOpen(clientId: string): void {
    this.openClientId = this.openClientId === clientId ? null : clientId;
  }

  async toggleUserModules(user: UserView): Promise<void> {
    if (!user.clientId) {
      this.openModulesUserId = null;
      return;
    }
    const target = this.openModulesUserId === user.id ? null : user.id;
    this.openModulesUserId = target;
    if (target && !this.userModules[user.id]) {
      try {
        const modules = await this.admin.listUserModules(user.id);
        this.userModules[user.id] = modules.map((m) => ({
          key: m.key,
          name: m.name,
          enabled: Boolean(m.enabled)
        }));
      } catch (error) {
        console.error(error);
        this.errorMessage = 'No se pudieron cargar los módulos del usuario.';
      } finally {
        this.cdr.detectChanges();
      }
    }
  }

  toggleUserModule(userId: string, moduleKey: string): void {
    if (!this.userModules[userId]) {
      this.userModules[userId] = this.modules.map((m) => ({ ...m }));
    }
    const list = this.userModules[userId];
    if (!list) return;
    const item = list.find((m) => m.key === moduleKey);
    if (item) {
      item.enabled = !item.enabled;
    }
  }

  async saveUserModules(userId: string): Promise<void> {
    const list = this.userModules[userId] ?? [];
    const enabledKeys = list.filter((m) => m.enabled).map((m) => m.key);
    try {
      await this.admin.updateUserModules(userId, enabledKeys);
      this.successMessage = 'Módulos actualizados.';
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudieron guardar los módulos.';
    } finally {
      this.cdr.detectChanges();
    }
  }

  trackByGroup(_index: number, group: { id: string }): string {
    return group.id;
  }

  trackByUser(_index: number, user: UserView): string {
    return user.id;
  }

  startEditUser(user: UserView): void {
    this.editingUserId = user.id;
    this.editUser = {
      displayName: user.displayName,
      email: user.email,
      clientId: user.clientId ?? ''
    };
  }

  cancelEditUser(): void {
    this.editingUserId = null;
  }

  async saveUser(user: UserView): Promise<void> {
    await this.admin.updateUserProfile(user.id, {
      displayName: this.editUser.displayName.trim(),
      email: this.editUser.email.trim(),
      clientId: this.editUser.clientId || null
    });
    this.editingUserId = null;
    await this.load();
  }

  async removeUser(user: UserView): Promise<void> {
    if (!confirm('¿Eliminar usuario?')) return;
    await this.admin.deleteUser(user.id);
    await this.load();
  }


  async onToggleActive(user: UserView): Promise<void> {
    try {
      await this.admin.updateUserActive(user.id, !user.isActive);
      user.isActive = !user.isActive;
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo actualizar el estado.';
    } finally {
      this.cdr.detectChanges();
    }
  }

  async onChangeRole(user: UserView, role: Role): Promise<void> {
    try {
      await this.admin.updateUserRole(user.id, role);
      user.roles = [role];
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo actualizar el rol.';
    } finally {
      this.cdr.detectChanges();
    }
  }

  async onChangePassword(user: UserView, password: string): Promise<void> {
    if (!password) {
      this.errorMessage = 'Ingresa una contraseña nueva.';
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.admin.updateUserPassword(user.id, password);
      this.successMessage = 'Contraseña actualizada.';
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo actualizar la contraseña.';
    } finally {
      this.cdr.detectChanges();
    }
  }

  togglePermission(roleId: number, permission: string): void {
    const current = new Set(this.rolePermissions[roleId] ?? []);
    if (current.has(permission)) {
      current.delete(permission);
    } else {
      current.add(permission);
    }
    this.rolePermissions[roleId] = Array.from(current);
  }

  async saveRolePermissions(roleId: number): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.admin.updateRolePermissions(roleId, this.rolePermissions[roleId] ?? []);
      this.successMessage = 'Permisos guardados.';
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudieron guardar los permisos.';
    } finally {
      this.cdr.detectChanges();
    }
  }

  permissionLabel(permission: string): string {
    return this.permissionLabels[permission] ?? permission;
  }

  sortedPermissions(): string[] {
    return [...this.permissions].sort((a, b) => this.permissionLabel(a).localeCompare(this.permissionLabel(b)));
  }
}
