import { LABEL_CATEGORY, PROPAGATED_LABELS, RULES, VALIDATORS, type Category } from './rules';

export interface Term {
  label: string;
  value: string;
}

export interface SanitizeOptions {
  terms: Term[];
  domains: string[];
  enabled: Record<Category, boolean>;
}

export interface Segment {
  text: string;
  label?: string;
  original?: string;
}

export interface SanitizeResult {
  output: string;
  segments: Segment[];
  counts: Record<string, number>;
}

interface Span {
  start: number;
  end: number;
  label: string;
  priority: number;
}

const CUSTOM_PRIORITY = 100;
const DOMAIN_PRIORITY = 97;
const PROPAGATED_PRIORITY = 10;
const MIN_PROPAGATED_LENGTH = 3;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

function literalPattern(values: Iterable<string>, flags: string): RegExp {
  const alternatives = [...new Set(values)].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|');
  return new RegExp(`(?<![\\p{L}\\p{N}_])(?:${alternatives})(?![\\p{L}\\p{N}_])`, `g${flags}u`);
}

function groupLabel(name: string): string {
  return name.replace(/\d+$/, '');
}

function collectRuleSpans(text: string, enabled: Record<Category, boolean>, add: (span: Span) => void) {
  for (const rule of RULES) {
    for (const match of text.matchAll(rule.pattern)) {
      const groups = match.indices?.groups;
      const found: [string, [number, number] | undefined][] = groups
        ? Object.entries(groups).map(([name, range]) => [groupLabel(name), range])
        : [[rule.label ?? 'REDACTED', match.indices?.[0]]];
      for (const [label, range] of found) {
        if (!range) continue;
        const category = LABEL_CATEGORY[label];
        if (category && !enabled[category]) continue;
        const validate = VALIDATORS[label];
        if (validate && !validate(text.slice(range[0], range[1]))) continue;
        add({ start: range[0], end: range[1], label, priority: rule.priority });
      }
    }
  }
}

function resolveOverlaps(spans: Span[], length: number): Span[] {
  const ordered = [...spans].sort(
    (a, b) => b.priority - a.priority || b.end - b.start - (a.end - a.start) || a.start - b.start,
  );
  const taken = new Uint8Array(length);
  const accepted: Span[] = [];
  for (const span of ordered) {
    if (taken.subarray(span.start, span.end).includes(1)) continue;
    taken.fill(1, span.start, span.end);
    accepted.push(span);
  }
  return accepted.sort((a, b) => a.start - b.start);
}

export function sanitize(text: string, options: SanitizeOptions): SanitizeResult {
  const spans: Span[] = [];
  const add = (span: Span) => {
    if (text.slice(span.start, span.end).trim()) spans.push(span);
  };

  const terms = options.terms.filter((term) => term.value.trim());
  if (terms.length > 0) {
    const labels = new Map(terms.map((term) => [term.value.trim().toLowerCase(), term.label]));
    for (const match of text.matchAll(literalPattern(labels.keys(), 'i'))) {
      const label = labels.get(match[0].toLowerCase()) ?? 'CUSTOM';
      add({ start: match.index, end: match.index + match[0].length, label, priority: CUSTOM_PRIORITY });
    }
  }

  if (options.domains.length > 0) {
    const domains = [...new Set(options.domains)].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|');
    const pattern = new RegExp(`(?<![\\w.@-])(?:[a-z0-9-]+\\.)*(?:${domains})(?!\\.?[\\w-])`, 'gi');
    for (const match of text.matchAll(pattern)) {
      add({ start: match.index, end: match.index + match[0].length, label: 'HOST', priority: DOMAIN_PRIORITY });
    }
  }

  collectRuleSpans(text, options.enabled, add);

  const seeds = new Map<string, string>();
  for (const span of spans) {
    const value = text.slice(span.start, span.end);
    if (PROPAGATED_LABELS.has(span.label) && value.length >= MIN_PROPAGATED_LENGTH && !/^\d+$/.test(value) && !seeds.has(value)) {
      seeds.set(value, span.label);
    }
  }
  if (seeds.size > 0) {
    for (const match of text.matchAll(literalPattern(seeds.keys(), ''))) {
      const label = seeds.get(match[0]) ?? 'REDACTED';
      add({ start: match.index, end: match.index + match[0].length, label, priority: PROPAGATED_PRIORITY });
    }
  }

  const placeholders = new Map<string, string>();
  const counts: Record<string, number> = {};
  const segments: Segment[] = [];
  let cursor = 0;
  for (const span of resolveOverlaps(spans, text.length)) {
    if (span.start > cursor) segments.push({ text: text.slice(cursor, span.start) });
    const original = text.slice(span.start, span.end);
    const key = `${span.label}\u0000${original.toLowerCase()}`;
    let placeholder = placeholders.get(key);
    if (!placeholder) {
      counts[span.label] = (counts[span.label] ?? 0) + 1;
      placeholder = `[${span.label}_${counts[span.label]}]`;
      placeholders.set(key, placeholder);
    }
    segments.push({ text: placeholder, label: span.label, original });
    cursor = span.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });

  return { output: segments.map((segment) => segment.text).join(''), segments, counts };
}
