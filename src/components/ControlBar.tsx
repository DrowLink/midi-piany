import React from 'react';
import type { HandFilter } from '../types/music';
import { Play, Pause, RotateCcw, PauseCircle, Gauge, Radio } from 'lucide-react';

interface ControlBarProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  waitMode: boolean;
  onToggleWaitMode: () => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
  handFilter: HandFilter;
  onChangeHandFilter: (hand: HandFilter) => void;
  midiDevices: string[];
}

export const ControlBar: React.FC<ControlBarProps> = ({
  isPlaying,
  onTogglePlay,
  onReset,
  waitMode,
  onToggleWaitMode,
  playbackSpeed,
  onChangeSpeed,
  handFilter,
  onChangeHandFilter,
  midiDevices,
}) => {
  const speeds = [0.5, 0.75, 1.0, 1.25];

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/95 border-b border-slate-800 backdrop-blur-md">
      {/* Playback Controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onTogglePlay}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all shadow-md cursor-pointer ${
            isPlaying
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/30'
          }`}
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4" />
              <span>Pausa</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Reproducir</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onReset}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer border border-slate-700"
          title="Reiniciar canción"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Wait Mode Toggle */}
        <button
          type="button"
          onClick={onToggleWaitMode}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border cursor-pointer ${
            waitMode
              ? 'bg-amber-500/20 border-amber-400/80 text-amber-300 shadow-lg shadow-amber-500/20 ring-1 ring-amber-400/50'
              : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:border-slate-600'
          }`}
          title="Modo Espera: Congela la canción hasta tocar la nota correcta"
        >
          <PauseCircle className={`w-4 h-4 ${waitMode ? 'text-amber-400 animate-spin-slow' : 'text-slate-500'}`} />
          <span>Modo Espera: {waitMode ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* Hand Filter Selector */}
      <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
        <span className="text-[11px] font-semibold text-slate-400 px-2 uppercase tracking-wider hidden sm:inline">
          Manos:
        </span>
        <button
          type="button"
          onClick={() => onChangeHandFilter('both')}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            handFilter === 'both'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Ambas
        </button>
        <button
          type="button"
          onClick={() => onChangeHandFilter('left')}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
            handFilter === 'left'
              ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40 shadow-sm'
              : 'text-slate-400 hover:text-purple-300'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-purple-500"></span>
          <span>Izquierda</span>
        </button>
        <button
          type="button"
          onClick={() => onChangeHandFilter('right')}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
            handFilter === 'right'
              ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-cyan-300'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
          <span>Derecha</span>
        </button>
      </div>

      {/* Speed Selector */}
      <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
        <Gauge className="w-3.5 h-3.5 text-slate-400 ml-2" />
        {speeds.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChangeSpeed(s)}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
              playbackSpeed === s
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* MIDI Device Status */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800/80 text-xs">
        <Radio className={`w-3.5 h-3.5 ${midiDevices.length > 0 ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`} />
        <span className="text-slate-400">
          MIDI: {midiDevices.length > 0 ? midiDevices.join(', ') : 'Ninguno detectado'}
        </span>
      </div>
    </div>
  );
};
