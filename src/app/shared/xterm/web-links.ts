import {WebLinksAddon} from "@xterm/addon-web-links";
import {open} from "@tauri-apps/plugin-shell";
import {noop} from "rxjs";

const allowedSchemes = new Set(['https', 'http', 'mailto']);

/** Links inside terminal output can come from the TV, so only web links open. */
export function openWebLink(uri: string): Promise<void> {
  let scheme: string | undefined;
  try {
    scheme = new URL(uri).protocol.replace(':', '').toLowerCase();
  } catch {
    scheme = undefined;
  }
  if (!scheme || !allowedSchemes.has(scheme)) {
    console.warn('Refusing to open non-web link', scheme);
    return Promise.resolve();
  }
  return open(uri).catch(error => {
    console.warn('Failed to open link', error);
    window.open(uri, '_blank');
  });
}

export class AppWebLinksAddon extends WebLinksAddon {
  constructor() {
    super((event, uri) => {
      event.preventDefault();
      openWebLink(uri).then(noop);
    });
  }
}
