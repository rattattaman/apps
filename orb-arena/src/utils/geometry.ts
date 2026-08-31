export interface Point {
  x: number;
  y: number;
}

export interface Segment {
  start: Point;
  end: Point;
}

export function distanceSquared(a: Point, b: Point): number {
  const x = a.x - b.x;
  const y = a.y - b.y;
  return x * x + y * y;
}

export function pointToSegmentDistanceSquared(point: Point, segment: Segment): number {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distanceSquared(point, segment.start);
  const projection = Math.max(0, Math.min(1,
    ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / lengthSquared,
  ));
  return distanceSquared(point, {
    x: segment.start.x + projection * dx,
    y: segment.start.y + projection * dy,
  });
}

function orientation(a: Point, b: Point, c: Point): number {
  return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
}

export function segmentsIntersect(first: Segment, second: Segment): boolean {
  const o1 = orientation(first.start, first.end, second.start);
  const o2 = orientation(first.start, first.end, second.end);
  const o3 = orientation(second.start, second.end, first.start);
  const o4 = orientation(second.start, second.end, first.end);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

export function segmentDistanceSquared(first: Segment, second: Segment): number {
  if (segmentsIntersect(first, second)) return 0;
  return Math.min(
    pointToSegmentDistanceSquared(first.start, second),
    pointToSegmentDistanceSquared(first.end, second),
    pointToSegmentDistanceSquared(second.start, first),
    pointToSegmentDistanceSquared(second.end, first),
  );
}
