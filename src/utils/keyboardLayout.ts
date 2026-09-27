import { isBlackKey, midiToNoteName } from './musicMath';

export interface KeyLayoutInfo {
  midi: number;
  name: string;
  isBlack: boolean;
  leftPercent: number; // 0 to 100
  widthPercent: number; // 0 to 100
}

/**
 * Calculates responsive horizontal percentages for piano keys from minMidi to maxMidi.
 * White keys distribute evenly across 100% width.
 * Black keys are centered over the borders between white keys.
 */
export function generateKeyLayout(minMidi = 36, maxMidi = 84): {
  keys: KeyLayoutInfo[];
  whiteKeyCount: number;
} {
  // 1. Collect all white keys in order to get total count
  const allMidis: number[] = [];
  let whiteKeyCount = 0;

  for (let m = minMidi; m <= maxMidi; m++) {
    allMidis.push(m);
    if (!isBlackKey(m)) {
      whiteKeyCount++;
    }
  }

  const whiteKeyWidthPercent = 100 / whiteKeyCount;
  const blackKeyWidthPercent = whiteKeyWidthPercent * 0.62;

  let currentWhiteIndex = 0;
  const keys: KeyLayoutInfo[] = [];

  for (const midi of allMidis) {
    const black = isBlackKey(midi);
    const name = midiToNoteName(midi);

    if (!black) {
      const leftPercent = currentWhiteIndex * whiteKeyWidthPercent;
      keys.push({
        midi,
        name,
        isBlack: false,
        leftPercent,
        widthPercent: whiteKeyWidthPercent
      });
      currentWhiteIndex++;
    } else {
      // Black key sits between the previous white key and the current/next white key
      // Its center is at currentWhiteIndex * whiteKeyWidthPercent
      const centerPercent = currentWhiteIndex * whiteKeyWidthPercent;
      const leftPercent = centerPercent - (blackKeyWidthPercent / 2);
      keys.push({
        midi,
        name,
        isBlack: true,
        leftPercent,
        widthPercent: blackKeyWidthPercent
      });
    }
  }

  return { keys, whiteKeyCount };
}
