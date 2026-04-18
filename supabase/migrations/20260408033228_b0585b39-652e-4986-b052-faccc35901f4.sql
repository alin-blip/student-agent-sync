
-- =============================================
-- BILLING DETAILS TABLE
-- =============================================
CREATE TABLE public.billing_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_holder_name text,
  sort_code text,
  account_number text,
  iban text,
  swift_bic text,
  bank_name text,
  is_company boolean NOT NULL DEFAULT false,
  company_name text,
  company_number text,
  company_address text,
  vat_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_details_user_id_key UNIQUE (user_id)
);

ALTER TABLE public.billing_details ENABLE ROW LEVEL SECURITY;

-- Users read/update own billing details
CREATE POLICY "Users read own billing details"
  ON public.billing_details FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own billing details"
  ON public.billing_details FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own billing details"
  ON public.billing_details FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Owner sees all (needed for invoice approval)
CREATE POLICY "Owner manages all billing details"
  ON public.billing_details FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Updated_at trigger
CREATE TRIGGER update_billing_details_updated_at
  BEFORE UPDATE ON public.billing_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- INVOICE REQUESTS TABLE
-- =============================================
CREATE TABLE public.invoice_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  snapshot_id uuid NOT NULL REFERENCES public.commission_snapshots(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'submitted',
  invoice_number text,
  notes text,
  owner_notes text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_requests ENABLE ROW LEVEL SECURITY;

-- STRICT ISOLATION: users see ONLY their own invoices
CREATE POLICY "Users read own invoices"
  ON public.invoice_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid());

CREATE POLICY "Users insert own invoices"
  ON public.invoice_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());

-- Owner full access
CREATE POLICY "Owner manages all invoices"
  ON public.invoice_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Updated_at trigger
CREATE TRIGGER update_invoice_requests_updated_at
  BEFORE UPDATE ON public.invoice_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generate invoice_number on insert
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  _seq int;
BEGIN
  SELECT count(*) + 1 INTO _seq FROM public.invoice_requests WHERE created_at::date = now()::date;
  NEW.invoice_number := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(_seq::text, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_invoice_number_trigger
  BEFORE INSERT ON public.invoice_requests
  FOR EACH ROW EXECUTE FUNCTION public.generate_invoice_number();
