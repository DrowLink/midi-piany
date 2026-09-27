const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Converts a MIDI number (e.g. 60) to a note name with octave (e.g. "C4").
 */
export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = ((midi % 12) + 12) % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

/**
 * Converts a note string (e.g. "C4", "F#3", "Bb4") to a MIDI number.
 */
export function noteNameToMidi(noteName: string): number {
  const clean = noteName.trim().toUpperCase();
  const match = clean.match(/^([A-G][#B]?)(-?\d+)$/);
  if (!match) return 60; // fallback to Middle C

  let note = match[1];
  const octave = parseInt(match[2], 10);

  // Normalize flats to sharps
  const flatToSharp: Record<string, string> = {
    'DB': 'C#',
    'EB': 'D#',
    'GB': 'F#',
    'AB': 'G#',
    'BB': 'A#'
  };
  if (flatToSharp[note]) {
    note = flatToSharp[note];
  }

  const noteIndex = NOTE_NAMES.indexOf(note);
  if (noteIndex === -1) return 60;

  return (octave + 1) * 12 + noteIndex;
}

/**
 * Converts frequency in Hz to closest MIDI number.
 */
export function frequencyToMidi(freq: number): number {
  if (freq <= 0) return 0;
  return Math.round(69 + 12 * Math.log2(freq / 440));
}

/**
 * Converts MIDI number to standard frequency in Hz.
 */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Calculates detuning in cents from the exact pitch of the closest MIDI note.
 */
export function getCentsOffset(freq: number, midi: number): number {
  const targetFreq = midiToFrequency(midi);
  return Math.round(1200 * Math.log2(freq / targetFreq));
}

/**
 * Checks if a MIDI note is a black key on the piano.
 */
export function isBlackKey(midi: number): boolean {
  const noteIndex = ((midi % 12) + 12) % 12;
  return [1, 3, 6, 8, 10].includes(noteIndex); // C#, D#, F#, G#, A#
}

/**
 * PC Keyboard mapping to MIDI notes (two octaves around Middle C: C3 to E5).
 */
export const KEYBOARD_KEY_MAP: Record<string, number> = {
  // Lower octave (C3 to B3)
  'z': 48, // C3
  's': 49, // C#3
  'x': 50, // D3
  'd': 51, // D#3
  'c': 52, // E3
  'v': 53, // F3
  'g': 54, // F#3
  'b': 55, // G3
  'h': 56, // G#3
  'n': 57, // A3
  'j': 58, // A#3
  'm': 59, // B3

  // Middle octave (C4 to B4)
  'q': 60, // C4 (Middle C)
  '2': 61, // C#4
  'w': 62, // D4
  '3': 63, // D#4
  'e': 64, // E4
  'r': 65, // F4
  '5': 66, // F#4
  't': 67, // G4
  '6': 68, // G#4
  'y': 69, // A4
  '7': 70, // A#4
  'u': 71, // B4

  // Upper extension
  'i': 72, // C5
  '9': 73, // C#5
  'o': 74, // D5
  '0': 75, // D#5
  'p': 76  // E5
};
