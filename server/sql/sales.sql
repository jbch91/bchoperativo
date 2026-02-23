CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_base NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_iva NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sale_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES inventory_entries(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  lote TEXT NOT NULL,
  vencimiento DATE NOT NULL,
  cantidad INT NOT NULL,
  unitario NUMERIC(14,2) NOT NULL,
  iva NUMERIC(14,2) NOT NULL,
  total NUMERIC(14,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_client_id ON sales(client_id);
CREATE INDEX IF NOT EXISTS idx_sale_lines_sale_id ON sale_lines(sale_id);
