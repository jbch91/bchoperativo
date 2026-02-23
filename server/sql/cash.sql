CREATE TABLE IF NOT EXISTS cash_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in', 'out')),
  category TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  payment_method TEXT
);

CREATE INDEX IF NOT EXISTS idx_cash_transactions_client ON cash_transactions (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_type ON cash_transactions (type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_transactions_sale_unique ON cash_transactions (sale_id) WHERE source = 'sale';
