import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { EntidadesService } from '../services/entidades.service';
import { Entidad, Area } from '../models/entidad.model';

declare const bootstrap: any;

@Component({
  selector: 'app-areas',
  templateUrl: './areas.component.html',
})
export class AreasComponent implements OnInit {
  entidades: Entidad[] = [];
  areas: Area[] = [];
  filtroEntidadId: number | null = null;

  loading = false;
  error = '';
  successMsg = '';

  createForm!: FormGroup;
  saving = false;

  editingArea: Area | null = null;
  editForm!: FormGroup;
  savingEdit = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private entidadesService: EntidadesService
  ) {}

  ngOnInit(): void {
    this.createForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      entidadId: [null, Validators.required],
    });

    this.editForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      entidadId: [null, Validators.required],
    });

    this.loadEntidades();
    this.loadAreas();
  }

  loadEntidades(): void {
    this.entidadesService.getAllEntidades().subscribe({
      next: (data) => (this.entidades = data),
      error: () => (this.error = 'Error al cargar entidades'),
    });
  }

  loadAreas(): void {
    this.loading = true;
    this.entidadesService.getAllAreas(this.filtroEntidadId ?? undefined).subscribe({
      next: (data) => { this.areas = data; this.loading = false; },
      error: () => { this.error = 'Error al cargar áreas'; this.loading = false; },
    });
  }

  onFiltroChange(): void {
    this.loadAreas();
  }

  get areasFiltradas(): Area[] {
    return this.areas;
  }

  // ── Crear ──────────────────────────────────────────────────────────────────

  openCreate(): void {
    this.createForm.reset({ nombre: '', entidadId: this.filtroEntidadId });
    new bootstrap.Modal(document.getElementById('createModal')).show();
  }

  guardarArea(): void {
    if (this.createForm.invalid) { this.createForm.markAllAsTouched(); return; }
    this.saving = true;
    const val = this.createForm.value;
    this.entidadesService.createArea({
      nombre: val.nombre,
      entidadId: Number(val.entidadId),
    }).subscribe({
      next: () => {
        this.saving = false;
        bootstrap.Modal.getInstance(document.getElementById('createModal'))?.hide();
        this.loadAreas();
        this.showSuccess('Área creada correctamente');
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.message || 'Error al crear área';
      },
    });
  }

  // ── Editar ─────────────────────────────────────────────────────────────────

  openEdit(a: Area): void {
    this.editingArea = a;
    this.editForm.patchValue({
      nombre: a.nombre,
      entidadId: a.entidadId,
    });
    new bootstrap.Modal(document.getElementById('editModal')).show();
  }

  guardarEdicion(): void {
    if (this.editForm.invalid || !this.editingArea) { this.editForm.markAllAsTouched(); return; }
    this.savingEdit = true;
    const val = this.editForm.value;
    this.entidadesService.updateArea(this.editingArea.id, {
      nombre: val.nombre,
      entidadId: Number(val.entidadId),
    }).subscribe({
      next: () => {
        this.savingEdit = false;
        bootstrap.Modal.getInstance(document.getElementById('editModal'))?.hide();
        this.loadAreas();
        this.showSuccess('Área actualizada');
      },
      error: (err) => {
        this.savingEdit = false;
        this.error = err?.error?.message || 'Error al actualizar área';
      },
    });
  }

  // ── Eliminar ───────────────────────────────────────────────────────────────

  eliminar(a: Area): void {
    if (!confirm(`¿Eliminar el área "${a.nombre}"?`)) return;
    this.entidadesService.deleteArea(a.id).subscribe({
      next: () => { this.loadAreas(); this.showSuccess('Área eliminada'); },
      error: (err) => (this.error = err?.error?.message || 'Error al eliminar'),
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  getNombreEntidad(id: number): string {
    return this.entidades.find((e) => e.id === id)?.nombre ?? '—';
  }

  logout(): void { this.authService.logout(); }

  private showSuccess(msg: string): void {
    this.successMsg = msg;
    setTimeout(() => (this.successMsg = ''), 5000);
  }
}
