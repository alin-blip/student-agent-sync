export interface CommissionTier {
  id: string;
  tier_name: string;
  min_students: number;
  max_students: number | null;
  commission_per_student: number;
  university_id?: string | null;
}

export interface UniversityCommission {
  university_id: string;
  commission_per_student: number;
  tier_id?: string | null;
}

export function matchTier(
  activeStudentCount: number,
  tiers: CommissionTier[]
): CommissionTier | null {
  const sorted = [...tiers].sort((a, b) => b.min_students - a.min_students);
  for (const tier of sorted) {
    if (
      activeStudentCount >= tier.min_students &&
      (tier.max_students === null || activeStudentCount <= tier.max_students)
    ) {
      return tier;
    }
  }
  return null;
}

export function calcCommission(
  activeStudentCount: number,
  tiers: CommissionTier[]
): { tier: CommissionTier | null; amount: number } {
  const tier = matchTier(activeStudentCount, tiers);
  if (!tier) return { tier: null, amount: 0 };
  return { tier, amount: activeStudentCount * tier.commission_per_student };
}

/**
 * Calculate commission per enrollment using priority:
 * 1. University-specific tiers (volume-based per uni)
 * 2. University custom/linked rate (university_commissions)
 * 3. Global tiers (volume-based across all)
 */
export function calcCommissionByEnrollments(
  enrollments: { university_id: string }[],
  uniCommissions: UniversityCommission[],
  tiers: CommissionTier[]
): number {
  const uniMap = new Map(uniCommissions.map(uc => [uc.university_id, uc]));
  const globalTiers = tiers.filter(t => !t.university_id);
  const tierMap = new Map(tiers.map(t => [t.id, t]));

  // Group enrollments by university
  const countByUni = new Map<string, number>();
  for (const e of enrollments) {
    countByUni.set(e.university_id, (countByUni.get(e.university_id) || 0) + 1);
  }

  let total = 0;
  let globalTierCount = 0;

  for (const [uniId, count] of countByUni) {
    // Priority 1: University-specific tiers
    const uniTiers = tiers.filter(t => t.university_id === uniId);
    if (uniTiers.length > 0) {
      const matched = matchTier(count, uniTiers);
      if (matched) {
        total += count * Number(matched.commission_per_student);
      }
      continue;
    }

    // Priority 2: University commission (custom/linked)
    const uc = uniMap.get(uniId);
    if (uc) {
      if (uc.tier_id) {
        const linkedTier = tierMap.get(uc.tier_id);
        total += count * (linkedTier ? Number(linkedTier.commission_per_student) : Number(uc.commission_per_student));
      } else {
        total += count * Number(uc.commission_per_student);
      }
      continue;
    }

    // Priority 3: Global tiers fallback
    globalTierCount += count;
  }

  if (globalTierCount > 0) {
    const { amount } = calcCommission(globalTierCount, globalTiers);
    total += amount;
  }

  return total;
}

export interface EnrollmentBreakdownItem {
  universityId: string;
  universityName: string;
  count: number;
  ratePerStudent: number;
  subtotal: number;
  rateSource: string;
}

/**
 * Build per-university breakdown for display, with rate source info.
 */
export function buildUniversityBreakdown(
  agentEnrollments: { university_id: string }[],
  uniCommissions: UniversityCommission[],
  tiers: CommissionTier[],
  uniNameMap: Map<string, string>,
  tierMap: Map<string, CommissionTier>
): EnrollmentBreakdownItem[] {
  const uniMap = new Map(uniCommissions.map(uc => [uc.university_id, uc]));
  const globalTiers = tiers.filter(t => !t.university_id);

  const countByUni = new Map<string, number>();
  for (const e of agentEnrollments) {
    countByUni.set(e.university_id, (countByUni.get(e.university_id) || 0) + 1);
  }

  const items: EnrollmentBreakdownItem[] = [];

  for (const [uniId, count] of countByUni) {
    // Priority 1: University-specific tiers
    const uniTiers = tiers.filter(t => t.university_id === uniId);
    if (uniTiers.length > 0) {
      const matched = matchTier(count, uniTiers);
      const rate = matched ? Number(matched.commission_per_student) : 0;
      items.push({
        universityId: uniId,
        universityName: uniNameMap.get(uniId) || uniId,
        count,
        ratePerStudent: rate,
        subtotal: count * rate,
        rateSource: matched ? `Uni Tier: ${matched.tier_name}` : "No tier",
      });
      continue;
    }

    // Priority 2: University commission
    const uc = uniMap.get(uniId);
    if (uc) {
      let rate: number;
      let source: string;
      if (uc.tier_id) {
        const linkedTier = tierMap.get(uc.tier_id);
        rate = linkedTier ? Number(linkedTier.commission_per_student) : Number(uc.commission_per_student);
        source = linkedTier ? `Tier: ${linkedTier.tier_name}` : "Custom";
      } else {
        rate = Number(uc.commission_per_student);
        source = "Custom";
      }
      items.push({
        universityId: uniId,
        universityName: uniNameMap.get(uniId) || uniId,
        count,
        ratePerStudent: rate,
        subtotal: count * rate,
        rateSource: source,
      });
      continue;
    }

    // Priority 3: Global tiers
    // For display, we match based on count at this uni against global tiers
    // (Note: actual calc uses total global count, but for breakdown we show per-uni)
    const matched = matchTier(count, globalTiers);
    const rate = matched ? Number(matched.commission_per_student) : 0;
    items.push({
      universityId: uniId,
      universityName: uniNameMap.get(uniId) || uniId,
      count,
      ratePerStudent: rate,
      subtotal: count * rate,
      rateSource: matched ? `Global: ${matched.tier_name}` : "No tier",
    });
  }

  return items.sort((a, b) => b.subtotal - a.subtotal);
}
