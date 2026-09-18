/**
 * The postings offered in demo mode. Each one shows a different verdict, so a
 * visitor sees the full range without an API key.
 */
export const DEMO_POSTINGS = [
  {
    id: 'n8n',
    label: 'n8n: sponsors visas, but only to Germany',
    sourceFile: 'n8n_senior_frontend_platform_engineer.txt',
  },
  {
    id: 'personio',
    label: 'Personio: silent on sponsorship',
    sourceFile: 'personio_senior_frontend_engineer_d_f_m_money_team.txt',
  },
  {
    id: 'synthesia',
    label: 'Synthesia: "remote in Europe" through an employer of record',
    sourceFile: 'synthesia_senior_frontend_engineer_marketing_website.txt',
  },
] as const;

export type DemoId = (typeof DEMO_POSTINGS)[number]['id'];
