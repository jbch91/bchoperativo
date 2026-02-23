import { query } from './db.js';

export async function listInventoryProducts(clientId) {
  const { rows } = await query(
    `SELECT id, code, articulo, presentacion, marca, created_at
     FROM inventory_products
     WHERE client_id = $1
     ORDER BY created_at DESC`,
    [clientId]
  );
  return rows;
}

export async function listInventorySummary(clientId) {
  const { rows } = await query(
    `SELECT p.id, p.code, p.articulo, p.presentacion, p.marca,
            COALESCE(SUM(e.cantidad), 0) AS total_cantidad
     FROM inventory_products p
     LEFT JOIN inventory_entries e ON e.product_id = p.id
     WHERE p.client_id = $1
     GROUP BY p.id, p.code, p.articulo, p.presentacion, p.marca
     HAVING COALESCE(SUM(e.cantidad), 0) > 0
     ORDER BY p.created_at DESC`,
    [clientId]
  );
  return rows;
}

export async function listInventoryEntries(clientId) {
  const { rows } = await query(
    `SELECT e.id,
            p.id AS product_id,
            p.code,
            p.articulo,
            p.presentacion,
            p.marca,
            e.costo,
            e.iva_tipo,
            e.costo_base,
            e.iva_valor,
            e.costo_total,
            e.venta_factor,
            e.precio_venta,
            e.fecha_vencimiento,
            e.lote,
            e.invima,
            e.cantidad,
            e.created_at
     FROM inventory_entries e
     JOIN inventory_products p ON p.id = e.product_id
     WHERE p.client_id = $1 AND e.cantidad > 0
     ORDER BY e.fecha_vencimiento ASC, e.created_at DESC`,
    [clientId]
  );
  return rows;
}

export async function createInventoryProduct(clientId, payload) {
  const { code, articulo, presentacion, marca } = payload;
  const { rows } = await query(
    `INSERT INTO inventory_products (client_id, code, articulo, presentacion, marca)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id`,
    [clientId, code, articulo, presentacion, marca]
  );
  return rows[0];
}

export async function updateInventoryProduct(clientId, productId, payload) {
  const { code, articulo, presentacion, marca } = payload;
  await query(
    `UPDATE inventory_products
     SET code = $1,
         articulo = $2,
         presentacion = $3,
         marca = $4
     WHERE id = $5 AND client_id = $6`,
    [code, articulo, presentacion, marca, productId, clientId]
  );
}

export async function createInventoryProductsBulk(clientId, items) {
  const rows = [];
  for (const item of items) {
    rows.push([clientId, item.code, item.articulo, item.presentacion, item.marca]);
  }
  if (!rows.length) {
    return { inserted: 0, skipped: 0 };
  }

  const values = rows
    .map((_, i) => {
      const base = i * 5;
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5})`;
    })
    .join(',');

  const params = rows.flat();
  const result = await query(
    `INSERT INTO inventory_products (client_id, code, articulo, presentacion, marca)
     VALUES ${values}
     ON CONFLICT (client_id, code) DO NOTHING`,
    params
  );

  const inserted = result.rowCount || 0;
  const skipped = rows.length - inserted;
  return { inserted, skipped };
}

export async function createInventoryEntry(productId, payload) {
  const { costo, ivaTipo, costoBase, ivaValor, costoTotal, ventaFactor, precioVenta, fechaVencimiento, lote, invima, cantidad } = payload;
  const { rows } = await query(
    `INSERT INTO inventory_entries
      (product_id, costo, iva_tipo, costo_base, iva_valor, costo_total, venta_factor, precio_venta, fecha_vencimiento, lote, invima, cantidad)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id`,
    [productId, costo, ivaTipo, costoBase, ivaValor, costoTotal, ventaFactor, precioVenta, fechaVencimiento, lote, invima, cantidad]
  );
  return rows[0];
}

export async function deleteInventoryProduct(clientId, id) {
  await query('DELETE FROM inventory_products WHERE id = $1 AND client_id = $2', [id, clientId]);
}

export async function deleteInventoryEntry(clientId, entryId) {
  await query(
    `DELETE FROM inventory_entries e
     USING inventory_products p
     WHERE e.id = $1 AND e.product_id = p.id AND p.client_id = $2`,
    [entryId, clientId]
  );
}

export async function updateInventoryEntry(clientId, entryId, payload) {
  const { costo, ivaTipo, costoBase, ivaValor, costoTotal, ventaFactor, precioVenta, fechaVencimiento, lote, invima, cantidad } = payload;
  await query(
    `UPDATE inventory_entries e
     SET costo = $1,
         iva_tipo = $2,
         costo_base = $3,
         iva_valor = $4,
         costo_total = $5,
         venta_factor = $6,
         precio_venta = $7,
         fecha_vencimiento = $8,
         lote = $9,
         invima = $10,
         cantidad = $11
     FROM inventory_products p
     WHERE e.id = $12 AND e.product_id = p.id AND p.client_id = $13`,
    [costo, ivaTipo, costoBase, ivaValor, costoTotal, ventaFactor, precioVenta, fechaVencimiento, lote, invima, cantidad, entryId, clientId]
  );
}
