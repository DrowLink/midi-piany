import { midiToFrequency } from '../utils/musicMath';

interface ActiveVoice {
  osc1: OscillatorNode;
  osc2: OscillatorNode;
  gain1: GainNode;
  gain2: GainNode;
  filter: BiquadFilterNode;
  voiceGain: GainNode;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private activeVoices: Map<number, ActiveVoice> = new Map();
  private midiAccess: MIDIAccess | null = null;
  private onMidiNoteOn: ((midi: number, velocity: number) => void) | null = null;
  private onMidiNoteOff: ((midi: number) => void) | null = null;
  private onMidiStatusChange: ((devices: string[]) => void) | null = null;

  /**
   * Initializes or resumes the AudioContext on user interaction.
   */
  async init(): Promise<AudioContext> {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master compressor to prevent distortion during big chords
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.6, this.ctx.currentTime);

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    return this.ctx;
  }

  /**
   * Starts a polyphonic note with warm Rhodes/acoustic piano harmonic modeling.
   */
  async startNote(midi: number, velocity = 0.8) {
    const ctx = await this.init();
    const now = ctx.currentTime;

    // Release existing voice on same MIDI key if any
    this.stopNote(midi);

    const freq = midiToFrequency(midi);

    // Voice Main Gain
    const voiceGain = ctx.createGain();
    const peakGain = Math.max(0.1, Math.min(1.0, velocity)) * 0.45;
    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.linearRampToValueAtTime(peakGain, now + 0.006); // Fast attack
    voiceGain.gain.exponentialRampToValueAtTime(peakGain * 0.4, now + 0.8); // Natural decay to sustain

    // Dynamic Lowpass Filter (mellows down after hammer strike)
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const baseCutoff = Math.min(6000, freq * 4 + 800);
    filter.frequency.setValueAtTime(baseCutoff * 1.8, now);
    filter.frequency.exponentialRampToValueAtTime(baseCutoff, now + 0.4);
    filter.Q.setValueAtTime(1.2, now);

    // Oscillator 1: Warm fundamental body (Triangle wave)
    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);

    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0.8, now);
    osc1.connect(gain1);
    gain1.connect(filter);

    // Oscillator 2: Bell/tine sparkle harmonic overtone (Sine at 2x or 3x frequency with fast decay)
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    const harmonicRatio = midi < 60 ? 3 : 2;
    osc2.frequency.setValueAtTime(freq * harmonicRatio, now);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.35, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35); // Fast tine decay
    osc2.connect(gain2);
    gain2.connect(filter);

    // Connect voice chain
    filter.connect(voiceGain);
    if (this.masterGain) {
      voiceGain.connect(this.masterGain);
    }

    osc1.start(now);
    osc2.start(now);

    this.activeVoices.set(midi, {
      osc1,
      osc2,
      gain1,
      gain2,
      filter,
      voiceGain
    });
  }

  /**
   * Stops/releases a note smoothly with natural piano damper release.
   */
  stopNote(midi: number) {
    const voice = this.activeVoices.get(midi);
    if (!voice || !this.ctx) return;

    const now = this.ctx.currentTime;
    const releaseTime = 0.25;

    // Smooth exponential release to avoid clicking
    voice.voiceGain.gain.cancelScheduledValues(now);
    voice.voiceGain.gain.setValueAtTime(Math.max(voice.voiceGain.gain.value, 0.0001), now);
    voice.voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);

    voice.osc1.stop(now + releaseTime + 0.05);
    voice.osc2.stop(now + releaseTime + 0.05);

    this.activeVoices.delete(midi);
  }

  /**
   * One-shot play for automatic song playback preview.
   */
  async playNote(midi: number, duration = 0.5, velocity = 0.8) {
    await this.startNote(midi, velocity);
    setTimeout(() => {
      this.stopNote(midi);
    }, Math.max(80, duration * 1000));
  }

  /**
   * Web MIDI API Initialization.
   */
  async initMIDI(
    onNoteOn: (midi: number, velocity: number) => void,
    onNoteOff: (midi: number) => void,
    onStatusChange: (devices: string[]) => void
  ): Promise<boolean> {
    this.onMidiNoteOn = onNoteOn;
    this.onMidiNoteOff = onNoteOff;
    this.onMidiStatusChange = onStatusChange;

    if (!navigator.requestMIDIAccess) {
      console.warn('Web MIDI API is not supported in this browser.');
      return false;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess();
      this.updateConnectedMidiDevices();

      this.midiAccess.onstatechange = () => {
        this.updateConnectedMidiDevices();
      };

      return true;
    } catch (err) {
      console.warn('Failed to access MIDI devices:', err);
      return false;
    }
  }

  private updateConnectedMidiDevices() {
    if (!this.midiAccess) return;

    const deviceNames: string[] = [];
    for (const input of this.midiAccess.inputs.values()) {
      deviceNames.push(input.name || 'Dispositivo MIDI Desconocido');
      input.onmidimessage = (event: MIDIMessageEvent) => this.handleMIDIMessage(event);
    }

    if (this.onMidiStatusChange) {
      this.onMidiStatusChange(deviceNames);
    }
  }

  private handleMIDIMessage(event: MIDIMessageEvent) {
    if (!event.data || event.data.length < 2) return;
    const [statusByte, noteNumber, velocity = 0] = event.data;
    const command = statusByte >> 4;

    if (command === 9 && velocity > 0) {
      // Note On
      this.startNote(noteNumber, velocity / 127);
      if (this.onMidiNoteOn) {
        this.onMidiNoteOn(noteNumber, velocity / 127);
      }
    } else if (command === 8 || (command === 9 && velocity === 0)) {
      // Note Off
      this.stopNote(noteNumber);
      if (this.onMidiNoteOff) {
        this.onMidiNoteOff(noteNumber);
      }
    }
  }

  /**
   * Stops all currently playing sounds.
   */
  stopAll() {
    for (const midi of Array.from(this.activeVoices.keys())) {
      this.stopNote(midi);
    }
  }
}

export const audioEngine = new AudioEngine();
