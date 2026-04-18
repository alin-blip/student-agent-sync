
DROP POLICY "Trigger inserts audit logs" ON public.audit_log;
CREATE POLICY "Only triggers insert audit logs"
  ON public.audit_log FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');
