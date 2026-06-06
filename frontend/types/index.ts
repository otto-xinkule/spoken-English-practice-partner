/* ── Shared types for AI Speaking Coach ── */

export type WSMessageType =
  | "start_session" | "end_session" | "audio" | "vad_event" | "barge_in" | "set_scene"
  | "asr_result" | "llm_token" | "llm_done" | "tts_audio" | "tts_done"
  | "pronunciation_result" | "grammar_hint" | "state_change" | "error" | "session_summary" | "scene_list";

export interface SceneInfo {
  id: string; name: string; name_zh: string; icon: string; difficulty: string;
}

export interface WSMessage {
  type: WSMessageType;
  data?: Record<string, unknown>;
}

export type OrchestratorState = "IDLE" | "LISTENING" | "USER_SPEAKING" | "THINKING" | "AI_SPEAKING";

export interface VADEvent { status: "speech_start" | "speech_end" | "speaking" | "silence"; probability: number; }

export interface ASRResult { text: string; is_final: boolean; }

export interface PhonemeScore { phoneme: string; accuracy: number; }
export interface WordScore { word: string; accuracy: number; error_type: string; phonemes: PhonemeScore[]; }
export interface PronunciationResult {
  accuracy_score: number; fluency_score: number; completeness_score: number;
  pronunciation_score: number; words: WordScore[];
}

export interface GrammarHint {
  has_error: boolean; original: string; correction: string;
  explanation: string; error_type: string;
}

export interface RadarScores {
  fluency: number; grammar: number; vocabulary: number;
  pronunciation: number; comprehension: number; confidence: number;
}

export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface SessionSummary {
  session_id: string; message_count: number; barge_in_count: number;
  cefr_level?: CEFRLevel; radar_scores?: RadarScores;
  strengths?: string[]; weaknesses?: string[];
  grammar_errors: GrammarHint[]; pronunciation_scores: PronunciationResult[];
  transcript: Array<{ user: string; ai: string }>;
}
