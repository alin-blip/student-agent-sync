import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Users, GraduationCap, BarChart3, Bot, CreditCard, IdCard,
  ChevronRight, CheckCircle2, Star, Menu, X, ArrowRight,
  Clock, AlertTriangle, FolderSearch, Mail, Phone
} from "lucide-react";
import heroDashboard from "@/assets/hero-dashboard.jpg";
import patternBg from "@/assets/pattern-bg.jpg";

/* ───── scroll-fade hook ───── */
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add("opacity-100", "translate-y-0"); el.classList.remove("opacity-0", "translate-y-8"); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

const Section = ({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) => {
  const ref = useFadeIn();
  return (
    <section id={id} ref={ref} className={`opacity-0 translate-y-8 transition-all duration-700 ease-out ${className}`}>
      {children}
    </section>
  );
};

/* ───── data ───── */
const features = [
  { icon: Users, title: "Agent Management", desc: "Onboard, monitor and scale your agent network from a single dashboard. Track performance, assign students, manage commissions — all in one place.", value: "£2,997" },
  { icon: GraduationCap, title: "Student Tracking", desc: "Complete student lifecycle management. From first contact through enrollment, funding, and graduation — never lose track of a student again.", value: "£1,997" },
  { icon: BarChart3, title: "Enrollment Pipeline", desc: "Visual pipeline with real-time status updates. Know exactly where every application stands and what needs attention next.", value: "£1,497" },
  { icon: CreditCard, title: "Commission Engine", desc: "Automated tiered commission calculations by university. Transparent payouts that eliminate disputes and keep agents motivated.", value: "£2,497" },
  { icon: Bot, title: "AI Assistant", desc: "Built-in AI that knows your knowledge base, answers agent questions, generates content, and handles repetitive tasks so you don't have to.", value: "£3,997" },
  { icon: IdCard, title: "Digital Agent Cards", desc: "Branded digital business cards for every agent. QR codes, social links, booking integration — a professional first impression every time.", value: "£997" },
];

const painPoints = [
  { icon: FolderSearch, title: "Scattered Student Data", desc: "Spreadsheets, emails, WhatsApp messages — student information is everywhere except where you need it." },
  { icon: AlertTriangle, title: "Commission Disputes", desc: "Manual calculations lead to errors, late payments, and agents who lose trust in your business." },
  { icon: Clock, title: "Manual Tracking Chaos", desc: "Hours wasted on status updates, follow-ups, and reports that should be automatic." },
];

const testimonials = [
  { name: "Sarah Mitchell", role: "Agency Owner, London", text: "EduForYou transformed how we manage 50+ agents. What used to take a full-time admin now runs itself. Our enrollment rate increased 3x in 6 months.", stars: 5 },
  { name: "James Okafor", role: "Senior Agent, Manchester", text: "The digital card alone brought me 20 extra leads last quarter. The dashboard makes me feel like I'm running a real business, not just freelancing.", stars: 5 },
  { name: "Priya Sharma", role: "Admin Manager, Birmingham", text: "Finally, commission calculations I can trust. No more spreadsheets, no more arguments. The agents are happier and I sleep better at night.", stars: 5 },
];

const steps = [
  { num: "01", title: "Sign Up", desc: "Create your agency account in under 2 minutes. No credit card required." },
  { num: "02", title: "Add Your Team", desc: "Invite admins and agents. They get their own dashboard, digital card, and AI assistant instantly." },
  { num: "03", title: "Scale Enrollments", desc: "Track students, manage pipelines, automate commissions — and watch your agency grow." },
];

/* ───── component ───── */
const Index = () => {
  const [mobileMenu, setMobileMenu] = useState(false);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenu(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden">

      {/* ═══ NAVBAR ═══ */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-primary/95 backdrop-blur-md border-b border-primary/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          {/* Logo */}
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-accent-foreground" />
            </div>
            <span className="text-lg font-bold text-primary-foreground tracking-tight">
              Edu<span className="text-accent">ForYou</span>
            </span>
          </button>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {["features", "how-it-works", "pricing", "contact"].map((s) => (
              <button key={s} onClick={() => scrollTo(s)} className="text-sm text-primary-foreground/70 hover:text-accent transition-colors capitalize">
                {s.replace("-", " ")}
              </button>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10">
                Log In
              </Button>
            </Link>
            <Button onClick={() => scrollTo("contact")} className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/25">
              Contact Us <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {/* Mobile toggle */}
          <button onClick={() => setMobileMenu(!mobileMenu)} className="md:hidden text-primary-foreground">
            {mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenu && (
          <div className="md:hidden bg-primary border-t border-primary-foreground/10 px-4 pb-4 space-y-2">
            {["features", "how-it-works", "pricing", "contact"].map((s) => (
              <button key={s} onClick={() => scrollTo(s)} className="block w-full text-left py-2 text-primary-foreground/80 hover:text-accent capitalize">
                {s.replace("-", " ")}
              </button>
            ))}
            <div className="flex gap-2 pt-2">
              <Link to="/login" className="flex-1">
                <Button variant="outline" className="w-full border-primary-foreground/20 text-primary-foreground">Log In</Button>
              </Link>
              <Button onClick={() => scrollTo("contact")} className="flex-1 bg-accent text-accent-foreground">Contact Us</Button>
            </div>
          </div>
        )}
      </nav>

      {/* ═══ HERO ═══ */}
      <header className="relative pt-16 bg-primary overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-[hsl(220,50%,16%)]" />
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 bg-[radial-gradient(circle_at_70%_30%,hsl(24,95%,53%)_0%,transparent_60%)]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 bg-accent/15 border border-accent/30 rounded-full px-4 py-1.5 text-sm text-accent font-medium">
                <Star className="w-4 h-4 fill-accent" /> #1 Platform for Education Agencies in the UK
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-primary-foreground leading-[1.1] tracking-tight">
                Manage Your Education Agency{" "}
                <span className="text-accent">Like a Machine</span>
              </h1>

              <p className="text-lg sm:text-xl text-primary-foreground/70 max-w-lg leading-relaxed">
                Stop drowning in spreadsheets. EduForYou gives you one powerful dashboard to manage agents, track students, automate commissions, and scale enrollments — <span className="text-accent font-semibold">without hiring more staff</span>.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button onClick={() => scrollTo("contact")} size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-xl shadow-accent/30 text-base px-8 h-13">
                  Start Free — No Card Required <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
                <Link to="/login">
                  <Button variant="outline" size="lg" className="border-primary-foreground/20 text-primary-foreground text-base px-8 h-13 w-full sm:w-auto bg-accent">
                    Log In to Dashboard
                  </Button>
                </Link>
              </div>

              <div className="flex items-center gap-6 text-sm text-primary-foreground/50">
                <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-accent" /> Free to start</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-accent" /> No setup fees</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-accent" /> Cancel anytime</span>
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="absolute -inset-4 bg-accent/20 rounded-2xl blur-3xl" />
              <img
                src={heroDashboard}
                alt="EduForYou agent management dashboard showing student enrollment tracking and commission analytics"
                width={1920}
                height={1080}
                className="relative rounded-xl shadow-2xl shadow-black/40 border border-primary-foreground/10"
              />
            </div>
          </div>
        </div>
      </header>

      {/* ═══ SOCIAL PROOF BAR ═══ */}
      <div className="bg-accent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            ["500+", "Active Agents"],
            ["10,000+", "Students Enrolled"],
            ["50+", "Partner Universities"],
            ["98%", "Agent Satisfaction"],
          ].map(([num, label]) => (
            <div key={label}>
              <div className="text-2xl sm:text-3xl font-bold text-accent-foreground">{num}</div>
              <div className="text-sm text-accent-foreground/80">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ PROBLEM / AGITATE ═══ */}
      <Section className="py-20 lg:py-28 bg-background" id="problems">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center space-y-16">
          <div className="max-w-2xl mx-auto space-y-4">
            <p className="text-sm font-semibold text-accent uppercase tracking-widest">The Problem</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Running an Education Agency <span className="text-accent">Shouldn't Feel Like This</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              If any of these sound familiar, you're not alone — and you're leaving money on the table.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {painPoints.map((p) => (
              <div key={p.title} className="group bg-card border border-border rounded-xl p-8 hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 transition-all duration-300">
                <div className="w-14 h-14 rounded-xl bg-destructive/10 flex items-center justify-center mb-6 group-hover:bg-accent/10 transition-colors">
                  <p.icon className="w-7 h-7 text-destructive group-hover:text-accent transition-colors" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">{p.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ═══ FEATURES ═══ */}
      <Section className="py-20 lg:py-28 bg-secondary/50" id="features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <p className="text-sm font-semibold text-accent uppercase tracking-widest">Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Everything You Need to <span className="text-accent">Dominate</span> Student Recruitment
            </h2>
            <p className="text-muted-foreground text-lg">
              Built by agency owners, for agency owners. Every feature solves a real problem.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f) => (
              <div key={f.title} className="group bg-card border border-border rounded-xl p-8 hover:border-accent/40 hover:shadow-xl hover:shadow-accent/5 transition-all duration-300 hover:-translate-y-1">
                <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mb-6 group-hover:bg-accent group-hover:shadow-lg group-hover:shadow-accent/25 transition-all">
                  <f.icon className="w-7 h-7 text-accent group-hover:text-accent-foreground transition-colors" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ═══ HOW IT WORKS ═══ */}
      <Section className="py-20 lg:py-28 bg-background" id="how-it-works">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <p className="text-sm font-semibold text-accent uppercase tracking-widest">How It Works</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Set Up in <span className="text-accent">Minutes</span>, Not Weeks
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-16 left-[16.6%] right-[16.6%] h-0.5 bg-gradient-to-r from-accent/40 via-accent to-accent/40" />

            {steps.map((s) => (
              <div key={s.num} className="relative text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-2xl font-bold shadow-lg shadow-accent/25 relative z-10">
                  {s.num}
                </div>
                <h3 className="text-xl font-semibold text-foreground">{s.title}</h3>
                <p className="text-muted-foreground max-w-xs mx-auto">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ═══ VALUE STACK (HORMOZI) ═══ */}
      <Section
        className="py-20 lg:py-28 relative"
        id="pricing"
      >
        <div className="absolute inset-0">
          <img src={patternBg} alt="" className="w-full h-full object-cover" loading="lazy" width={1920} height={640} />
          <div className="absolute inset-0 bg-primary/95" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center space-y-4">
            <p className="text-sm font-semibold text-accent uppercase tracking-widest">The Offer</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground">
              Everything You Get <span className="text-accent">When You Join</span>
            </h2>
            <p className="text-primary-foreground/60 text-lg max-w-xl mx-auto">
              We've packaged everything an education agency needs into one platform. Here's what that's worth:
            </p>
          </div>

          <div className="bg-primary-foreground/5 border border-primary-foreground/10 rounded-2xl p-8 sm:p-12 space-y-6">
            {features.map((f) => (
              <div key={f.title} className="flex items-center justify-between py-3 border-b border-primary-foreground/10 last:border-0">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                  <span className="text-primary-foreground font-medium">{f.title}</span>
                </div>
                <span className="text-primary-foreground/40 line-through text-sm">{f.value}/yr</span>
              </div>
            ))}

            <div className="pt-6 border-t border-accent/30 text-center space-y-4">
              <div>
                <p className="text-primary-foreground/50 text-sm">Total Value:</p>
                <p className="text-3xl font-bold text-primary-foreground/40 line-through">£13,982/yr</p>
              </div>
              <div>
                <p className="text-accent text-sm font-semibold">What You Pay Today:</p>
                <p className="text-5xl font-bold text-accent">FREE</p>
                <p className="text-primary-foreground/50 text-sm mt-1">to get started — upgrade as you grow</p>
              </div>

              <Button onClick={() => scrollTo("contact")} size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-xl shadow-accent/30 text-lg px-12 h-14 mt-4">
                Get Started Now — It's Free <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══ TESTIMONIALS ═══ */}
      <Section className="py-20 lg:py-28 bg-background" id="testimonials">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <p className="text-sm font-semibold text-accent uppercase tracking-widest">Testimonials</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Trusted by Agency Owners <span className="text-accent">Across the UK</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-card border border-border rounded-xl p-8 space-y-4 hover:shadow-lg transition-shadow">
                <div className="flex gap-1">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-foreground leading-relaxed italic">"{t.text}"</p>
                <div className="pt-4 border-t border-border">
                  <p className="font-semibold text-foreground">{t.name}</p>
                  <p className="text-sm text-muted-foreground">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ═══ CONTACT / FINAL CTA ═══ */}
      <Section className="py-20 lg:py-28 bg-primary relative overflow-hidden" id="contact">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-[hsl(220,50%,16%)]" />
        <div className="absolute bottom-0 left-0 w-full h-1/2 opacity-5 bg-[radial-gradient(circle_at_30%_100%,hsl(24,95%,53%)_0%,transparent_50%)]" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center space-y-6 mb-12">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary-foreground">
              Ready to <span className="text-accent">Scale Your Agency</span>?
            </h2>
            <p className="text-lg text-primary-foreground/60 max-w-xl mx-auto">
              Whether you're managing 5 agents or 500, EduForYou grows with you. Get in touch to see how we can help.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Contact info */}
            <div className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-primary-foreground">Get In Touch</h3>
                <p className="text-primary-foreground/60">
                  Interested in partnering with us or want a demo? Reach out and we'll get back to you within 24 hours.
                </p>
              </div>
              <div className="space-y-4">
                <a href="mailto:info@eduforyou.co.uk" className="flex items-center gap-3 text-primary-foreground/70 hover:text-accent transition-colors">
                  <Mail className="w-5 h-5 text-accent" />
                  info@eduforyou.co.uk
                </a>
                <a href="tel:+447000000000" className="flex items-center gap-3 text-primary-foreground/70 hover:text-accent transition-colors">
                  <Phone className="w-5 h-5 text-accent" />
                  +44 7000 000 000
                </a>
              </div>
              <div className="pt-4">
                <Link to="/login">
                  <Button variant="outline" size="lg" className="text-primary-foreground border-primary bg-accent">
                    Already have an account? Log In
                  </Button>
                </Link>
              </div>
            </div>

            {/* Contact form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const mailto = `mailto:info@eduforyou.co.uk?subject=Partnership Inquiry from ${fd.get("name")}&body=${fd.get("message")}%0A%0AFrom: ${fd.get("name")}%0AEmail: ${fd.get("email")}`;
                window.location.href = mailto;
              }}
              className="bg-primary-foreground/5 border border-primary-foreground/10 rounded-xl p-8 space-y-5"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium text-primary-foreground">Full Name</label>
                <input name="name" required placeholder="John Smith" className="w-full h-11 px-4 rounded-lg bg-primary-foreground/10 border border-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/30 focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-primary-foreground">Email</label>
                <input name="email" type="email" required placeholder="john@agency.co.uk" className="w-full h-11 px-4 rounded-lg bg-primary-foreground/10 border border-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/30 focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-primary-foreground">Message</label>
                <textarea name="message" required rows={4} placeholder="Tell us about your agency and how we can help..." className="w-full px-4 py-3 rounded-lg bg-primary-foreground/10 border border-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/30 focus:outline-none focus:ring-2 focus:ring-accent resize-none" />
              </div>
              <Button type="submit" size="lg" className="w-full bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/25 text-base h-12">
                Send Message <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>
          </div>
        </div>
      </Section>

      {/* ═══ FOOTER ═══ */}
      <footer className="bg-[hsl(220,65%,7%)] border-t border-primary-foreground/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-accent-foreground" />
              </div>
              <span className="text-lg font-bold text-primary-foreground tracking-tight">
                Edu<span className="text-accent">ForYou</span>
              </span>
            </div>

            <div className="flex items-center gap-6 text-sm text-primary-foreground/40">
              <button onClick={() => scrollTo("features")} className="hover:text-accent transition-colors">Features</button>
              <button onClick={() => scrollTo("pricing")} className="hover:text-accent transition-colors">Pricing</button>
              <button onClick={() => scrollTo("contact")} className="hover:text-accent transition-colors">Contact</button>
              <Link to="/login" className="hover:text-accent transition-colors">Login</Link>
            </div>

            <p className="text-sm text-primary-foreground/30">
              © {new Date().getFullYear()} EduForYou. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
