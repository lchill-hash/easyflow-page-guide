export const DIAGNOSTIC_FORBIDDEN_WORDS = [
  "http",
  "url",
  "message",
  "device",
  "transcript",
] as const;

export const AUDIO_DATA_FORBIDDEN_WORDS = [
  "audioData",
  "audioBlob",
  "audioBase64",
  "audioBuffer",
  "audioUrl",
  "录音",
  "音频数据",
] as const;

export const INSTALL_BRIEF_FORBIDDEN_WORDS = [
  ...DIAGNOSTIC_FORBIDDEN_WORDS,
  "audio",
] as const;

export const ALLOWED_DIAGNOSTIC_AUDIO_VALUE = "audio-capture" as const;