/**
 * Original, dependency-free synthesized game cues.
 * Audio starts only after the user explicitly enables it from a browser gesture.
 * No external assets, analytics, trackers or network requests.
 */
export type Cue = "start" | "countdown" | "reveal" | "finish" | "correct" | "incorrect";
let audio: AudioContext | undefined;
const tones: Record<Cue, Array<[number,number]>> = {
  start: [[392,0],[523,0.13],[659,0.26]],
  countdown: [[440,0]],
  reveal: [[523,0],[659,0.12]],
  finish: [[523,0],[659,0.14],[784,0.28],[1047,0.42]],
  correct: [[587,0],[880,0.13]],
  incorrect: [[330,0],[220,0.14]],
};
export async function enableGameAudio(): Promise<boolean> {
  if (typeof window === "undefined" || !window.AudioContext) return false;
  try {
    audio ??= new AudioContext();
    await audio.resume();
    return audio.state === "running";
  } catch { return false; }
}
export function playGameCue(cue: Cue): void {
  if (!audio || audio.state !== "running") return;
  try {
    const start=audio.currentTime;
    for (const [frequency,delay] of tones[cue]) {
      const oscillator=audio.createOscillator();
      const gain=audio.createGain();
      const when=start+delay;
      const duration=cue==="finish"?0.24:0.12;
      oscillator.type=cue==="incorrect"?"triangle":"sine";
      oscillator.frequency.setValueAtTime(frequency,when);
      gain.gain.setValueAtTime(0.0001,when);
      gain.gain.exponentialRampToValueAtTime(0.09,when+0.016);
      gain.gain.exponentialRampToValueAtTime(0.0001,when+duration);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(when);
      oscillator.stop(when+duration+0.01);
    }
  } catch {
    // Unsupported or blocked audio must never interrupt live gameplay.
  }
}
