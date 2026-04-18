
-- Add avatar_url to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Brand settings table (single-row config)
CREATE TABLE public.brand_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_prompt text NOT NULL DEFAULT '',
  logo_url text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages brand settings" ON public.brand_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Authenticated read brand settings" ON public.brand_settings FOR SELECT TO authenticated
  USING (true);

-- Insert default row
INSERT INTO public.brand_settings (brand_prompt) VALUES ('');

-- Generated images table
CREATE TABLE public.generated_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  preset text NOT NULL DEFAULT 'social_post',
  image_path text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own images" ON public.generated_images FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin reads team images" ON public.generated_images FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND (
    user_id = auth.uid() OR user_id IN (SELECT id FROM profiles WHERE admin_id = auth.uid())
  ));

CREATE POLICY "Owner reads all images" ON public.generated_images FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role));

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('brand-assets', 'brand-assets', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('generated-images', 'generated-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Storage RLS policies
CREATE POLICY "Authenticated upload avatars" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "Users delete own avatars" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owner upload brand assets" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'brand-assets' AND has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Public read brand assets" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'brand-assets');

CREATE POLICY "Owner delete brand assets" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'brand-assets' AND has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Authenticated upload generated images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'generated-images');

CREATE POLICY "Public read generated images" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'generated-images');

CREATE POLICY "Users delete own generated images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'generated-images' AND (storage.foldername(name))[1] = auth.uid()::text);
