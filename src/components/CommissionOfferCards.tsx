import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PoundSterling } from "lucide-react";

export function CommissionOfferCards() {
  const { data: offers = [] } = useQuery({
    queryKey: ["university-commission-offers"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("university_commissions")
        .select("id, commission_per_student, highlight_text, university_id, tier_id, universities(name)")
        .eq("is_highlighted", true);
      return data || [];
    },
  });

  const { data: tiers = [] } = useQuery({
    queryKey: ["commission-tiers"],
    queryFn: async () => {
      const { data } = await supabase.from("commission_tiers").select("*");
      return data || [];
    },
  });

  if (offers.length === 0) return null;

  const tierMap = new Map(tiers.map((t: any) => [t.id, t]));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {offers.map((offer: any) => {
        const linkedTier = offer.tier_id ? tierMap.get(offer.tier_id) : null;
        const rate = linkedTier ? Number(linkedTier.commission_per_student) : Number(offer.commission_per_student);
        return (
          <div
            key={offer.id}
            className="relative overflow-hidden rounded-lg border bg-gradient-to-br from-accent/10 to-accent/5 p-4"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-accent/20 p-2">
                <PoundSterling className="h-5 w-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">
                  {offer.universities?.name}
                </p>
                <p className="text-xl font-bold text-accent tabular-nums">
                  £{rate.toLocaleString()}
                  <span className="text-xs font-normal text-muted-foreground ml-1">/student</span>
                </p>
                {offer.highlight_text && (
                  <p className="text-xs text-muted-foreground mt-1">{offer.highlight_text}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
