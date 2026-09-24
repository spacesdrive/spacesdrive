/**
 * Shape of site/data/profile.json: the snapshot the daily workflow writes for
 * the web terminal. Shared by the Node stats script (producer) and the browser
 * (consumer), so this file must stay free of Node and DOM APIs.
 */

export interface RepositorySummary {
  name: string;
  description: string | null;
  url: string;
  homepage: string | null;
  language: string | null;
  stars: number;
  forks: number;
  /** ISO date of the last push. */
  pushedAt: string;
}

export interface LanguageShare {
  name: string;
  /** Bytes of code across owned public repositories. */
  bytes: number;
}

export interface SiteStats {
  publicRepos: number;
  contributedRepos: number;
  stars: number;
  forks: number;
  followers: number;
  following: number;
  commits: number;
  issues: number;
  pullRequests: number;
  mergedPullRequests: number;
  contributionsLastYear: number;
  linesAdded: number;
  linesDeleted: number;
}

export interface SiteData {
  /** ISO timestamp of the snapshot. */
  generatedAt: string;
  profile: {
    name: string;
    login: string;
    user: string;
    host: string;
    /** ISO date the GitHub account was created. */
    createdAt: string;
    sections: { title: string | null; fields: { key: string; value: string }[] }[];
  };
  stats: SiteStats;
  repositories: RepositorySummary[];
  languages: LanguageShare[];
  /** The ASCII portrait shaded for each colour scheme. */
  portrait: { dark: PortraitRows; light: PortraitRows };
}

/** Rows of characters, and one opacity digit (0-9, a = full) per character. */
export interface PortraitRows {
  glyphs: string[];
  opacity: string[];
}
