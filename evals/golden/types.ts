/**
 * Ground truth for one posting in the golden set.
 *
 * Every field is labelled from the posting TEXT alone, because that is all the
 * model will see. Where a board's card or the tracker says more than the text
 * (e.g. "Berlin, hybrid" on LinkedIn metadata), the label stays 'unspecified'.
 *
 * The enums come from lib/schema.ts, so a label can never use a value the model
 * is not allowed to produce.
 */
import type { Eligible, RemotePolicy, Seniority, SponsorshipStated } from '../../lib/schema';

export interface GoldenLabel {
  file: string;
  company: string;
  role: string;
  seniority: Seniority;
  minYears: number | null;
  remotePolicy: RemotePolicy;
  /** Where the hire may sit when remote. Empty means unrestricted or not applicable. */
  allowedRegions: string[];
  sponsorshipStated: SponsorshipStated;
  relocationStated: boolean;
  /** A required language other than English, or null. */
  languageRequirement: string | null;
  /**
   * Can someone in Egypt, with no EU/UK work rights, be hired on this posting as written?
   * 'ask' = the posting is silent, so eligibility can only be settled by asking the employer.
   */
  eligible: Eligible;
  /** The mistake this posting is in the set to catch, if any. */
  trap?: string;
  /** Verbatim quotes from the posting that justify the non-obvious fields. */
  evidence: string[];
}
