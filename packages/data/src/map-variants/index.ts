export {
  MapEscalation,
  type MapEscalationInput,
  MapEscalationJobShare,
  MapEscalationWaveSize,
} from './escalation.js';
export {
  applyMapVariantBriefing,
  applyMapVariantEntities,
  applyMapVariantScript,
  applyMapVariantSlots,
} from './patch.js';
export { findMapVariant, MAP_VARIANTS, mapVariantsOf } from './registry.js';
export {
  MapVariant,
  MapVariantAiTasks,
  MapVariantBriefingPages,
  type MapVariantInput,
  MapVariantKind,
  MapVariantLandscapeObject,
  MapVariantMissionResults,
  MapVariantScriptPatch,
  MapVariantStartSeat,
} from './schema.js';
