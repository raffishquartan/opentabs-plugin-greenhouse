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
