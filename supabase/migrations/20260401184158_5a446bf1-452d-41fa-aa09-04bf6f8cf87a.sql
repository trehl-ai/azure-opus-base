
-- Add reminder_sent column
ALTER TABLE public.tasks ADD COLUMN reminder_sent boolean NOT NULL DEFAULT false;

-- Trigger to reset reminder_sent when due_date changes
CREATE OR REPLACE FUNCTION public.reset_reminder_on_due_date_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
    NEW.reminder_sent := false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reset_reminder_on_due_date
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_reminder_on_due_date_change();
