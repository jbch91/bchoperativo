import { ChangeDetectorRef, Component, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { InventoryProductsService, InventoryProduct } from '../inventario/inventory-products.service';
import { ClientContextService } from '../../shared/client-context.service';

@Component({
  selector: 'app-inventario-ingreso',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './inventario-ingreso.component.html',
  styleUrl: './inventario-ingreso.component.scss'
})
export class InventarioIngresoComponent {
  loading = false;
  errorMessage = '';

  products: InventoryProduct[] = [];
  productSearch = '';
  selectedProductId = '';

  costo: number | null = null;
  ivaTipo: 'gravado' | 'excluido' | 'exento' = 'gravado';
  costoBase: number | null = null;
  ivaValor: number | null = null;
  costoTotal: number | null = null;
  ventaFactor = 0.7;
  precioVenta: number | null = null;
  fechaVencimiento = '';
  lote = '';
  invima = '';
  cantidad: number | null = null;

  constructor(
    private readonly productsService: InventoryProductsService,
    public readonly auth: AuthService,
    public readonly clientContext: ClientContextService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {
    void this.clientContext.init();
    void this.init();
    effect(() => {
      const clientId = this.clientContext.selectedClientId();
      if (clientId) {
        void this.loadProducts();
      }
    });
  }

  async init(): Promise<void> {
    if (this.clientContext.selectedClientId()) {
      await this.loadProducts();
    }
  }

  async loadProducts(): Promise<void> {
    const clientId = this.clientContext.selectedClientId();
    if (!clientId) return;
    try {
      this.products = await this.productsService.listProducts(clientId);
    } catch (error) {
      console.error(error);
      this.products = [];
    } finally {
      this.cdr.detectChanges();
    }
  }

  get filteredProducts(): InventoryProduct[] {
    const term = this.productSearch.toLowerCase().trim();
    if (!term) return this.products;
    return this.products.filter((p) =>
      `${p.code} ${p.articulo} ${p.presentacion} ${p.marca}`
        .toLowerCase()
        .includes(term)
    );
  }

  async onSubmit(): Promise<void> {
    this.errorMessage = '';
    const clientId = this.clientContext.selectedClientId();
    if (!clientId) {
      this.errorMessage = 'Selecciona un cliente.';
      return;
    }
    if (!this.selectedProductId) {
      this.errorMessage = 'Selecciona un producto.';
      return;
    }
    if (!this.fechaVencimiento) {
      this.errorMessage = 'Ingresa la fecha de vencimiento.';
      return;
    }
    if (this.costoBase === null || Number.isNaN(Number(this.costoBase))) {
      this.errorMessage = 'Ingresa un costo base válido.';
      return;
    }
    if (Number(this.costoBase) <= 0) {
      this.errorMessage = 'El costo base debe ser mayor que 0.';
      return;
    }
    this.recalculateIva();
    this.recalculateVenta();
    if (this.cantidad === null || Number.isNaN(Number(this.cantidad))) {
      this.errorMessage = 'Ingresa una cantidad válida.';
      return;
    }
    if (Number(this.cantidad) <= 0) {
      this.errorMessage = 'La cantidad debe ser mayor que 0.';
      return;
    }
    const today = this.todayISO();
    if (this.fechaVencimiento < today) {
      this.errorMessage = 'La fecha de vencimiento no puede ser anterior a hoy.';
      return;
    }

    this.loading = true;
    try {
      await this.productsService.createEntry(clientId, {
        productId: this.selectedProductId,
        costo: Number(this.costoTotal) || 0,
        ivaTipo: this.ivaTipo,
        costoBase: Number(this.costoBase) || 0,
        ivaValor: Number(this.ivaValor) || 0,
        costoTotal: Number(this.costoTotal) || 0,
        ventaFactor: Number(this.ventaFactor) || 0.5,
        precioVenta: Number(this.precioVenta) || 0,
        fechaVencimiento: this.fechaVencimiento,
        lote: this.lote,
        invima: this.invima,
        cantidad: Number(this.cantidad)
      });
      await this.router.navigate(['/inventario']);
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo registrar el ingreso.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  recalculateIva(): void {
    const base = Number(this.costoBase) || 0;
    const rate = this.ivaTipo === 'gravado' ? 0.19 : 0;
    const iva = Math.round(base * rate * 100) / 100;
    this.ivaValor = iva;
    this.costoTotal = Math.round((base + iva) * 100) / 100;
    this.recalculateVenta();
  }

  recalculateVenta(): void {
    const base = Number(this.costoBase) || 0;
    const factor = Number(this.ventaFactor) || 0.5;
    if (factor <= 0) {
      this.precioVenta = 0;
      return;
    }
    this.precioVenta = Math.round((base / factor) * 100) / 100;
  }

  private todayISO(): string {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }
}
