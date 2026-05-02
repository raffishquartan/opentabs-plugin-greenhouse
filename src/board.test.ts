// SPDX-License-Identifier: MIT
// Copyright (c) 2026 raffishquartan

import { describe, it, expect } from 'vitest';
import { resolveBoardToken } from './board.js';

describe('resolveBoardToken', () => {
  it('accepts a simple lowercase alphanumeric token', () => {
    expect(resolveBoardToken({ board: 'airbnb' })).toBe('airbnb');
  });

  it('rejects a token containing a slash', () => {
    expect(() => resolveBoardToken({ board: 'air/bnb' })).toThrow(/invalid/i);
  });

  it('extracts token from a job-boards.greenhouse.io URL', () => {
    expect(resolveBoardToken({ board: 'https://job-boards.greenhouse.io/airbnb' })).toBe('airbnb');
  });

  it('extracts token from a URL with a job sub-path', () => {
    expect(resolveBoardToken({ board: 'https://job-boards.greenhouse.io/airbnb/jobs/12345' })).toBe('airbnb');
  });

  it('extracts token from a legacy boards.greenhouse.io URL', () => {
    expect(resolveBoardToken({ board: 'https://boards.greenhouse.io/airbnb' })).toBe('airbnb');
  });

  it('extracts token from an EU job-boards URL', () => {
    expect(resolveBoardToken({ board: 'https://job-boards.eu.greenhouse.io/airbnb' })).toBe('airbnb');
  });

  it('rejects a URL on a non-greenhouse host', () => {
    expect(() => resolveBoardToken({ board: 'https://example.com/airbnb' })).toThrow(/invalid/i);
  });

  it('infers token from currentUrl when board not given', () => {
    expect(resolveBoardToken({ currentUrl: 'https://job-boards.eu.greenhouse.io/airbnb/jobs/12345' })).toBe('airbnb');
  });

  it('throws when no board and currentUrl is not a greenhouse host', () => {
    expect(() => resolveBoardToken({ currentUrl: 'https://example.com/' })).toThrow(/no board/i);
  });

  it('throws when no input is provided', () => {
    expect(() => resolveBoardToken({})).toThrow(/no board/i);
  });

  it('throws when currentUrl is greenhouse but has no token segment', () => {
    expect(() => resolveBoardToken({ currentUrl: 'https://job-boards.eu.greenhouse.io/' })).toThrow(/no board/i);
  });
});
