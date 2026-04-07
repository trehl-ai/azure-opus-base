
-- Delete roadshow details for VR Industrie deals
DELETE FROM public.deal_roadshow_details
WHERE deal_id IN (
  SELECT id FROM public.deals WHERE pipeline_id = '3f27d8f5-d7e1-48a8-9c8b-5cc610777634'
);

-- Delete activities for VR Industrie deals
DELETE FROM public.deal_activities
WHERE deal_id IN (
  SELECT id FROM public.deals WHERE pipeline_id = '3f27d8f5-d7e1-48a8-9c8b-5cc610777634'
);

-- Delete entity tags for VR Industrie deals
DELETE FROM public.entity_tags
WHERE entity_type = 'deal' AND entity_id IN (
  SELECT id FROM public.deals WHERE pipeline_id = '3f27d8f5-d7e1-48a8-9c8b-5cc610777634'
);

-- Delete email messages linked to VR Industrie deals
UPDATE public.email_messages SET deal_id = NULL
WHERE deal_id IN (
  SELECT id FROM public.deals WHERE pipeline_id = '3f27d8f5-d7e1-48a8-9c8b-5cc610777634'
);

-- Delete VR Industrie deals
DELETE FROM public.deals WHERE pipeline_id = '3f27d8f5-d7e1-48a8-9c8b-5cc610777634';
