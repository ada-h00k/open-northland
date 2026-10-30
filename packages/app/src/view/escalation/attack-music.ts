import type { MusicTrack } from '@open-northland/audio';

/**
 * The music a siege attack plays once through: "Colossal Boss Battle Theme" by Matthew Pablo, under
 * CC-BY 3.0 (notice in public/licenses/THIRD-PARTY-NOTICES.txt). The file is the author's MP3 as Ogg
 * Vorbis, 3 dB lower; `loudnessLufs` is measured on it, and `gainDb` takes it to the -20 LUFS the
 * rendered music is levelled to.
 */
export const ATTACK_MUSIC: MusicTrack = {
  file: '/audio/colossal-boss-battle.ogg',
  // No loop region: the one pass is the whole file, ending included.
  loopStartS: 0,
  loopEndS: 125.936,
  loudnessLufs: -14.5,
  gainDb: -5.5,
  segmentSha256: 'a695397d638533652f2682cb495613f1434e2e40acb2925c0cbc36034d07b75d',
};
