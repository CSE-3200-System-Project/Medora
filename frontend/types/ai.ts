export type ChoruiMessageRole = "ai" | "user";
export type ChoruiRoleContext = "patient" | "doctor";

export interface ChoruiMessage {
  id: string;
  role: ChoruiMessageRole;
  content: string;
  timestamp: string;
  failed?: boolean;
}

export interface ChoruiStructuredData {
  symptoms: string[];
  conditions: string[];
  duration: string;
  severity: number;
}

export interface ChoruiIntakeRequest {
  message: string;
  conversation_id?: string;
  patient_id?: string;
  history: ChoruiMessage[];
  role_context?: ChoruiRoleContext;
}

export interface ChoruiIntakeResponse {
  reply: string;
  conversation_id: string;
  structured_data?: Partial<ChoruiStructuredData>;
  context_mode?: string;
}

export interface ChoruiConversationSummary {
  conversation_id: string;
  role_context: string;
  context_mode: string;
  patient_id?: string | null;
  patient_ref?: string | null;
  last_sender: string;
  last_message: string;
  updated_at: string;
}

export interface ChoruiConversationMessage {
  id: string;
  role: ChoruiMessageRole;
  content: string;
  timestamp: string;
}

export interface ChoruiConversationHistoryResponse {
  conversation_id: string;
  context_mode?: string;
  messages: ChoruiConversationMessage[];
}

export interface ChoruiConversationDeleteResponse {
  conversation_id: string;
  deleted: boolean;
}

export interface ChoruiSaveRequest {
  patient_id: string;
  structured_data: ChoruiStructuredData;
}

export const DEFAULT_CHORUI_STRUCTURED_DATA: ChoruiStructuredData = {
  symptoms: [],
  conditions: [],
  duration: "",
  severity: 0,
};

export const CHORUI_DISCLAIMER =
  "Chorui AI is an assistance tool for education and workflow support. It does not replace professional consultation or final clinical judgment.";
