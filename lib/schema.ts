/**
 * The contract between the model and the UI.
 *
 * The model fills `Posting`; the UI renders it as it streams; the evals score it
 * against the golden labels. Field order is deliberate: it is the order fields
 * stream in, so the quick classification lands first and the long requirement
 * lists last.
 *
 * Claude structured outputs reject numeric and string constraints (min, max,
 * minLength...), so none are used here. "May be absent" is always `.nullable()`,
 * never `.optional()`: the model must commit to null rather than skip a field.
 */
import { z } from 'zod';

export const SENIORITY = ['mid', 'senior', 'lead', 'staff', 'principal', 'manager', 'unspecified'] as const;
export const REMOTE_POLICY = ['onsite', 'hybrid', 'remote', 'remote-restricted', 'unspecified'] as const;
export const SPONSORSHIP_STATED = ['yes', 'no', 'not-mentioned'] as const;
export const ELIGIBLE = ['yes', 'no', 'ask'] as const;
export const REQUIREMENT_CATEGORY = ['tech', 'experience', 'leadership', 'domain', 'ai', 'language', 'other'] as const;

export type Seniority = (typeof SENIORITY)[number];
export type RemotePolicy = (typeof REMOTE_POLICY)[number];
export type SponsorshipStated = (typeof SPONSORSHIP_STATED)[number];
export type Eligible = (typeof ELIGIBLE)[number];
export type RequirementCategory = (typeof REQUIREMENT_CATEGORY)[number];

export const requirementSchema = z.object({
  text: z
    .string()
    .describe('One requirement, as the posting states it, shortened to a single line. Never add what the posting does not say.'),
  category: z.enum(REQUIREMENT_CATEGORY),
});

export const postingSchema = z.object({
  title: z.string().describe('Job title as written in the posting.'),
  company: z.string().nullable().describe('Hiring company. For an agency posting with an unnamed client, the agency.'),
  seniority: z
    .enum(SENIORITY)
    .describe("Level stated in the title or requirements. 'unspecified' when the posting does not say."),
  // Plain number, not .int(): Zod 4 emits safe-integer minimum/maximum for .int(),
  // which Claude structured outputs reject. The description asks for a whole number.
  minYears: z
    .number()
    .nullable()
    .describe('Minimum years of experience required, as a whole number. Null when not stated.'),
  location: z.string().nullable().describe('Where the role is based, as written.'),
  remotePolicy: z
    .enum(REMOTE_POLICY)
    .describe(
      "'remote-restricted' when remote work is limited to named countries or regions. A perk such as '20 days a year working from anywhere' does not make a role remote.",
    ),
  allowedRegions: z
    .array(z.string())
    .describe('Countries or regions a remote hire must be in. Empty when unrestricted or not applicable.'),
  sponsorshipStated: z
    .enum(SPONSORSHIP_STATED)
    .describe(
      "'yes' only if the posting offers visa sponsorship or work permit support in its own words. 'no' if it rules sponsorship out or requires existing right to work.",
    ),
  sponsorshipEvidence: z
    .string()
    .nullable()
    .describe('The exact sentence from the posting behind sponsorshipStated, copied verbatim. Null when not mentioned.'),
  relocationStated: z.boolean().describe('True only if the posting offers relocation support or a relocation package.'),
  languageRequirement: z
    .string()
    .nullable()
    .describe(
      'A required language other than English, with the level stated. Null if none. A posting written entirely in a local language for a domestic team implies that language.',
    ),
  eligibility: z
    .object({
      reason: z
        .string()
        .describe(
          'One or two sentences on whether a candidate outside the EU/UK with no local work rights could be hired, based only on this posting.',
        ),
      verdict: z
        .enum(ELIGIBLE)
        .describe(
          "'no' if residency, existing right to work, an employer-of-record arrangement or a language requirement rules them out. 'ask' if the posting is silent. Gulf employers sponsor expat hires by default.",
        ),
    })
    .describe('Reason first, then verdict.'),
  mustHave: z.array(requirementSchema).describe('Required qualifications, in posting order.'),
  niceToHave: z.array(requirementSchema).describe('Preferred or bonus qualifications, in posting order.'),
  stack: z.array(z.string()).describe('Named technologies, frameworks and tools, deduplicated.'),
});

export type Requirement = z.infer<typeof requirementSchema>;
export type Posting = z.infer<typeof postingSchema>;
