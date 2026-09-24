/**
 * Boots the web terminal: loads the stats snapshot, wires up the prompt and
 * runs /help on every page load (including reloads).
 */
import { commands, findCommand, usage } from './commands/index.ts';
import type { SiteData } from './data.ts';
import { createTerminal, text } from './terminal.ts';

const screen = document.querySelector<HTMLElement>('#screen');
const output = document.querySelector<HTMLElement>('#output');
const form = document.querySelector<HTMLFormElement>('#prompt');
const input = document.querySelector<HTMLInputElement>('#input');
const promptLabel = document.querySelector<HTMLElement>('#prompt-user');
if (!screen || !output || !form || !input || !promptLabel) throw new Error('Terminal markup is missing');

const terminal = createTerminal(output);
const history: string[] = [];
let historyIndex = 0;
let prompt = 'ujjwal@spacesdrive';
let data: SiteData | null = null;

function run(line: string): void {
  const [name = '', ...args] = line.trim().split(/\s+/);
  terminal.echo(prompt, line);
  if (!name) return;

  const command = findCommand(name);
  if (!command) {
    terminal.print([[text(`command not found: ${name}. Type `, 'error'), text('/help', 'key'), text(' to see every command.', 'error')]]);
  } else if (command.clearsScreen) {
    terminal.clear();
    return;
  } else if (!data) {
    terminal.print([[text('Stats are still loading, try again in a moment.', 'error')]]);
  } else {
    terminal.print(command.run(args, data));
  }
  terminal.print([[]]);
  screen?.scrollTo({ top: screen.scrollHeight });
}

/** Completes a partly typed command name; lists the options when there are several. */
function complete(): void {
  const typed = input!.value.trim().replace(/^\//, '').toLowerCase();
  if (!typed || typed.includes(' ')) return;
  const matches = commands.filter((command) => command.name.startsWith(typed));
  if (matches.length === 1) input!.value = `/${matches[0]!.name} `;
  else if (matches.length > 1) {
    terminal.print([matches.map((command) => text(`${usage(command)}   `, 'key')), []]);
    screen?.scrollTo({ top: screen.scrollHeight });
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const line = input.value;
  input.value = '';
  if (line.trim()) history.push(line);
  historyIndex = history.length;
  run(line);
});

input.addEventListener('keydown', (event) => {
  if (event.key === 'Tab') {
    event.preventDefault();
    complete();
  } else if (event.key === 'ArrowUp' && historyIndex > 0) {
    event.preventDefault();
    input.value = history[--historyIndex] ?? '';
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    historyIndex = Math.min(historyIndex + 1, history.length);
    input.value = history[historyIndex] ?? '';
  } else if (event.key === 'l' && event.ctrlKey) {
    event.preventDefault();
    terminal.clear();
  }
});

// Clicking anywhere focuses the prompt, unless the visitor is selecting text.
screen.addEventListener('click', () => {
  if (!window.getSelection()?.toString()) input.focus();
});

async function start(): Promise<void> {
  try {
    const response = await fetch('data/profile.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = (await response.json()) as SiteData;
    prompt = `${data.profile.user}@${data.profile.host}`;
    promptLabel!.textContent = prompt;
    document.title = `${prompt}: ~`;
  } catch (error) {
    terminal.print([[text(`Could not load stats (${String(error)}). /help and /clear still work.`, 'error')], []]);
  }
  run('/help');
  input!.focus();
}

void start();
