/**
 * sound.ts — 탕비실 프로시저럴 사운드 엔진
 *
 * 오디오 파일 없이 Web Audio API 합성만으로 모든 효과음을 만든다.
 * - 기본 OFF, 토글 상태는 localStorage 에 저장
 * - AudioContext 는 첫 사용자 제스처 이후 lazy 생성/resume (자동재생 정책)
 * - 빗소리는 날씨 연동 루프 (setRain)
 */

export type SoundName =
  | "blip"    // UI 탭
  | "pop"     // 가벼운 팝 (만두 꺼내기 등)
  | "clink"   // 컵 내려놓기
  | "brew"    // 커피 추출 (~2s)
  | "crunch"  // 과자 씹기
  | "coin"    // 자판기 동전
  | "drop"    // 자판기 배출
  | "hum"     // 전자레인지 가동 (8s)
  | "ding"    // 전자레인지 완료
  | "water"   // 화분 물주기
  | "boom"    // 컵 결투 폭발
  | "purr"    // 고양이 골골
  | "stamp"   // 출근 도장
  | "lighter" // 라이터 (흡연실)
  | "inhale"  // 연기 들이마시기
  | "stub"    // 담배 비벼 끄기
  | "footsteps" // 복도 발자국
  | "door"    // 문 열림
  | "blast"   // 전자레인지 폭발 (컵 결투 boom 보다 크다)
  | "siren"   // 창밖 소방차
  | "chirp"   // 창틀에 앉은 새
  | "knock"   // 유리 두드리는 소리
  | "peel"    // 사과 껍질 깎이는 소리
  | "snap"    // 껍질이 툭 끊김
  | "fanfare"; // 한 번에 다 깎았을 때

const STORAGE_KEY = "tangbirsil_sound_v1";

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private rain: { gain: GainNode; src: AudioBufferSourceNode } | null = null;
  private rainWanted = false;
  private listeners = new Set<() => void>();

  enabled: boolean = (() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  })();

  // ─── 기반 ──────────────────────────────────────────────

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    try { localStorage.setItem(STORAGE_KEY, on ? "1" : "0"); } catch { /* ignore */ }
    if (on) {
      this.ensure();
      if (this.rainWanted) this.startRain();
      this.play("blip");
    } else {
      this.stopRain();
    }
    this.listeners.forEach((fn) => fn());
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** 화이트 노이즈 버퍼 (효과음 재료) */
  private noise(seconds: number): AudioBuffer | null {
    const ctx = this.ensure();
    if (!ctx) return null;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** 짧은 오실레이터 음 하나 */
  private tone(opts: {
    type?: OscillatorType; from: number; to?: number;
    dur: number; gain?: number; delay?: number; curve?: "exp" | "lin";
  }) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(opts.from, t0);
    if (opts.to !== undefined) {
      if (opts.curve === "lin") osc.frequency.linearRampToValueAtTime(opts.to, t0 + opts.dur);
      else osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t0 + opts.dur);
    }
    const peak = opts.gain ?? 0.15;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + opts.dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.05);
  }

  /** 필터 통과 노이즈 버스트 */
  private noiseBurst(opts: {
    dur: number; gain?: number; delay?: number;
    filter?: BiquadFilterType; freq?: number; freqTo?: number; q?: number;
  }) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const buf = this.noise(opts.dur + 0.05);
    if (!buf) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = opts.filter ?? "lowpass";
    f.frequency.setValueAtTime(opts.freq ?? 800, t0);
    if (opts.freqTo !== undefined) f.frequency.linearRampToValueAtTime(opts.freqTo, t0 + opts.dur);
    f.Q.value = opts.q ?? 0.8;
    const g = ctx.createGain();
    const peak = opts.gain ?? 0.12;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + opts.dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + opts.dur + 0.1);
  }

  // ─── 효과음 ────────────────────────────────────────────

  play(name: SoundName) {
    if (!this.ensure()) return;
    switch (name) {
      case "blip":
        this.tone({ type: "square", from: 720, to: 980, dur: 0.07, gain: 0.06 });
        break;
      case "pop":
        this.tone({ type: "triangle", from: 320, to: 90, dur: 0.09, gain: 0.14 });
        this.noiseBurst({ dur: 0.04, gain: 0.05, filter: "highpass", freq: 2000 });
        break;
      case "clink":
        this.tone({ from: 1800, dur: 0.12, gain: 0.08 });
        this.tone({ from: 2450, dur: 0.16, gain: 0.05, delay: 0.01 });
        break;
      case "brew":
        // 추출: 쉬이익 + 물방울 3번 (CoffeeMachine 의 2초 추출에 맞춤)
        this.noiseBurst({ dur: 1.9, gain: 0.05, filter: "bandpass", freq: 450, freqTo: 700, q: 1.6 });
        [0.5, 0.95, 1.4].forEach((d, i) =>
          this.tone({ from: 880 - i * 120, to: 300, dur: 0.1, gain: 0.05, delay: d }));
        break;
      case "crunch":
        [0, 0.09, 0.19].forEach((d) =>
          this.noiseBurst({ dur: 0.05, gain: 0.1, filter: "highpass", freq: 1400, delay: d }));
        break;
      case "coin":
        this.tone({ type: "square", from: 988, dur: 0.07, gain: 0.06 });
        this.tone({ type: "square", from: 1319, dur: 0.18, gain: 0.06, delay: 0.07 });
        break;
      case "drop":
        this.tone({ from: 190, to: 55, dur: 0.14, gain: 0.16 });
        this.noiseBurst({ dur: 0.09, gain: 0.08, filter: "lowpass", freq: 320, delay: 0.02 });
        this.noiseBurst({ dur: 0.05, gain: 0.05, filter: "lowpass", freq: 500, delay: 0.16 });
        break;
      case "hum":
        // 전자레인지 8초 가동음
        this.tone({ type: "sawtooth", from: 55, dur: 8, gain: 0.03, curve: "lin" });
        this.tone({ type: "sine", from: 110, dur: 8, gain: 0.02, curve: "lin" });
        break;
      case "ding":
        this.tone({ from: 1760, dur: 1.0, gain: 0.1 });
        this.tone({ from: 2637, dur: 0.7, gain: 0.04, delay: 0.005 });
        break;
      case "water":
        this.noiseBurst({ dur: 0.3, gain: 0.08, filter: "bandpass", freq: 900, freqTo: 2200, q: 1.2 });
        [0.12, 0.24].forEach((d, i) =>
          this.tone({ from: 1200 - i * 300, to: 500, dur: 0.08, gain: 0.04, delay: d }));
        break;
      case "boom":
        this.noiseBurst({ dur: 0.35, gain: 0.22, filter: "lowpass", freq: 260 });
        this.tone({ from: 160, to: 45, dur: 0.3, gain: 0.18 });
        break;
      case "purr": {
        // 25Hz 진폭 변조된 저역 노이즈 ≈ 골골송
        const ctx = this.ensure();
        if (!ctx || !this.master) break;
        const buf = this.noise(1.5);
        if (!buf) break;
        const t0 = ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const f = ctx.createBiquadFilter();
        f.type = "lowpass"; f.frequency.value = 150; f.Q.value = 0.7;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.25, t0 + 0.15);
        g.gain.setValueAtTime(0.25, t0 + 1.1);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.5);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 24;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.12;
        lfo.connect(lfoGain).connect(g.gain);
        src.connect(f).connect(g).connect(this.master);
        lfo.start(t0); src.start(t0);
        lfo.stop(t0 + 1.6); src.stop(t0 + 1.6);
        break;
      }
      case "stamp":
        this.tone({ from: 210, to: 85, dur: 0.07, gain: 0.16 });
        this.noiseBurst({ dur: 0.03, gain: 0.06, filter: "highpass", freq: 1200, delay: 0.005 });
        break;

      // ─── 흡연실 ───────────────────────────────────────────
      case "lighter":
        // 부싯돌 두 번 긁고, 세 번째에 불이 붙는다
        this.noiseBurst({ dur: 0.05, gain: 0.09, filter: "highpass", freq: 3200, q: 1.2 });
        this.noiseBurst({ dur: 0.05, gain: 0.09, filter: "highpass", freq: 3000, q: 1.2, delay: 0.16 });
        this.noiseBurst({ dur: 0.5, gain: 0.05, filter: "lowpass", freq: 700, freqTo: 280, delay: 0.33 });
        break;
      case "inhale":
        // 숨을 길게 빨아들이는 소리 — 대역폭이 좁아지며 올라간다
        this.noiseBurst({ dur: 1.1, gain: 0.045, filter: "bandpass", freq: 420, freqTo: 1150, q: 2.4 });
        break;
      case "stub":
        // 재떨이에 비벼 끄기 — 짧은 마찰 세 번
        [0, 0.07, 0.15].forEach((d) =>
          this.noiseBurst({ dur: 0.07, gain: 0.06, filter: "bandpass", freq: 1900, q: 0.9, delay: d }));
        break;
      case "footsteps":
        // 복도에서 다가오는 발자국 — 뒤로 갈수록 커진다
        [0, 0.42, 0.84, 1.26].forEach((d, i) => {
          this.tone({ type: "sine", from: 105, to: 48, dur: 0.11, gain: 0.05 + i * 0.022, delay: d });
          this.noiseBurst({ dur: 0.05, gain: 0.025 + i * 0.012, filter: "lowpass", freq: 420, delay: d });
        });
        break;
      case "blast":
        // 저역 충격 + 파편 노이즈 + 여운
        this.tone({ type: "sine", from: 150, to: 24, dur: 0.55, gain: 0.34 });
        this.noiseBurst({ dur: 0.35, gain: 0.22, filter: "lowpass", freq: 900, freqTo: 120 });
        this.noiseBurst({ dur: 0.7, gain: 0.07, filter: "bandpass", freq: 2400, freqTo: 500, q: 0.7, delay: 0.06 });
        this.tone({ type: "sine", from: 60, to: 18, dur: 1.1, gain: 0.12, delay: 0.12 });
        break;
      case "siren":
        // 도플러 — 다가왔다 멀어진다
        [0, 0.62, 1.24, 1.86].forEach((d, i) => {
          const far = i >= 2;
          this.tone({ type: "square", from: far ? 760 : 640, to: far ? 560 : 900, dur: 0.5, gain: far ? 0.03 : 0.05, delay: d, curve: "lin" });
        });
        break;
      case "chirp":
        // 짹짹 — 짧은 상승 삑 두 번
        [0, 0.13].forEach((d) => {
          this.tone({ type: "sine", from: 2600, to: 3900, dur: 0.06, gain: 0.045, delay: d, curve: "lin" });
          this.tone({ type: "sine", from: 3900, to: 2900, dur: 0.05, gain: 0.035, delay: d + 0.055, curve: "lin" });
        });
        break;
      case "knock":
        // 유리를 톡톡톡 — 얇고 딱딱한 타격
        [0, 0.19, 0.38].forEach((d) => {
          this.tone({ type: "sine", from: 1750, to: 900, dur: 0.05, gain: 0.06, delay: d });
          this.noiseBurst({ dur: 0.025, gain: 0.035, filter: "highpass", freq: 4200, delay: d });
        });
        break;
      case "peel":
        // 껍질이 벗겨지는 짧은 마찰 — 깎는 동안 반복해서 깔린다
        this.noiseBurst({ dur: 0.13, gain: 0.028, filter: "bandpass", freq: 2600, freqTo: 1500, q: 1.6 });
        break;
      case "snap":
        // 툭 — 끊기는 순간
        this.tone({ type: "sine", from: 900, to: 190, dur: 0.09, gain: 0.13 });
        this.noiseBurst({ dur: 0.06, gain: 0.05, filter: "highpass", freq: 2400 });
        this.tone({ type: "sine", from: 240, to: 90, dur: 0.2, gain: 0.07, delay: 0.05 });
        break;
      case "fanfare":
        // 다 깎았다 — 짧게 올라가는 세 음
        [523, 659, 784, 1047].forEach((f, i) =>
          this.tone({ type: "triangle", from: f, to: f, dur: 0.16, gain: 0.07, delay: i * 0.09 }));
        break;
      case "door":
        // 경첩 삐걱 + 닫히는 쿵
        this.tone({ type: "sawtooth", from: 240, to: 640, dur: 0.5, gain: 0.035, curve: "lin" });
        this.noiseBurst({ dur: 0.45, gain: 0.03, filter: "bandpass", freq: 1500, freqTo: 2600, q: 3 });
        this.tone({ from: 130, to: 42, dur: 0.22, gain: 0.15, delay: 0.62 });
        this.noiseBurst({ dur: 0.12, gain: 0.07, filter: "lowpass", freq: 300, delay: 0.62 });
        break;
    }
  }

  // ─── 빗소리 루프 ───────────────────────────────────────

  /** 날씨 훅에서 호출 — 비 오는 날 + 사운드 ON 이면 루프 재생 */
  setRain(on: boolean) {
    this.rainWanted = on;
    if (on && this.enabled) this.startRain();
    if (!on) this.stopRain();
  }

  private startRain() {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.rain) return;
    const buf = this.noise(2.5);
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 950; f.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 2);
    src.connect(f).connect(g).connect(this.master);
    src.start();
    this.rain = { gain: g, src };
  }

  private stopRain() {
    if (!this.rain || !this.ctx) return;
    const { gain, src } = this.rain;
    this.rain = null;
    try {
      gain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 1);
      src.stop(this.ctx.currentTime + 1.1);
    } catch { /* already stopped */ }
  }
}

/** 앱 전역 싱글턴 */
export const sound = new SoundEngine();
