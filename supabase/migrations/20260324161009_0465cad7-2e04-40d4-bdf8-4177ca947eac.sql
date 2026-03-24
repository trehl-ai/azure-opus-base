ALTER TABLE public.companies DROP CONSTRAINT companies_source_check;
ALTER TABLE public.companies ADD CONSTRAINT companies_source_check CHECK (source = ANY (ARRAY['manual','csv_import','excel_import','email_intake','referral','website']));

ALTER TABLE public.contacts DROP CONSTRAINT contacts_source_check;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_source_check CHECK (source = ANY (ARRAY['manual','csv_import','excel_import','email_intake','referral','website']));