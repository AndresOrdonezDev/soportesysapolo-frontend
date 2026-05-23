import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { EntidadesService } from '../services/entidades.service';
import { Entidad } from '../models/entidad.model';

declare const bootstrap: any;

@Component({
  selector: 'app-entidades',
  templateUrl: './entidades.component.html',
})
export class EntidadesComponent implements OnInit {
  entidades: Entidad[] = [];
  loading = false;
  error = '';
  successMsg = '';

  // Formulario crear
  createForm!: FormGroup;
  correosCreate: string[] = [];
  nuevoCorreoCreate = '';
  saving = false;

  // Formulario editar
  editingEntidad: Entidad | null = null;
  editForm!: FormGroup;
  correosEdit: string[] = [];
  nuevoCorreoEdit = '';
  savingEdit = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private entidadesService: EntidadesService
  ) {}

  ngOnInit(): void {
    this.createForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      fechaVencimientoSoporte: [''],
    });

    this.editForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      estado: [true],
      fechaVencimientoSoporte: [''],
    });

    this.load();
  }

  load(): void {
    this.loading = true;
    this.entidadesService.getAllEntidades().subscribe({
      next: (data) => { this.entidades = data; this.loading = false; },
      error: () => { this.error = 'Error al cargar entidades'; this.loading = false; },
    });
  }

  // ── Crear ──────────────────────────────────────────────────────────────────

  openCreate(): void {
    this.createForm.reset({ nombre: '', fechaVencimientoSoporte: '' });
    this.correosCreate = [];
    this.nuevoCorreoCreate = '';
    new bootstrap.Modal(document.getElementById('createModal')).show();
  }

  agregarCorreoCreate(): void {
    const email = this.nuevoCorreoCreate.trim().toLowerCase();
    if (!email || !this.esEmailValido(email)) return;
    if (!this.correosCreate.includes(email)) this.correosCreate.push(email);
    this.nuevoCorreoCreate = '';
  }

  quitarCorreoCreate(i: number): void {
    this.correosCreate.splice(i, 1);
  }

  guardarEntidad(): void {
    if (this.createForm.invalid) { this.createForm.markAllAsTouched(); return; }
    this.saving = true;
    const val = this.createForm.value;
    this.entidadesService.createEntidad({
      nombre: val.nombre,
      estado: true,
      correosNotificacion: this.correosCreate,
      fechaVencimientoSoporte: val.fechaVencimientoSoporte || null,
    }).subscribe({
      next: () => {
        this.saving = false;
        bootstrap.Modal.getInstance(document.getElementById('createModal'))?.hide();
        this.load();
        this.showSuccess('Entidad creada correctamente');
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.message || 'Error al crear entidad';
      },
    });
  }

  // ── Editar ─────────────────────────────────────────────────────────────────

  openEdit(e: Entidad): void {
    this.editingEntidad = e;
    this.editForm.patchValue({
      nombre: e.nombre,
      estado: e.estado,
      fechaVencimientoSoporte: e.fechaVencimientoSoporte || '',
    });
    this.correosEdit = [...(e.correosNotificacion ?? [])];
    this.nuevoCorreoEdit = '';
    new bootstrap.Modal(document.getElementById('editModal')).show();
  }

  agregarCorreoEdit(): void {
    const email = this.nuevoCorreoEdit.trim().toLowerCase();
    if (!email || !this.esEmailValido(email)) return;
    if (!this.correosEdit.includes(email)) this.correosEdit.push(email);
    this.nuevoCorreoEdit = '';
  }

  quitarCorreoEdit(i: number): void {
    this.correosEdit.splice(i, 1);
  }

  guardarEdicion(): void {
    if (this.editForm.invalid || !this.editingEntidad) { this.editForm.markAllAsTouched(); return; }
    this.savingEdit = true;
    const val = this.editForm.value;
    this.entidadesService.updateEntidad(this.editingEntidad.id, {
      nombre: val.nombre,
      estado: val.estado,
      correosNotificacion: this.correosEdit,
      fechaVencimientoSoporte: val.fechaVencimientoSoporte || null,
    }).subscribe({
      next: () => {
        this.savingEdit = false;
        bootstrap.Modal.getInstance(document.getElementById('editModal'))?.hide();
        this.load();
        this.showSuccess('Entidad actualizada');
      },
      error: (err) => {
        this.savingEdit = false;
        this.error = err?.error?.message || 'Error al actualizar entidad';
      },
    });
  }

  // ── Eliminar ───────────────────────────────────────────────────────────────

  eliminar(e: Entidad): void {
    if (!confirm(`¿Eliminar la entidad "${e.nombre}"? Esta acción también eliminará todas sus áreas asociadas.`)) return;
    this.entidadesService.deleteEntidad(e.id).subscribe({
      next: () => { this.load(); this.showSuccess('Entidad eliminada'); },
      error: (err) => (this.error = err?.error?.message || 'Error al eliminar'),
    });
  }

  // ── Toggle estado rápido ───────────────────────────────────────────────────

  toggleEstado(e: Entidad): void {
    this.entidadesService.updateEntidad(e.id, { estado: !e.estado }).subscribe({
      next: () => { e.estado = !e.estado; this.showSuccess(`Entidad ${e.estado ? 'activada' : 'desactivada'}`); },
      error: (err) => (this.error = err?.error?.message || 'Error al cambiar estado'),
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  estaVencido(fecha: string | null): boolean {
    if (!fecha) return false;
    return new Date(fecha) < new Date();
  }

  private esEmailValido(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  logout(): void { this.authService.logout(); }

  private showSuccess(msg: string): void {
    this.successMsg = msg;
    setTimeout(() => (this.successMsg = ''), 5000);
  }
}
