import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { SoportesService } from '../services/soportes.service';
import { EntidadesService } from '../services/entidades.service';
import { SocketService } from '../services/socket.service';
import { Soporte, SoporteAdjunto } from '../models/soporte.model';
import { User, ScopeItem } from '../models/user.model';

declare const bootstrap: any;

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;

  // Entidades para filtro
  entidadesFilter: { id: number; nombre: string }[] = [];

  // Filtros
  filtroEstado = 'todos';
  filtroEntidadId: number | null = null;
  searchTerm = '';

  // Lista de tickets
  soportes: Soporte[] = [];
  loading = false;
  error = '';
  successMsg = '';

  // Hilo seleccionado
  selectedSoporteId: number | null = null;
  selectedSoporte: Soporte | null = null;
  loadingThread = false;
  imageCache = new Map<number, string>();
  imagenViewer: string | null = null;

  // Reply
  replyText = '';
  replyFiles: File[] = [];
  sendingReply = false;
  replyError = '';

  // Nueva solicitud
  nuevaForm!: FormGroup;
  nuevaEntidadId: number | null = null;
  nuevaFiles: File[] = [];
  savingNew = false;

  // Scope del usuario actual (para user y soporte)
  private userScope: ScopeItem[] = [];

  // Cambio clave
  cambioClaveForm!: FormGroup;
  savingClave = false;
  claveError = '';
  claveSuccess = '';

  // Export excel
  exportForm!: FormGroup;
  exportEntidadIds: number[] = [];
  exporting = false;

  // WS
  wsToast = '';
  private wsSubs: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private soportesService: SoportesService,
    private entidadesService: EntidadesService,
    private socketService: SocketService,
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.currentUser;

    this.nuevaForm = this.fb.group({
      titulo:  ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
      texto:   ['', [Validators.required, Validators.minLength(5)]],
    });

    this.cambioClaveForm = this.fb.group({
      password:        ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(6)]],
    });

    this.exportForm = this.fb.group({
      desde: ['', Validators.required],
      hasta: ['', Validators.required],
    });

    // Filtro por defecto según rol
    this.filtroEstado = this.isSoporte ? 'pendiente' : 'todos';

    this.loadMe();
    this.initSocket();
  }

  ngOnDestroy(): void {
    this.wsSubs.forEach(s => s.unsubscribe());
    this.socketService.disconnect();
    // Liberar object URLs
    this.imageCache.forEach(url => URL.revokeObjectURL(url));
  }

  // ── Roles ────────────────────────────────────────────────────────────────

  get isAdmin(): boolean   { return this.currentUser?.role === 'admin'; }
  get isSoporte(): boolean { return this.currentUser?.role === 'soporte'; }
  get isUser(): boolean    { return this.currentUser?.role === 'user'; }

  // ── Carga inicial (scope + entidades + datos) ─────────────────────────────

  private loadMe(): void {
    this.authService.getMe().subscribe({
      next: (me) => {
        this.userScope = me.scope ?? [];
        this.buildEntidadesFilter();
        this.loadSoportes();
      },
      error: () => {
        this.buildEntidadesFilter();
        this.loadSoportes();
      },
    });
  }

  private buildEntidadesFilter(): void {
    if (this.isAdmin) {
      this.entidadesService.getAllEntidades().subscribe({
        next: (data) => (this.entidadesFilter = data.map(e => ({ id: e.id, nombre: e.nombre }))),
        error: () => {},
      });
    } else if (this.isSoporte) {
      this.entidadesFilter = this.userScope
        .map(s => s.entidad ? { id: s.entidad.id, nombre: s.entidad.nombre } : null)
        .filter((e): e is { id: number; nombre: string } => !!e);
    }
  }

  loadSoportes(): void {
    this.loading = true;
    // Siempre carga todos los estados para que los conteos de los pills sean correctos.
    // El filtro de estado se aplica client-side en filteredSoportes.
    const params: { estado: string; entidadId?: number } = { estado: 'todos' };
    if (this.filtroEntidadId) params.entidadId = this.filtroEntidadId;

    this.soportesService.getAll(params).subscribe({
      next: (data) => { this.soportes = data; this.loading = false; },
      error: () => { this.error = 'Error al cargar solicitudes'; this.loading = false; },
    });
  }

  onFiltroEstadoChange(estado: string): void {
    this.filtroEstado = estado;
    // No recarga — filteredSoportes aplica el filtro sobre la lista ya cargada
  }

  onFiltroEntidadChange(): void {
    // Sí recarga porque cambia la entidad, que es un filtro del servidor
    this.loadSoportes();
  }

  // ── Filtro local (estado + search) ───────────────────────────────────────

  // Para soporte: "Resuelto" muestra solo tickets donde él tiene al menos un mensaje
  private hasMyMessage(s: Soporte): boolean {
    return (s.mensajes ?? []).some(m => m.usuarioId === this.currentUser?.id);
  }

  get filteredSoportes(): Soporte[] {
    let result: Soporte[];

    if (this.filtroEstado === 'todos') {
      result = [...this.soportes];
    } else if (this.filtroEstado === 'resuelto' && this.isSoporte) {
      result = this.soportes.filter(s => s.estado === 'resuelto' && this.hasMyMessage(s));
    } else {
      result = this.soportes.filter(s => s.estado === this.filtroEstado);
    }

    const term = this.searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter(s =>
        s.titulo?.toLowerCase().includes(term) ||
        s.usuario?.nombre?.toLowerCase().includes(term) ||
        s.entidad?.nombre?.toLowerCase().includes(term)
      );
    }
    return result;
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  get totalCount(): number    { return this.soportes.length; }
  get pendienteCount(): number { return this.soportes.filter(s => s.estado === 'pendiente').length; }
  get resueltoCount(): number {
    if (this.isSoporte) {
      return this.soportes.filter(s => s.estado === 'resuelto' && this.hasMyMessage(s)).length;
    }
    return this.soportes.filter(s => s.estado === 'resuelto').length;
  }

  // ── Ticket seleccionado / hilo ────────────────────────────────────────────

  selectTicket(s: Soporte): void {
    if (this.selectedSoporteId === s.id) {
      this.selectedSoporteId = null;
      this.selectedSoporte = null;
      this.replyText = '';
      this.replyFiles = [];
      this.replyError = '';
      return;
    }
    this.selectedSoporteId = s.id;
    this.selectedSoporte = null;
    this.loadingThread = true;
    this.replyText = '';
    this.replyFiles = [];
    this.replyError = '';

    this.soportesService.getOne(s.id).subscribe({
      next: (full) => {
        this.selectedSoporte = full;
        this.loadingThread = false;
        this.loadThreadImages(full);
      },
      error: () => { this.loadingThread = false; },
    });
  }

  private loadThreadImages(s: Soporte): void {
    const images = (s.mensajes ?? []).flatMap(m => m.adjuntos ?? []).filter(a => a.tipo === 'image');
    for (const adj of images) {
      if (!this.imageCache.has(adj.id)) {
        this.soportesService.getAdjuntoBlob(adj.id).subscribe({
          next: (blob) => this.imageCache.set(adj.id, URL.createObjectURL(blob)),
          error: () => {},
        });
      }
    }
  }

  getImageUrl(adjId: number): string {
    return this.imageCache.get(adjId) ?? '';
  }

  // ── Permisos de turno ─────────────────────────────────────────────────────

  isMyTurn(s: Soporte): boolean {
    const msgs = s.mensajes ?? [];
    if (!msgs.length) return false;
    const lastMsg = msgs[msgs.length - 1];
    if (this.isAdmin) return true;
    if (this.isSoporte) return lastMsg.usuario?.role === 'user';
    if (this.isUser)    return lastMsg.usuario?.role === 'soporte' || lastMsg.usuario?.role === 'admin';
    return false;
  }

  canDelete(s: Soporte): boolean {
    if (this.isSoporte) return false;
    if (this.isAdmin) return true;
    const tieneRespuesta = (s.mensajes ?? []).some(m => m.usuarioId !== s.usuarioId);
    return !tieneRespuesta && s.usuarioId === this.currentUser?.id;
  }

  // ── Responder en el hilo ──────────────────────────────────────────────────

  onReplyFilesChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.replyFiles = [...this.replyFiles, ...Array.from(input.files)];
      input.value = '';
    }
  }

  removeReplyFile(i: number): void { this.replyFiles.splice(i, 1); }

  enviarRespuesta(): void {
    if (!this.replyText.trim() || !this.selectedSoporteId) return;
    this.sendingReply = true;
    this.replyError = '';

    const fd = new FormData();
    fd.append('texto', this.replyText.trim());
    this.replyFiles.forEach(f => fd.append('archivos', f));

    this.soportesService.addMensaje(this.selectedSoporteId, fd).subscribe({
      next: (updated) => {
        this.selectedSoporte = updated;
        this.replyText = '';
        this.replyFiles = [];
        this.sendingReply = false;
        this.loadThreadImages(updated);
        // Actualizar en la lista local
        const idx = this.soportes.findIndex(s => s.id === updated.id);
        if (idx !== -1) this.soportes[idx] = updated;
      },
      error: (err) => {
        this.sendingReply = false;
        this.replyError = err?.error?.message || 'No es tu turno o error al enviar';
      },
    });
  }

  // ── Ver / Descargar adjuntos ──────────────────────────────────────────────

  openImageViewer(objectUrl: string): void {
    this.imagenViewer = objectUrl;
    new bootstrap.Modal(document.getElementById('imagenViewerModal')).show();
  }

  downloadFile(adj: SoporteAdjunto): void {
    this.soportesService.downloadAdjunto(adj.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = adj.nombre; a.click();
        URL.revokeObjectURL(url);
      },
      error: () => (this.error = 'Error al descargar el archivo'),
    });
  }

  // ── Eliminar ticket ───────────────────────────────────────────────────────

  eliminarSoporte(s: Soporte, event: Event): void {
    event.stopPropagation();
    if (!confirm(`¿Eliminar la solicitud #${s.id}?`)) return;
    this.soportesService.delete(s.id).subscribe({
      next: () => {
        this.soportes = this.soportes.filter(x => x.id !== s.id);
        if (this.selectedSoporteId === s.id) { this.selectedSoporteId = null; this.selectedSoporte = null; }
        this.showSuccess('Solicitud eliminada');
      },
      error: (err) => (this.error = err?.error?.message || 'Error al eliminar'),
    });
  }

  // ── Nueva solicitud ───────────────────────────────────────────────────────

  get nuevaEntidadIdResuelto(): number | null {
    if (this.isAdmin) return this.nuevaEntidadId;
    return this.userScope[0]?.entidadId ?? null;
  }

  get userEntidadNombre(): string {
    if (!this.userScope.length) return '';
    return this.userScope[0]?.entidad?.nombre ?? '';
  }

  openNuevaSolicitud(): void {
    this.nuevaForm.reset();
    this.nuevaFiles = [];
    this.nuevaEntidadId = null;
    new bootstrap.Modal(document.getElementById('nuevaSolicitudModal')).show();
  }

  onNuevaFilesChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.nuevaFiles = [...this.nuevaFiles, ...Array.from(input.files)];
      input.value = '';
    }
  }

  removeNuevaFile(i: number): void { this.nuevaFiles.splice(i, 1); }

  guardarNuevaSolicitud(): void {
    if (this.nuevaForm.invalid) { this.nuevaForm.markAllAsTouched(); return; }
    const entidadId = this.nuevaEntidadIdResuelto;
    if (!entidadId) { this.error = 'No tienes entidad asignada. Contacta al administrador.'; return; }

    this.savingNew = true;
    const fd = new FormData();
    fd.append('titulo', this.nuevaForm.value.titulo);
    fd.append('texto', this.nuevaForm.value.texto);
    fd.append('entidadId', String(entidadId));
    this.nuevaFiles.forEach(f => fd.append('archivos', f));

    this.soportesService.create(fd).subscribe({
      next: () => {
        this.savingNew = false;
        bootstrap.Modal.getInstance(document.getElementById('nuevaSolicitudModal'))?.hide();
        this.loadSoportes();
        this.showSuccess('Solicitud creada exitosamente');
      },
      error: (err) => { this.savingNew = false; this.error = err?.error?.message || 'Error al crear solicitud'; },
    });
  }

  // ── Cambio de contraseña ──────────────────────────────────────────────────

  openCambioClave(): void {
    this.cambioClaveForm.reset();
    this.claveError = '';
    this.claveSuccess = '';
    new bootstrap.Modal(document.getElementById('cambioClaveModal')).show();
  }

  guardarCambioClave(): void {
    if (this.cambioClaveForm.invalid) { this.cambioClaveForm.markAllAsTouched(); return; }
    const { password, confirmPassword } = this.cambioClaveForm.value;
    if (password !== confirmPassword) { this.claveError = 'Las contraseñas no coinciden'; return; }
    this.savingClave = true;
    this.authService.changePassword(password, confirmPassword).subscribe({
      next: () => { this.savingClave = false; this.claveSuccess = 'Contraseña cambiada exitosamente'; this.cambioClaveForm.reset(); },
      error: (err) => { this.savingClave = false; this.claveError = err?.error?.message || 'Error al cambiar la contraseña'; },
    });
  }

  // ── Export Excel ──────────────────────────────────────────────────────────

  openExportModal(): void {
    this.exportForm.reset();
    this.exportEntidadIds = [];
    new bootstrap.Modal(document.getElementById('exportModal')).show();
  }

  toggleExportEntidad(id: number): void {
    const idx = this.exportEntidadIds.indexOf(id);
    if (idx === -1) this.exportEntidadIds.push(id);
    else this.exportEntidadIds.splice(idx, 1);
  }

  isExportEntidadChecked(id: number): boolean {
    return this.exportEntidadIds.includes(id);
  }

  exportarExcel(): void {
    if (this.exportForm.invalid) { this.exportForm.markAllAsTouched(); return; }
    this.exporting = true;
    const { desde, hasta } = this.exportForm.value;
    this.soportesService.exportExcel(desde, hasta, this.exportEntidadIds.length ? this.exportEntidadIds : undefined).subscribe({
      next: (blob) => {
        this.exporting = false;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `solicitudes_${desde}_${hasta}.xlsx`; a.click();
        URL.revokeObjectURL(url);
        bootstrap.Modal.getInstance(document.getElementById('exportModal'))?.hide();
      },
      error: () => { this.exporting = false; this.error = 'Error al exportar'; },
    });
  }

  // ── WebSocket ─────────────────────────────────────────────────────────────

  private initSocket(): void {
    const token = this.authService.token;
    if (!token) return;
    this.socketService.connect(token);

    this.wsSubs.push(
      this.socketService.on<Soporte>('nuevo-soporte').subscribe(s => {
        if (!this.soportes.find(x => x.id === s.id)) {
          this.soportes = [s, ...this.soportes];
        }
        this.showWsToast(`Nueva solicitud: ${s.titulo || '#' + s.id}`);
      })
    );

    this.wsSubs.push(
      this.socketService.on<Soporte>('soporte-actualizado').subscribe(s => {
        const idx = this.soportes.findIndex(x => x.id === s.id);
        if (idx !== -1) {
          // Actualiza el ticket existente en la lista
          this.soportes = [...this.soportes.slice(0, idx), s, ...this.soportes.slice(idx + 1)];
        } else {
          // Ticket no estaba en la lista (p.ej. llega de pendiente tras estar resuelto
          // y el soporte se conectó cuando estaba resuelto) → agregarlo
          this.soportes = [s, ...this.soportes];
        }
        // Actualizar hilo si está abierto
        if (this.selectedSoporteId === s.id) {
          this.selectedSoporte = s;
          this.loadThreadImages(s);
        }
        this.showWsToast(`Nuevo mensaje en solicitud #${s.id}`);
      })
    );

    this.wsSubs.push(
      this.socketService.on<{ id: number }>('soporte-eliminado').subscribe(({ id }) => {
        this.soportes = this.soportes.filter(s => s.id !== id);
        if (this.selectedSoporteId === id) { this.selectedSoporteId = null; this.selectedSoporte = null; }
      })
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

  logout(): void { this.authService.logout(); }

  private showSuccess(msg: string): void {
    this.successMsg = msg;
    setTimeout(() => (this.successMsg = ''), 4000);
  }
}
