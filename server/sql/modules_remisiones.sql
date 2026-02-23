INSERT INTO modules (key, name, description)
VALUES
  ('remisiones', 'Remisiones', 'Remisiones de productos')
ON CONFLICT (key) DO NOTHING;
