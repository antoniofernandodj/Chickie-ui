import { Component, inject, signal, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { SignupRequest } from '../../../core/models';
import { UiButtonComponent } from '../../../shared/components';

interface PendingSignup {
  email:   string;
  nome:    string;
  payload: SignupRequest;
}

@Component({
  selector: 'app-verificar-email',
  imports: [RouterLink, UiButtonComponent],
  templateUrl: './verificar-email.component.html',
})
export class VerificarEmailComponent implements OnInit, OnDestroy {
  private auth       = inject(AuthService);
  private router     = inject(Router);
  private platformId = inject(PLATFORM_ID);

  pending   = signal<PendingSignup | null>(null);
  resending = signal(false);
  cooldown  = signal(0);
  resendMsg = signal('');

  private cooldownInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const raw = sessionStorage.getItem('chickie_signup_pending');
    if (!raw) { this.router.navigate(['/auth/signup']); return; }
    try { this.pending.set(JSON.parse(raw)); } catch { this.router.navigate(['/auth/signup']); }
  }

  ngOnDestroy(): void {
    if (this.cooldownInterval) clearInterval(this.cooldownInterval);
  }

  reenviar(): void {
    const p = this.pending();
    if (!p || this.cooldown() > 0 || this.resending()) return;
    this.resending.set(true);
    this.resendMsg.set('');
    this.auth.signup(p.payload).subscribe({
      next: () => {
        this.resending.set(false);
        this.resendMsg.set('Email reenviado! Verifique sua caixa de entrada.');
        this.startCooldown(60);
      },
      error: (err) => {
        this.resending.set(false);
        this.resendMsg.set(err?.error?.error ?? 'Erro ao reenviar. Tente novamente.');
      },
    });
  }

  private startCooldown(seconds: number): void {
    this.cooldown.set(seconds);
    this.cooldownInterval = setInterval(() => {
      const next = this.cooldown() - 1;
      this.cooldown.set(next);
      if (next <= 0 && this.cooldownInterval) {
        clearInterval(this.cooldownInterval);
        this.cooldownInterval = null;
      }
    }, 1000);
  }
}
