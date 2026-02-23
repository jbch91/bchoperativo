ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS sale_type text DEFAULT 'producto';

CREATE INDEX IF NOT EXISTS idx_sales_sale_type ON sales (sale_type);
