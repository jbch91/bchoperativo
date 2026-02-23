INSERT INTO permissions (name, description)
VALUES
  ('remisiones:manage', 'Gestionar remisiones')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('remisiones:manage')
WHERE r.name IN ('superuser', 'admin')
ON CONFLICT DO NOTHING;
