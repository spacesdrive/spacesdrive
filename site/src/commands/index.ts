/** Every command the terminal understands, plus /help and /clear. */
import { text } from '../terminal.ts';
import type { Command } from './command.ts';
import { githubCommands } from './github.ts';
import { profileCommands } from './profile.ts';

const help: Command = {
  name: 'help',
  summary: 'List every command (this screen)',
  run: () => {
    const width = Math.max(...commands.map((command) => usage(command).length)) + 3;
    return [
      [text('Available commands', 'accent'), text('  (the leading / is optional)', 'muted')],
      [],
      ...commands.map((command) => [text(usage(command).padEnd(width), 'key'), text(command.summary)]),
      [],
      [text('Tab', 'number'), text(' completes a command, ', 'muted'), text('↑ ↓', 'number'), text(' browse history, ', 'muted'), text('Ctrl+L', 'number'), text(' clears', 'muted')],
    ];
  },
};

const clear: Command = {
  name: 'clear',
  summary: 'Clear the screen',
  clearsScreen: true,
  run: () => [],
};

export const commands: Command[] = [help, ...profileCommands, ...githubCommands, clear];

/** `/repo <name>` */
export const usage = (command: Command): string => `/${command.name}${command.args ? ` ${command.args}` : ''}`;

/** Accepts `/stats`, `stats` and `STATS`. */
export const findCommand = (name: string): Command | undefined =>
  commands.find((command) => command.name === name.replace(/^\//, '').toLowerCase());
