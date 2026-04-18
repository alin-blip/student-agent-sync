import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";

interface OnboardingStep {
  target: string;
  title: string;
  description: string;
  icon: string;
}

const STEPS: OnboardingStep[] = [
  {
    target: "step-sidebar",
    title: "Navigation",
    description: "Use the sidebar to access Students, Enrollments, Messages, Tasks and more.",
    icon: "📌",
  },
  {
    target: "step-promo",
    title: "Promotions",
    description: "Track active promotions and bonuses. Hit your targets to earn extra rewards.",
    icon: "🎯",
  },
  {
    target: "step-commissions",
    title: "Commission Offers",
    description: "See university-specific commission rates. Each card shows what you earn per student.",
    icon: "💰",
  },
  {
    target: "step-stats",
    title: "Your Stats",
    description: "Quick overview of your students, active enrollments, and current commission tier.",
    icon: "📊",
  },
  {
    target: "step-target",
    title: "Monthly Target",
    description: "Track your monthly enrollment progress against your target.",
    icon: "📈",
  },
  {
    target: "step-enrollments",
    title: "Enrollments",
    description: "View all your student enrollments, their status, university and course details.",
    icon: "📋",
  },
  {
    target: "step-new-student",
    title: "Enroll Students",
    description: "Click here to start enrolling a new student.",
    icon: "🎓",
  },
];

const LS_KEY = "onboarding-completed";

interface Props {
  forceOpen?: boolean;
  onClose?: () => void;
}

export function OnboardingWizard({ forceOpen, onClose }: Props) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (forceOpen) {
      setActive(true);
      setStep(0);
      return;
    }
    const done = localStorage.getItem(LS_KEY);
    if (!done) {
      // Small delay so DOM is rendered
      const t = setTimeout(() => setActive(true), 800);
      return () => clearTimeout(t);
    }
  }, [forceOpen]);

  const measure = useCallback(() => {
    if (!active) return;
    const el = document.querySelector(`[data-onboarding="${STEPS[step].target}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      setRect(r);
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      setRect(null);
    }
  }, [step, active]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  const finish = useCallback(() => {
    setActive(false);
    localStorage.setItem(LS_KEY, "true");
    onClose?.();
  }, [onClose]);

  if (!active) return null;

  const pad = 8;
  const cutout = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  // Position card to the right of element if space, otherwise below
  let cardStyle: React.CSSProperties = { position: "fixed", zIndex: 10002 };
  if (cutout) {
    const spaceRight = window.innerWidth - (cutout.left + cutout.width);
    const spaceBottom = window.innerHeight - (cutout.top + cutout.height);

    if (spaceRight > 340) {
      cardStyle.left = cutout.left + cutout.width + 16;
      cardStyle.top = Math.max(16, Math.min(cutout.top, window.innerHeight - 280));
    } else if (spaceBottom > 240) {
      cardStyle.left = Math.max(16, Math.min(cutout.left, window.innerWidth - 340));
      cardStyle.top = cutout.top + cutout.height + 16;
    } else {
      cardStyle.left = Math.max(16, Math.min(cutout.left, window.innerWidth - 340));
      cardStyle.top = Math.max(16, cutout.top - 240);
    }
  } else {
    cardStyle.left = "50%";
    cardStyle.top = "50%";
    cardStyle.transform = "translate(-50%, -50%)";
  }

  return (
    <div className="fixed inset-0 z-[10000]">
      {/* Overlay with cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 10000 }}>
        <defs>
          <mask id="onboarding-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {cutout && (
              <rect
                x={cutout.left}
                y={cutout.top}
                width={cutout.width}
                height={cutout.height}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#onboarding-mask)"
        />
      </svg>

      {/* Highlight border */}
      {cutout && (
        <div
          className="absolute rounded-xl ring-2 ring-primary animate-pulse pointer-events-none"
          style={{
            zIndex: 10001,
            top: cutout.top,
            left: cutout.left,
            width: cutout.width,
            height: cutout.height,
            boxShadow: "0 0 20px hsl(var(--primary) / 0.4), 0 0 40px hsl(var(--primary) / 0.2)",
          }}
        />
      )}

      {/* Explanation card */}
      <div
        ref={cardRef}
        className="w-80 rounded-xl border bg-card p-5 shadow-2xl animate-scale-in"
        style={cardStyle}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{STEPS[step].icon}</span>
            <h3 className="font-semibold text-base text-foreground">{STEPS[step].title}</h3>
          </div>
          <button
            onClick={finish}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          {STEPS[step].description}
        </p>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step
                  ? "w-6 bg-primary"
                  : i < step
                  ? "w-1.5 bg-primary/50"
                  : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={finish}
            className="text-muted-foreground text-xs"
          >
            Skip tour
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="h-3 w-3 mr-1" />
                Back
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button size="sm" onClick={() => setStep(step + 1)}>
                Next
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={finish}>
                <Sparkles className="h-3 w-3 mr-1" />
                Finish
              </Button>
            )}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground/60 text-center mt-3">
          {step + 1} of {STEPS.length}
        </p>
      </div>
    </div>
  );
}
