// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

export interface ResolveBoardTokenInput {
  board?: string;
  currentUrl?: string;
}

const TOKEN_RE = /^[a-z0-9_-]+$/;
const KNOWN_HOSTS = new Set(['boards.greenhouse.io', 'job-boards.greenhouse.io', 'job-boards.eu.greenhouse.io']);

function tryExtractFromUrl(s: string): string | null {
  try {
    const u = new URL(s);
    if (!KNOWN_HOSTS.has(u.hostname)) return null;
    const segs = u.pathname.split('/').filter(Boolean);
    return segs[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Derive the Greenhouse host (origin) to scrape against. Prefers the host of
 * an explicit `board` URL, then the current tab URL, then a US-host default.
 * Cross-host fetches are blocked by page CSP at runtime, so the host the
 * scraper uses must match the active tab — getting this wrong is the most
 * common cause of "Failed to fetch" in production.
 */
export function resolveBoardHost(input: ResolveBoardTokenInput): string {
  if (input.board?.includes('://')) {
    try {
      const u = new URL(input.board);
      if (KNOWN_HOSTS.has(u.hostname)) return `https://${u.hostname}`;
    } catch {
      /* fall through */
    }
  }
  if (input.currentUrl) {
    try {
      const u = new URL(input.currentUrl);
      if (KNOWN_HOSTS.has(u.hostname)) return `https://${u.hostname}`;
    } catch {
      /* fall through */
    }
  }
  return 'https://job-boards.greenhouse.io';
}

export function resolveBoardToken(input: ResolveBoardTokenInput): string {
  if (input.board) {
    if (input.board.includes('://')) {
      const tok = tryExtractFromUrl(input.board);
      if (tok && TOKEN_RE.test(tok)) return tok;
      throw new Error(`invalid board: ${input.board}`);
    }
    if (TOKEN_RE.test(input.board)) return input.board;
    throw new Error(`invalid board token: ${JSON.stringify(input.board)}`);
  }
  if (input.currentUrl) {
    const tok = tryExtractFromUrl(input.currentUrl);
    if (tok && TOKEN_RE.test(tok)) return tok;
  }
  throw new Error('no board specified and current tab is not a Greenhouse board page');
}
