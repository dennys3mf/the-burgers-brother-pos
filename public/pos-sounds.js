const frequencies = {
  'action-success': [740, 980],
  'error': [440, 330],
  'new-order': [740, 980, 1240],
  'order-delayed': [620, 490, 620],
  'order-ready': [740, 980, 1175],
  'payment-success': [880, 1100, 1320]
};

export function createPosSounds({
  Audio = globalThis.AudioContext || globalThis.webkitAudioContext,
  fetchAudio = globalThis.fetch
} = {}) {
  const clips = new Map();
  const scheduled = new Set();
  let context;
  let loading;
  let enabled = false;
  let nextTime = 0;

  function preload() {
    loading ||= Promise.allSettled(Object.keys(frequencies).map(async cue => {
      const file = new URL('./sounds/' + cue + '.mp3', import.meta.url);
      const response = await fetchAudio(file);
      if (!response.ok) return;
      clips.set(cue, await context.decodeAudioData(await response.arrayBuffer()));
    }));
    return loading;
  }

  async function enable() {
    if (!Audio) return false;
    context ||= new Audio();
    await context.resume();
    enabled = context.state === 'running';
    if (enabled) preload();
    return enabled;
  }

  function stop() {
    for (const source of scheduled) source.stop();
    scheduled.clear();
    nextTime = context?.currentTime || 0;
  }

  function mute() {
    enabled = false;
    stop();
  }

  function start(source, gain, time, stopTime) {
    source.connect(gain).connect(context.destination);
    scheduled.add(source);
    source.onended = () => scheduled.delete(source);
    source.start(time);
    if (stopTime !== undefined) source.stop(stopTime);
  }

  function play(cue, volume = 1) {
    if (!enabled || context.state !== 'running' || !Object.hasOwn(frequencies, cue)) return false;
    const level = Math.max(0, Math.min(Number(volume) || 0, 1));
    if (!level) return false;
    const time = Math.max(context.currentTime, nextTime);
    // Limit the backlog so past operations do not keep sounding during the next one.
    if (time - context.currentTime > 3) return false;
    const clip = clips.get(cue);
    if (clip) {
      const source = context.createBufferSource();
      source.buffer = clip;
      const gain = context.createGain();
      gain.gain.setValueAtTime(level, time);
      start(source, gain, time);
      nextTime = time + clip.duration + .12;
    } else {
      frequencies[cue].forEach((frequency, index) => {
        const offset = time + .19 * index;
        const tone = context.createOscillator();
        tone.type = 'triangle';
        tone.frequency.value = frequency;
        const gain = context.createGain();
        gain.gain.setValueAtTime(.001, offset);
        gain.gain.linearRampToValueAtTime(.34 * level, offset + .025);
        gain.gain.linearRampToValueAtTime(0, offset + .17);
        start(tone, gain, offset, offset + .18);
      });
      nextTime = time + .19 * frequencies[cue].length + .12;
    }
    return true;
  }

  return { enable, mute, stop, play, ready: () => loading };
}
