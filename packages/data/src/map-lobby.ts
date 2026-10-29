import type { MapsIndexPlayerSlot } from './schema/maps/listing.js';
import {
  ComputerModuleId,
  type MapAiSeat,
  type MapMultiplayerSlot,
  type MapPlayerSlot,
  type MapScript,
} from './schema/maps/script.js';

/** What a seat's `playeroption` row, or its absence, lets the lobby do with it. */
export function mapSlotEligibility(
  type: MapPlayerSlot['type'],
  allowed: MapMultiplayerSlot['allowed'] | undefined,
): Pick<MapsIndexPlayerSlot, 'claimable' | 'aiAllowed' | 'noneAllowed'> {
  return {
    claimable: type !== 'none' && (allowed === undefined ? type === 'human' : allowed.includes('human')),
    aiAllowed: allowed === undefined || allowed.includes('ai'),
    noneAllowed: allowed === undefined || allowed.includes('none'),
  };
}

/** The lobby seats a script authors: its roster rows read against the `[multiplayer]` table. */
export function mapLobbySlots(script: MapScript): MapsIndexPlayerSlot[] {
  const table = script.multiplayer;
  return script.players.map((slot) => {
    const allowed = table?.slotOptions.find((row) => row.player === slot.player)?.allowed;
    const eligibility = mapSlotEligibility(slot.type, allowed);
    return {
      ...slot,
      claimable: eligibility.claimable,
      hidden: table?.hiddenSlots.includes(slot.player) ?? false,
      aiAllowed: eligibility.aiAllowed,
      noneAllowed: eligibility.noneAllowed,
      hasComputerControl: mapAllowsComputerControl(script.ai?.find((row) => row.player === slot.player)),
    };
  });
}

/** Whether the authored switches permit any autonomous computer-player capability. */
export function mapAllowsComputerControl(row: MapAiSeat | undefined): boolean {
  if (row === undefined) return true;
  if (row.allDisabled || row.computerDisabled) return false;
  return !ComputerModuleId.options.every((id) => row.disabledComputerModules.includes(id));
}
