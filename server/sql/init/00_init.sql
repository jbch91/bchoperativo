\set ON_ERROR_STOP on

-- Ensure extensions exist up-front
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Base auth tables
\i /sql/schema.sql

-- Core domain tables
\i /sql/clients.sql
\i /sql/modules.sql
\i /sql/user_modules.sql
\i /sql/inventory_products.sql
\i /sql/inventory_products_v2.sql
\i /sql/inventory_entries_tax.sql
\i /sql/inventory_entries_sales.sql
\i /sql/sales.sql
\i /sql/cash.sql
\i /sql/remisiones.sql
\i /sql/maintenance.sql
\i /sql/schedules.sql
\i /sql/training_schedules.sql
\i /sql/calibration_schedules.sql
\i /sql/audit_logs.sql
\i /sql/password_reset.sql
\i /sql/refresh_tokens.sql

-- Alterations / feature expansions
\i /sql/users_add_client.sql
\i /sql/users_add_signature.sql
\i /sql/clients_add_address.sql
\i /sql/sales_buyer.sql
\i /sql/sales_type.sql
\i /sql/sales_service_type.sql
\i /sql/sales_consumption_fields.sql
\i /sql/sales_payment_method.sql
\i /sql/sale_lines_nullable_entry.sql
\i /sql/maintenance_add_schedule_fields.sql
\i /sql/maintenance_add_reminders.sql
\i /sql/maintenance_add_pdf.sql
\i /sql/schedules_add_pdf.sql
\i /sql/training_add_pdf.sql
\i /sql/calibration_add_pdf.sql
\i /sql/modules_cash.sql
\i /sql/modules_remisiones.sql
\i /sql/history_indexes.sql
\i /sql/add_email.sql
\i /sql/tenant_hv_migration.sql
\i /sql/tenant_hv_part2.sql

-- Roles & permissions
\i /sql/seed.sql
\i /sql/seed_users_permission.sql
\i /sql/roles_inventory.sql
\i /sql/roles_cash.sql
\i /sql/roles_remisiones.sql
\i /sql/roles_maintenance.sql
\i /sql/roles_hv_view_fix.sql
\i /sql/permissions_hv.sql
\i /sql/admin_clients_permission.sql
\i /sql/superuser_all_permissions.sql
