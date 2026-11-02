/** Live Web Audio chiptune. No sample files. */

const MELODY = [523.25, 659.25, 783.99, 659.25, 587.33, 523.25, 440, 392, 440, 523.25, 587.33, 493.88];
const BASS = [130.81, 130.81, 174.61, 164.81, 146.83, 130.81, 110, 98];

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let noiseBuffer = null;
  let started = false;
  const music = { next: 0, step: 0 };

  function ensure() {
    if (ctx) return true;
    const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioCtx) return false;
    try {
      ctx = new AudioCtx();
    } catch {
      ctx = null;
      return false;
    }
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.07;
    musicGain.connect(master);
    const samples = ctx.sampleRate * 1;
    noiseBuffer = ctx.createBuffer(1, samples, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1;
    return true;
  }

  function envGain(destination, freq, dur, type, gain, when, slideTo) {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), when + dur);
    amp.gain.setValueAtTime(Math.max(0.0001, gain), when);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(amp);
    amp.connect(destination);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  function burst(duration, gain, when) {
    const src = ctx.createBufferSource();
    const amp = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    src.buffer = noiseBuffer;
    filter.type = "lowpass";
    filter.frequency.value = 900;
    amp.gain.setValueAtTime(Math.max(0.0001, gain), when);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(master);
    src.start(when);
    src.stop(when + duration + 0.02);
  }

  function resume() {
    if (!ensure()) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    if (!started) {
      started = true;
      music.next = ctx.currentTime + 0.05;
    }
  }

  function setVolume(volume, muted) {
    if (!master) return;
    const value = muted ? 0 : Math.max(0, Math.min(1, volume));
    master.gain.setTargetAtTime(value, ctx.currentTime, 0.02);
  }

  function pump() {
    if (!ctx || !started || !musicGain) return;
    const horizon = ctx.currentTime + 0.35;
    while (music.next < horizon) {
      const note = MELODY[music.step % MELODY.length];
      const bass = BASS[music.step % BASS.length];
      envGain(musicGain, note, 0.22, "square", 0.2, music.next);
      if (music.step % 2 === 0) envGain(musicGain, bass, 0.28, "triangle", 0.35, music.next);
      music.next += 0.26;
      music.step += 1;
    }
  }

  function playEvents(events) {
    if (!events || !events.length || !ensure()) return;
    const now = ctx.currentTime;
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (event.type === "shove") {
        envGain(master, 180 + event.charge * 220, 0.16, "sawtooth", 0.12, now, 90);
      } else if (event.type === "hit") {
        envGain(master, 140, 0.12, "square", 0.16, now, 70);
        burst(0.08, 0.18, now);
      } else if (event.type === "ko") {
        envGain(master, 420, 0.35, "sine", 0.16, now, 80);
        burst(0.28, 0.22, now);
      } else if (event.type === "shatter") {
        burst(0.4, 0.3, now);
        envGain(master, 90, 0.3, "triangle", 0.2, now, 40);
      } else if (event.type === "pickup") {
        envGain(master, 660, 0.1, "square", 0.1, now);
        envGain(master, 880, 0.14, "square", 0.1, now + 0.08);
        envGain(master, 1180, 0.18, "square", 0.08, now + 0.16);
      } else if (event.type === "hop") {
        envGain(master, 520, 0.08, "sine", 0.06, now, 740);
      } else if (event.type === "countdown") {
        if (event.value === 0) {
          envGain(master, 880, 0.2, "square", 0.12, now);
        } else {
          envGain(master, 440 + (3 - event.value) * 40, 0.12, "square", 0.1, now);
        }
      } else if (event.type === "round") {
        envGain(master, 523, 0.16, "triangle", 0.14, now);
        envGain(master, 659, 0.16, "triangle", 0.14, now + 0.14);
        envGain(master, 784, 0.28, "triangle", 0.14, now + 0.28);
      } else if (event.type === "match") {
        [523, 659, 784, 1046].forEach((freq, index) => {
          envGain(master, freq, 0.3, "square", 0.1, now + index * 0.16);
        });
      }
    }
  }

  return { resume, setVolume, pump, playEvents, ensure };
}
