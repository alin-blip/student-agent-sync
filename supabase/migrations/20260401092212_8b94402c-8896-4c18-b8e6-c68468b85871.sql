
DROP TRIGGER IF EXISTS trg_commission_snapshot ON public.enrollments;
CREATE TRIGGER trg_commission_snapshot 
  AFTER UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.create_commission_snapshot();

DROP TRIGGER IF EXISTS audit_commission_snapshots ON public.commission_snapshots;
CREATE TRIGGER audit_commission_snapshots 
  AFTER INSERT OR UPDATE OR DELETE ON public.commission_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_commission_payments ON public.commission_payments;
CREATE TRIGGER audit_commission_payments 
  AFTER INSERT OR UPDATE OR DELETE ON public.commission_payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
