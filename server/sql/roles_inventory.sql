INSERT INTO permissions (name, description)
VALUES
  ('inventory:manage', 'Gestionar inventario de productos'),
  ('read:all', 'Lectura general')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('inventory:manage', 'read:all')
WHERE r.name IN ('superuser', 'admin')
ON CONFLICT DO NOTHING;
