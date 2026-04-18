import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Save, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  student: any;
  existingForm?: any;
}

const EMPTY_FORM = {
  title: "", relationship_status: "", first_name: "", family_name: "",
  date_of_birth: "", nationality: "", town_of_birth: "",
  email: "", phone: "", ni_number: "", current_address: "",
  applied_before: "", applied_before_details: "",
  immigration_status: "", share_code: "", expiry_date: "",
  worked_last_3_months: "", employment_type: "", job_title_company: "",
  address_history_1: "", address_history_2: "", address_history_3: "",
  university_name_address: "", course_name: "", course_length_start: "", year_tuition_fee: "",
  uk_contact_1_name: "", uk_contact_1_relationship: "", uk_contact_1_phone: "", uk_contact_1_address: "",
  uk_contact_2_name: "", uk_contact_2_relationship: "", uk_contact_2_phone: "", uk_contact_2_address: "",
  crn: "", password: "", secret_answer: "",
  spouse_marriage_date: "", spouse_full_name: "", spouse_dob: "", spouse_address: "",
  spouse_phone: "", spouse_email: "", spouse_ni_number: "", spouse_place_of_birth: "",
  spouse_employment_status: "", spouse_has_income: "",
  dependants_info: "",
  consent_full_name: "", consent_date: "",
};

export function StudentFinanceFormDialog({ open, onOpenChange, studentId, student, existingForm }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existingForm) {
      const merged = { ...EMPTY_FORM };
      for (const key of Object.keys(EMPTY_FORM)) {
        if (existingForm[key]) merged[key as keyof typeof EMPTY_FORM] = existingForm[key];
      }
      setForm(merged);
    } else if (student) {
      setForm({
        ...EMPTY_FORM,
        title: student.title || "",
        first_name: student.first_name || "",
        family_name: student.last_name || "",
        date_of_birth: student.date_of_birth || "",
        nationality: student.nationality || "",
        email: student.email || "",
        phone: student.phone || "",
        ni_number: student.ni_number || "",
        current_address: student.full_address || "",
        immigration_status: student.immigration_status || "",
        share_code: student.share_code || "",
        crn: student.crn || "",
      });
    }
  }, [student, existingForm, open]);

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.consent_full_name || !form.consent_date) {
      toast({ title: "Consent required", description: "Please fill in the consent section before saving.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        student_id: studentId,
        agent_id: user!.id,
        method: "platform" as const,
      };

      if (existingForm?.id) {
        const { error } = await supabase.from("student_finance_forms").update(payload).eq("id", existingForm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("student_finance_forms").insert(payload);
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["student-finance-forms", studentId] });
      toast({ title: "Student Finance form saved" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error saving form", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, field, placeholder, textarea }: { label: string; field: string; placeholder?: string; textarea?: boolean }) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {textarea ? (
        <Textarea value={(form as any)[field] || ""} onChange={e => set(field, e.target.value)} placeholder={placeholder} className="text-sm" rows={2} />
      ) : (
        <Input value={(form as any)[field] || ""} onChange={e => set(field, e.target.value)} placeholder={placeholder} className="text-sm h-9" />
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Student Finance Application Form</DialogTitle>
          <DialogDescription>Fill in all sections as they appear on the student's ID and documents.</DialogDescription>
        </DialogHeader>

        <Accordion type="multiple" defaultValue={["personal", "contact", "consent"]} className="w-full">
          {/* PERSONAL DETAILS */}
          <AccordionItem value="personal">
            <AccordionTrigger className="text-sm font-semibold">Personal Details</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Title</Label>
                  <Select value={form.title} onValueChange={v => set("title", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {["Mr", "Mrs", "Miss", "Ms"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Relationship Status</Label>
                  <Select value={form.relationship_status} onValueChange={v => set("relationship_status", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {["Single", "Married", "Civil Partnership", "Divorced", "Widowed", "Separated"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Field label="First Name" field="first_name" />
                <Field label="Family Name" field="family_name" />
                <Field label="Date of Birth" field="date_of_birth" placeholder="DD/MM/YYYY" />
                <Field label="Nationality" field="nationality" />
                <Field label="Town/Village of Birth" field="town_of_birth" />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* CONTACT DETAILS */}
          <AccordionItem value="contact">
            <AccordionTrigger className="text-sm font-semibold">Contact Details</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email Address" field="email" />
                <Field label="Phone Number" field="phone" />
                <Field label="National Insurance Number" field="ni_number" placeholder="e.g. AB123456C" />
                <div className="col-span-2">
                  <Field label="Current Address (House no, street, postcode, country)" field="current_address" textarea />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Applied before to Student Finance?</Label>
                  <Select value={form.applied_before} onValueChange={v => set("applied_before", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YES">YES</SelectItem>
                      <SelectItem value="NO">NO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.applied_before === "YES" && (
                  <div className="col-span-2">
                    <Field label="If YES – course, university, start & end date" field="applied_before_details" textarea />
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* IMMIGRATION STATUS */}
          <AccordionItem value="immigration">
            <AccordionTrigger className="text-sm font-semibold">Immigration Status</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Settled / Pre-settled Status</Label>
                  <Select value={form.immigration_status} onValueChange={v => set("immigration_status", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Settled">Settled</SelectItem>
                      <SelectItem value="Pre-settled">Pre-settled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Field label="Share Code" field="share_code" />
                {form.immigration_status === "Pre-settled" && (
                  <Field label="Expiry Date (if pre-settled)" field="expiry_date" placeholder="DD/MM/YYYY" />
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* EMPLOYMENT */}
          <AccordionItem value="employment">
            <AccordionTrigger className="text-sm font-semibold">Employment Details</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Worked in last 3 months?</Label>
                  <Select value={form.worked_last_3_months} onValueChange={v => set("worked_last_3_months", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YES">YES</SelectItem>
                      <SelectItem value="NO">NO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.worked_last_3_months === "YES" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Employment Type</Label>
                      <Select value={form.employment_type} onValueChange={v => set("employment_type", v)}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Employed">Employed</SelectItem>
                          <SelectItem value="Self-employed">Self-employed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Field label="Job Title & Company Name" field="job_title_company" />
                    </div>
                  </>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ADDRESS HISTORY */}
          <AccordionItem value="address_history">
            <AccordionTrigger className="text-sm font-semibold">Address History (Last 3 Years)</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                <Field label="Address 1 (Full address + From/To dates)" field="address_history_1" textarea />
                <Field label="Address 2 (Full address + From/To dates)" field="address_history_2" textarea />
                <Field label="Address 3 (Full address + From/To dates)" field="address_history_3" textarea />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* UNIVERSITY / COURSE */}
          <AccordionItem value="university">
            <AccordionTrigger className="text-sm font-semibold">University / Course Details</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Field label="University Name & Address" field="university_name_address" textarea /></div>
                <Field label="Full Course Name" field="course_name" />
                <Field label="Course Length & Start Date" field="course_length_start" />
                <Field label="Year of Course & Tuition Fee" field="year_tuition_fee" />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* UK CONTACTS */}
          <AccordionItem value="uk_contacts">
            <AccordionTrigger className="text-sm font-semibold">UK Contacts</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground font-medium">Contact 1</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Name" field="uk_contact_1_name" />
                  <Field label="Relationship" field="uk_contact_1_relationship" />
                  <Field label="Phone" field="uk_contact_1_phone" />
                  <Field label="Address" field="uk_contact_1_address" />
                </div>
                <p className="text-xs text-muted-foreground font-medium">Contact 2</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Name" field="uk_contact_2_name" />
                  <Field label="Relationship" field="uk_contact_2_relationship" />
                  <Field label="Phone" field="uk_contact_2_phone" />
                  <Field label="Address" field="uk_contact_2_address" />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* CRN / PASSWORD */}
          <AccordionItem value="crn">
            <AccordionTrigger className="text-sm font-semibold">CRN / Password / Secret Answer</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Customer Reference Number (CRN)" field="crn" />
                <Field label="Password" field="password" />
                <Field label="Secret Answer" field="secret_answer" />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* FINANCIAL DETAILS (SPOUSE) */}
          <AccordionItem value="financial">
            <AccordionTrigger className="text-sm font-semibold">Financial Details (Supporting Person)</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date of Marriage" field="spouse_marriage_date" placeholder="DD/MM/YYYY" />
                <Field label="Full Name" field="spouse_full_name" />
                <Field label="Date of Birth" field="spouse_dob" placeholder="DD/MM/YYYY" />
                <Field label="Address" field="spouse_address" />
                <Field label="Phone Number" field="spouse_phone" />
                <Field label="Email Address" field="spouse_email" />
                <Field label="National Insurance Number" field="spouse_ni_number" />
                <Field label="Place of Birth" field="spouse_place_of_birth" />
                <div className="space-y-1.5">
                  <Label className="text-xs">Employment Status</Label>
                  <Select value={form.spouse_employment_status} onValueChange={v => set("spouse_employment_status", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Employed">Employed</SelectItem>
                      <SelectItem value="Self-employed">Self-employed</SelectItem>
                      <SelectItem value="Unemployed">Unemployed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Has Income?</Label>
                  <Select value={form.spouse_has_income} onValueChange={v => set("spouse_has_income", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YES">YES</SelectItem>
                      <SelectItem value="NO">NO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* DEPENDANTS */}
          <AccordionItem value="dependants">
            <AccordionTrigger className="text-sm font-semibold">Dependants</AccordionTrigger>
            <AccordionContent>
              <Field label="Children under 16 – Name & Date of Birth" field="dependants_info" textarea />
            </AccordionContent>
          </AccordionItem>

          {/* CONSENT */}
          <AccordionItem value="consent">
            <AccordionTrigger className="text-sm font-semibold">Consent & Authorisation</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  I confirm that all information provided is accurate. I authorise EduForYou to complete and submit my Student Finance application on my behalf and communicate with Student Finance England. I understand my data will be processed in accordance with UK GDPR.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Full Name" field="consent_full_name" />
                  <Field label="Date" field="consent_date" placeholder="DD/MM/YYYY" />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Save Form
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
