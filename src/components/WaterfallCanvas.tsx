import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import type { Song, SongNote, HandFilter } from '../types/music';
import { generateKeyLayout } from '../utils/keyboardLayout';
import type { KeyLayoutInfo } from '../utils/keyboardLayout';
import { audioEngine } from '../audio/audioEngine';


interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  color: string;
}

export interface WaterfallCanvasHandle {
  handleNoteInput: (midi: number) => boolean; // returns true if note hit a waiting target
  resetPlayback: () => void;
  seekTo: (time: number) => void;
}

interface WaterfallCanvasProps {
  song: Song;
  isPlaying: boolean;
  onPlayStateChange: (playing: boolean) => void;
  playbackSpeed: number;
  waitMode: boolean;
  handFilter: HandFilter;
  activeInputMidis: Set<number>;
  allowOctaveTolerance?: boolean;
  minMidi?: number;
  maxMidi?: number;
  onExpectedNotesChange?: (expectedMidis: Set<number>, handByMidi: Map<number, 'left' | 'right'>) => void;
  onCurrentTimeChange?: (time: number) => void;
}

export const WaterfallCanvas = forwardRef<WaterfallCanvasHandle, WaterfallCanvasProps>(({
  song,
  isPlaying,
  onPlayStateChange,
  playbackSpeed,
  waitMode,
  handFilter,
  activeInputMidis,
  allowOctaveTolerance = true,
  minMidi = 36,
  maxMidi = 84,
  onExpectedNotesChange,
  onCurrentTimeChange,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Time and state management refs for animation loop
  const currentTimeRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const isWaitingRef = useRef<boolean>(false);
  const completedNoteIdsRef = useRef<Set<string>>(new Set());
  const satisfiedInCurrentStepRef = useRef<Set<number>>(new Set());
  const waitingNotesRef = useRef<SongNote[]>([]);
  const particlesRef = useRef<Particle[]>([]);

  // Layout lookup map: midi -> KeyLayoutInfo
  const layoutInfoRef = useRef<{
    keys: KeyLayoutInfo[];
    keyMap: Map<number, KeyLayoutInfo>;
  }>({
    keys: [],
    keyMap: new Map()
  });

  // Pixels per second of falling speed (height of travel)
  const PIXELS_PER_SECOND = 140;

  // Initialize key layout
  useEffect(() => {
    const layout = generateKeyLayout(minMidi, maxMidi);
    const map = new Map<number, KeyLayoutInfo>();
    layout.keys.forEach(k => map.set(k.midi, k));
    layoutInfoRef.current = {
      keys: layout.keys,
      keyMap: map
    };
  }, [minMidi, maxMidi]);

  // Expose imperative handle for direct user inputs (mic, midi, keyboard, click)
  useImperativeHandle(ref, () => ({
    handleNoteInput: (midi: number): boolean => {
      // Check if note satisfies a waiting requirement
      if (isWaitingRef.current && waitingNotesRef.current.length > 0) {
        const matchingTarget = waitingNotesRef.current.find(n => {
          if (satisfiedInCurrentStepRef.current.has(n.midi)) return false;
          if (n.midi === midi) return true;
          if (allowOctaveTolerance) {
            // Note pitch-class equivalence (e.g. A2 vs A3 or A1)
            return ((n.midi % 12) + 12) % 12 === ((midi % 12) + 12) % 12;
          }
          return false;
        });

        if (matchingTarget) {
          satisfiedInCurrentStepRef.current.add(matchingTarget.midi);
          triggerHitBurst(matchingTarget.midi, matchingTarget.hand);

          // Check if all waiting notes for this chord/moment are now satisfied
          const allSatisfied = waitingNotesRef.current.every(n =>
            satisfiedInCurrentStepRef.current.has(n.midi)
          );

          if (allSatisfied) {
            // Mark all as completed and release freeze!
            waitingNotesRef.current.forEach(n => completedNoteIdsRef.current.add(n.id));
            waitingNotesRef.current = [];
            satisfiedInCurrentStepRef.current.clear();
            isWaitingRef.current = false;

            if (onExpectedNotesChange) {
              onExpectedNotesChange(new Set(), new Map());
            }
          } else {
            // Update expected notes UI
            updateExpectedNotesUI();
          }
          return true;
        }
      }

      return false;
    },
    resetPlayback: () => {
      currentTimeRef.current = 0;
      completedNoteIdsRef.current.clear();
      satisfiedInCurrentStepRef.current.clear();
      waitingNotesRef.current = [];
      particlesRef.current = [];
      isWaitingRef.current = false;
      if (onExpectedNotesChange) {
        onExpectedNotesChange(new Set(), new Map());
      }
    },
    seekTo: (time: number) => {
      currentTimeRef.current = Math.max(0, Math.min(time, song.duration));
      completedNoteIdsRef.current.clear();
      satisfiedInCurrentStepRef.current.clear();
      waitingNotesRef.current = [];
      particlesRef.current = [];
      isWaitingRef.current = false;
      song.notes.forEach(n => {
        if (n.time < currentTimeRef.current) {
          completedNoteIdsRef.current.add(n.id);
        }
      });
    }
  }));

  // Trigger hit particle effect at the key position
  const triggerHitBurst = (midi: number, hand: 'left' | 'right') => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const key = layoutInfoRef.current.keyMap.get(midi);
    if (!key) return;

    const canvasWidth = canvas.width / (window.devicePixelRatio || 1);
    const canvasHeight = canvas.height / (window.devicePixelRatio || 1);
    const hitY = canvasHeight - 12;

    const keyX = (key.leftPercent / 100) * canvasWidth;
    const keyW = (key.widthPercent / 100) * canvasWidth;
    const centerX = keyX + keyW / 2;

    const baseColor = hand === 'left' ? '#c084fc' : '#22d3ee';

    // Cap particle array to prevent lag
    if (particlesRef.current.length > 30) {
      particlesRef.current.splice(0, particlesRef.current.length - 30);
    }

    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * (Math.random() - 0.5)) - Math.PI / 2;
      const speed = 2 + Math.random() * 4;
      particlesRef.current.push({
        x: centerX + (Math.random() - 0.5) * keyW * 0.4,
        y: hitY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1.0,
        size: 2 + Math.random() * 2.5,
        color: Math.random() > 0.3 ? baseColor : '#ffffff'
      });
    }
  };

  const updateExpectedNotesUI = () => {
    if (!onExpectedNotesChange) return;

    const expectedMidis = new Set<number>();
    const handMap = new Map<number, 'left' | 'right'>();

    waitingNotesRef.current.forEach(n => {
      if (!satisfiedInCurrentStepRef.current.has(n.midi)) {
        expectedMidis.add(n.midi);
        handMap.set(n.midi, n.hand);
      }
    });

    onExpectedNotesChange(expectedMidis, handMap);
  };

  // Main Animation and Physics Loop
  useEffect(() => {
    let animId: number;

    const loop = (timestamp: number) => {
      const deltaSec = Math.min((timestamp - lastFrameTimeRef.current) / 1000, 0.1);
      lastFrameTimeRef.current = timestamp;

      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(loop);
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        animId = requestAnimationFrame(loop);
        return;
      }

      const hitLineY = height - 12;

      // 1. Advance Playback Time (unless paused or waiting)
      if (isPlaying && !isWaitingRef.current) {
        currentTimeRef.current += deltaSec * playbackSpeed;
        if (onCurrentTimeChange) {
          onCurrentTimeChange(currentTimeRef.current);
        }

        // Check if song finished
        if (currentTimeRef.current > song.duration + 2.0) {
          onPlayStateChange(false);
        }
      }

      const curTime = currentTimeRef.current;

      // 2. Filter active notes according to handFilter
      const filteredNotes = song.notes.filter(note => {
        if (handFilter === 'left') return note.hand === 'left';
        if (handFilter === 'right') return note.hand === 'right';
        return true;
      });

      // 3. Collision and Wait-Mode Logic
      if (isPlaying && waitMode && !isWaitingRef.current) {
        // Find notes that are currently hitting the bottom line
        // A note hits when curTime >= note.time and hasn't been completed
        const uncompletedArrived = filteredNotes.filter(
          n => !completedNoteIdsRef.current.has(n.id) && curTime >= n.time - 0.03
        );

        if (uncompletedArrived.length > 0) {
          // Identify the closest upcoming step/chord timestamp
          const earliestTime = Math.min(...uncompletedArrived.map(n => n.time));
          // Group notes at this exact step (within 0.12s tolerance for chords)
          const chordNotes = uncompletedArrived.filter(
            n => Math.abs(n.time - earliestTime) <= 0.12
          );

          waitingNotesRef.current = chordNotes;
          satisfiedInCurrentStepRef.current.clear();
          isWaitingRef.current = true;
          // Snap current time to exact impact time
          currentTimeRef.current = earliestTime;
          updateExpectedNotesUI();
        }
      } else if (isPlaying && !waitMode) {
        // Free playback mode: auto-play synth note when it crosses hit line
        filteredNotes.forEach(n => {
          if (!completedNoteIdsRef.current.has(n.id) && curTime >= n.time) {
            completedNoteIdsRef.current.add(n.id);
            audioEngine.playNote(n.midi, n.duration, 0.75);
            triggerHitBurst(n.midi, n.hand);
          }
        });
      }

      // 4. Render Background & Key Guides
      ctx.clearRect(0, 0, width, height);

      // Deep rich modern background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      // Draw subtle key lanes
      const keys = layoutInfoRef.current.keys;
      ctx.lineWidth = 1;
      keys.forEach(k => {
        const x = (k.leftPercent / 100) * width;
        const w = (k.widthPercent / 100) * width;

        if (k.isBlack) {
          ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
          ctx.fillRect(x, 0, w, height);
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
          ctx.strokeRect(x, 0, w, height);
        }
      });

      // 5. Render Falling Note Bars
      filteredNotes.forEach(note => {
        const keyInfo = layoutInfoRef.current.keyMap.get(note.midi);
        if (!keyInfo) return;

        const x = (keyInfo.leftPercent / 100) * width;
        const w = (keyInfo.widthPercent / 100) * width;

        // Position: time difference from now to note start
        // As note.time approaches curTime, y increases toward hitLineY
        const noteLength = Math.max(18, note.duration * PIXELS_PER_SECOND);
        const yBottom = hitLineY - (note.time - curTime) * PIXELS_PER_SECOND;
        const yTop = yBottom - noteLength;

        // Only draw notes that are visible on screen
        if (yBottom < -50 || yTop > height + 50) return;

        const isCompleted = completedNoteIdsRef.current.has(note.id);
        const isCurrentlyWaiting = waitingNotesRef.current.some(n => n.id === note.id);
        const isSatisfied = satisfiedInCurrentStepRef.current.has(note.midi);

        ctx.save();

        // Rounded note rectangle
        const radius = Math.min(8, w / 2 - 1, noteLength / 2);
        const drawX = x + 1.5;
        const drawW = Math.max(4, w - 3);
        const drawH = Math.max(radius * 2, noteLength);
        const drawY = yTop;

        ctx.beginPath();
        ctx.roundRect(drawX, drawY, drawW, drawH, radius);

        // Styling based on hand and state
        let grad = ctx.createLinearGradient(drawX, drawY, drawX + drawW, drawY + drawH);

        if (isCompleted || isSatisfied) {
          // Sparkling hit note
          grad.addColorStop(0, '#fef08a');
          grad.addColorStop(1, '#eab308');
          ctx.shadowColor = 'rgba(234, 179, 8, 0.7)';
          ctx.shadowBlur = 14;
        } else if (isCurrentlyWaiting) {
          // Pulsing wait note
          const pulse = 0.7 + 0.3 * Math.sin(timestamp * 0.008);
          if (note.hand === 'left') {
            grad.addColorStop(0, `rgba(192, 132, 252, ${pulse})`);
            grad.addColorStop(1, `rgba(139, 92, 246, ${pulse})`);
            ctx.shadowColor = 'rgba(168, 85, 247, 0.8)';
          } else {
            grad.addColorStop(0, `rgba(56, 189, 248, ${pulse})`);
            grad.addColorStop(1, `rgba(6, 182, 212, ${pulse})`);
            ctx.shadowColor = 'rgba(6, 182, 212, 0.8)';
          }
          ctx.shadowBlur = 18;
        } else {
          // Normal falling note
          if (note.hand === 'left') {
            // Left Hand: Purple / Violet
            grad.addColorStop(0, '#a855f7');
            grad.addColorStop(1, '#7c3aed');
            ctx.shadowColor = 'rgba(124, 58, 237, 0.4)';
          } else {
            // Right Hand: Cyan / Teal
            grad.addColorStop(0, '#38bdf8');
            grad.addColorStop(1, '#0891b2');
            ctx.shadowColor = 'rgba(8, 145, 178, 0.4)';
          }
          ctx.shadowBlur = 8;
        }

        ctx.fillStyle = grad;
        ctx.fill();

        // Note inner glass shine
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Note name text inside the bar if wide enough
        if (drawW >= 14 && drawH >= 18) {
          ctx.fillStyle = '#ffffff';
          ctx.font = '600 11px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.shadowBlur = 0;
          ctx.fillText(note.name, drawX + drawW / 2, drawY + drawH - 5);
        }

        ctx.restore();
      });

      // 6. Render Glowing Hit Line
      ctx.save();
      const hitGlow = ctx.createLinearGradient(0, hitLineY - 6, 0, hitLineY + 6);
      hitGlow.addColorStop(0, 'rgba(6, 182, 212, 0)');
      hitGlow.addColorStop(0.5, isWaitingRef.current ? 'rgba(245, 158, 11, 0.95)' : 'rgba(56, 189, 248, 0.9)');
      hitGlow.addColorStop(1, 'rgba(6, 182, 212, 0)');

      ctx.fillStyle = hitGlow;
      ctx.fillRect(0, hitLineY - 6, width, 12);

      // Crisp neon core line
      ctx.strokeStyle = isWaitingRef.current ? '#f59e0b' : '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = isWaitingRef.current ? '#fbbf24' : '#06b6d4';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(0, hitLineY);
      ctx.lineTo(width, hitLineY);
      ctx.stroke();
      ctx.restore();

      // 7. Render Active Pressed Key Lights on Hit Line
      activeInputMidis.forEach(midi => {
        const k = layoutInfoRef.current.keyMap.get(midi);
        if (!k) return;
        const x = (k.leftPercent / 100) * width;
        const w = (k.widthPercent / 100) * width;

        ctx.save();
        const flash = ctx.createRadialGradient(x + w / 2, hitLineY, 2, x + w / 2, hitLineY, w * 1.5);
        flash.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        flash.addColorStop(0.4, 'rgba(34, 211, 238, 0.7)');
        flash.addColorStop(1, 'rgba(34, 211, 238, 0)');
        ctx.fillStyle = flash;
        ctx.fillRect(x - w / 2, hitLineY - 25, w * 2, 50);
        ctx.restore();
      });

      // 8. Render Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // Gravity
        p.alpha -= 0.025;

        if (p.alpha <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animId = requestAnimationFrame(loop);
    };

    lastFrameTimeRef.current = performance.now();
    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPlaying, playbackSpeed, waitMode, handFilter, song, activeInputMidis, onPlayStateChange, onExpectedNotesChange, onCurrentTimeChange]);

  // Responsive canvas resize handling
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-full h-[360px] md:h-[440px] bg-slate-950 overflow-hidden select-none border-b border-cyan-500/20 shadow-2xl">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
      />

      {/* Floating Status Indicator when in Wait Mode */}
      {isWaitingRef.current && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/50 backdrop-blur-md flex items-center gap-2 shadow-lg shadow-amber-500/10 animate-pulse">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
          <span className="text-amber-200 text-xs font-semibold tracking-wider uppercase">
            Modo Espera: Toca la{waitingNotesRef.current.length > 1 ? 's notas' : ' nota'} requerida{waitingNotesRef.current.length > 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
});
