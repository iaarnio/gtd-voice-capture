export interface TranscriptionResult {
  text: string;
  language?: string;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface VoiceRequestContext {
  requestId: string;
  timestamp: Date;
}
