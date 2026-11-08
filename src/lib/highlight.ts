import type { Segment } from './sanitize';

export const BULK_SEGMENT_THRESHOLD = 4000;

function paint(node: HTMLElement, segments: Segment[]) {
  const fragment = document.createDocumentFragment();
  for (const segment of segments) {
    if (segment.label) {
      const mark = document.createElement('mark');
      mark.textContent = segment.text;
      mark.title = segment.original ?? '';
      fragment.append(mark);
    } else {
      fragment.append(segment.text);
    }
  }
  node.replaceChildren(fragment);
}

export function segments(node: HTMLElement, initial: Segment[]) {
  paint(node, initial);
  return { update: (next: Segment[]) => paint(node, next) };
}
