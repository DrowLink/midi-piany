import React, { useMemo } from 'react';
import { generateKeyLayout } from '../utils/keyboardLayout';
import { KEYBOARD_KEY_MAP } from '../utils/musicMath';

interface PianoKeyboardProps {
  minMidi?: number;
  maxMidi?: number;
  activeInputMidis: Set<number>;
  expectedMidis: Set<number>;
  handByMidi: Map<number, 'left' | 'right'>;
  onNoteDown: (midi: number) => void;
  onNoteUp: (midi: number) => void;
}

export const PianoKeyboard: React.FC<PianoKeyboardProps> = ({
  minMidi = 36,
  maxMidi = 84,
  activeInputMidis,
  expectedMidis,
  handByMidi,
  onNoteDown,
  onNoteUp
}) => {
  // Generate exact geometric layout identical to WaterfallCanvas
  const { keys } = useMemo(() => generateKeyLayout(minMidi, maxMidi), [minMidi, maxMidi]);

  // Reverse mapping for PC keyboard shortcut hints
  const pcKeyHintByMidi = useMemo(() => {
    const map = new Map<number, string>();
    Object.entries(KEYBOARD_KEY_MAP).forEach(([key, midi]) => {
      map.set(midi, key.toUpperCase());
    });
    return map;
  }, []);

  // Separate white keys and black keys to render black keys on top
  const whiteKeys = keys.filter(k => !k.isBlack);
  const blackKeys = keys.filter(k => k.isBlack);

  const renderKey = (key: typeof keys[0]) => {
    const isActive = activeInputMidis.has(key.midi);
    const isExpected = expectedMidis.has(key.midi);
    const expectedHand = handByMidi.get(key.midi);
    const keyHint = pcKeyHintByMidi.get(key.midi);

    // Color definitions based on state and hand
    let activeBg = '';
    let glowShadow = '';

    if (isActive) {
      activeBg = 'bg-gradient-to-t from-cyan-400 to-sky-200 text-slate-900';
      glowShadow = '0 0 20px rgba(34, 211, 238, 0.9)';
    } else if (isExpected) {
      if (expectedHand === 'left') {
        activeBg = 'bg-gradient-to-t from-purple-600 to-violet-400 text-white animate-pulse';
        glowShadow = '0 0 18px rgba(168, 85, 247, 0.85)';
      } else {
        activeBg = 'bg-gradient-to-t from-cyan-600 to-teal-300 text-white animate-pulse';
        glowShadow = '0 0 18px rgba(6, 182, 212, 0.85)';
      }
    }

    if (key.isBlack) {
      return (
        <button
          key={key.midi}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onNoteDown(key.midi); }}
          onMouseUp={(e) => { e.preventDefault(); onNoteUp(key.midi); }}
          onMouseLeave={(e) => { e.preventDefault(); onNoteUp(key.midi); }}
          onTouchStart={(e) => { e.preventDefault(); onNoteDown(key.midi); }}
          onTouchEnd={(e) => { e.preventDefault(); onNoteUp(key.midi); }}
          style={{
            left: `${key.leftPercent}%`,
            width: `${key.widthPercent}%`,
            boxShadow: glowShadow || undefined
          }}
          className={`absolute top-0 h-[62%] rounded-b-md z-20 cursor-pointer transition-all duration-75 select-none flex flex-col justify-end items-center pb-1.5 border border-slate-700/60 ${
            activeBg
              ? activeBg
              : 'bg-gradient-to-b from-slate-900 via-neutral-900 to-zinc-800 text-zinc-400 hover:from-neutral-800 hover:to-zinc-700 shadow-md shadow-black/80'
          }`}
          title={`${key.name} (MIDI ${key.midi})`}
        >
          {/* Note name & PC key hint */}
          <span className="text-[10px] font-bold tracking-tighter opacity-90 leading-none">
            {key.name}
          </span>
          {keyHint && (
            <span className="text-[8px] font-mono opacity-50 mt-0.5 leading-none bg-black/40 px-1 rounded">
              {keyHint}
            </span>
          )}
        </button>
      );
    }

    // White Key
    const isC = key.name.startsWith('C') && !key.name.includes('#');

    return (
      <button
        key={key.midi}
        type="button"
        onMouseDown={(e) => { e.preventDefault(); onNoteDown(key.midi); }}
        onMouseUp={(e) => { e.preventDefault(); onNoteUp(key.midi); }}
        onMouseLeave={(e) => { e.preventDefault(); onNoteUp(key.midi); }}
        onTouchStart={(e) => { e.preventDefault(); onNoteDown(key.midi); }}
        onTouchEnd={(e) => { e.preventDefault(); onNoteUp(key.midi); }}
        style={{
          left: `${key.leftPercent}%`,
          width: `${key.widthPercent}%`,
          boxShadow: glowShadow || undefined
        }}
        className={`absolute top-0 h-full rounded-b-lg z-10 cursor-pointer transition-all duration-75 select-none flex flex-col justify-end items-center pb-2 border-r border-l border-b border-slate-300/40 ${
          activeBg
            ? activeBg
            : 'bg-gradient-to-b from-neutral-100 via-white to-neutral-200 text-neutral-600 hover:from-slate-100 hover:to-slate-300 shadow-sm'
        }`}
        title={`${key.name} (MIDI ${key.midi})`}
      >
        {/* Highlight on C notes */}
        {isC && (
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/50 mb-1"></span>
        )}

        <span className={`text-[11px] font-semibold tracking-tighter leading-none ${isC ? 'text-cyan-700 font-bold' : ''}`}>
          {key.name}
        </span>
        {keyHint && (
          <span className="text-[9px] font-mono opacity-60 mt-1 leading-none bg-slate-200/80 text-slate-700 px-1 rounded">
            {keyHint}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="relative w-full h-[150px] md:h-[180px] bg-slate-900 select-none overflow-hidden rounded-b-xl border-t border-slate-800 shadow-2xl">
      {/* 3D Key Bed Backing */}
      <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-b from-black to-slate-900 z-30 opacity-70"></div>

      {/* White Keys */}
      {whiteKeys.map(renderKey)}

      {/* Black Keys rendered on top */}
      {blackKeys.map(renderKey)}
    </div>
  );
};
