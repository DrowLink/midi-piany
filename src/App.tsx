import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { DRY_HANDS_SONG } from './songs/dryHands';
import type { HandFilter, DetectedPitch } from './types/music';
import { WaterfallCanvas } from './components/WaterfallCanvas';
import type { WaterfallCanvasHandle } from './components/WaterfallCanvas';
import { PianoKeyboard } from './components/PianoKeyboard';
import { ControlBar } from './components/ControlBar';
import { PitchTuner } from './components/PitchTuner';
import { audioEngine } from './audio/audioEngine';
import { pitchDetector } from './audio/pitchDetection';
import { KEYBOARD_KEY_MAP, midiToNoteName } from './utils/musicMath';
import { Music, Sparkles, Keyboard } from 'lucide-react';

export const App: React.FC = () => {
  // Playback & Learning State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [waitMode, setWaitMode] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [handFilter, setHandFilter] = useState<HandFilter>('both');
  const [currentTime, setCurrentTime] = useState<number>(0);

  // Active inputs & Note targets
  const [activeInputMidis, setActiveInputMidis] = useState<Set<number>>(new Set());
  const [expectedMidis, setExpectedMidis] = useState<Set<number>>(new Set());
  const [handByMidi, setHandByMidi] = useState<Map<number, 'left' | 'right'>>(new Map());

  // Hardware inputs
  const [isMicListening, setIsMicListening] = useState<boolean>(false);
  const [detectedPitch, setDetectedPitch] = useState<DetectedPitch | null>(null);
  const [liveVolume, setLiveVolume] = useState<number>(0);
  const [midiDevices, setMidiDevices] = useState<string[]>([]);

  // Octave tolerance (accepts octave harmonics for acoustic piano)
  const [allowOctaveTolerance, setAllowOctaveTolerance] = useState<boolean>(true);

  // Noise gate threshold (10% to 85%, default 45% blocks background hum)
  const [thresholdPercent, setThresholdPercent] = useState<number>(45);

  const handleThresholdChange = useCallback((percent: number) => {
    setThresholdPercent(percent);
    pitchDetector.setThreshold(percent);
  }, []);

  // Refs
  const waterfallRef = useRef<WaterfallCanvasHandle | null>(null);
  const micDebounceTimeoutRef = useRef<number | null>(null);

  // Expected note name string for visual matching feedback
  const expectedNoteName = useMemo(() => {
    if (expectedMidis.size === 0) return undefined;
    const firstMidi = Array.from(expectedMidis)[0];
    return midiToNoteName(firstMidi);
  }, [expectedMidis]);

  // Handle note press from User Virtual Inputs (Mouse click, Touch, PC Keyboard, MIDI keyboard)
  const handleUserNoteDown = useCallback((midi: number) => {
    audioEngine.startNote(midi, 0.85);

    setActiveInputMidis(prev => {
      const next = new Set(prev);
      next.add(midi);
      return next;
    });

    if (waterfallRef.current) {
      waterfallRef.current.handleNoteInput(midi);
    }
  }, []);

  const handleUserNoteUp = useCallback((midi: number) => {
    audioEngine.stopNote(midi);
    setActiveInputMidis(prev => {
      const next = new Set(prev);
      next.delete(midi);
      return next;
    });
  }, []);

  // Web MIDI setup on initial mount
  useEffect(() => {
    audioEngine.initMIDI(
      (midi) => handleUserNoteDown(midi),
      (midi) => handleUserNoteUp(midi),
      (devices) => setMidiDevices(devices)
    );
  }, [handleUserNoteDown, handleUserNoteUp]);

  // Global PC Computer Keyboard event listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      const midi = KEYBOARD_KEY_MAP[key];
      if (midi) {
        handleUserNoteDown(midi);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const midi = KEYBOARD_KEY_MAP[key];
      if (midi) {
        handleUserNoteUp(midi);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleUserNoteDown, handleUserNoteUp]);

  // Toggle Microphone Pitch Detection
  const toggleMicrophone = async () => {
    if (isMicListening) {
      pitchDetector.stop();
      setIsMicListening(false);
      setDetectedPitch(null);
      setLiveVolume(0);
    } else {
      await audioEngine.init();
      pitchDetector.setThreshold(thresholdPercent);

      const ok = await pitchDetector.start((pitch, rawVol) => {
        setDetectedPitch(pitch);
        setLiveVolume(rawVol);

        if (pitch) {
          // Highlight key visually on virtual piano
          setActiveInputMidis(prev => {
            const next = new Set(prev);
            next.add(pitch.midi);
            return next;
          });

          // Check hit against waterfall wait mode
          if (waterfallRef.current) {
            waterfallRef.current.handleNoteInput(pitch.midi);
          }

          // Auto release visual key after a moment
          if (micDebounceTimeoutRef.current) {
            clearTimeout(micDebounceTimeoutRef.current);
          }
          micDebounceTimeoutRef.current = window.setTimeout(() => {
            setActiveInputMidis(prev => {
              const next = new Set(prev);
              next.delete(pitch.midi);
              return next;
            });
          }, 320);
        }
      });
      setIsMicListening(ok);
    }
  };

  // Reset Playback
  const handleReset = () => {
    if (waterfallRef.current) {
      waterfallRef.current.resetPlayback();
    }
    setCurrentTime(0);
    audioEngine.stopAll();
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      {/* Top Header */}
      <header className="flex flex-wrap items-center justify-between px-6 py-3.5 bg-slate-900/90 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 text-white shadow-lg shadow-cyan-500/20">
            <Music className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-sky-200 to-purple-300 bg-clip-text text-transparent">
                MidiPiany Synthesia
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Wait Mode
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Aprende paso a paso con caída de notas, micrófono y piano virtual
            </p>
          </div>
        </div>

        {/* Current Song Card */}
        <div className="flex items-center gap-3 bg-slate-950/80 px-4 py-2 rounded-xl border border-slate-800 shadow-inner">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <div>
            <div className="text-xs font-semibold text-slate-200">
              {DRY_HANDS_SONG.title}
            </div>
            <div className="text-[10px] text-slate-400">
              {DRY_HANDS_SONG.artist} • {DRY_HANDS_SONG.bpm} BPM
            </div>
          </div>
        </div>
      </header>

      {/* Control Bar */}
      <ControlBar
        isPlaying={isPlaying}
        onTogglePlay={() => {
          audioEngine.init();
          setIsPlaying(!isPlaying);
        }}
        onReset={handleReset}
        waitMode={waitMode}
        onToggleWaitMode={() => setWaitMode(!waitMode)}
        playbackSpeed={playbackSpeed}
        onChangeSpeed={setPlaybackSpeed}
        handFilter={handFilter}
        onChangeHandFilter={setHandFilter}
        midiDevices={midiDevices}
      />

      {/* Main Piano Synthesia Learning Area */}
      <main className="flex-1 flex flex-col justify-between max-w-7xl w-full mx-auto p-3 md:p-6 gap-3">
        {/* Pitch detection tuner & instructions row */}
        <div className="flex flex-col gap-2">
          <PitchTuner
            isListening={isMicListening}
            detectedPitch={detectedPitch}
            liveVolume={liveVolume}
            thresholdPercent={thresholdPercent}
            onChangeThreshold={handleThresholdChange}
            onToggleMic={toggleMicrophone}
            allowOctaveTolerance={allowOctaveTolerance}
            onToggleOctaveTolerance={() => setAllowOctaveTolerance(!allowOctaveTolerance)}
            expectedNoteName={expectedNoteName}
          />

          <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 px-1">
            <div className="flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-cyan-400" />
              <span>Teclas PC: <strong>Q-P</strong> (mano derecha), <strong>Z-M</strong> (mano izquierda) o clics en pantalla</span>
            </div>
            {expectedNoteName && waitMode && (
              <span className="text-amber-300 font-semibold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                Esperando nota: <strong className="text-amber-200">{expectedNoteName}</strong> en tu piano físico
              </span>
            )}
          </div>
        </div>

        {/* Central Waterfall Visualizer */}
        <div className="rounded-xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-950">
          <WaterfallCanvas
            ref={waterfallRef}
            song={DRY_HANDS_SONG}
            isPlaying={isPlaying}
            onPlayStateChange={setIsPlaying}
            playbackSpeed={playbackSpeed}
            waitMode={waitMode}
            handFilter={handFilter}
            activeInputMidis={activeInputMidis}
            allowOctaveTolerance={allowOctaveTolerance}
            minMidi={36} // C2
            maxMidi={84} // C6 (4 octavas completas)
            onExpectedNotesChange={(expected, hands) => {
              setExpectedMidis(expected);
              setHandByMidi(hands);
            }}
            onCurrentTimeChange={setCurrentTime}
          />

          {/* Bottom Interactive Piano Keyboard */}
          <PianoKeyboard
            minMidi={36}
            maxMidi={84}
            activeInputMidis={activeInputMidis}
            expectedMidis={expectedMidis}
            handByMidi={handByMidi}
            onNoteDown={handleUserNoteDown}
            onNoteUp={handleUserNoteUp}
          />
        </div>

        {/* Bottom Legend & Status */}
        <footer className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-900 px-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-purple-500"></span>
              <span>Mano Izquierda (Bajo / Acordes)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400"></span>
              <span>Mano Derecha (Melodía)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400"></span>
              <span>Nota en espera (Modo Espera)</span>
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
            <span>Tiempo: {currentTime.toFixed(1)}s / {DRY_HANDS_SONG.duration.toFixed(1)}s</span>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default App;
