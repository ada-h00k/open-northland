export {
  MapEscalation,
  type MapEscalationInput,
  MapEscalationJobShare,
  MapEscalationWaveSize,
} from './escalation.js';
export { applyMapVariantScript, applyMapVariantSlots } from './patch.js';
export { findMapVariant, MAP_VARIANTS, mapVariantsOf } from './registry.js';
export {
  MapVariant,
  MapVariantAiTasks,
  type MapVariantInput,
  MapVariantKind,
  MapVariantMissionResults,
  MapVariantScriptPatch,
} from './schema.js';
