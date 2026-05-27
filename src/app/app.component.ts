import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from './services/auth.service';
import { SocketService } from './services/socket.service';

@Component({
  selector: 'app-root',
  template: `
    <router-outlet></router-outlet>
    <div class="ws-toast" *ngIf="wsToast">
      <i class="bi bi-bell-fill me-2"></i>{{ wsToast }}
    </div>
  `,
})
export class AppComponent implements OnInit, OnDestroy {
  wsToast = '';
  private wsSubs: Subscription[] = [];
  private toastTimer: any;

  constructor(
    private authService: AuthService,
    private socketService: SocketService,
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        const token = this.authService.token;
        if (token) this.initSocket(token);
      } else {
        this.clearSubs();
        this.socketService.disconnect();
      }
    });
  }

  ngOnDestroy(): void {
    this.clearSubs();
  }

  private initSocket(token: string): void {
    this.socketService.connect(token);

    this.wsSubs.push(
      this.socketService.on<any>('nuevo-soporte').subscribe(s =>
        this.showWsToast(`Nueva solicitud: ${s.titulo || '#' + s.id}`)
      ),
      this.socketService.on<any>('soporte-actualizado').subscribe(s =>
        this.showWsToast(`Nuevo mensaje en solicitud #${s.id}`)
      ),
      this.socketService.on<any>('nuevo-caso').subscribe(c =>
        this.showWsToast(`Nuevo caso: ${c.titulo || '#' + c.id}`)
      ),
      this.socketService.on<any>('caso-actualizado').subscribe(c =>
        this.showWsToast(`Caso actualizado: #${c.id}`)
      ),
    );
  }

  private showWsToast(msg: string): void {
    clearTimeout(this.toastTimer);
    this.wsToast = msg;
    this.toastTimer = setTimeout(() => (this.wsToast = ''), 5000);
  }

  private clearSubs(): void {
    this.wsSubs.forEach(s => s.unsubscribe());
    this.wsSubs = [];
  }
}
