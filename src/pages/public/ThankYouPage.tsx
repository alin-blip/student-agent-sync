import { Link } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ThankYouPage() {
  return (
    <div className="min-h-screen bg-[#0A1628] text-white p-4 flex items-center justify-center">
      <div className="w-full max-w-md bg-card rounded-lg shadow-lg p-8 text-center space-y-6">
        <CheckCircle className="w-24 h-24 text-[#D4AF37] mx-auto" />
        <h1 className="text-3xl font-bold text-[#D4AF37]">Thank You for Your Application!</h1>
        <p className="text-gray-300">
          We have received your application and will review it shortly. We'll get back to you within 48 hours.
        </p>
        <Button asChild className="bg-[#D4AF37] text-[#0A1628] hover:bg-[#D4AF37]/90 text-lg px-8 py-3 rounded-full font-semibold transition-all duration-300">
          <Link to="/">Return to Homepage</Link>
        </Button>
      </div>
    </div>
  );
}
