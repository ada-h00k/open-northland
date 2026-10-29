import type { MapEscalation } from '@open-northland/data';
import {
  mapEscalationProgress,
  Vehicle,
  VehicleDrive,
  vehiclePassengers,
  writeMapEscalation,
} from '../../components/index.js';
import { contentIndex } from '../../core/content-index.js';
import type { Entity, World } from '../../ecs/world.js';
import type { SystemContext } from '../context.js';
import { removeSettlerSilently } from '../lifecycle/death.js';
import { spawnSettler } from '../spawn/index.js';
import { createVehicle } from '../vehicles/create.js';
import { attachToVehicle, boardRider, unloadPeople } from '../vehicles/crew.js';
import { dockVehicle } from '../vehicles/dock.js';
import { startVehicleDrive } from '../vehicles/movement.js';
import { removeVehicle } from '../vehicles/remove.js';

type Target = MapEscalation['attacks']['targets'][number];
type LandingPoints = NonNullable<Target['landing']>;

// A wave's sea landing: one ship per targeted seat appears at the seat's sea spawn point with the fresh
// men aboard, docks at the seat's landing point, sets them ashore, then sails back and leaves the map.
// The men belong to the raider seat like the land band, so the same Attack task and aim take them.

/**
 * Put `jobs` aboard a fresh ship at the target's sea spawn point and send it to dock at its landing
 * point, owned by the target's raider. One ship only: the men past its seats, the commander's included,
 * stay home. Returns the men aboard; none when the ship cannot be made or finds no way to the shore.
 */
export function launchLanding(
  world: World,
  ctx: SystemContext,
  config: MapEscalation,
  target: Target,
  jobs: readonly number[],
): Entity[] {
  const landings = config.landings;
  const points = target.landing;
  const terrain = ctx.terrain;
  if (landings === undefined || points === undefined || terrain === undefined || jobs.length === 0) return [];
  const vehicleType = contentIndex(ctx.content).vehicleTypeBySlug.get(landings.vehicle);
  if (vehicleType === undefined || !terrain.inBounds(points.spawnX, points.spawnY)) return [];
  const ship = createVehicle(world, ctx, {
    vehicleType,
    x: points.spawnX,
    y: points.spawnY,
    tribe: config.tribe,
    owner: target.raider,
  });
  if (ship === null) return [];
  const men = boardMen(world, ctx, config, target, points, ship, jobs);
  const sails =
    men.length > 0 &&
    dockVehicle(world, ctx, { kind: 'dockVehicle', vehicle: ship, x: points.x, y: points.y });
  if (!sails) {
    scrapLanding(world, ctx, ship);
    return [];
  }
  writeMapEscalation(world, (progress) => {
    progress.landings.push({ ship, seat: target.seat, leg: 'inbound' });
  });
  return men;
}

/** Each man is born on the landing shore and stepped aboard at once, the way a map seats a crew
 *  inside a vehicle; the first takes the commander's seat. */
function boardMen(
  world: World,
  ctx: SystemContext,
  config: MapEscalation,
  target: Target,
  points: LandingPoints,
  ship: Entity,
  jobs: readonly number[],
): Entity[] {
  const men: Entity[] = [];
  for (const jobType of jobs) {
    if (!world.get(ship, Vehicle).passengers.includes(null)) break;
    const e = spawnSettler(world, ctx, {
      kind: 'spawnSettler',
      jobType,
      tribe: config.tribe,
      x: points.x,
      y: points.y,
      owner: target.raider,
    });
    if (e === null) continue;
    if (!attachToVehicle(world, ctx, { kind: 'attachToVehicle', entity: e, vehicle: ship })) {
      removeSettlerSilently(world, e);
      continue;
    }
    boardRider(world, e, ship);
    men.push(e);
  }
  return men;
}

/**
 * Move each ship under way on: an inbound one that moored sets its men ashore and turns back; one that
 * lost its way is sent to dock again, and scrapped with whoever is aboard when no way is left; an
 * outbound one that arrived, or stopped, leaves the map. A ship gone (sunk) is forgotten.
 */
export function landingsTurn(world: World, ctx: SystemContext, config: MapEscalation): void {
  const landings = mapEscalationProgress(world).landings;
  if (landings.length === 0) return;
  const kept: Array<{ ship: Entity; seat: number; leg: 'inbound' | 'outbound' }> = [];
  for (const landing of landings) {
    const { ship, seat } = landing;
    const state = world.tryGet(ship, Vehicle);
    const points = config.attacks.targets.find((target) => target.seat === seat)?.landing;
    if (state === undefined || points === undefined) continue;
    const underWay = world.has(ship, VehicleDrive);
    if (landing.leg === 'outbound') {
      if (underWay) kept.push({ ...landing });
      else removeVehicle(world, ctx, ship, 'script');
      continue;
    }
    if (state.moored && state.mooring?.hx === points.x && state.mooring.hy === points.y) {
      unloadPeople(world, ctx, { kind: 'unloadPeople', vehicle: ship });
      if (sailOut(world, ctx, ship, points)) kept.push({ ship, seat, leg: 'outbound' });
      else removeVehicle(world, ctx, ship, 'script');
      continue;
    }
    const docking = underWay || state.task === 'docks';
    if (docking || dockVehicle(world, ctx, { kind: 'dockVehicle', vehicle: ship, x: points.x, y: points.y }))
      kept.push({ ...landing });
    else scrapLanding(world, ctx, ship);
  }
  writeMapEscalation(world, (progress) => {
    progress.landings = kept;
  });
}

/** Send the emptied ship back to its spawn point. A ship sails on with nobody aboard, so the drive
 *  needs no commander. */
function sailOut(world: World, ctx: SystemContext, ship: Entity, points: LandingPoints): boolean {
  const terrain = ctx.terrain;
  if (terrain === undefined) return false;
  if (!startVehicleDrive(world, ctx, terrain, ship, terrain.nodeAt(points.spawnX, points.spawnY)))
    return false;
  const live = world.mut(ship, Vehicle);
  live.task = 'none';
  live.mooring = null;
  return true;
}

/** A ship that cannot land leaves the map with its men, who never set foot ashore. */
function scrapLanding(world: World, ctx: SystemContext, ship: Entity): void {
  const state = world.tryGet(ship, Vehicle);
  for (const seat of state === undefined ? [] : vehiclePassengers(state))
    if (world.isAlive(seat.entity)) removeSettlerSilently(world, seat.entity);
  removeVehicle(world, ctx, ship, 'script');
}
