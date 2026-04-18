import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { CheckCircle, DollarSign, Handshake, Lightbulb } from "lucide-react";

export default function ForBusinessPage() {
  return (
    <div className="min-h-screen bg-[#0A1628] text-white">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center text-center px-4 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: "url('/images/hero-dashboard.jpg')" }}></div>
        <div className="relative z-10 max-w-4xl mx-auto space-y-6">
          <h1 className="text-5xl md:text-6xl font-extrabold text-[#D4AF37] leading-tight">
            Add a Revenue Stream Without Lifting a Finger
          </h1>
          <p className="text-xl md:text-2xl text-gray-200">
            Turn Your Network Into a New Income Source. Zero financial effort. Zero additional time.
          </p>
          <Button asChild className="bg-[#D4AF37] text-[#0A1628] hover:bg-[#D4AF37]/90 text-lg px-8 py-6 rounded-full font-semibold transition-all duration-300">
            <Link to="/apply-partner">Apply to Become a Partner</Link>
          </Button>
        </div>
      </section>

      {/* Value Proposition Section */}
      <section className="py-20 px-4 bg-[#0A1628]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <ValuePropCard
            icon={<DollarSign className="w-10 h-10 text-[#D4AF37]" />}
            title="Monetise Your Existing Network"
            description="Leverage your email list, current clients, social media followers, or foot traffic. Your network is a goldmine, let's unlock its potential."
          />
          <ValuePropCard
            icon={<Handshake className="w-10 h-10 text-[#D4AF37]" />}
            title="Zero Investment Required"
            description="No upfront costs, no hiring, no complicated training. Partner with us and start earning without any financial burden."
          />
          <ValuePropCard
            icon={<CheckCircle className="w-10 h-10 text-[#D4AF37]" />}
            title="We Handle Everything"
            description="EduForYou takes care of the entire process: admissions, documentation, and funding applications. You just refer, we do the rest."
          />
          <ValuePropCard
            icon={<Lightbulb className="w-10 h-10 text-[#D4AF37]" />}
            title="Boost Your Cash Flow"
            description="Enjoy recurrent income per referred student, paid automatically. A steady and predictable revenue stream for your business."
          />
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-20 px-4 bg-[#0A1628] text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <h2 className="text-4xl font-bold text-[#D4AF37]">Our Impact in Numbers</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <p className="text-5xl font-extrabold text-white">500+</p>
              <p className="text-lg text-gray-300">Active Partners</p>
            </div>
            <div>
              <p className="text-5xl font-extrabold text-white">10,000+</p>
              <p className="text-lg text-gray-300">Students Enrolled</p>
            </div>
            <div>
              <p className="text-5xl font-extrabold text-white">100+</p>
              <p className="text-lg text-gray-300">UK Universities</p>
            </div>
          </div>
          <p className="text-xl text-gray-200 mt-8">
            Partnering with diverse businesses: Staffing Agencies, Accounting Firms, Law Practices, and more.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-[#0A1628] text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-4xl font-bold text-[#D4AF37]">Ready to Grow Your Business?</h2>
          <p className="text-xl text-gray-200">
            Join our network of successful partners and start transforming lives while boosting your bottom line.
          </p>
          <Button asChild className="bg-[#D4AF37] text-[#0A1628] hover:bg-[#D4AF37]/90 text-lg px-8 py-6 rounded-full font-semibold transition-all duration-300">
            <Link to="/apply-partner">Apply to Become a Partner</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-[#0A1628] text-center text-gray-400 border-t border-gray-800">
        <p>&copy; {new Date().getFullYear()} EduForYou UK. All rights reserved.</p>
      </footer>
    </div>
  );
}

interface ValuePropCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function ValuePropCard({ icon, title, description }: ValuePropCardProps) {
  return (
    <div className="bg-[#0A1628] p-6 rounded-lg shadow-lg border border-gray-800 text-center space-y-4">
      <div className="flex justify-center">{icon}</div>
      <h3 className="text-xl font-semibold text-[#D4AF37]">{title}</h3>
      <p className="text-gray-300">{description}</p>
    </div>
  );
}
