/**
 * One number for how far the CV covers a posting.
 *
 * Deliberately simple arithmetic rather than a model's opinion: a requirement
 * either has supporting evidence on the CV or it does not, and a required
 * qualification counts for more than a preferred one. Anyone reading the result
 * can recompute it from the list underneath, which is the point. A score nobody
 * can check is worth nothing.
 */
import type { RequirementMatch } from './match-requirements';

/** A missing must-have costs more than a missing nice-to-have. */
export const MUST_HAVE_WEIGHT = 2;
export const NICE_TO_HAVE_WEIGHT = 1;

export type MatchScore = {
  /** 0 to 100, weighted. */
  percentage: number;
  mustHaveCovered: number;
  mustHaveTotal: number;
  niceToHaveCovered: number;
  niceToHaveTotal: number;
};

function covered(matches: RequirementMatch[]): number {
  return matches?.filter((match) => match.evidence.length > 0).length;
}

export function scoreMatch(mustHave: RequirementMatch[], niceToHave: RequirementMatch[]): MatchScore {
  const mustHaveCovered = covered(mustHave);
  const niceToHaveCovered = covered(niceToHave);

  const earned = mustHaveCovered * MUST_HAVE_WEIGHT + niceToHaveCovered * NICE_TO_HAVE_WEIGHT;
  const available = mustHave.length * MUST_HAVE_WEIGHT + niceToHave.length * NICE_TO_HAVE_WEIGHT;

  return {
    // No requirements at all means nothing to score, not a perfect match.
    percentage: available === 0 ? 0 : Math.round((earned / available) * 100),
    mustHaveCovered,
    mustHaveTotal: mustHave.length,
    niceToHaveCovered,
    niceToHaveTotal: niceToHave.length,
  };
}
