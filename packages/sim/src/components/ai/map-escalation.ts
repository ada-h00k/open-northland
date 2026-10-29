import type { DeepReadonly, Entity, World } from '../../ecs/world.js';
import { defineWorldSingleton } from '../../ecs/world-singleton.js';

/** The attack a map escalation has under way. */
export interface MapEscalationAttackRecord {
  /** The attack's number, from 1. */
  wave: number;
  launchedTick: number;
  /** The men it spawned and that may still live, ascending by id; the end check drops the dead. */
  men: Entity[];
}

/** A map escalation's progress; the schedule itself is immutable input, like the AI script. */
export interface MapEscalationProgress {
  /** The scheduled launches that fell due so far, spawned or not. */
  launches: number;
  attack: MapEscalationAttackRecord | null;
}

/** No carrier exists until the first launch falls due, so a world before it hashes as one without it. */
const escalation = defineWorldSingleton<MapEscalationProgress>('MapEscalation', 'players', () => ({
  launches: 0,
  attack: null,
}));

export const MapEscalationState = escalation.component;

export function mapEscalationProgress(world: World): DeepReadonly<MapEscalationProgress> {
  return escalation.read(world);
}

export function writeMapEscalation(world: World, apply: (value: MapEscalationProgress) => void): void {
  escalation.write(world, apply);
}
