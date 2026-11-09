import { describe, expect, it } from 'vitest';
import { Owner, SiteAssignment, Stockpile, UnderConstruction } from '../../../../src/components/index.js';
import { type Fixed, Simulation } from '../../../../src/index.js';
import { ConstructionTaskClaims } from '../../../../src/systems/settlers/drives/economy/construction-task-claims.js';
import { collectSupplyTally, deliveredConstructionFraction } from '../../../../src/systems/stores/index.js';
import {
  builderAt,
  constructionContent,
  ctxOf,
  grassMap,
  HOUSE,
  STONE,
  siteAt,
  WOOD,
} from './system/support.js';

describe('construction task claims', () => {
  it('hands out no more hammer strikes than the delivered material can absorb', () => {
    const sim = new Simulation({ seed: 1, content: constructionContent(), map: grassMap(12, 4) });
    const site = siteAt(sim, HOUSE, 6, 1);
    sim.world.mut(site, Stockpile).amounts.set(STONE, 2);
    const delivered = deliveredConstructionFraction(sim.world, ctxOf(sim), site);
    // One quantum short of the delivered cap leaves exactly one strike.
    sim.world.mut(site, UnderConstruction).labor = (delivered - 1) as Fixed;
    const claims = new ConstructionTaskClaims(sim.world, ctxOf(sim), collectSupplyTally(sim.world));

    expect(claims.hasHammerClaim(site)).toBe(false);
    expect(claims.claimHammer(site)).toBe(true);
    expect(claims.hasHammerClaim(site)).toBe(true);
    expect(claims.hasHammerWork(site)).toBe(false);
    expect(claims.claimHammer(site)).toBe(false);
  });

  it('counts crews as the assignments stood at the first question, with the pass moves over them', () => {
    const sim = new Simulation({ seed: 3, content: constructionContent(), map: grassMap(24, 8) });
    const [a, b] = [siteAt(sim, HOUSE, 4, 2), siteAt(sim, HOUSE, 14, 2)];
    const crew = [builderAt(sim, 1, 1), builderAt(sim, 2, 1), builderAt(sim, 3, 1)];
    for (const builder of crew) sim.world.add(builder, SiteAssignment, { site: a, pinned: false });
    const pass = () => new ConstructionTaskClaims(sim.world, ctxOf(sim), collectSupplyTally(sim.world));
    const first = pass();
    expect(first.crewSize(a)).toBe(3);
    const [mover, leaver] = crew;
    if (mover === undefined || leaver === undefined) throw new Error('crew missing');
    first.moveCrew(a, b);
    sim.world.add(mover, SiteAssignment, { site: b, pinned: false });
    sim.world.remove(leaver, SiteAssignment);
    expect([first.crewSize(a), first.crewSize(b)]).toEqual([2, 1]);
    first.moveCrew(b, undefined);
    first.moveCrew(b, undefined);
    expect(first.crewSize(b)).toBe(0);
    const next = pass();
    expect([next.crewSize(a), next.crewSize(b)]).toEqual([1, 1]);
    expect(sim.world.verifyCaches()).toEqual([]);
  });

  it('ranks a prioritized site over the standing tiers and a demoted one under them', () => {
    const sim = new Simulation({ seed: 3, content: constructionContent(), map: grassMap(24, 8) });
    // A fresh site the builders would rank last (nothing delivered), beside a ready, unstaffed one
    // holding its whole bill (2× stone + 1× wood) with steps to hammer.
    const near = siteAt(sim, HOUSE, 4, 2);
    const far = siteAt(sim, HOUSE, 14, 2);
    sim.world.mut(far, Stockpile).amounts.set(STONE, 2).set(WOOD, 1);
    const builder = builderAt(sim, 1, 1);
    for (const e of [near, far, builder]) sim.world.add(e, Owner, { player: 0 });
    const ranking = () => {
      const claims = new ConstructionTaskClaims(sim.world, ctxOf(sim), collectSupplyTally(sim.world));
      return claims.rankBuildingSites(0, [near, far], builder);
    };

    // Without a rank the standing decides: the ready site first, the waiting one last.
    const plain = ranking();
    expect(plain.ranks).toEqual([5, 0]);
    expect(plain.rankOf.get(far)).toBe(5);
    expect(plain.rankOf.get(near)).toBe(0);

    // A demoted site sinks under every unrated one, whatever its standing.
    sim.world.mut(far, UnderConstruction).priority = 'low';
    const demoted = ranking();
    expect(demoted.ranks).toEqual([0, -5]);
    expect(demoted.rankOf.get(far)).toBe(-5);

    // A prioritized site rises over every unrated one, so the waiting site is worked first.
    sim.world.mut(far, UnderConstruction).priority = undefined;
    sim.world.mut(near, UnderConstruction).priority = 'high';
    const promoted = ranking();
    expect(promoted.ranks).toEqual([10, 5]);
    expect(promoted.rankOf.get(near)).toBe(10);
    expect(sim.world.verifyCaches()).toEqual([]);
  });
});
