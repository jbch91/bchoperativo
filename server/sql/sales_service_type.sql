ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS service_type text;

CREATE INDEX IF NOT EXISTS idx_sales_service_type ON sales (service_type);
