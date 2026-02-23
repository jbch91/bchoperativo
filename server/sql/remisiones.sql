CREATE TABLE IF NOT EXISTS remision_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  contact TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS remisiones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  remision_number TEXT NOT NULL,
  remision_client_id UUID REFERENCES remision_clients(id) ON DELETE SET NULL,
  recipient TEXT,
  destination TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS remision_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  remision_id UUID NOT NULL REFERENCES remisiones(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES inventory_entries(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  lote TEXT NOT NULL,
  vencimiento DATE NOT NULL,
  cantidad INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_remisiones_client ON remisiones (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_remision_lines_remision ON remision_lines (remision_id);
CREATE INDEX IF NOT EXISTS idx_remision_clients_client ON remision_clients (client_id);
