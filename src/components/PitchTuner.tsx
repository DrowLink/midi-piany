import React, { useState } from 'react';
import type { DetectedPitch } from '../types/music';
import { Mic, MicOff, Activity, CheckCircle2, Music2, Wand2 } from 'lucide-react';

interface PitchTunerProps {
  isListening: boolean;
  detectedPitch: DetectedPitch | null;
  liveVolume: number; // 0.0 to 1.0 real-time audio energy
  thresholdPercent: number; // 10 to 90 (%)
  onChangeThreshold: (percent: number) => void;
  onToggleMic: () => void;
  allowOctaveTolerance: boolean;
  onToggleOctaveTolerance: () => void;
  expectedNoteName?: string;
}

export const PitchTuner: React.FC<PitchTunerProps> = ({
  isListening,
  detectedPitch,
  liveVolume,
  thresholdPercent,
  onChangeThreshold,
  onToggleMic,
  allowOctaveTolerance,
  onToggleOctaveTolerance,
  expectedNoteName,
}) => {
  const [isCalibrating, setIsCalibrating] = useState(false);
  const livePercent = Math.round(liveVolume * 100);
  const isAboveThreshold = livePercent >= thresholdPercent;

  const isInTune = detectedPitch && Math.abs(detectedPitch.cents) <= 15;
  const isTargetNote = Boolean(
    detectedPitch &&
    expectedNoteName &&
    (allowOctaveTolerance
      ? detectedPitch.noteName.replace(/\d+/, '') === expectedNoteName.replace(/\d+/, '')
      : detectedPitch.noteName === expectedNoteName)
  );

  // Auto-Calibrate Noise Gate: measures peak ambient noise for 1.5s and sets threshold 10% above it
  const handleAutoCalibrate = () => {
    if (!isListening) return;
    setIsCalibrating(true);
    let peakVolume = livePercent;

    const interval = setInterval(() => {
      if (livePercent > peakVolume) {
        peakVolume = livePercent;
      }
    }, 50);

    setTimeout(() => {
      clearInterval(interval);
      setIsCalibrating(false);
      // Set threshold to peak ambient noise + 10% safety margin (clamped between 20% and 85%)
      const calibratedThreshold = Math.min(85, Math.max(20, peakVolume + 10));
      onChangeThreshold(calibratedThreshold);
    }, 1500);
  };

  return (
    <div className="w-full flex flex-col gap-3 bg-slate-900/95 border border-cyan-500/30 rounded-2xl p-4 shadow-xl backdrop-blur-md">
      {/* Top Row: Main Mic Toggle, Note Display, Octave Tolerance */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Mic Toggle Button */}
          <button
            type="button"
            onClick={onToggleMic}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer shadow-lg ${
              isListening
                ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/30 ring-2 ring-rose-400/50'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/30'
            }`}
          >
            {isListening ? (
              <>
                <Mic className="w-4 h-4 text-white animate-pulse" />
                <span>Micrófono Activado</span>
              </>
            ) : (
              <>
                <MicOff className="w-4 h-4" />
                <span>Conectar Micrófono (Piano Real)</span>
              </>
            )}
          </button>

          {/* Live Detected Note Card */}
          {isListening ? (
            <div className="flex items-center gap-3 bg-slate-950 px-3.5 py-1.5 rounded-xl border border-slate-800 min-h-[44px]">
              {detectedPitch && isAboveThreshold ? (
                <div className="flex items-center gap-2.5">
                  {/* Large Note Badge */}
                  <div
                    className={`px-3 py-1 rounded-lg text-lg font-black tracking-tight transition-all ${
                      isTargetNote
                        ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/40 animate-pulse'
                        : isInTune
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    }`}
                  >
                    {detectedPitch.noteName}
                  </div>

                  {/* Frequency & Match info */}
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono text-slate-200 font-bold">
                        {detectedPitch.frequency} Hz
                      </span>
                      {isTargetNote && (
                        <span className="flex items-center text-[10px] text-emerald-400 font-semibold gap-0.5">
                          <CheckCircle2 className="w-3 h-3" /> ¡Correcta!
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[9px] font-mono ${
                        isInTune ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {detectedPitch.cents > 0 ? `+${detectedPitch.cents}` : detectedPitch.cents} cents
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
                  <span className={`w-2 h-2 rounded-full ${isAboveThreshold ? 'bg-amber-400' : 'bg-slate-600'}`}></span>
                  <span>
                    {isAboveThreshold
                      ? 'Analizando tono...'
                      : 'Filtro activo (ruido de fondo bloqueado)'}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-400 hidden sm:inline">
              Presiona el botón para escuchar tu piano físico mediante el micrófono
            </span>
          )}
        </div>

        {/* Tolerancia de Octava Button */}
        <button
          type="button"
          onClick={onToggleOctaveTolerance}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all cursor-pointer ${
            allowOctaveTolerance
              ? 'bg-purple-600/20 border-purple-500/40 text-purple-300 shadow-sm'
              : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-400'
          }`}
          title="Tolerancia de octava: Acepta armónicos de la misma nota (ej. A2 y A3)"
        >
          <Music2 className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-[11px] font-semibold">Tolerar Octava: {allowOctaveTolerance ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* Bottom Row: Noise Gate Threshold Slider & Visual VU Meter with Gate Line */}
      {isListening && (
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800/80">
          {/* VU Meter with Threshold Marker */}
          <div className="flex-1 min-w-[280px] flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>Nivel de Entrada: <strong className="text-white font-mono">{livePercent}%</strong></span>
              </span>
              <span className="text-slate-400 font-mono text-[10px]">
                Umbral de Ruido: <strong className="text-amber-400 font-bold">{thresholdPercent}%</strong>
              </span>
            </div>

            {/* Visual Bar with Marker */}
            <div className="relative w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              {/* Live Volume Fill */}
              <div
                className={`h-full transition-all duration-75 ${
                  isAboveThreshold
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/50'
                    : 'bg-slate-700/60'
                }`}
                style={{ width: `${Math.min(100, livePercent)}%` }}
              />

              {/* Threshold Marker Needle */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-amber-400 shadow-md shadow-amber-400/80 z-10"
                style={{ left: `${thresholdPercent}%` }}
                title={`Umbral: ${thresholdPercent}%`}
              />
            </div>
          </div>

          {/* Threshold Slider & Auto Calibrate */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 whitespace-nowrap">Ajustar Umbral:</span>
              <input
                type="range"
                min="10"
                max="85"
                step="1"
                value={thresholdPercent}
                onChange={(e) => onChangeThreshold(Number(e.target.value))}
                className="w-28 sm:w-36 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <span className="text-xs font-mono text-amber-300 w-8 text-right font-bold">
                {thresholdPercent}%
              </span>
            </div>

            {/* Auto Calibrate Button */}
            <button
              type="button"
              onClick={handleAutoCalibrate}
              disabled={isCalibrating}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isCalibrating
                  ? 'bg-amber-500/20 text-amber-300 border-amber-400/50 animate-pulse'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700 hover:border-slate-600'
              }`}
              title="Mide el ruido ambiente durante 1.5s y fija el umbral por encima de él automáticamente"
            >
              <Wand2 className="w-3.5 h-3.5 text-amber-400" />
              <span>{isCalibrating ? 'Midiendo silencio...' : 'Auto-Calibrar'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
