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

function decodeHtmlEntities(s: string): string {
  // Greenhouse's `content` field is HTML-entity-escaped (e.g. "&lt;p&gt;...").
  // Decode via a detached textarea: setting innerHTML decodes entities; reading
  // .value yields the resulting text. Falls back to a minimal manual decode if
  // the DOM is unavailable (e.g. in some test contexts).
  if (typeof document !== 'undefined') {
    const ta = document.createElement('textarea');
    ta.innerHTML = s;
    return ta.value;
  }
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

export function htmlToMarkdown(html: string | null | undefined): string {
  if (!html) return '';
  const decoded = decodeHtmlEntities(html);
  return getService().turndown(decoded).trim();
}
