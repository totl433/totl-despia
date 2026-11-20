/** Avatar and badge size on the D03 card (Figma 451:61161). */
export const EVERYONE_IN_AVATAR = 60;
/** Centre of the badge to the centre of each avatar. */
const RING = 90;
const AVATAR = EVERYONE_IN_AVATAR;

export type Point = { x: number; y: number };

/**
 * Where each avatar sits for 2–8 players, as top-left offsets in a box that fits the shape (Figma
 * 451:61161). 2 sit left and right of the badge; 3 make a peak with the badge between the lower two;
 * 4 a square; 5–8 a ring that starts at the top. All on a 90pt circle, clockwise.
 */
export function everyoneInLayout(count: number): { avatars: Point[]; badge: Point; width: number; height: number } {
  const n = Math.max(2, Math.min(8, Math.round(count)));
  let centres: Point[];
  if (n === 3) {
    centres = [{ x: 0, y: -RING }, { x: RING, y: 0 }, { x: -RING, y: 0 }];
  } else {
    const start = n === 2 ? 0 : n === 4 ? -135 : -90;
    centres = Array.from({ length: n }, (_, i) => {
      const angle = ((start + (360 / n) * i) * Math.PI) / 180;
      const round = (v: number) => Math.round(v * 100) / 100;
      return { x: round(RING * Math.cos(angle)), y: round(RING * Math.sin(angle)) };
    });
  }
  const all = [...centres, { x: 0, y: 0 }];
  const minX = Math.min(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y));
  const maxX = Math.max(...all.map((p) => p.x));
  const maxY = Math.max(...all.map((p) => p.y));
  const place = (p: Point) => ({ x: p.x - minX, y: p.y - minY });
  return {
    avatars: centres.map(place),
    badge: place({ x: 0, y: 0 }),
    width: maxX - minX + AVATAR,
    height: maxY - minY + AVATAR,
  };
}
