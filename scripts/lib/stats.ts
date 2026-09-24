/**
 * Collects profile statistics from the GitHub GraphQL API.
 *
 * Every query is restricted to public data so the numbers are the same whether
 * the script runs with the workflow's GITHUB_TOKEN or with a personal token.
 */
import type { LanguageShare, RepositorySummary } from '../../site/src/data.ts';
import type { GraphQLClient } from './github.ts';
import type { GitHubStats } from './types.ts';

interface Connection {
  totalCount: number;
}

interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

interface ProfileQuery {
  user: {
    id: string;
    createdAt: string;
    followers: Connection;
    following: Connection;
    repositoriesContributedTo: Connection;
    contributionsCollection: { contributionCalendar: { totalContributions: number } };
  } | null;
  issues: { issueCount: number };
  pullRequests: { issueCount: number };
  mergedPullRequests: { issueCount: number };
}

interface Repository {
  name: string;
  description: string | null;
  url: string;
  homepageUrl: string | null;
  pushedAt: string;
  isFork: boolean;
  stargazerCount: number;
  forkCount: number;
  primaryLanguage: { name: string } | null;
  languages: { edges: { size: number; node: { name: string } }[] };
  defaultBranchRef: { name: string } | null;
}

interface RepositoriesQuery {
  user: {
    repositories: { totalCount: number; pageInfo: PageInfo; nodes: Repository[] };
  };
}

interface CommitNode {
  additions: number;
  deletions: number;
  parents: Connection;
}

interface HistoryQuery {
  repository: {
    defaultBranchRef: {
      target: {
        history?: { totalCount: number; pageInfo: PageInfo; nodes: CommitNode[] };
      };
    } | null;
  } | null;
}

const PROFILE_QUERY = /* GraphQL */ `
  query Profile($login: String!, $issues: String!, $pullRequests: String!, $mergedPullRequests: String!) {
    user(login: $login) {
      id
      createdAt
      followers { totalCount }
      following { totalCount }
      repositoriesContributedTo(
        privacy: PUBLIC
        includeUserRepositories: false
        contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, PULL_REQUEST_REVIEW, REPOSITORY]
      ) { totalCount }
      contributionsCollection { contributionCalendar { totalContributions } }
    }
    issues: search(query: $issues, type: ISSUE) { issueCount }
    pullRequests: search(query: $pullRequests, type: ISSUE) { issueCount }
    mergedPullRequests: search(query: $mergedPullRequests, type: ISSUE) { issueCount }
  }
`;

const REPOSITORIES_QUERY = /* GraphQL */ `
  query Repositories($login: String!, $cursor: String) {
    user(login: $login) {
      repositories(
        first: 100
        after: $cursor
        ownerAffiliations: OWNER
        privacy: PUBLIC
        orderBy: { field: NAME, direction: ASC }
      ) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes {
          name
          description
          url
          homepageUrl
          pushedAt
          isFork
          stargazerCount
          forkCount
          primaryLanguage { name }
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name } } }
          defaultBranchRef { name }
        }
      }
    }
  }
`;

const HISTORY_QUERY = /* GraphQL */ `
  query History($owner: String!, $name: String!, $authorId: ID!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      defaultBranchRef {
        target {
          ... on Commit {
            history(first: 100, after: $cursor, author: { id: $authorId }) {
              totalCount
              pageInfo { hasNextPage endCursor }
              nodes {
                additions
                deletions
                parents { totalCount }
              }
            }
          }
        }
      }
    }
  }
`;

async function fetchRepositories(client: GraphQLClient, login: string): Promise<{ total: number; repositories: Repository[] }> {
  const repositories: Repository[] = [];
  let cursor: string | null = null;
  let total = 0;
  do {
    const data: RepositoriesQuery = await client<RepositoriesQuery>(REPOSITORIES_QUERY, { login, cursor });
    const page = data.user.repositories;
    total = page.totalCount;
    repositories.push(...page.nodes);
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);
  return { total, repositories };
}

interface CommitTotals {
  commits: number;
  linesAdded: number;
  linesDeleted: number;
}

/** Walks the default-branch history of one repository, counting only commits by `authorId`. */
async function fetchCommitTotals(
  client: GraphQLClient,
  owner: string,
  name: string,
  authorId: string,
): Promise<CommitTotals> {
  const totals: CommitTotals = { commits: 0, linesAdded: 0, linesDeleted: 0 };
  let cursor: string | null = null;
  do {
    const data: HistoryQuery = await client<HistoryQuery>(HISTORY_QUERY, { owner, name, authorId, cursor });
    const history = data.repository?.defaultBranchRef?.target.history;
    if (!history) break;
    totals.commits = history.totalCount;
    for (const commit of history.nodes) {
      // Merge commits repeat changes that are already counted on the merged branch.
      if (commit.parents.totalCount > 1) continue;
      totals.linesAdded += commit.additions;
      totals.linesDeleted += commit.deletions;
    }
    cursor = history.pageInfo.hasNextPage ? history.pageInfo.endCursor : null;
  } while (cursor);
  return totals;
}

/** Repositories for the web terminal, most starred first. */
function summariseRepositories(repositories: Repository[]): RepositorySummary[] {
  return repositories
    .map((repo) => ({
      name: repo.name,
      description: repo.description,
      url: repo.url,
      homepage: repo.homepageUrl || null,
      language: repo.primaryLanguage?.name ?? null,
      stars: repo.stargazerCount,
      forks: repo.forkCount,
      pushedAt: repo.pushedAt,
    }))
    .sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name));
}

/** Bytes per language summed across repositories, largest first. */
function totalLanguages(repositories: Repository[]): LanguageShare[] {
  const bytes = new Map<string, number>();
  for (const repo of repositories) {
    for (const { size, node } of repo.languages.edges) bytes.set(node.name, (bytes.get(node.name) ?? 0) + size);
  }
  return [...bytes].map(([name, total]) => ({ name, bytes: total })).sort((a, b) => b.bytes - a.bytes);
}

export async function collectStats(client: GraphQLClient, login: string): Promise<GitHubStats> {
  const search = (qualifiers: string): string => `author:${login} is:public ${qualifiers}`;
  const profile = await client<ProfileQuery>(PROFILE_QUERY, {
    login,
    issues: search('type:issue'),
    pullRequests: search('type:pr'),
    mergedPullRequests: search('type:pr is:merged'),
  });
  const user = profile.user;
  if (!user) throw new Error(`GitHub user "${login}" was not found`);

  const { total: publicRepos, repositories } = await fetchRepositories(client, login);
  const sources = repositories.filter((repo) => !repo.isFork);

  const stats: GitHubStats = {
    login,
    createdAt: new Date(user.createdAt),
    publicRepos,
    contributedRepos: user.repositoriesContributedTo.totalCount,
    stars: sources.reduce((sum, repo) => sum + repo.stargazerCount, 0),
    forks: sources.reduce((sum, repo) => sum + repo.forkCount, 0),
    followers: user.followers.totalCount,
    following: user.following.totalCount,
    commits: 0,
    issues: profile.issues.issueCount,
    pullRequests: profile.pullRequests.issueCount,
    mergedPullRequests: profile.mergedPullRequests.issueCount,
    contributionsLastYear: user.contributionsCollection.contributionCalendar.totalContributions,
    linesAdded: 0,
    linesDeleted: 0,
    repositories: summariseRepositories(sources),
    languages: totalLanguages(sources),
  };

  // Sequential on purpose: parallel history walks trip GitHub's secondary rate limits.
  for (const repo of sources) {
    if (!repo.defaultBranchRef) continue; // empty repository
    const totals = await fetchCommitTotals(client, login, repo.name, user.id);
    stats.commits += totals.commits;
    stats.linesAdded += totals.linesAdded;
    stats.linesDeleted += totals.linesDeleted;
  }

  return stats;
}
