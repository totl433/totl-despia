import { describe, expect, it } from 'vitest';
import sitemap from '../../public/sitemap.xml?raw';
import { routeSeoFor } from './routeSeo';

describe('routeSeoFor', () => {
  it('gives each public page its own canonical, and /app points at /', () => {
    expect(routeSeoFor('/')?.canonicalPath).toBe('/');
    expect(routeSeoFor('/app')?.canonicalPath).toBe('/');
    expect(routeSeoFor('/support')?.canonicalPath).toBe('/support');
    expect(routeSeoFor('/support/')?.canonicalPath).toBe('/support');
  });

  it('returns nothing for signed-in routes', () => {
    expect(routeSeoFor('/predictions')).toBeNull();
    expect(routeSeoFor('/league/ABC12')).toBeNull();
  });

  it('covers exactly the URLs in public/sitemap.xml', () => {
    const locs = [...sitemap.matchAll(/<loc>https:\/\/playtotl\.com([^<]*)<\/loc>/g)].map((m) => m[1]);
    for (const path of locs) expect(routeSeoFor(path)?.canonicalPath).toBe(path);
  });
});
