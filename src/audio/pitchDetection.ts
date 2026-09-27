import type { DetectedPitch } from '../types/music';
import { frequencyToMidi, midiToNoteName, getCentsOffset } from '../utils/musicMath';

export type PitchCallback = (pitch: DetectedPitch | null, rawVolume: number) => void;

export class PitchDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private highpassFilter: BiquadFilterNode | null = null;
  private lowpassFilter: BiquadFilterNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private buffer: Float32Array<ArrayBuffer> | null = null;
  private yinBuffer: Float32Array<ArrayBuffer> | null = null;
  private isListening = false;
  private rafId: number | null = null;
  private onPitchCallback: PitchCallback | null = null;

  // Search range: A1 (~55 Hz) to C6 (~1046 Hz)
  private readonly MIN_FREQ = 55;
  private readonly MAX_FREQ = 1100;

  // User-configurable noise gate threshold (0.05 to 0.95)
  // Incoming audio volume below this threshold is completely blocked
  public userThreshold = 0.35; // Default 35%
  private noiseFloor = 0.003;


  // 2-frame stability tracker (~33ms) to eliminate instantaneous noise clicks
  private stableMidi = -1;
  private stableCount = 0;
  private readonly REQUIRED_STABLE_FRAMES = 2;

  // Refractory timer to prevent a single keystroke from firing continuously
  private lastFiredMidi = -1;
  private lastFiredTime = 0;

  async start(onPitch: PitchCallback): Promise<boolean> {
    try {
      this.onPitchCallback = onPitch;
      this.noiseFloor = 0.003;
      this.stableMidi = -1;
      this.stableCount = 0;
      this.lastFiredMidi = -1;
      this.lastFiredTime = 0;

      // Pure raw instrument audio capture:
      // echoCancellation: false (crucial: avoids WebRTC killing acoustic piano notes)
      // autoGainControl: false (crucial: avoids boosting room noise during silence)
      // noiseSuppression: false (crucial: prevents muffling acoustic piano resonance)
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // 1. High-pass filter at 50 Hz: blocks sub-audible desk thuds & 50Hz/60Hz AC hum while preserving A1 (55Hz) & A2 (110Hz)
      this.highpassFilter = this.audioContext.createBiquadFilter();
      this.highpassFilter.type = 'highpass';
      this.highpassFilter.frequency.setValueAtTime(50, this.audioContext.currentTime);

      // 2. Low-pass filter at 1400 Hz: attenuates fan hiss and high-frequency noise
      this.lowpassFilter = this.audioContext.createBiquadFilter();
      this.lowpassFilter.type = 'lowpass';
      this.lowpassFilter.frequency.setValueAtTime(1400, this.audioContext.currentTime);

      // 3. Analyser with 4096 samples (ESSENTIAL for bass notes like A2 (110Hz) and D2 (73Hz) to have >= 3 cycles)
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 4096;
      this.buffer = new Float32Array(this.analyser.fftSize) as Float32Array<ArrayBuffer>;
      this.yinBuffer = new Float32Array(this.analyser.fftSize / 2) as Float32Array<ArrayBuffer>;

      this.sourceNode.connect(this.highpassFilter);
      this.highpassFilter.connect(this.lowpassFilter);
      this.lowpassFilter.connect(this.analyser);

      this.isListening = true;
      this.detectLoop();
      return true;
    } catch (err) {
      console.error('Error al inicializar micrófono:', err);
      this.stop();
      return false;
    }
  }

  stop() {
    this.isListening = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.highpassFilter) {
      this.highpassFilter.disconnect();
      this.highpassFilter = null;
    }
    if (this.lowpassFilter) {
      this.lowpassFilter.disconnect();
      this.lowpassFilter = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.buffer = null;
    this.yinBuffer = null;
    this.stableMidi = -1;
    this.stableCount = 0;
    this.lastFiredMidi = -1;

    if (this.onPitchCallback) {
      this.onPitchCallback(null, 0);
    }
  }

  get active(): boolean {
    return this.isListening;
  }

  setThreshold(percent: number) {
    this.userThreshold = Math.max(0.05, Math.min(0.95, percent / 100));
  }

  private detectLoop = () => {
    if (!this.isListening || !this.analyser || !this.buffer || !this.audioContext) return;

    this.analyser.getFloatTimeDomainData(this.buffer);

    // Compute raw RMS volume for live VU meter
    let sumSq = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      sumSq += this.buffer[i] * this.buffer[i];
    }
    const rawRms = Math.sqrt(sumSq / this.buffer.length);
    const normalizedRawVolume = Math.min(1, rawRms * 20); // 0.0 to 1.0

    // Strict Noise Gate: If volume is below the user's threshold, block completely!
    if (normalizedRawVolume < this.userThreshold) {
      this.stableCount = 0;
      this.stableMidi = -1;
      if (this.onPitchCallback) {
        this.onPitchCallback(null, normalizedRawVolume);
      }
      this.rafId = requestAnimationFrame(this.detectLoop);
      return;
    }

    const candidatePitch = this.calculatePitchStrictYin(this.buffer, this.audioContext.sampleRate, rawRms);
    const now = performance.now();

    if (candidatePitch) {
      if (candidatePitch.midi === this.stableMidi) {
        this.stableCount++;
      } else {
        this.stableMidi = candidatePitch.midi;
        this.stableCount = 1;
      }

      if (this.stableCount >= this.REQUIRED_STABLE_FRAMES) {
        const isNewNote = candidatePitch.midi !== this.lastFiredMidi;
        const cooldownExpired = (now - this.lastFiredTime) > 300;

        if (isNewNote || cooldownExpired) {
          this.lastFiredMidi = candidatePitch.midi;
          this.lastFiredTime = now;

          if (this.onPitchCallback) {
            this.onPitchCallback(candidatePitch, normalizedRawVolume);
          }
        }
      }
    } else {
      this.stableCount = 0;
      this.stableMidi = -1;

      // After 250ms of quiet, allow re-striking same note
      if (now - this.lastFiredTime > 250) {
        this.lastFiredMidi = -1;
      }

      if (this.onPitchCallback) {
        this.onPitchCallback(null, normalizedRawVolume);
      }
    }

    this.rafId = requestAnimationFrame(this.detectLoop);
  };

  /**
   * Acoustic-Piano Tuned YIN Algorithm.
   * Large 4096 buffer supports fundamental periods down to A1 (55Hz).
   */
  private calculatePitchStrictYin(buffer: Float32Array, sampleRate: number, rms: number): DetectedPitch | null {
    const bufferSize = buffer.length;
    const halfBufferSize = Math.floor(bufferSize / 2);

    // Adaptive noise tracking
    if (rms < this.noiseFloor * 1.5) {
      this.noiseFloor = this.noiseFloor * 0.95 + rms * 0.05;
    }

    // Acoustic Piano Sensitivity Gate:
    // Requires signal to be at least 1.8x ambient noise floor AND > 0.005
    const triggerThreshold = Math.max(0.005, this.noiseFloor * 1.8);
    if (rms < triggerThreshold) {
      return null; // Quiet room noise -> ignore
    }

    const minPeriod = Math.floor(sampleRate / this.MAX_FREQ);
    const maxPeriod = Math.min(halfBufferSize - 1, Math.floor(sampleRate / this.MIN_FREQ));

    const yinBuffer = this.yinBuffer || new Float32Array(halfBufferSize);

    // Step 1: Squared difference
    yinBuffer[0] = 0;
    for (let tau = 1; tau <= maxPeriod; tau++) {
      let diff = 0;
      for (let i = 0; i < halfBufferSize; i++) {
        const delta = buffer[i] - buffer[i + tau];
        diff += delta * delta;
      }
      yinBuffer[tau] = diff;
    }

    // Step 2: Cumulative mean normalized difference
    let runningSum = 0;
    yinBuffer[0] = 1;
    for (let tau = 1; tau <= maxPeriod; tau++) {
      runningSum += yinBuffer[tau];
      yinBuffer[tau] = runningSum > 0 ? (yinBuffer[tau] * tau) / runningSum : 1;
    }

    // Step 3: Absolute threshold for acoustic piano (0.22)
    // Acoustic piano strings exhibit unison beating, making 0.20-0.24 the optimal dip threshold
    let tauEstimate = -1;
    const YIN_THRESHOLD = 0.22;

    for (let tau = minPeriod; tau <= maxPeriod; tau++) {
      if (yinBuffer[tau] < YIN_THRESHOLD) {
        while (tau + 1 <= maxPeriod && yinBuffer[tau + 1] < yinBuffer[tau]) {
          tau++;
        }
        tauEstimate = tau;
        break;
      }
    }

    // Secondary check: if no dip reached 0.22, find best local minimum below 0.28
    if (tauEstimate === -1) {
      let minVal = 1.0;
      for (let tau = minPeriod; tau <= maxPeriod; tau++) {
        if (yinBuffer[tau] < minVal) {
          minVal = yinBuffer[tau];
          tauEstimate = tau;
        }
      }
      if (minVal > 0.28) {
        return null; // Aperiodic / speech / noise -> reject
      }
    }

    if (tauEstimate <= 0) return null;

    // Step 4: Parabolic interpolation
    let fineTau = tauEstimate;
    if (tauEstimate > 1 && tauEstimate < maxPeriod) {
      const s0 = yinBuffer[tauEstimate - 1];
      const s1 = yinBuffer[tauEstimate];
      const s2 = yinBuffer[tauEstimate + 1];
      const bottom = 2 * (2 * s1 - s0 - s2);
      if (bottom !== 0) {
        const delta = (s2 - s0) / bottom;
        if (Math.abs(delta) < 1) {
          fineTau = tauEstimate + delta;
        }
      }
    }

    const frequency = sampleRate / fineTau;
    if (frequency < this.MIN_FREQ || frequency > this.MAX_FREQ) {
      return null;
    }

    const midi = frequencyToMidi(frequency);
    const noteName = midiToNoteName(midi);
    const cents = getCentsOffset(frequency, midi);
    const clarity = Math.max(0, Math.min(1, 1 - yinBuffer[tauEstimate]));

    return {
      frequency: Math.round(frequency * 10) / 10,
      midi,
      noteName,
      cents,
      volume: Math.min(1, rms * 20),
      clarity: Math.round(clarity * 100) / 100
    };
  }
}

export const pitchDetector = new PitchDetector();
