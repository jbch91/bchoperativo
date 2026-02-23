import { ChangeDetectorRef, Component, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { InventoryProduct, InventoryProductsService } from '../inventario/inventory-products.service';
import * as XLSX from 'xlsx';
import { ClientContextService } from '../../shared/client-context.service';

@Component({
  selector: 'app-inventario-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './inventario-create.component.html',
  styleUrl: './inventario-create.component.scss'
})
export class InventarioCreateComponent {
  loading = false;
  errorMessage = '';
  successMessage = '';
  bulkLoading = false;
  loadingList = false;
  listError = '';
  searchTerm = '';
  page = 1;
  pageSize = 10;
  productItems: InventoryProduct[] = [];
  editingProductId: string | null = null;
  editProduct = { code: '', articulo: '', presentacion: '', marca: '' };

  code = '';
  articulo = '';
  presentacion = '';
  marca = '';

  constructor(
    private readonly products: InventoryProductsService,
    public readonly auth: AuthService,
    private readonly clientContext: ClientContextService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {
    void this.clientContext.init();
    void this.loadSummary();
    effect(() => {
      const clientId = this.clientContext.selectedClientId();
      if (clientId) {
        void this.loadSummary();
      }
    });
  }

  async onSubmit(): Promise<void> {
    this.errorMessage = '';
    const clientId = this.clientContext.selectedClientId();
    if (!clientId) {
      this.errorMessage = 'Selecciona un cliente.';
      return;
    }
    if (!this.code || !this.articulo || !this.presentacion || !this.marca) {
      this.errorMessage = 'Completa todos los campos obligatorios.';
      return;
    }

    this.loading = true;
    try {
      await this.products.createProduct(clientId, {
        code: this.code,
        articulo: this.articulo,
        presentacion: this.presentacion,
        marca: this.marca
      });
      this.successMessage = 'Producto creado.';
      await this.loadSummary();
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo crear el producto.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async onUploadProducts(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.errorMessage = '';
    this.successMessage = '';
    const clientId = this.clientContext.selectedClientId();
    if (!clientId) {
      this.errorMessage = 'Selecciona un cliente.';
      return;
    }
    this.bulkLoading = true;
    try {
      const rows = await this.readExcel(file);
      const items = this.parseExcelRows(rows);
      if (!items.length) {
        this.errorMessage = 'El archivo no tiene datos válidos.';
        return;
      }
      const result = await this.products.createProductsBulk(clientId, items);
      this.successMessage = `Importados: ${result.inserted}, omitidos: ${result.skipped}.`;
      await this.loadSummary();
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo importar el archivo.';
    } finally {
      this.bulkLoading = false;
      input.value = '';
      this.cdr.detectChanges();
    }
  }

  private readExcel(file: File): Promise<any[][]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.onload = () => {
        const data = new Uint8Array(reader.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as any[][];
        resolve(rows);
      };
      reader.readAsArrayBuffer(file);
    });
  }

  private parseExcelRows(rows: any[][]): { code: string; articulo: string; presentacion: string; marca: string }[] {
    if (!rows.length) return [];
    const header = rows[0].map((cell) => String(cell || '').trim().toLowerCase());
    const colIndex = {
      code: header.findIndex((h) => h === 'codigo' || h === 'código'),
      articulo: header.findIndex((h) => h === 'articulo' || h === 'artículo'),
      presentacion: header.findIndex((h) => h === 'presentacion' || h === 'presentación'),
      marca: header.findIndex((h) => h === 'marca')
    };

    return rows.slice(1).map((row) => ({
      code: String(row[colIndex.code] || '').trim(),
      articulo: String(row[colIndex.articulo] || '').trim(),
      presentacion: String(row[colIndex.presentacion] || '').trim(),
      marca: String(row[colIndex.marca] || '').trim()
    })).filter((item) => item.code && item.articulo && item.presentacion && item.marca);
  }

  async loadSummary(): Promise<void> {
    const clientId = this.clientContext.selectedClientId();
    if (!clientId) return;
    this.loadingList = true;
    this.listError = '';
    try {
      this.productItems = await this.products.listProducts(clientId);
      this.page = 1;
      this.searchTerm = '';
    } catch (error) {
      console.error(error);
      this.listError = 'No se pudo cargar el listado.';
      this.productItems = [];
    } finally {
      this.loadingList = false;
      this.cdr.detectChanges();
    }
  }

  get filteredSummary(): InventoryProduct[] {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) return this.productItems;
    return this.productItems.filter((item) =>
      `${item.code} ${item.articulo} ${item.presentacion} ${item.marca}`.toLowerCase().includes(term)
    );
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredSummary.length / this.pageSize));
  }

  get pagedSummary(): InventoryProduct[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredSummary.slice(start, start + this.pageSize);
  }

  nextPage(): void {
    if (this.page < this.totalPages) this.page += 1;
  }

  prevPage(): void {
    if (this.page > 1) this.page -= 1;
  }

  startEditProduct(item: InventoryProduct): void {
    this.editingProductId = item.id;
    this.editProduct = {
      code: item.code,
      articulo: item.articulo,
      presentacion: item.presentacion,
      marca: item.marca
    };
  }

  cancelEditProduct(): void {
    this.editingProductId = null;
  }

  async saveEditProduct(item: InventoryProduct): Promise<void> {
    const clientId = this.clientContext.selectedClientId();
    if (!clientId) return;
    if (!this.editProduct.code || !this.editProduct.articulo || !this.editProduct.presentacion || !this.editProduct.marca) {
      this.listError = 'Completa todos los campos del producto.';
      return;
    }
    await this.products.updateProduct(clientId, item.id, {
      code: this.editProduct.code.trim(),
      articulo: this.editProduct.articulo.trim(),
      presentacion: this.editProduct.presentacion.trim(),
      marca: this.editProduct.marca.trim()
    });
    this.editingProductId = null;
    await this.loadSummary();
  }

  async deleteProduct(item: InventoryProduct): Promise<void> {
    const clientId = this.clientContext.selectedClientId();
    if (!clientId) return;
    if (!confirm('¿Eliminar producto?')) return;
    await this.products.deleteProduct(clientId, item.id);
    await this.loadSummary();
  }
}
