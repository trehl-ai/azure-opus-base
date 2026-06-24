UPDATE public.users SET role='sales' WHERE email='w.berchtold@eo-ipso.com' AND is_active=false;
UPDATE public.users SET role='projektmanager' WHERE email IN ('t.timmer@eo-ipso.com','a.schuster@eo-ipso.com');
UPDATE public.users SET role='management' WHERE email='w.berchtold@spiel-sport-team.de';
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','management','projektmanager','sales'));
