import { Component, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ClientBarComponent } from './shared/client-bar/client-bar.component';
import { AuthService } from './auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, ClientBarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('Login');
  protected readonly showClientBar = signal(true);

  constructor(
    private readonly router: Router,
    private readonly auth: AuthService
  ) {
    this.updateClientBar(this.router.url);
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      this.updateClientBar((event as NavigationEnd).urlAfterRedirects);
    });
    effect(() => {
      this.auth.currentUser();
      this.updateClientBar(this.router.url);
    });
  }

  private updateClientBar(url: string): void {
    const isLogin = url.startsWith('/login');
    const isSuper = this.auth.hasRole('superuser');
    this.showClientBar.set(!isLogin && isSuper);
  }
}
