import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export default function ApplyPartnerPage() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [city, setCity] = useState("");
  const [numLocations, setNumLocations] = useState<number | "">("");
  const [numEmployees, setNumEmployees] = useState("");
  const [networkAccess, setNetworkAccess] = useState<string[]>([]);
  const [networkSize, setNetworkSize] = useState("");
  const [motivation, setMotivation] = useState("");
  const [howHeard, setHowHeard] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const networkAccessOptions = [
    "Email List",
    "Current Clients",
    "Social Media Followers",
    "Foot Traffic",
    "Employees",
    "Community Members",
    "Other",
  ];

  const handleNetworkAccessChange = (item: string) => {
    setNetworkAccess((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const { error } = await supabase.from("company_applications").insert({
      company_name: companyName,
      contact_name: contactName,
      email,
      phone,
      company_type: companyType,
      city,
      num_locations: numLocations === "" ? null : numLocations,
      num_employees: numEmployees,
      network_access: networkAccess,
      network_size: networkSize,
      motivation,
      how_heard: howHeard,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Application submitted successfully!" });
      navigate("/apply-partner/thank-you");
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[#0A1628] text-white p-4 flex items-center justify-center">
      <div className="w-full max-w-3xl bg-card rounded-lg shadow-lg p-8 space-y-6">
        <h1 className="text-3xl font-bold text-[#D4AF37] text-center">Partner Application</h1>
        <p className="text-center text-gray-300">Fill out the form below to apply to become an EduForYou partner.</p>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required className="bg-gray-700 border-gray-600 text-white" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactName">Contact Person Name</Label>
            <Input id="contactName" value={contactName} onChange={(e) => setContactName(e.target.value)} required className="bg-gray-700 border-gray-600 text-white" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-gray-700 border-gray-600 text-white" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-gray-700 border-gray-600 text-white" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyType">Company Type</Label>
            <Input id="companyType" value={companyType} onChange={(e) => setCompanyType(e.target.value)} placeholder="e.g., Staffing Agency, Accounting Firm" className="bg-gray-700 border-gray-600 text-white" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} className="bg-gray-700 border-gray-600 text-white" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="numLocations">Number of Physical Locations</Label>
            <Input id="numLocations" type="number" value={numLocations} onChange={(e) => setNumLocations(parseInt(e.target.value))} className="bg-gray-700 border-gray-600 text-white" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="numEmployees">Number of Employees</Label>
            <Select onValueChange={setNumEmployees} value={numEmployees}>
              <SelectTrigger className="w-full bg-gray-700 border-gray-600 text-white">
                <SelectValue placeholder="Select number of employees" />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 text-white">
                <SelectItem value="1-5">1-5</SelectItem>
                <SelectItem value="6-20">6-20</SelectItem>
                <SelectItem value="21-50">21-50</SelectItem>
                <SelectItem value="51-200">51-200</SelectItem>
                <SelectItem value="200+">200+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>How do you access your network?</Label>
            <div className="grid grid-cols-2 gap-2">
              {networkAccessOptions.map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <Checkbox
                    id={option}
                    checked={networkAccess.includes(option)}
                    onCheckedChange={() => handleNetworkAccessChange(option)}
                    className="border-gray-400 data-[state=checked]:bg-[#D4AF37] data-[state=checked]:text-[#0A1628]"
                  />
                  <Label htmlFor={option} className="text-gray-300">{option}</Label>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="networkSize">Estimated Network Size</Label>
            <Input id="networkSize" value={networkSize} onChange={(e) => setNetworkSize(e.target.value)} placeholder="e.g., 1,000+ contacts" className="bg-gray-700 border-gray-600 text-white" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="motivation">What motivates you to partner with EduForYou?</Label>
            <Textarea id="motivation" value={motivation} onChange={(e) => setMotivation(e.target.value)} rows={3} className="bg-gray-700 border-gray-600 text-white" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="howHeard">How did you hear about us?</Label>
            <Input id="howHeard" value={howHeard} onChange={(e) => setHowHeard(e.target.value)} className="bg-gray-700 border-gray-600 text-white" />
          </div>
          <Button type="submit" className="w-full md:col-span-2 bg-[#D4AF37] text-[#0A1628] hover:bg-[#D4AF37]/90 text-lg py-3 font-semibold transition-all duration-300" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Application"}
          </Button>
        </form>
      </div>
    </div>
  );
}
