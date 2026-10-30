const labels: Record<string, string> = {
  repetition_suspected: 'repetição suspeita', repeated_phrase_suspected: 'frase repetida suspeita',
  low_confidence: 'baixa confiança do modelo', low_average_confidence: 'baixa confiança média',
  words_per_second_implausible: 'texto excessivo para a duração', long_audio_with_little_text: 'pouco texto para a duração',
  long_text_on_low_energy_audio: 'muito texto em áudio de energia baixa', speaker_identity_provisional: 'identidade do falante provisória',
};
export function qualityWarning(code: string) { return labels[code] || code; }
