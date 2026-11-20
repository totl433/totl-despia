import { describe, expect, it } from 'vitest';

import { everyoneInLayout } from './everyoneInLayout';

// Figma 451:61161: the avatar group's size for each league size.
const FIGMA: Record<number, [number, number]> = {
  2: [240, 60],
  3: [240, 150],
  4: [187.28, 187.28],
  5: [232.16, 221.41],
  6: [215.88, 240],
  7: [235.56, 231.23],
  8: [240, 240],
};

describe('everyoneInLayout', () => {
  it('matches the Figma shape for every league size', () => {
    for (const [size, [width, height]] of Object.entries(FIGMA)) {
      const layout = everyoneInLayout(Number(size));
      expect(layout.avatars).toHaveLength(Number(size));
      expect(Math.abs(layout.width - width)).toBeLessThan(2);
      expect(Math.abs(layout.height - height)).toBeLessThan(2);
    }
  });

  it('puts 2 either side of the badge and the third player of 3 above it', () => {
    expect(everyoneInLayout(2)).toMatchObject({ badge: { x: 90, y: 0 }, avatars: [{ x: 180, y: 0 }, { x: 0, y: 0 }] });
    expect(everyoneInLayout(3)).toMatchObject({ badge: { x: 90, y: 90 }, avatars: [{ x: 90, y: 0 }, { x: 180, y: 90 }, { x: 0, y: 90 }] });
  });

  it('keeps the badge centred on the ring from 4 up', () => {
    for (const size of [4, 5, 6, 7, 8]) {
      const { badge, width } = everyoneInLayout(size);
      expect(Math.abs(badge.x + 30 - width / 2)).toBeLessThan(1);
    }
  });
});
