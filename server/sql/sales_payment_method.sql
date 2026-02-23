ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'efectivo';

CREATE INDEX IF NOT EXISTS idx_sales_payment_method ON sales (payment_method);
