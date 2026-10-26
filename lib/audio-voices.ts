export type AudioVoice = { id: string; label: string; language: string };
export type AudioLanguage = 'de' | 'en';
/** Shown for text preparation when no document server is connected. */
export const defaultAudioVoices: AudioVoice[] = [
  { id: 'thorsten', label: 'Thorsten · Deutsch', language: 'de-DE' },
  { id: 'kerstin', label: 'Kerstin · Deutsch', language: 'de-DE' },
  { id: 'ljspeech', label: 'LJ · English (US)', language: 'en-US' },
];
export const voicesForLanguage = (voices: AudioVoice[], language: AudioLanguage) =>
  voices.filter((voice) => voice.language.toLowerCase().split(/[-_]/)[0] === language);
export const selectedAudioVoice = (voices: AudioVoice[], language: AudioLanguage, id: string) => {
  const matching = voicesForLanguage(voices, language);
  return matching.find((voice) => voice.id === id) || matching[0];
};
