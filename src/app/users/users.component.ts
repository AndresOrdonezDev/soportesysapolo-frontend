import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UsersService, ScopePayloadItem } from '../services/users.service';
import { EntidadesService } from '../services/entidades.service';
import { User } from '../models/user.model';
import { Entidad, Area } from '../models/entidad.model';

declare const bootstrap: any;

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
})
export class UsersComponent implements OnInit {
  users: User[] = [];
  loading = false;
  error = '';
  successMsg = '';

  searchTerm = '';
  pageSize = 10;
  currentPage = 1;

  get filteredUsers(): User[] {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) return this.users;
    return this.users.filter(u => {
      const inName   = u.nombre.toLowerCase().includes(term);
      const inAlias  = u.alias.toLowerCase().includes(term);
      const inPhone  = (u.telefono ?? '').toLowerCase().includes(term);
      const inEntity = u.scope?.some(s => s.entidad?.nombre.toLowerCase().includes(term)) ?? false;
      return inName || inAlias || inPhone || inEntity;
    });
  }

  get totalPages(): number { return Math.max(1, Math.ceil(this.filteredUsers.length / this.pageSize)); }

  get pagedUsers(): User[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredUsers.slice(start, start + this.pageSize);
  }

  get pages(): number[] { return Array.from({ length: this.totalPages }, (_, i) => i + 1); }

  // ── Entidades y áreas disponibles ─────────────────────────────────────────
  entidades: Entidad[] = [];

  // ── Estado scope para modal CREAR ─────────────────────────────────────────
  createForm!: FormGroup;
  saving = false;
  cEntidadId: number | null = null;
  cAreaId: number | null = null;
  cEntidadIds: number[] = [];        // para rol soporte (multi)
  cAreasDisponibles: Area[] = [];
  cLoadingAreas = false;

  // ── Estado scope para modal EDITAR ────────────────────────────────────────
  editingUser: User | null = null;
  editForm!: FormGroup;
  savingEdit = false;
  eEntidadId: number | null = null;
  eAreaId: number | null = null;
  eEntidadIds: number[] = [];        // para rol soporte (multi)
  eAreasDisponibles: Area[] = [];
  eLoadingAreas = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private usersService: UsersService,
    private entidadesService: EntidadesService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.createForm = this.fb.group({
      nombre:   ['', [Validators.required, Validators.minLength(3)]],
      alias:    ['', [Validators.required, Validators.minLength(3)]],
      role:     ['user', Validators.required],
      telefono: [''],
    });

    this.editForm = this.fb.group({
      nombre:   ['', [Validators.required, Validators.minLength(3)]],
      alias:    ['', [Validators.required, Validators.minLength(3)]],
      role:     ['user', Validators.required],
      telefono: [''],
      activo:   [true],
    });

    this.loadUsers();
    this.loadEntidades();
  }

  get currentUser(): User | null { return this.authService.currentUser; }

  // ── Carga de datos ─────────────────────────────────────────────────────────

  loadUsers(): void {
    this.loading = true;
    this.usersService.getAll().subscribe({
      next: (data) => { this.users = data; this.loading = false; },
      error: () => { this.error = 'Error al cargar usuarios'; this.loading = false; },
    });
  }

  loadEntidades(): void {
    this.entidadesService.getAllEntidades().subscribe({
      next: (data) => (this.entidades = data),
      error: () => {},
    });
  }

  // ── Helpers de scope ───────────────────────────────────────────────────────

  getScopeLabel(user: User): string {
    if (!user.scope?.length) return '—';
    if (user.role === 'soporte') {
      return user.scope.map(s => s.entidad?.nombre ?? `#${s.entidadId}`).join(', ');
    }
    const s = user.scope[0];
    const entNombre = s.entidad?.nombre ?? `Entidad #${s.entidadId}`;
    const areaNombre = s.area?.nombre ?? (s.areaId ? `Área #${s.areaId}` : null);
    return areaNombre ? `${entNombre} / ${areaNombre}` : entNombre;
  }

  buildScopePayload(role: string): ScopePayloadItem[] | null {
    if (role === 'admin') return [];
    if (role === 'user') {
      if (!this.cEntidadId) return null;
      return [{ entidadId: this.cEntidadId, areaId: this.cAreaId ?? undefined }];
    }
    if (role === 'soporte') {
      if (!this.cEntidadIds.length) return null;
      return this.cEntidadIds.map(id => ({ entidadId: id }));
    }
    return [];
  }

  buildEditScopePayload(role: string): ScopePayloadItem[] | null {
    if (role === 'admin') return [];
    if (role === 'user') {
      if (!this.eEntidadId) return null;
      return [{ entidadId: this.eEntidadId, areaId: this.eAreaId ?? undefined }];
    }
    if (role === 'soporte') {
      if (!this.eEntidadIds.length) return null;
      return this.eEntidadIds.map(id => ({ entidadId: id }));
    }
    return [];
  }

  // ── Crear: scope callbacks ─────────────────────────────────────────────────

  onCreateRoleChange(): void {
    this.cEntidadId = null;
    this.cAreaId = null;
    this.cEntidadIds = [];
    this.cAreasDisponibles = [];
  }

  onCreateEntidadChange(): void {
    this.cAreaId = null;
    this.cAreasDisponibles = [];
    if (!this.cEntidadId) return;
    this.cLoadingAreas = true;
    this.entidadesService.getAllAreas(this.cEntidadId).subscribe({
      next: (areas) => { this.cAreasDisponibles = areas; this.cLoadingAreas = false; },
      error: () => (this.cLoadingAreas = false),
    });
  }

  toggleCreateSoporte(id: number): void {
    const idx = this.cEntidadIds.indexOf(id);
    if (idx === -1) this.cEntidadIds.push(id);
    else this.cEntidadIds.splice(idx, 1);
  }

  isSoporteChecked(id: number): boolean {
    return this.cEntidadIds.includes(id);
  }

  // ── Editar: scope callbacks ────────────────────────────────────────────────

  onEditRoleChange(): void {
    this.eEntidadId = null;
    this.eAreaId = null;
    this.eEntidadIds = [];
    this.eAreasDisponibles = [];
  }

  onEditEntidadChange(): void {
    this.eAreaId = null;
    this.eAreasDisponibles = [];
    if (!this.eEntidadId) return;
    this.eLoadingAreas = true;
    this.entidadesService.getAllAreas(this.eEntidadId).subscribe({
      next: (areas) => { this.eAreasDisponibles = areas; this.eLoadingAreas = false; },
      error: () => (this.eLoadingAreas = false),
    });
  }

  toggleEditSoporte(id: number): void {
    const idx = this.eEntidadIds.indexOf(id);
    if (idx === -1) this.eEntidadIds.push(id);
    else this.eEntidadIds.splice(idx, 1);
  }

  isEditSoporteChecked(id: number): boolean {
    return this.eEntidadIds.includes(id);
  }

  // ── Modal Crear ────────────────────────────────────────────────────────────

  openCreate(): void {
    this.createForm.reset({ role: 'user', area: 'General' });
    this.cEntidadId = null;
    this.cAreaId = null;
    this.cEntidadIds = [];
    this.cAreasDisponibles = [];
    new bootstrap.Modal(document.getElementById('createModal')).show();
  }

  guardarUsuario(): void {
    if (this.createForm.invalid) { this.createForm.markAllAsTouched(); return; }

    const role = this.createForm.value.role;
    const scopePayload = this.buildScopePayload(role);

    if (scopePayload === null) {
      this.error = role === 'user'
        ? 'Debe seleccionar una entidad y un área para el usuario'
        : 'Debe seleccionar al menos una entidad para el soporte';
      return;
    }

    this.saving = true;
    this.usersService.create(this.createForm.value).subscribe({
      next: (newUser) => {
        if (scopePayload.length > 0) {
          this.usersService.setScope(newUser.id, scopePayload).subscribe({
            next: () => this.afterCreate(),
            error: () => {
              this.saving = false;
              bootstrap.Modal.getInstance(document.getElementById('createModal'))?.hide();
              this.loadUsers();
              this.showSuccess('Usuario creado (contraseña: usuario123). No se pudo asignar el scope — edite el usuario para asignarlo.');
            },
          });
        } else {
          this.afterCreate();
        }
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.message || 'Error al crear usuario';
      },
    });
  }

  private afterCreate(): void {
    this.saving = false;
    bootstrap.Modal.getInstance(document.getElementById('createModal'))?.hide();
    this.loadUsers();
    this.showSuccess('Usuario creado con contraseña predeterminada: usuario123');
  }

  // ── Modal Editar ───────────────────────────────────────────────────────────

  openEdit(user: User): void {
    this.editingUser = user;
    this.editForm.patchValue({
      nombre:   user.nombre,
      alias:    user.alias,
      role:     user.role,
      telefono: user.telefono || '',
      activo:   user.activo,
    });

    // Pre-poblar scope
    this.eEntidadIds = [];
    this.eAreasDisponibles = [];
    this.eEntidadId = null;
    this.eAreaId = null;

    if (user.scope?.length) {
      if (user.role === 'soporte') {
        this.eEntidadIds = user.scope.map(s => s.entidadId);
      } else if (user.role === 'user') {
        this.eEntidadId = user.scope[0]?.entidadId ?? null;
        this.eAreaId = user.scope[0]?.areaId ?? null;
        if (this.eEntidadId) {
          this.eLoadingAreas = true;
          this.entidadesService.getAllAreas(this.eEntidadId).subscribe({
            next: (areas) => { this.eAreasDisponibles = areas; this.eLoadingAreas = false; },
            error: () => (this.eLoadingAreas = false),
          });
        }
      }
    }

    new bootstrap.Modal(document.getElementById('editModal')).show();
  }

  guardarEdicion(): void {
    if (this.editForm.invalid || !this.editingUser) { this.editForm.markAllAsTouched(); return; }

    const role = this.editForm.value.role;
    const scopePayload = this.buildEditScopePayload(role);

    this.savingEdit = true;
    this.usersService.update(this.editingUser.id, this.editForm.value).subscribe({
      next: () => {
        const userId = this.editingUser!.id;
        if (scopePayload !== null) {
          this.usersService.setScope(userId, scopePayload).subscribe({
            next: () => this.afterEdit(),
            error: () => {
              this.savingEdit = false;
              bootstrap.Modal.getInstance(document.getElementById('editModal'))?.hide();
              this.loadUsers();
              this.showSuccess('Usuario actualizado. No se pudo actualizar el scope.');
            },
          });
        } else {
          this.afterEdit();
        }
      },
      error: (err) => {
        this.savingEdit = false;
        this.error = err?.error?.message || 'Error al actualizar usuario';
      },
    });
  }

  private afterEdit(): void {
    this.savingEdit = false;
    bootstrap.Modal.getInstance(document.getElementById('editModal'))?.hide();
    this.loadUsers();
    this.showSuccess('Usuario actualizado');
  }

  // ── Otras acciones ─────────────────────────────────────────────────────────

  resetPassword(user: User): void {
    if (!confirm(`¿Restablecer la contraseña de "${user.nombre}" a "usuario123"?`)) return;
    this.usersService.resetPassword(user.id).subscribe({
      next: () => this.showSuccess(`Contraseña de ${user.nombre} restablecida`),
      error: (err) => (this.error = err?.error?.message || 'Error al restablecer'),
    });
  }

  eliminarUsuario(user: User): void {
    if (user.id === this.currentUser?.id) { this.error = 'No puede eliminar su propio usuario'; return; }
    if (!confirm(`¿Eliminar al usuario "${user.nombre}"?`)) return;
    this.usersService.delete(user.id).subscribe({
      next: () => { this.loadUsers(); this.showSuccess('Usuario eliminado'); },
      error: (err) => (this.error = err?.error?.message || 'Error al eliminar'),
    });
  }

  logout(): void { this.authService.logout(); }

  private showSuccess(msg: string): void {
    this.successMsg = msg;
    setTimeout(() => (this.successMsg = ''), 5000);
  }
}
