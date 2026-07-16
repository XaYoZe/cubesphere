// ============ 程序化音效引擎 (WebAudio) ============
'use strict';

const Sfx = {
  ctx: null, master: null, musicGain: null, fxGain: null,
  humOsc: null, humGain: null, fireGain: null, fireSrc: null,
  musicOn: true, started: false,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.fxGain = this.ctx.createGain();
    this.fxGain.gain.value = 1.0;
    this.fxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.32;
    this.musicGain.connect(this.master);
    this.makeNoiseBuffer();
    this.startAmbientLoops();
    this.started = true;
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  makeNoiseBuffer() {
    const len = this.ctx.sampleRate * 1.2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  },

  // ---- 基础合成单元 ----
  noiseBurst({ dur = 0.15, freq = 800, q = 1, gain = 0.5, type = 'bandpass', decay = null, pitchEnd = null }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (pitchEnd) f.frequency.exponentialRampToValueAtTime(pitchEnd, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (decay || dur));
    src.connect(f); f.connect(g); g.connect(this.fxGain);
    src.start(t); src.stop(t + dur + 0.05);
  },
  tone({ freq = 440, dur = 0.12, type = 'sine', gain = 0.25, delay = 0, slideTo = null, dest = null, attack = 0.005 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || this.fxGain);
    o.start(t); o.stop(t + dur + 0.05);
  },

  // ---- 材质音效参数 ----
  matParams: {
    grass: { freq: 520, q: 0.8, gain: 0.4, type: 'lowpass' },
    sand: { freq: 900, q: 0.6, gain: 0.35, type: 'lowpass' },
    stone: { freq: 1400, q: 1.6, gain: 0.5, type: 'bandpass' },
    wood: { freq: 340, q: 3.5, gain: 0.55, type: 'bandpass' },
    metal: { freq: 2400, q: 5, gain: 0.4, type: 'bandpass' },
  },
  dig(mat) {
    const p = this.matParams[mat] || this.matParams.stone;
    this.noiseBurst({ dur: 0.09, freq: p.freq * (0.9 + Math.random() * 0.25), q: p.q, gain: p.gain * 0.7, type: p.type });
    if (mat === 'wood') this.tone({ freq: 160 + Math.random() * 40, dur: 0.07, type: 'triangle', gain: 0.2 });
  },
  breakBlock(mat) {
    const p = this.matParams[mat] || this.matParams.stone;
    this.noiseBurst({ dur: 0.28, freq: p.freq, q: p.q * 0.7, gain: p.gain, type: p.type, pitchEnd: p.freq * 0.4 });
    this.noiseBurst({ dur: 0.18, freq: p.freq * 0.5, q: 1, gain: p.gain * 0.6, type: 'lowpass' });
  },
  place(mat) {
    const p = this.matParams[mat] || this.matParams.stone;
    this.noiseBurst({ dur: 0.12, freq: p.freq * 0.8, q: p.q, gain: p.gain * 0.8, type: p.type });
    this.tone({ freq: 90, dur: 0.08, type: 'sine', gain: 0.25 });
  },
  step(mat) {
    const p = this.matParams[mat] || this.matParams.grass;
    this.noiseBurst({ dur: 0.055, freq: p.freq * (0.8 + Math.random() * 0.5), q: p.q, gain: 0.13, type: p.type });
  },
  pop() {
    this.tone({ freq: 500 + Math.random() * 300, dur: 0.08, type: 'sine', gain: 0.28, slideTo: 1100 });
  },
  click() { this.tone({ freq: 2200, dur: 0.035, type: 'square', gain: 0.08 }); },
  uiOpen() { this.tone({ freq: 500, dur: 0.09, type: 'sine', gain: 0.15, slideTo: 750 }); },
  uiClose() { this.tone({ freq: 700, dur: 0.09, type: 'sine', gain: 0.15, slideTo: 450 }); },
  craft() {
    this.noiseBurst({ dur: 0.08, freq: 900, q: 2, gain: 0.25, type: 'bandpass' });
    this.tone({ freq: 660, dur: 0.1, type: 'triangle', gain: 0.2, delay: 0.03 });
    this.tone({ freq: 990, dur: 0.12, type: 'triangle', gain: 0.18, delay: 0.09 });
  },
  eat() {
    for (let i = 0; i < 3; i++) this.noiseBurst({ dur: 0.07, freq: 500 + i * 100, q: 1, gain: 0.3, type: 'lowpass' });
  },
  hurt() {
    this.tone({ freq: 280, dur: 0.18, type: 'sawtooth', gain: 0.25, slideTo: 140 });
  },
  levelup() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.tone({ freq: f, dur: 0.3, type: 'triangle', gain: 0.2, delay: i * 0.09 }));
  },
  research() {
    const notes = [392, 494, 587, 784, 988];
    notes.forEach((f, i) => this.tone({ freq: f, dur: 0.4, type: 'sine', gain: 0.22, delay: i * 0.11 }));
    this.noiseBurst({ dur: 0.6, freq: 3000, q: 0.6, gain: 0.08, type: 'highpass' });
  },
  techClick() { this.tone({ freq: 1200, dur: 0.06, type: 'sine', gain: 0.14, slideTo: 1600 }); },
  error() { this.tone({ freq: 220, dur: 0.14, type: 'square', gain: 0.12, slideTo: 180 }); },
  launch() {
    this.noiseBurst({ dur: 1.6, freq: 300, q: 1.2, gain: 0.5, type: 'bandpass', pitchEnd: 3200, decay: 1.6 });
    this.tone({ freq: 150, dur: 1.4, type: 'sawtooth', gain: 0.16, slideTo: 900 });
    this.tone({ freq: 75, dur: 0.7, type: 'sine', gain: 0.3, slideTo: 40 });
  },
  machinePlace() {
    this.noiseBurst({ dur: 0.2, freq: 2000, q: 3, gain: 0.3, type: 'bandpass', pitchEnd: 800 });
    this.tone({ freq: 120, dur: 0.15, type: 'sine', gain: 0.3 });
    this.tone({ freq: 1800, dur: 0.1, type: 'sine', gain: 0.1, delay: 0.12 });
  },
  splash() { this.noiseBurst({ dur: 0.35, freq: 1200, q: 0.7, gain: 0.35, type: 'lowpass', pitchEnd: 400 }); },
  victory() {
    const seq = [523, 659, 784, 1047, 784, 1047, 1319, 1568];
    seq.forEach((f, i) => this.tone({ freq: f, dur: 0.5, type: 'triangle', gain: 0.22, delay: i * 0.16 }));
  },

  // ---- 环境循环（机器嗡鸣 / 炉火） ----
  startAmbientLoops() {
    // 机器嗡鸣
    this.humGain = this.ctx.createGain(); this.humGain.gain.value = 0;
    const o1 = this.ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 58;
    const o2 = this.ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 116.5;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 3.1;
    const lfoG = this.ctx.createGain(); lfoG.gain.value = 12;
    lfo.connect(lfoG); lfoG.connect(o1.frequency);
    o1.connect(f); o2.connect(f); f.connect(this.humGain);
    this.humGain.connect(this.fxGain);
    o1.start(); o2.start(); lfo.start();
    // 炉火
    this.fireGain = this.ctx.createGain(); this.fireGain.gain.value = 0;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const ff = this.ctx.createBiquadFilter(); ff.type = 'lowpass'; ff.frequency.value = 500;
    const flick = this.ctx.createGain(); flick.gain.value = 1;
    src.connect(ff); ff.connect(flick); flick.connect(this.fireGain);
    this.fireGain.connect(this.fxGain);
    src.start();
    this.fireFlicker = flick;
    setInterval(() => {
      if (this.fireFlicker && this.ctx)
        this.fireFlicker.gain.linearRampToValueAtTime(0.5 + Math.random() * 0.6, this.ctx.currentTime + 0.12);
    }, 130);
  },
  setHum(level) {
    if (this.humGain) this.humGain.gain.linearRampToValueAtTime(Math.min(0.09, level * 0.03), this.ctx.currentTime + 0.3);
  },
  setFire(level) {
    if (this.fireGain) this.fireGain.gain.linearRampToValueAtTime(Math.min(0.12, level * 0.06), this.ctx.currentTime + 0.4);
  },

  // ---- 生成式环境音乐 ----
  chordIdx: 0,
  chords: [
    [261.6, 329.6, 392.0, 493.9],   // Cmaj7
    [220.0, 261.6, 329.6, 415.3],   // Am(maj7)-ish
    [174.6, 220.0, 261.6, 349.2],   // F
    [196.0, 246.9, 293.7, 392.0],   // G
    [146.8, 220.0, 293.7, 370.0],   // D-ish
    [164.8, 207.7, 246.9, 329.6],   // E-ish
  ],
  scale: [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3],
  musicTimer: 0,
  tickMusic(dt) {
    if (!this.ctx || !this.musicOn) return;
    this.musicTimer -= dt;
    if (this.musicTimer <= 0) {
      this.musicTimer = 7 + Math.random() * 5;
      const chord = this.chords[this.chordIdx % this.chords.length];
      this.chordIdx += (Math.random() < 0.7 ? 1 : 2);
      chord.forEach((f, i) => {
        this.tone({ freq: f / 2, dur: 6 + Math.random() * 2, type: 'sine', gain: 0.05 + Math.random() * 0.02, delay: i * 0.35, dest: this.musicGain, attack: 2.0 });
      });
      if (Math.random() < 0.65) {
        const n = 1 + (Math.random() * 3 | 0);
        for (let i = 0; i < n; i++) {
          const f = this.scale[(Math.random() * this.scale.length) | 0];
          this.tone({ freq: f * 2, dur: 1.8, type: 'triangle', gain: 0.035, delay: 1 + i * (1.2 + Math.random()), dest: this.musicGain, attack: 0.4 });
        }
      }
    }
  },
  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.musicGain) this.musicGain.gain.value = this.musicOn ? 0.32 : 0;
    return this.musicOn;
  },
  setVolume(v) { if (this.master) this.master.gain.value = v; },
};
