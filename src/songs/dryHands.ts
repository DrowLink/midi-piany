import dryHandsData from './dryHands.json';
import type { Song, SongNote } from '../types/music';
import { noteNameToMidi, midiToNoteName } from '../utils/musicMath';

export const DRY_HANDS_SONG: Song = {
  id: dryHandsData.id,
  title: dryHandsData.title,
  artist: dryHandsData.artist,
  bpm: dryHandsData.bpm,
  duration: dryHandsData.duration,
  notes: dryHandsData.notes.map((rawNote, index): SongNote => {
    const midi = typeof rawNote.note === 'number'
      ? rawNote.note
      : noteNameToMidi(rawNote.note);
    const name = midiToNoteName(midi);

    return {
      id: `note-${index}-${midi}-${rawNote.time}`,
      note: rawNote.note,
      midi,
      name,
      time: rawNote.time,
      duration: rawNote.duration,
      hand: rawNote.hand as 'left' | 'right'
    };
  })
};
