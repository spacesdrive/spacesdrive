/** Commands about the person: who, what they use, how to reach them. */
import type { SiteData } from '../data.ts';
import { formatDate, formatDuration, heading, keyValue, linkOrText } from '../format.ts';
import { text, type OutputLine, type Part } from '../terminal.ts';
import { field, type Command } from './command.ts';

/** Every field of the profile section that contains `key`. */
function sectionWith(data: SiteData, key: string): { key: string; value: string }[] {
  return data.profile.sections.find((section) => section.fields.some((item) => item.key === key))?.fields ?? [];
}

function fieldLines(fields: { key: string; value: string }[], links = false): OutputLine[] {
  const width = Math.max(...fields.map((item) => item.key.length)) + 4;
  return fields.map((item) => keyValue(item.key, links ? [linkOrText(item.value)] : item.value, width));
}

/** The ASCII portrait for the visitor's colour scheme, each run of equal opacity as one span. */
function portraitLines(data: SiteData): OutputLine[] {
  const light = window.matchMedia('(prefers-color-scheme: light)').matches;
  const portrait = light ? data.portrait.light : data.portrait.dark;
  const lines = portrait.glyphs.map((glyphs, row) => {
    const opacity = portrait.opacity[row] ?? '';
    const parts: Part[] = [];
    for (let i = 0; i < glyphs.length; i++) {
      const level = parseInt(opacity[i] ?? '0', 36) / 10;
      const last = parts[parts.length - 1];
      if (last && last.opacity === level) last.text += glyphs[i];
      else parts.push({ text: glyphs[i] ?? ' ', tone: 'portrait', opacity: level });
    }
    return parts;
  });
  // Rows below the collar fade to nothing on the dark theme; drop them.
  while (lines.length && !lines[lines.length - 1]!.some((part) => part.text.trim())) lines.pop();
  return lines;
}

export const profileCommands: Command[] = [
  {
    name: 'whoami',
    summary: 'Who I am, where I work, what I do',
    run: (_args, data) => [
      [text(data.profile.name, 'accent'), text(` (@${data.profile.login})`, 'muted')],
      keyValue('Host', field(data, 'Host') ?? '-', 8),
      keyValue('Kernel', field(data, 'Kernel') ?? '-', 8),
      keyValue('Web', [linkOrText(field(data, 'Website') ?? '-')], 8),
    ],
  },
  {
    name: 'neofetch',
    summary: 'ASCII portrait with the full system info',
    run: (_args, data) => [
      ...portraitLines(data),
      [],
      [text(data.profile.user, 'accent'), text('@', 'muted'), text(data.profile.host, 'accent')],
      // Titled sections get a divider; untitled ones are separated by a blank line.
      ...data.profile.sections.flatMap((section, index) => [
        ...(section.title ? [heading(section.title)] : index > 0 ? [[]] : []),
        ...fieldLines(section.fields, section.title === 'Contact'),
      ]),
    ],
  },
  {
    name: 'stack',
    summary: 'Frameworks, databases, cloud, DevOps, AI/ML and tools',
    run: (_args, data) => [...fieldLines(sectionWith(data, 'Languages.Programming')), ...fieldLines(sectionWith(data, 'Frameworks'))],
  },
  {
    name: 'contact',
    summary: 'Website, GitHub, LinkedIn, Medium, Instagram (clickable)',
    run: (_args, data) => fieldLines(sectionWith(data, 'Website'), true),
  },
  {
    name: 'uptime',
    summary: 'How long I have been on GitHub',
    run: (_args, data) => {
      const since = new Date(data.profile.createdAt);
      return [
        [text('up ', 'muted'), text(formatDuration(since, new Date()), 'number'), text(` since ${formatDate(data.profile.createdAt)}`, 'muted')],
      ];
    },
  },
];
