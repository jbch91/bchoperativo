INSERT INTO modules (key, name, description)
VALUES
  ('caja', 'Caja', 'Movimientos de caja')
ON CONFLICT (key) DO NOTHING;
