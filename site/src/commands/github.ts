/** Commands about GitHub activity, read from the daily snapshot. */
import type { RepositorySummary, SiteData } from '../data.ts';
import { bar, countLine, formatDate, formatNumber, keyValue, truncate } from '../format.ts';
import { link, text, type OutputLine } from '../terminal.ts';
import type { Command } from './command.ts';

const snapshotNote = (data: SiteData): OutputLine => [
  text(`snapshot ${formatDate(data.generatedAt)}, refreshed daily`, 'muted'),
];

/** Finds a repository by exact name, then by prefix, ignoring case. */
function findRepository(data: SiteData, name: string): RepositorySummary | undefined {
  const wanted = name.toLowerCase();
  return (
    data.repositories.find((repo) => repo.name.toLowerCase() === wanted) ??
    data.repositories.find((repo) => repo.name.toLowerCase().startsWith(wanted))
  );
}

export const githubCommands: Command[] = [
  {
    name: 'stats',
    summary: 'Every GitHub stat at a glance',
    run: (_args, data) => [
      countLine('Repos', data.stats.publicRepos),
      countLine('Contributed To', data.stats.contributedRepos),
      countLine('Stars', data.stats.stars),
      countLine('Forks', data.stats.forks),
      countLine('Commits', data.stats.commits),
      countLine('Pull Requests', data.stats.pullRequests),
      countLine('Merged PRs', data.stats.mergedPullRequests),
      countLine('Issues', data.stats.issues),
      countLine('Followers', data.stats.followers),
      countLine('Following', data.stats.following),
      countLine('Contributions', data.stats.contributionsLastYear),
      countLine('Lines of Code', data.stats.linesAdded - data.stats.linesDeleted),
      snapshotNote(data),
    ],
  },
  {
    name: 'repos',
    summary: 'Public repositories, most starred first',
    run: (_args, data) => {
      const width = Math.max(...data.repositories.map((repo) => repo.name.length)) + 2;
      return data.repositories.map((repo) => [
        link(repo.name, repo.url),
        text(' '.repeat(width - repo.name.length)),
        text(`★ ${String(repo.stars).padStart(3)}  `, 'number'),
        text((repo.language ?? '-').padEnd(11), 'key'),
        text(truncate(repo.description ?? '', 60), 'muted'),
      ]);
    },
  },
  {
    name: 'repo',
    args: '<name>',
    summary: 'Details of one repository, e.g. /repo luxe',
    run: (args, data) => {
      const name = args[0];
      if (!name) return [[text('usage: /repo <name>   (see /repos for names)', 'error')]];
      const repo = findRepository(data, name);
      if (!repo) return [[text(`no repository called "${name}". Try /repos`, 'error')]];
      return [
        [link(repo.name, repo.url)],
        ...(repo.description ? [[text(repo.description)]] : []),
        [],
        keyValue('Language', repo.language ?? '-', 12),
        keyValue('Stars', [text(formatNumber(repo.stars), 'number')], 12),
        keyValue('Forks', [text(formatNumber(repo.forks), 'number')], 12),
        keyValue('Last push', formatDate(repo.pushedAt), 12),
        keyValue('Code', [link(repo.url, repo.url)], 12),
        ...(repo.homepage ? [keyValue('Live', [link(repo.homepage, repo.homepage)], 12)] : []),
      ];
    },
  },
  {
    name: 'stars',
    summary: 'Stars and forks per repository',
    run: (_args, { repositories, stats }) => {
      const starred = repositories.filter((repo) => repo.stars > 0);
      const most = Math.max(1, ...starred.map((repo) => repo.stars));
      const width = Math.max(...starred.map((repo) => repo.name.length)) + 2;
      return [
        ...starred.map((repo): OutputLine => [
          text(repo.name.padEnd(width), 'key'),
          ...bar(repo.stars / most),
          text(` ★ ${repo.stars}`, 'number'),
          text(`  ⑂ ${repo.forks}`, 'muted'),
        ]),
        [],
        [text('total ', 'muted'), text(`★ ${formatNumber(stats.stars)}`, 'number'), text(`  ⑂ ${formatNumber(stats.forks)}`, 'muted')],
      ];
    },
  },
  {
    name: 'commits',
    summary: 'Commits and lines of code',
    run: (_args, { stats }) => [
      countLine('Commits', stats.commits),
      keyValue('Lines added', [text(`+${formatNumber(stats.linesAdded)}`, 'added')]),
      keyValue('Lines deleted', [text(`-${formatNumber(stats.linesDeleted)}`, 'deleted')]),
      countLine('Net lines', stats.linesAdded - stats.linesDeleted),
      countLine('Lines / commit', Math.round((stats.linesAdded + stats.linesDeleted) / Math.max(stats.commits, 1))),
      [text('merge commits are left out of line counts', 'muted')],
    ],
  },
  {
    name: 'languages',
    summary: 'Languages across my repositories, by size',
    run: (_args, { languages }) => {
      const total = languages.reduce((sum, language) => sum + language.bytes, 0) || 1;
      const width = Math.max(...languages.map((language) => language.name.length)) + 2;
      return languages.map((language) => [
        text(language.name.padEnd(width), 'key'),
        ...bar(language.bytes / total),
        text(` ${((language.bytes / total) * 100).toFixed(1).padStart(5)}%`, 'number'),
      ]);
    },
  },
  {
    name: 'activity',
    summary: 'Contributions, pull requests and issues',
    run: (_args, { stats }) => [
      keyValue('Contributions', [
        text(formatNumber(stats.contributionsLastYear), 'number'),
        text(' in the past year', 'muted'),
      ]),
      countLine('Pull Requests', stats.pullRequests),
      keyValue('Merged', [
        text(formatNumber(stats.mergedPullRequests), 'number'),
        text(` (${Math.round((stats.mergedPullRequests / Math.max(stats.pullRequests, 1)) * 100)}%)`, 'muted'),
      ]),
      countLine('Issues', stats.issues),
      countLine('Contributed To', stats.contributedRepos),
      countLine('Followers', stats.followers),
      countLine('Following', stats.following),
    ],
  },
  {
    name: 'projects',
    summary: 'Live projects you can open',
    run: (_args, data) =>
      data.repositories
        .filter((repo): repo is RepositorySummary & { homepage: string } => repo.homepage !== null)
        .flatMap((repo) => [
          [text(repo.name, 'key'), text('  '), link(repo.homepage, repo.homepage)],
          [text(`  ${truncate(repo.description ?? '', 90)}`, 'muted')],
        ]),
  },
];
