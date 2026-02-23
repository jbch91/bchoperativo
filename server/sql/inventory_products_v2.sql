-- Migracion: si existe la tabla antigua con campos de lote, renombrarla primero
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_products' AND column_name = 'lote'
  ) THEN
    ALTER TABLE inventory_products RENAME TO inventory_products_legacy;
  END IF;
END $$;

-- Productos base
CREATE TABLE IF NOT EXISTS inventory_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  articulo TEXT NOT NULL,
  presentacion TEXT NOT NULL,
  marca TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_products_client_id ON inventory_products(client_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_products_code_unique ON inventory_products(client_id, code);

-- Ingresos / lotes
CREATE TABLE IF NOT EXISTS inventory_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES inventory_products(id) ON DELETE CASCADE,
  costo NUMERIC(14,2) NOT NULL DEFAULT 0,
  fecha_vencimiento DATE NOT NULL,
  lote TEXT NOT NULL,
  invima TEXT NOT NULL,
  cantidad INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_entries_product_id ON inventory_entries(product_id);

-- Migrar datos si existe la tabla legacy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'inventory_products_legacy'
  ) THEN
    INSERT INTO inventory_products (id, client_id, code, articulo, presentacion, marca, created_at)
    SELECT uuid_generate_v4(), client_id, code, articulo, presentacion, marca, MIN(created_at)
    FROM inventory_products_legacy
    GROUP BY client_id, code, articulo, presentacion, marca
    ON CONFLICT (client_id, code) DO NOTHING;

    INSERT INTO inventory_entries (product_id, costo, fecha_vencimiento, lote, invima, cantidad, created_at)
    SELECT p.id, l.costo, l.fecha_vencimiento, l.lote, l.invima, l.cantidad, l.created_at
    FROM inventory_products_legacy l
    JOIN inventory_products p ON p.client_id = l.client_id AND p.code = l.code;
  END IF;
END $$;
