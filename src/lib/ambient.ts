/**
 * Free, copyright-safe "soft music" generated live in the browser with the Web Audio API.
 * No audio files, no hosting cost, works offline.
 */
export type AmbientId = "rain" | "brown" | "waves" | "pads" | "keys";

export const AMBIENT_OPTIONS: { id: AmbientId; label: string; emoji: string; hint: string }[] = [
  { id: "pads", label: "Soft Pads", emoji: "🌌", hint: "Warm, slow chords" },
  { id: "keys", label: "Dreamy Keys", emoji: "🎹", hint: "Gentle music-box notes" },
  { id: "rain", label: "Rainfall", emoji: "🌧️", hint: "Steady rain on a window" },
  { id: "waves", label: "Ocean Waves", emoji: "🌊", hint: "Slow rolling waves" },
  { id: "brown", label: "Deep Focus", emoji: "🧠", hint: "Smooth brown noise" },
];

const A_MINOR_PENTATONIC = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
const CHORDS: number[][] = [
  [220.0, 261.63, 329.63], // Am
  [174.61, 220.0, 261.63], // F
  [261.63, 329.63, 392.0], // C
  [196.0, 246.94, 293.66], // G
];

class AmbientEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private stopFns: Array<() => void> = [];
  private volume = 0.5;
  current: AmbientId | null = null;

  private ensure() {
    if (!this.ctx) {
      const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const AC = w.AudioContext || w.webkitAudioContext;
      if (!AC) throw new Error("Audio is not supported in this browser");
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return { ctx: this.ctx, master: this.master as GainNode };
  }

  private noise(ctx: AudioContext, brown: boolean) {
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      } else {
        data[i] = white;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx && this.master && this.current) {
      this.master.gain.setTargetAtTime(v * 0.9, this.ctx.currentTime, 0.1);
    }
  }

  play(id: AmbientId) {
    this.stopGraph();
    const { ctx, master } = this.ensure();
    this.current = id;

    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(master);
    this.stopFns.push(() => out.disconnect());

    if (id === "rain") {
      const n = this.noise(ctx, false);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 900;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 7000;
      const g = ctx.createGain();
      g.gain.value = 0.22;
      n.connect(hp).connect(lp).connect(g).connect(out);
      const rumble = this.noise(ctx, true);
      const rg = ctx.createGain();
      rg.gain.value = 0.18;
      rumble.connect(rg).connect(out);
      n.start();
      rumble.start();
      this.stopFns.push(() => {
        n.stop();
        rumble.stop();
      });
    } else if (id === "brown") {
      const n = this.noise(ctx, true);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1200;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      n.connect(lp).connect(g).connect(out);
      n.start();
      this.stopFns.push(() => n.stop());
    } else if (id === "waves") {
      const n = this.noise(ctx, true);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 800;
      const g = ctx.createGain();
      g.gain.value = 0.35;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.11;
      const depth = ctx.createGain();
      depth.gain.value = 0.3;
      lfo.connect(depth).connect(g.gain);
      n.connect(lp).connect(g).connect(out);
      n.start();
      lfo.start();
      this.stopFns.push(() => {
        n.stop();
        lfo.stop();
      });
    } else {
      // pads (+ keys on top)
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      const padGain = ctx.createGain();
      padGain.gain.value = id === "pads" ? 0.5 : 0.22;
      lp.connect(padGain).connect(out);

      const oscs: OscillatorNode[] = [];
      CHORDS[0].forEach((f, i) => {
        [-6, 6].forEach((detune) => {
          const o = ctx.createOscillator();
          o.type = i === 0 ? "sine" : "triangle";
          o.frequency.value = f;
          o.detune.value = detune;
          const g = ctx.createGain();
          g.gain.value = 0.09;
          o.connect(g).connect(lp);
          o.start();
          oscs.push(o);
        });
      });
      let chordIndex = 0;
      const chordTimer = window.setInterval(() => {
        chordIndex = (chordIndex + 1) % CHORDS.length;
        const chord = CHORDS[chordIndex];
        oscs.forEach((o, i) => o.frequency.setTargetAtTime(chord[Math.floor(i / 2)], ctx.currentTime, 1.6));
      }, 9000);
      this.stopFns.push(() => {
        window.clearInterval(chordTimer);
        oscs.forEach((o) => o.stop());
      });

      if (id === "keys") {
        const delay = ctx.createDelay(2);
        delay.delayTime.value = 0.46;
        const fb = ctx.createGain();
        fb.gain.value = 0.42;
        const dlp = ctx.createBiquadFilter();
        dlp.type = "lowpass";
        dlp.frequency.value = 2200;
        delay.connect(fb).connect(dlp).connect(delay);
        const keysOut = ctx.createGain();
        keysOut.gain.value = 0.55;
        keysOut.connect(out);
        delay.connect(keysOut);

        const pluck = () => {
          const f = A_MINOR_PENTATONIC[Math.floor(Math.random() * A_MINOR_PENTATONIC.length)];
          const o = ctx.createOscillator();
          o.type = "sine";
          o.frequency.value = f * (Math.random() > 0.7 ? 2 : 1);
          const g = ctx.createGain();
          const t = ctx.currentTime;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
          o.connect(g);
          g.connect(keysOut);
          g.connect(delay);
          o.start(t);
          o.stop(t + 3.2);
        };
        let keyTimer = 0;
        const schedule = () => {
          pluck();
          keyTimer = window.setTimeout(schedule, 1800 + Math.random() * 2600);
        };
        schedule();
        this.stopFns.push(() => window.clearTimeout(keyTimer));
      }
    }

    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(this.volume * 0.9, ctx.currentTime, 0.8);
  }

  private stopGraph() {
    const fns = this.stopFns;
    this.stopFns = [];
    fns.forEach((fn) => {
      try {
        fn();
      } catch {
        /* already stopped */
      }
    });
  }

  stop() {
    if (!this.ctx || !this.master) {
      this.current = null;
      return;
    }
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
    this.current = null;
    window.setTimeout(() => {
      if (!this.current) this.stopGraph();
    }, 1800);
  }
}

export const ambient = new AmbientEngine();
