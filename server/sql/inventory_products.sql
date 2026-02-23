CREATE TABLE IF NOT EXISTS inventory_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  articulo TEXT NOT NULL,
  presentacion TEXT NOT NULL,
  marca TEXT NOT NULL,
  costo NUMERIC(14,2) NOT NULL DEFAULT 0,
  fecha_vencimiento DATE NOT NULL,
  lote TEXT NOT NULL,
  invima TEXT NOT NULL,
  cantidad INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_products_client_id ON inventory_products(client_id);
