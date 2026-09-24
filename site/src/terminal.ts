/**
 * The terminal screen: prints lines of coloured text and links. Everything is
 * built with DOM nodes and textContent, so data is never parsed as HTML.
 */

export type Tone = 'text' | 'key' | 'muted' | 'accent' | 'number' | 'added' | 'deleted' | 'path' | 'error' | 'portrait';

export interface Part {
  text: string;
  tone?: Tone;
  /** Renders the part as a link. */
  href?: string;
  /** 0..1, used by the ASCII portrait. */
  opacity?: number;
}

export type OutputLine = Part[];

export const text = (value: string, tone: Tone = 'text'): Part => ({ text: value, tone });
export const link = (value: string, href: string): Part => ({ text: value, tone: 'path', href });

export interface Terminal {
  print(lines: OutputLine[]): void;
  /** Shows a command as if it had been typed at the prompt. */
  echo(prompt: string, command: string): void;
  clear(): void;
}

function renderPart(part: Part): HTMLElement {
  const element = document.createElement(part.href ? 'a' : 'span');
  element.textContent = part.text;
  element.className = part.tone ?? 'text';
  if (part.opacity !== undefined) element.style.opacity = String(part.opacity);
  if (element instanceof HTMLAnchorElement && part.href) {
    element.href = part.href;
    element.target = '_blank';
    element.rel = 'noopener noreferrer';
  }
  return element;
}

export function createTerminal(output: HTMLElement): Terminal {
  const addLine = (parts: OutputLine, className = 'line'): void => {
    const line = document.createElement('div');
    line.className = className;
    line.append(...parts.map(renderPart));
    output.append(line);
  };

  return {
    print(lines) {
      for (const parts of lines) addLine(parts);
    },
    echo(prompt, command) {
      addLine([text(prompt, 'key'), text(':', 'muted'), text('~', 'path'), text('$ ', 'muted'), text(command)], 'line command');
    },
    clear() {
      output.replaceChildren();
    },
  };
}
