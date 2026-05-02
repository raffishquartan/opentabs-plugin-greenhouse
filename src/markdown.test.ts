// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { describe, it, expect } from 'vitest';
import { htmlToMarkdown } from './markdown.js';

describe('htmlToMarkdown', () => {
  it('returns empty string for empty input', () => {
    expect(htmlToMarkdown('')).toBe('');
  });

  it('returns empty string for null/undefined input', () => {
    expect(htmlToMarkdown(null)).toBe('');
    expect(htmlToMarkdown(undefined)).toBe('');
  });

  it('converts a simple paragraph', () => {
    expect(htmlToMarkdown('<p>Hello world</p>')).toBe('Hello world');
  });

  it('converts headings to atx style', () => {
    expect(htmlToMarkdown('<h2>About the role</h2>')).toBe('## About the role');
  });

  it('converts a bullet list', () => {
    const md = htmlToMarkdown('<ul><li>One</li><li>Two</li></ul>');
    expect(md).toMatch(/^-\s+One/m);
    expect(md).toMatch(/^-\s+Two/m);
  });

  it('strips script and style content', () => {
    const md = htmlToMarkdown('<p>visible</p><script>alert(1)</script><style>p{}</style>');
    expect(md).toBe('visible');
  });

  it('preserves links', () => {
    const md = htmlToMarkdown('<p>See <a href="https://example.com/x">here</a></p>');
    expect(md).toBe('See [here](https://example.com/x)');
  });

  it('decodes HTML entities before converting (Greenhouse content quirk)', () => {
    // Greenhouse stores `content` as entity-escaped text rather than raw HTML.
    expect(htmlToMarkdown('&lt;p&gt;Hello &amp; world&lt;/p&gt;')).toBe('Hello & world');
  });
});
