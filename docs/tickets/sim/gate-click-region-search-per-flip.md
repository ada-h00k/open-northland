# Keep a split click's side check from re-searching a half-map region after every walk flip

**Area:** sim · **Priority:** P3

A move order onto ground a closed gate or wall splits (`clickSides`,
`packages/sim/src/systems/movement/structure-route.ts`) asks `structureSameRegion` whether the box's
sides join. Across a gate that seals off a large region the answer comes from an exhausted search of the
smaller side. `GroupReachability` keeps that result only per walk-block version, and any walkable-node
flip anywhere on the map (a felled tree, a new site, an emptied deposit) bumps the version and drops it.

Measured on a 512x512-node grass map with a full-width wall and a closed gate in the middle, 50
movers, `formationSlots` at the gate: about 42 ms after any flip elsewhere, 0.6 ms when repeated without
one. In a running economy almost every such click pays the 42 ms on the sim thread (the worker's slot
query, or in-tick for a direct `moveUnit` onto a blocker). An attack-move skips the check.

## Scope

Make the learned groups survive flips that cannot change the answer, or bound the side check without
turning a long detour into "unreachable" (a click just past a long wall with a far opening must still
send movers around). Keep results exact and deterministic.

## Verify

- The measurement above, repeated with a flip between clicks, drops to the repeat cost; name the
  scenario and numbers in the commit.
- Existing palisade route and formation slot tests stay green; goldens unchanged.
