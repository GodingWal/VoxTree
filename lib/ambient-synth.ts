// Browser-based Ambient Sound Synthesizer using Web Audio API
// Runs completely client-side and offline, generating relaxing soundscapes.

export type AmbientSoundType = "none" | "white_noise" | "soft_rain" | "ocean_waves" | "forest_night";

class AmbientSynth {
  private audioCtx: AudioContext | null = null;
  private currentType: AmbientSoundType = "none";
  private masterGain: GainNode | null = null;
  private activeNodes: {
    source: AudioNode;
    gain: GainNode;
    extra?: any;
  }[] = [];

  constructor() {
    // AudioContext is initialized on first user interaction due to browser autoplay policies
  }

  private initContext() {
    if (this.audioCtx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    this.audioCtx = new AudioContextClass();
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
    this.masterGain.connect(this.audioCtx.destination);

    // Fade in master gain slowly
    this.masterGain.gain.linearRampToValueAtTime(0.5, this.audioCtx.currentTime + 1.5);
  }

  // Helper to create a Brown Noise buffer
  // Brown noise has a deeper, much more relaxing sound than white noise (sounds like distant waterfall/heavy rain)
  private createBrownNoiseBuffer(size = 4096 * 16): AudioBuffer {
    if (!this.audioCtx) throw new Error("AudioContext not initialized");
    const buffer = this.audioCtx.createBuffer(1, size, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    
    let lastOut = 0.0;
    for (let i = 0; i < size; i++) {
      const white = Math.random() * 2 - 1;
      // Filter white noise to create brown noise (accumulated filter)
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5; // amplify to normal volume
    }
    return buffer;
  }

  // Helper to create a Pink Noise buffer
  // Pink noise sits between white and brown noise, ideal for rain patters
  private createPinkNoiseBuffer(size = 4096 * 16): AudioBuffer {
    if (!this.audioCtx) throw new Error("AudioContext not initialized");
    const buffer = this.audioCtx.createBuffer(1, size, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < size; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      data[i] *= 0.11; // normalise
      b6 = white * 0.115926;
    }
    return buffer;
  }

  public async setSound(type: AmbientSoundType) {
    if (typeof window === "undefined") return;
    this.initContext();

    if (!this.audioCtx || !this.masterGain) return;

    if (this.audioCtx.state === "suspended") {
      try {
        await this.audioCtx.resume();
      } catch (err) {
        console.warn("Failed to resume AudioContext", err);
      }
    }

    if (this.currentType === type) return;
    this.stopCurrent();
    this.currentType = type;

    if (type === "none") return;

    switch (type) {
      case "white_noise":
        this.playBrownNoise(0.6); // Brownian noise is preferred as a relaxing white noise alternative
        break;
      case "soft_rain":
        this.playRain();
        break;
      case "ocean_waves":
        this.playOceanWaves();
        break;
      case "forest_night":
        this.playForestNight();
        break;
    }
  }

  private stopCurrent() {
    if (!this.audioCtx) return;

    // Fade out nodes before stopping to prevent clicks/pops
    const now = this.audioCtx.currentTime;
    this.activeNodes.forEach(node => {
      node.gain.gain.cancelScheduledValues(now);
      node.gain.gain.setValueAtTime(node.gain.gain.value, now);
      node.gain.gain.linearRampToValueAtTime(0, now + 0.8);
      
      // Stop sources after they fade out
      setTimeout(() => {
        try {
          if (node.source instanceof AudioBufferSourceNode) {
            node.source.stop();
          } else if (node.source instanceof OscillatorNode) {
            node.source.stop();
          }
          node.source.disconnect();
          node.gain.disconnect();
        } catch (e) {}
      }, 900);
    });

    if (this.activeNodes.some(n => n.extra?.intervalId)) {
      this.activeNodes.forEach(n => {
        if (n.extra?.intervalId) {
          clearInterval(n.extra.intervalId);
        }
      });
    }

    this.activeNodes = [];
  }

  private playBrownNoise(volume: number) {
    if (!this.audioCtx || !this.masterGain) return;

    const buffer = this.createBrownNoiseBuffer();
    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(600, this.audioCtx.currentTime);

    const gainNode = this.audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);

    source.start(0);
    gainNode.gain.linearRampToValueAtTime(volume, this.audioCtx.currentTime + 1.5);

    this.activeNodes.push({ source, gain: gainNode });
  }

  private playRain() {
    if (!this.audioCtx || !this.masterGain) return;

    // 1. Heavy rumble background (Brown Noise)
    const rumbleBuffer = this.createBrownNoiseBuffer();
    const rumbleSource = this.audioCtx.createBufferSource();
    rumbleSource.buffer = rumbleBuffer;
    rumbleSource.loop = true;

    const rumbleFilter = this.audioCtx.createBiquadFilter();
    rumbleFilter.type = "lowpass";
    rumbleFilter.frequency.setValueAtTime(250, this.audioCtx.currentTime);

    const rumbleGain = this.audioCtx.createGain();
    rumbleGain.gain.setValueAtTime(0, this.audioCtx.currentTime);

    rumbleSource.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(this.masterGain);

    rumbleSource.start(0);
    rumbleGain.gain.linearRampToValueAtTime(0.4, this.audioCtx.currentTime + 2.0);
    this.activeNodes.push({ source: rumbleSource, gain: rumbleGain });

    // 2. High patter drops (Pink Noise)
    const patterBuffer = this.createPinkNoiseBuffer();
    const patterSource = this.audioCtx.createBufferSource();
    patterSource.buffer = patterBuffer;
    patterSource.loop = true;

    const patterFilter = this.audioCtx.createBiquadFilter();
    patterFilter.type = "bandpass";
    patterFilter.frequency.setValueAtTime(1500, this.audioCtx.currentTime);
    patterFilter.Q.setValueAtTime(1.5, this.audioCtx.currentTime);

    const patterGain = this.audioCtx.createGain();
    patterGain.gain.setValueAtTime(0, this.audioCtx.currentTime);

    patterSource.connect(patterFilter);
    patterFilter.connect(patterGain);
    patterGain.connect(this.masterGain);

    patterSource.start(0);
    patterGain.gain.linearRampToValueAtTime(0.25, this.audioCtx.currentTime + 1.5);
    this.activeNodes.push({ source: patterSource, gain: patterGain });
  }

  private playOceanWaves() {
    if (!this.audioCtx || !this.masterGain) return;

    const buffer = this.createBrownNoiseBuffer();
    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(300, this.audioCtx.currentTime);

    const gainNode = this.audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);

    source.start(0);
    gainNode.gain.linearRampToValueAtTime(0.2, this.audioCtx.currentTime + 1.0);

    // Wave swell LFO simulator (modulates volume & filter frequency)
    const cycleWaves = () => {
      if (!this.audioCtx || this.currentType !== "ocean_waves") return;
      const now = this.audioCtx.currentTime;
      // Ocean wave cycles: 6-8 seconds
      // Swell up
      filter.frequency.linearRampToValueAtTime(550, now + 3.0);
      gainNode.gain.linearRampToValueAtTime(0.45, now + 3.0);
      // Fade down
      filter.frequency.linearRampToValueAtTime(180, now + 7.5);
      gainNode.gain.linearRampToValueAtTime(0.06, now + 7.5);
    };

    cycleWaves();
    const intervalId = setInterval(cycleWaves, 7500);

    this.activeNodes.push({
      source,
      gain: gainNode,
      extra: { intervalId }
    });
  }

  private playForestNight() {
    if (!this.audioCtx || !this.masterGain) return;

    // 1. Soft forest wind (lowpassed Brown Noise with volume automation)
    const windBuffer = this.createBrownNoiseBuffer();
    const windSource = this.audioCtx.createBufferSource();
    windSource.buffer = windBuffer;
    windSource.loop = true;

    const windFilter = this.audioCtx.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.setValueAtTime(180, this.audioCtx.currentTime);

    const windGain = this.audioCtx.createGain();
    windGain.gain.setValueAtTime(0, this.audioCtx.currentTime);

    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.masterGain);

    windSource.start(0);
    windGain.gain.linearRampToValueAtTime(0.18, this.audioCtx.currentTime + 2.0);
    this.activeNodes.push({ source: windSource, gain: windGain });

    const cycleWind = () => {
      if (!this.audioCtx || this.currentType !== "forest_night") return;
      const now = this.audioCtx.currentTime;
      windGain.gain.linearRampToValueAtTime(0.3, now + 4.0);
      windGain.gain.linearRampToValueAtTime(0.12, now + 9.0);
    };
    setInterval(cycleWind, 9000);

    // 2. Synthesized Crickets chirper (periodic pulses of high frequency sine waves)
    const playChirpGroup = () => {
      if (!this.audioCtx || this.currentType !== "forest_night") return;
      
      const now = this.audioCtx.currentTime;
      const cricketOsc = this.audioCtx.createOscillator();
      cricketOsc.type = "sine";
      cricketOsc.frequency.setValueAtTime(4200, now); // high pitch frequency

      const cricketFilter = this.audioCtx.createBiquadFilter();
      cricketFilter.type = "bandpass";
      cricketFilter.frequency.setValueAtTime(4200, now);
      cricketFilter.Q.setValueAtTime(5, now);

      const cricketGain = this.audioCtx.createGain();
      cricketGain.gain.setValueAtTime(0, now);

      cricketOsc.connect(cricketFilter);
      cricketFilter.connect(cricketGain);
      cricketGain.connect(this.masterGain!);

      cricketOsc.start(now);

      // Create a rapid sequence of 4-5 tiny chirps
      let time = now;
      for (let j = 0; j < 4; j++) {
        cricketGain.gain.setValueAtTime(0, time);
        cricketGain.gain.linearRampToValueAtTime(0.015, time + 0.02);
        cricketGain.gain.setValueAtTime(0.015, time + 0.05);
        cricketGain.gain.linearRampToValueAtTime(0, time + 0.07);
        time += 0.12; // spacing between chirps
      }

      cricketOsc.stop(time);
      
      // Clean up nodes after chirping group ends
      setTimeout(() => {
        cricketOsc.disconnect();
        cricketFilter.disconnect();
        cricketGain.disconnect();
      }, 1000);
    };

    // Chirp group every 3 to 5 seconds randomly
    const runCrickets = () => {
      if (this.currentType !== "forest_night") return;
      playChirpGroup();
      const nextDelay = 3000 + Math.random() * 3000;
      setTimeout(runCrickets, nextDelay);
    };

    // Delay start of crickets slightly
    setTimeout(runCrickets, 1000);
  }

  public stop() {
    this.stopCurrent();
    this.currentType = "none";
  }

  public setVolume(vol: number) {
    if (!this.audioCtx || !this.masterGain) return;
    const now = this.audioCtx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, vol)), now + 0.5);
  }
}

// Singleton pattern so only one synth plays across client route transitions
let ambientSynthInstance: AmbientSynth | null = null;

export function getAmbientSynth(): AmbientSynth {
  if (typeof window === "undefined") {
    // Mock for SSR compatibility
    return {
      setSound: async () => {},
      stop: () => {},
      setVolume: () => {}
    } as any;
  }
  if (!ambientSynthInstance) {
    ambientSynthInstance = new AmbientSynth();
  }
  return ambientSynthInstance;
}
