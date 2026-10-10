// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Splits a learned source's text into passages (WORK_PLAN 8.9, D49) — no LLM: by headings (Markdown `#` lines), then by
 * paragraphs, then by sentences, so each passage is about TARGET characters and never more than MAX (a single sentence
 * longer than MAX is cut at a space). Each passage keeps the heading it sits under, searched with it. Any script: a
 * sentence ends at . ? ! and their CJK / Devanagari / Arabic forms.
 */

export interface Passage {
  heading: string | null;
  content: string;
}

const TARGET = 1_000;
const MAX = 1_600;
const HEADING = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/;
const SENTENCE = /(?<=[.?!。？！।؟])\s+|(?<=[。？！])/u;

export function splitPassages(text: string): Passage[] {
  const out: Passage[] = [];
  let heading: string | null = null;
  let buffer = '';
  const flush = () => {
    const content = buffer.trim();
    if (content) out.push({ heading, content });
    buffer = '';
  };
  const add = (piece: string) => {
    if (buffer && buffer.length + piece.length + 2 > TARGET) flush();
    buffer = buffer ? `${buffer}\n\n${piece}` : piece;
  };
  for (const block of text.replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    const rest: string[] = [];
    for (const line of block.split('\n')) {
      const h = line.match(HEADING);
      if (h) {
        if (rest.join('').trim()) for (const p of pieces(rest.join('\n').trim())) add(p);
        rest.length = 0;
        flush();
        heading = (h[1] ?? '').trim() || null;
      } else {
        rest.push(line);
      }
    }
    if (rest.join('').trim()) for (const p of pieces(rest.join('\n').trim())) add(p);
  }
  flush();
  return out;
}

/** A paragraph as pieces of at most MAX characters: whole when it fits, else its sentences, else cut at spaces. */
function pieces(paragraph: string): string[] {
  if (paragraph.length <= MAX) return [paragraph];
  const out: string[] = [];
  let current = '';
  for (const sentence of paragraph.split(SENTENCE).filter((s) => s.trim())) {
    for (const part of cut(sentence.trim())) {
      if (current && current.length + part.length + 1 > TARGET) { out.push(current); current = ''; }
      current = current ? `${current} ${part}` : part;
    }
  }
  if (current) out.push(current);
  return out;
}

/** A sentence longer than MAX, cut at the last space before MAX (or at MAX when it has none). */
function cut(sentence: string): string[] {
  const out: string[] = [];
  let s = sentence;
  while (s.length > MAX) {
    const at = s.lastIndexOf(' ', MAX);
    const end = at > MAX / 2 ? at : MAX;
    out.push(s.slice(0, end).trim());
    s = s.slice(end).trim();
  }
  if (s) out.push(s);
  return out;
}
