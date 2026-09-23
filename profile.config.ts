/**
 * Everything shown on the profile card that is not a live statistic.
 *
 * Edit freely, then run `npm run stats` (or wait for the daily workflow) to
 * re-render the card. Fields that are commented out could not be verified from
 * public sources; uncomment and fill them in to show them.
 */
import { formatDuration, formatMonthYear } from './scripts/lib/format.ts';
import type { ProfileConfig } from './scripts/lib/types.ts';

export const profile: ProfileConfig = {
  login: 'spacesdrive',
  user: 'ujjwal',
  host: 'spacesdrive',
  name: 'Ujjwal Kumar Rai',
  sections: [
    {
      fields: [
        { key: 'OS', value: 'Windows 11' },
        { key: 'Host', value: 'Aevrin, Co-Founder' },
        { key: 'Kernel', value: 'Polymath: builds, breaks, learns, writes' },
        {
          key: 'Uptime',
          value: (stats, now) => `${formatDuration(stats.createdAt, now)} (since ${formatMonthYear(stats.createdAt)})`,
        },
        { key: 'IDE', value: 'VS Code, Claude Code' },
      ],
    },
    {
      fields: [
        { key: 'Languages.Programming', value: 'TypeScript, JavaScript, Python, Java, SQL, Shell' },
        { key: 'Languages.Computer', value: 'HTML, CSS, JSON, YAML, Markdown' },
        // { key: 'Languages.Real', value: '' },
      ],
    },
    {
      fields: [
        { key: 'Frameworks', value: 'React, Vite, Tailwind CSS, shadcn/ui, Express, Hono, FastAPI, Electron' },
        { key: 'Databases', value: 'PostgreSQL (Supabase), MongoDB, Redis (Upstash), Pinecone, SQLite' },
        { key: 'Cloud', value: 'Cloudflare Workers, Supabase, AWS' },
        { key: 'DevOps', value: 'GitHub Actions, CodeQL, Husky, commitlint' },
        { key: 'AI/ML', value: 'PyTorch, scikit-learn, LightGBM, SHAP, RAG (Pinecone + Groq)' },
        { key: 'Tools', value: 'Git, Vitest, Playwright, ESLint, Prettier, Wrangler' },
      ],
    },
    {
      fields: [
        { key: 'Hobbies.Software', value: 'Local-first, privacy-first tools' },
        { key: 'Hobbies.Writing', value: 'Essays on Medium' },
        // { key: 'Hobbies.Hardware', value: '' },
      ],
    },
    {
      title: 'Contact',
      fields: [
        // { key: 'Email', value: '' },
        { key: 'Website', value: 'tech.ujjwal.fyi' },
        { key: 'GitHub', value: 'github.com/spacesdrive' },
        { key: 'LinkedIn', value: 'linkedin.com/in/u-k-r' },
        { key: 'Medium', value: 'medium.com/@ujjwal_kumar_rai' },
        // { key: 'Discord', value: '' },
      ],
    },
  ],
};
