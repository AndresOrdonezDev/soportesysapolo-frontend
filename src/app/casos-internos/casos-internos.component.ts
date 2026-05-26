import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { CasosInternosService } from '../services/casos-internos.service';
import { SocketService } from '../services/socket.service';
import { CasoInterno, CasoInternoAdjunto } from '../models/caso-interno.model';
import { User } from '../models/user.model';

declare const bootstrap: any;

@Component({
  selector: 'app-casos-internos',
  templateUrl: './casos-internos.component.html',
})
export class CasosInternosComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;

  casos: CasoInterno[] = [];
  loading = false;
  error = '';
  successMsg = '';

  filtroEstado = 'todos';
  searchTerm = '';

  selectedCasoId: number | null = null;
  selectedCaso: CasoInterno | null = null;
  loadingThread = false;
  imageCache = new Map<number, string>();
  imagenViewer: string | null = null;

  replyText = '';
  replyFiles: File[] = [];
  sendingReply = false;
  replyError = '';

  nuevoForm!: FormGroup;
  nuevaVisibilidad: 'todos' | 'individual' = 'todos';
  nuevoAsignadoAIds: number[] = [];
  nuevoFiles: File[] = [];
  savingNuevo = false;

  reasignarCaso: CasoInterno | null = null;
  reasignarVisibilidad: 'todos' | 'individual' = 'todos';
  reasignarAsignadoAIds: number[] = [];
  savingReasignar = false;

  equipo: Pick<User, 'id' | 'nombre' | 'role'>[] = [];

  cambioClaveForm!: FormGroup;
  savingClave = false;
  claveError = '';
  claveSuccess = '';

  wsToast = '';
  private wsSubs: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private casosService: CasosInternosService,
    private socketService: SocketService,
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.currentUser;

    this.nuevoForm = this.fb.group({
      titulo: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
      texto: ['', [Validators.required, Validators.minLength(5)]],
    });

    this.cambioClaveForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(6)]],
    });

    this.loadCasos();
    this.loadEquipo();
    this.initSocket();
  }

  ngOnDestroy(): void {
    this.wsSubs.forEach(s => s.unsubscribe());
    this.socketService.disconnect();
    this.imageCache.forEach(url => URL.revokeObjectURL(url));
  }

  get isAdmin(): boolean { return this.currentUser?.role === 'admin'; }
  get isSoporte(): boolean { return this.currentUser?.role === 'soporte'; }

  // ── Carga ─────────────────────────────────────────────────────────────────

  loadCasos(): void {
    this.loading = true;
    this.casosService.getAll().subscribe({
      next: (data) => { this.casos = data; this.loading = false; },
      error: () => { this.error = 'Error al cargar los casos'; this.loading = false; },
    });
  }

  loadEquipo(): void {
    this.casosService.getEquipo().subscribe({
      next: (data) => (this.equipo = data),
      error: () => {},
    });
  }

  // ── Filtros ───────────────────────────────────────────────────────────────

  get filteredCasos(): CasoInterno[] {
    let result =
      this.filtroEstado === 'todos'
        ? [...this.casos]
        : this.casos.filter(c => c.estado === this.filtroEstado);

    const term = this.searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter(
        c =>
          c.titulo?.toLowerCase().includes(term) ||
          c.creadoPor?.nombre?.toLowerCase().includes(term) ||
          c.asignadoA?.some(u => u.nombre?.toLowerCase().includes(term)),
      );
    }
    return result;
  }

  get totalCount(): number { return this.casos.length; }
  get abiertoCount(): number { return this.casos.filter(c => c.estado === 'abierto').length; }
  get cerradoCount(): number { return this.casos.filter(c => c.estado === 'cerrado').length; }

  // ── Selección de caso ─────────────────────────────────────────────────────

  selectCaso(c: CasoInterno): void {
    if (this.selectedCasoId === c.id) {
      this.selectedCasoId = null;
      this.selectedCaso = null;
      this.replyText = '';
      this.replyFiles = [];
      this.replyError = '';
      return;
    }
    this.selectedCasoId = c.id;
    this.selectedCaso = null;
    this.loadingThread = true;
    this.replyText = '';
    this.replyFiles = [];
    this.replyError = '';

    this.casosService.getOne(c.id).subscribe({
      next: (full) => {
        this.selectedCaso = full;
        this.loadingThread = false;
        this.loadThreadImages(full);
      },
      error: () => { this.loadingThread = false; },
    });
  }

  private loadThreadImages(c: CasoInterno): void {
    const images = (c.mensajes ?? [])
      .flatMap(m => m.adjuntos ?? [])
      .filter(a => a.tipo === 'image');
    for (const adj of images) {
      if (!this.imageCache.has(adj.id)) {
        this.casosService.getAdjuntoBlob(adj.id).subscribe({
          next: (blob) => this.imageCache.set(adj.id, URL.createObjectURL(blob)),
          error: () => {},
        });
      }
    }
  }

  getImageUrl(adjId: number): string {
    return this.imageCache.get(adjId) ?? '';
  }

  // ── Permisos ──────────────────────────────────────────────────────────────

  canManage(c: CasoInterno): boolean {
    return this.isAdmin || c.creadoPorId === this.currentUser?.id;
  }

  // ── Responder ─────────────────────────────────────────────────────────────

  onReplyFilesChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.replyFiles = [...this.replyFiles, ...Array.from(input.files)];
      input.value = '';
    }
  }

  removeReplyFile(i: number): void { this.replyFiles.splice(i, 1); }

  enviarRespuesta(): void {
    if (!this.replyText.trim() || !this.selectedCasoId) return;
    this.sendingReply = true;
    this.replyError = '';

    const fd = new FormData();
    fd.append('texto', this.replyText.trim());
    this.replyFiles.forEach(f => fd.append('archivos', f));

    this.casosService.addMensaje(this.selectedCasoId, fd).subscribe({
      next: (updated) => {
        this.selectedCaso = updated;
        this.replyText = '';
        this.replyFiles = [];
        this.sendingReply = false;
        this.loadThreadImages(updated);
        const idx = this.casos.findIndex(c => c.id === updated.id);
        if (idx !== -1) this.casos[idx] = updated;
      },
      error: (err) => {
        this.sendingReply = false;
        this.replyError = err?.error?.message || 'Error al enviar';
      },
    });
  }

  // ── Adjuntos ──────────────────────────────────────────────────────────────

  openImageViewer(objectUrl: string): void {
    this.imagenViewer = objectUrl;
    new bootstrap.Modal(document.getElementById('ciImagenViewerModal')).show();
  }

  downloadFile(adj: CasoInternoAdjunto): void {
    this.casosService.downloadAdjunto(adj.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = adj.nombre; a.click();
        URL.revokeObjectURL(url);
      },
      error: () => (this.error = 'Error al descargar el archivo'),
    });
  }

  // ── Eliminar caso ─────────────────────────────────────────────────────────

  eliminarCaso(c: CasoInterno, event: Event): void {
    event.stopPropagation();
    if (!confirm(`¿Eliminar el caso #${c.id}?`)) return;
    this.casosService.delete(c.id).subscribe({
      next: () => {
        this.casos = this.casos.filter(x => x.id !== c.id);
        if (this.selectedCasoId === c.id) {
          this.selectedCasoId = null;
          this.selectedCaso = null;
        }
        this.showSuccess('Caso eliminado');
      },
      error: (err) => (this.error = err?.error?.message || 'Error al eliminar'),
    });
  }

  // ── Nuevo caso ────────────────────────────────────────────────────────────

  openNuevoCaso(): void {
    this.nuevoForm.reset();
    this.nuevoFiles = [];
    this.nuevaVisibilidad = 'todos';
    this.nuevoAsignadoAIds = [];
    new bootstrap.Modal(document.getElementById('nuevoCasoModal')).show();
  }

  isNuevoAsignadoChecked(id: number): boolean {
    return this.nuevoAsignadoAIds.includes(id);
  }

  toggleNuevoAsignado(id: number): void {
    const idx = this.nuevoAsignadoAIds.indexOf(id);
    if (idx === -1) this.nuevoAsignadoAIds.push(id);
    else this.nuevoAsignadoAIds.splice(idx, 1);
  }

  onNuevoFilesChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.nuevoFiles = [...this.nuevoFiles, ...Array.from(input.files)];
      input.value = '';
    }
  }

  removeNuevoFile(i: number): void { this.nuevoFiles.splice(i, 1); }

  guardarNuevoCaso(): void {
    if (this.nuevoForm.invalid) { this.nuevoForm.markAllAsTouched(); return; }
    if (this.nuevaVisibilidad === 'individual' && !this.nuevoAsignadoAIds.length) {
      this.error = 'Selecciona al menos un miembro del equipo para asignar el caso';
      return;
    }

    this.savingNuevo = true;
    const fd = new FormData();
    fd.append('titulo', this.nuevoForm.value.titulo);
    fd.append('texto', this.nuevoForm.value.texto);
    fd.append('visibilidad', this.nuevaVisibilidad);
    if (this.nuevaVisibilidad === 'individual') {
      this.nuevoAsignadoAIds.forEach(id => fd.append('asignadoAIds', String(id)));
    }
    this.nuevoFiles.forEach(f => fd.append('archivos', f));

    this.casosService.create(fd).subscribe({
      next: (nuevo) => {
        this.savingNuevo = false;
        bootstrap.Modal.getInstance(document.getElementById('nuevoCasoModal'))?.hide();
        this.casos = [nuevo, ...this.casos];
        this.showSuccess('Caso creado exitosamente');
      },
      error: (err) => {
        this.savingNuevo = false;
        this.error = err?.error?.message || 'Error al crear caso';
      },
    });
  }

  // ── Reasignar / Cambiar estado ────────────────────────────────────────────

  openReasignar(c: CasoInterno, event: Event): void {
    event.stopPropagation();
    this.reasignarCaso = c;
    this.reasignarVisibilidad = c.visibilidad;
    this.reasignarAsignadoAIds = (c.asignadoA ?? []).map(u => u.id);
    new bootstrap.Modal(document.getElementById('reasignarModal')).show();
  }

  isReasignarChecked(id: number): boolean {
    return this.reasignarAsignadoAIds.includes(id);
  }

  toggleReasignarAsignado(id: number): void {
    const idx = this.reasignarAsignadoAIds.indexOf(id);
    if (idx === -1) this.reasignarAsignadoAIds.push(id);
    else this.reasignarAsignadoAIds.splice(idx, 1);
  }

  guardarReasignar(): void {
    if (!this.reasignarCaso) return;
    if (this.reasignarVisibilidad === 'individual' && !this.reasignarAsignadoAIds.length) {
      this.error = 'Selecciona al menos un miembro del equipo';
      return;
    }

    this.savingReasignar = true;
    const payload: any = { visibilidad: this.reasignarVisibilidad };
    if (this.reasignarVisibilidad === 'individual') {
      payload.asignadoAIds = this.reasignarAsignadoAIds;
    }

    this.casosService.update(this.reasignarCaso.id, payload).subscribe({
      next: (updated) => {
        this.savingReasignar = false;
        const idx = this.casos.findIndex(c => c.id === updated.id);
        if (idx !== -1) this.casos[idx] = updated;
        if (this.selectedCasoId === updated.id) this.selectedCaso = updated;
        bootstrap.Modal.getInstance(document.getElementById('reasignarModal'))?.hide();
        this.showSuccess('Caso actualizado exitosamente');
      },
      error: (err) => {
        this.savingReasignar = false;
        this.error = err?.error?.message || 'Error al actualizar';
      },
    });
  }

  toggleEstadoCaso(c: CasoInterno, event: Event): void {
    event.stopPropagation();
    const nuevoEstado = c.estado === 'abierto' ? 'cerrado' : 'abierto';
    this.casosService.update(c.id, { estado: nuevoEstado }).subscribe({
      next: (updated) => {
        const idx = this.casos.findIndex(x => x.id === updated.id);
        if (idx !== -1) this.casos[idx] = updated;
        if (this.selectedCasoId === updated.id) this.selectedCaso = updated;
        this.showSuccess(nuevoEstado === 'cerrado' ? 'Caso cerrado' : 'Caso reabierto');
      },
      error: (err) => (this.error = err?.error?.message || 'Error al cambiar estado'),
    });
  }

  // ── Cambio de contraseña ──────────────────────────────────────────────────

  openCambioClave(): void {
    this.cambioClaveForm.reset();
    this.claveError = '';
    this.claveSuccess = '';
    new bootstrap.Modal(document.getElementById('ciCambioClaveModal')).show();
  }

  guardarCambioClave(): void {
    if (this.cambioClaveForm.invalid) { this.cambioClaveForm.markAllAsTouched(); return; }
    const { password, confirmPassword } = this.cambioClaveForm.value;
    if (password !== confirmPassword) { this.claveError = 'Las contraseñas no coinciden'; return; }
    this.savingClave = true;
    this.authService.changePassword(password, confirmPassword).subscribe({
      next: () => {
        this.savingClave = false;
        this.claveSuccess = 'Contraseña cambiada exitosamente';
        this.cambioClaveForm.reset();
      },
      error: (err) => {
        this.savingClave = false;
        this.claveError = err?.error?.message || 'Error al cambiar la contraseña';
      },
    });
  }

  // ── WebSocket ─────────────────────────────────────────────────────────────

  private initSocket(): void {
    const token = this.authService.token;
    if (!token) return;
    this.socketService.connect(token);

    this.wsSubs.push(
      this.socketService.on<CasoInterno>('nuevo-caso').subscribe(c => {
        if (!this.casos.find(x => x.id === c.id)) {
          this.casos = [c, ...this.casos];
        }
        this.showWsToast(`Nuevo caso: ${c.titulo || '#' + c.id}`);
      }),
    );

    this.wsSubs.push(
      this.socketService.on<CasoInterno>('caso-actualizado').subscribe(c => {
        const idx = this.casos.findIndex(x => x.id === c.id);
        if (idx !== -1) {
          this.casos = [
            ...this.casos.slice(0, idx),
            c,
            ...this.casos.slice(idx + 1),
          ];
        } else {
          this.casos = [c, ...this.casos];
        }
        if (this.selectedCasoId === c.id) {
          this.selectedCaso = c;
          this.loadThreadImages(c);
        }
        this.showWsToast(`Caso actualizado: #${c.id}`);
      }),
    );

    this.wsSubs.push(
      this.socketService.on<{ id: number }>('caso-eliminado').subscribe(({ id }) => {
        this.casos = this.casos.filter(c => c.id !== id);
        if (this.selectedCasoId === id) {
          this.selectedCasoId = null;
          this.selectedCaso = null;
        }
      }),
    );
  }

  private showWsToast(msg: string): void {
    this.wsToast = msg;
    setTimeout(() => (this.wsToast = ''), 5000);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  getInitials(nombre: string): string {
    return (nombre || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  }

  getAvatarClass(role: string): string {
    if (role === 'soporte') return 'av-soporte';
    if (role === 'admin') return 'av-admin';
    return 'av-user';
  }

  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  getAsignadoLabel(c: CasoInterno): string {
    if (c.visibilidad === 'todos') return 'Todo el equipo';
    if (!c.asignadoA?.length) return 'Sin asignar';
    if (c.asignadoA.length === 1) return c.asignadoA[0].nombre;
    return c.asignadoA.map(u => u.nombre).join(', ');
  }

  getRoleLabel(role: string): string {
    if (role === 'admin') return 'Admin';
    if (role === 'soporte') return 'Soporte';
    return role;
  }

  logout(): void { this.authService.logout(); }

  private showSuccess(msg: string): void {
    this.successMsg = msg;
    setTimeout(() => (this.successMsg = ''), 4000);
  }
}
