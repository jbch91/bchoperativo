ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS buyer_name text,
  ADD COLUMN IF NOT EXISTS buyer_document text,
  ADD COLUMN IF NOT EXISTS buyer_address text;

CREATE INDEX IF NOT EXISTS idx_sales_buyer_name ON sales (buyer_name);
