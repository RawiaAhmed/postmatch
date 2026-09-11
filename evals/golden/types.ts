/**
 * Ground truth for one posting in the golden set.
 *
 * Every field is labelled from the posting TEXT alone, because that is all the
 * model will see. Where a board's card or the tracker says more than the text
 * (e.g. "Berlin, hybrid" on LinkedIn metadata), the label stays 'unspecified'.
 */

export type Seniority = 'mid' | 'senior' | 'lead' | 'staff' | 'principal' | 'manager' | 'unspecified';

export type RemotePolicy =
  | 'onsite'
  | 'hybrid'
  | 'remote' //            no location restriction stated
  | 'remote-restricted' // remote, but only from named countries or regions
  | 'unspecified';

export type SponsorshipStated = 'yes' | 'no' | 'not-mentioned';

/**
 * Can someone in Egypt, with no EU/UK work rights, be hired on this posting as written?
 * 'ask' = the posting is silent, so eligibility can only be settled by asking the employer.
 */
export type Eligible = 'yes' | 'no' | 'ask';

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
  eligible: Eligible;
  /** The mistake this posting is in the set to catch, if any. */
  trap?: string;
  /** Verbatim quotes from the posting that justify the non-obvious fields. */
  evidence: string[];
}
