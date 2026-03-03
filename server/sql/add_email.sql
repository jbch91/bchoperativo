DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'users'
  ) THEN
    EXECUTE 'ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE';
  END IF;
END $$;

UPDATE users SET email = CONCAT(username, '@example.com')
WHERE email IS NULL;

ALTER TABLE users
ALTER COLUMN email SET NOT NULL;
