// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import TurndownService from 'turndown';

let cached: TurndownService | null = null;

function getService(): TurndownService {
  if (!cached) {
    cached = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '*',
    });
    cached.remove(['script', 'style']);
  }
  return cached;
}

export function htmlToMarkdown(html: string | null | undefined): string {
  if (!html) return '';
  return getService().turndown(html).trim();
}
