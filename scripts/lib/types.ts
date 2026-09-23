/** Live numbers pulled from the GitHub API. Everything here may change between runs. */
export interface GitHubStats {
  login: string;
  createdAt: Date;
  publicRepos: number;
  /** Public repositories owned by someone else that received a contribution. */
  contributedRepos: number;
  /** Stars across owned, public, non-fork repositories. */
  stars: number;
  /** Forks across owned, public, non-fork repositories. */
  forks: number;
  followers: number;
  following: number;
  /** Commits authored on the default branches of owned, public, non-fork repositories. */
  commits: number;
  issues: number;
  pullRequests: number;
  mergedPullRequests: number;
  /** Total from the public contribution calendar (rolling 12 months). */
  contributionsLastYear: number;
  /** Line counts from the same commits as `commits`, excluding merge commits. */
  linesAdded: number;
  linesDeleted: number;
}

/** A value on the card: fixed text, or text derived from the live stats. */
export type FieldValue = string | ((stats: GitHubStats, now: Date) => string);

export interface ProfileField {
  key: string;
  value: FieldValue;
}

export interface ProfileSection {
  /** Rendered as a divider line; untitled sections are separated by a blank line. */
  title?: string;
  fields: ProfileField[];
}

export interface ProfileConfig {
  /** GitHub username whose stats are collected. */
  login: string;
  /** The `user@host` heading shown on the card and in the prompt. */
  user: string;
  host: string;
  /** Full name, used in the image alt text. */
  name: string;
  sections: ProfileSection[];
}
