import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class SoporteStaffGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean {
    const role = this.authService.currentUser?.role;
    if (role === 'admin' || role === 'soporte') return true;
    this.router.navigate(['/dashboard']);
    return false;
  }
}
