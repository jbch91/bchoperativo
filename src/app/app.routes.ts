import { Routes } from '@angular/router';
import { accessGuard } from './auth/auth.guard';
import { LoginComponent } from './auth/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ClientsComponent } from './pages/clients/clients.component';
import { ClientsCreateComponent } from './pages/clients-create/clients-create.component';
import { ClientsManageComponent } from './pages/clients-manage/clients-manage.component';
import { ReportsComponent } from './pages/reports/reports.component';
import { NotAuthorizedComponent } from './pages/not-authorized/not-authorized.component';
import { UsersComponent } from './pages/users/users.component';
import { AuditComponent } from './pages/audit/audit.component';
import { InventarioComponent } from './pages/inventario/inventario.component';
import { InventarioCreateComponent } from './pages/inventario-create/inventario-create.component';
import { InventarioIngresoComponent } from './pages/inventario-ingreso/inventario-ingreso.component';
import { VentasComponent } from './pages/ventas/ventas.component';
import { VentasHistorialComponent } from './pages/ventas-historial/ventas-historial.component';
import { CajaComponent } from './pages/caja/caja.component';
import { RemisionesComponent } from './pages/remisiones/remisiones.component';
import { RemisionesClientesComponent } from './pages/remisiones-clientes/remisiones-clientes.component';
import { RemisionesHistorialComponent } from './pages/remisiones-historial/remisiones-historial.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginComponent },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [accessGuard]
  },
  {
    path: 'clientes',
    component: ClientsComponent,
    canActivate: [accessGuard],
    data: { permissions: ['clients:manage'], moduleKey: 'clientes' }
  },
  {
    path: 'clientes/nuevo',
    component: ClientsCreateComponent,
    canActivate: [accessGuard],
    data: { permissions: ['clients:create'], moduleKey: 'clientes' }
  },
  {
    path: 'clientes/administrar',
    component: ClientsManageComponent,
    canActivate: [accessGuard],
    data: { permissions: ['clients:manage'], moduleKey: 'clientes' }
  },
  {
    path: 'reportes',
    component: ReportsComponent,
    canActivate: [accessGuard],
    data: { permissions: ['reports:view'], moduleKey: 'reportes' }
  },
  {
    path: 'usuarios',
    component: UsersComponent,
    canActivate: [accessGuard],
    data: { permissions: ['users:manage'], moduleKey: 'usuarios' }
  },
  {
    path: 'auditoria',
    component: AuditComponent,
    canActivate: [accessGuard],
    data: { permissions: ['users:manage'], moduleKey: 'auditoria' }
  },
  {
    path: 'inventario',
    component: InventarioComponent,
    canActivate: [accessGuard],
    data: { permissionsAny: ['inventory:view', 'inventory:manage', 'read:all'], moduleKey: 'inventario' }
  },
  {
    path: 'inventario/producto',
    component: InventarioCreateComponent,
    canActivate: [accessGuard],
    data: { permissionsAny: ['inventory:view', 'inventory:manage', 'read:all'], moduleKey: 'inventario' }
  },
  {
    path: 'inventario/ingreso',
    component: InventarioIngresoComponent,
    canActivate: [accessGuard],
    data: { permissionsAny: ['inventory:view', 'inventory:manage', 'read:all'], moduleKey: 'inventario' }
  },
  {
    path: 'ventas',
    component: VentasComponent,
    canActivate: [accessGuard],
    data: { permissionsAny: ['sales:view', 'inventory:manage', 'read:all'], moduleKey: 'ventas' }
  },
  {
    path: 'ventas/historial',
    component: VentasHistorialComponent,
    canActivate: [accessGuard],
    data: { permissionsAny: ['sales:view', 'inventory:manage', 'read:all'], moduleKey: 'ventas' }
  },
  {
    path: 'caja',
    component: CajaComponent,
    canActivate: [accessGuard],
    data: { permissionsAny: ['cash:view', 'cash:manage', 'read:all'], moduleKey: 'caja' }
  },
  {
    path: 'remisiones',
    component: RemisionesComponent,
    canActivate: [accessGuard],
    data: { permissionsAny: ['remisiones:view', 'remisiones:manage', 'read:all'], moduleKey: 'remisiones' }
  },
  {
    path: 'remisiones/clientes',
    component: RemisionesClientesComponent,
    canActivate: [accessGuard],
    data: { permissionsAny: ['remisiones:view', 'remisiones:manage', 'read:all'], moduleKey: 'remisiones' }
  },
  {
    path: 'remisiones/historial',
    component: RemisionesHistorialComponent,
    canActivate: [accessGuard],
    data: { permissionsAny: ['remisiones:view', 'remisiones:manage', 'read:all'], moduleKey: 'remisiones' }
  },
  { path: 'no-autorizado', component: NotAuthorizedComponent },
  { path: '**', redirectTo: 'login' }
];
