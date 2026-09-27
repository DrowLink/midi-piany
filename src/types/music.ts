export type HandType = 'left' | 'right';

export interface SongNote {
  id: string;
  note: string | number;
  midi: number;
  name: string;
  time: number;      // Start time in seconds
  duration: number;  // Duration in seconds
  hand: HandType;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  duration: number;
  notes: SongNote[];
}

export interface DetectedPitch {
  frequency: number;
  midi: number;
  noteName: string;
  cents: number;
  volume: number; // Normalized RMS 0.0 - 1.0
  clarity: number; // Autocorrelation correlation coefficient
}

export type HandFilter = 'both' | 'right' | 'left';
