ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS consumption_area text,
  ADD COLUMN IF NOT EXISTS consumption_note text;

CREATE INDEX IF NOT EXISTS idx_sales_consumption_area ON sales (consumption_area);
