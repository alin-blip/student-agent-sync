CREATE TABLE public.drive_folder_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  drive_folder_id text NOT NULL,
  parent_drive_folder_id text,
  folder_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_drive_folder_entity ON public.drive_folder_mappings (entity_type, entity_id);

ALTER TABLE public.drive_folder_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages drive mappings"
  ON public.drive_folder_mappings
  FOR ALL
  TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY "Owner reads drive mappings"
  ON public.drive_folder_mappings
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role));