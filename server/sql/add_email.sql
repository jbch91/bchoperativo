DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE';
    EXECUTE 'UPDATE public.users SET email = CONCAT(username, ''@example.com'') WHERE email IS NULL';
    EXECUTE 'ALTER TABLE public.users ALTER COLUMN email SET NOT NULL';
  END IF;
END $$;
