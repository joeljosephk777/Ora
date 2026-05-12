export type UserRole = "professor" | "ta" | "student";
export type SessionStatus = "pending" | "in_progress" | "completed";
export type MessageRole = "ai" | "student";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role: UserRole;
          created_at?: string;
        };
        Update: {
          email?: string;
          full_name?: string | null;
          role?: UserRole;
        };
      };
      assignments: {
        Row: {
          id: string;
          professor_id: string;
          title: string;
          description: string;
          rubric: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          professor_id: string;
          title: string;
          description: string;
          rubric: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string;
          rubric?: string;
          updated_at?: string;
        };
      };
      questions: {
        Row: {
          id: string;
          assignment_id: string;
          content: string;
          order_index: number;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          content: string;
          order_index: number;
        };
        Update: {
          content?: string;
          order_index?: number;
        };
      };
      submissions: {
        Row: {
          id: string;
          assignment_id: string;
          student_id: string;
          code: string;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          student_id: string;
          code: string;
          submitted_at?: string;
        };
        Update: {
          code?: string;
        };
      };
      sessions: {
        Row: {
          id: string;
          submission_id: string;
          status: SessionStatus;
          started_at: string | null;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          submission_id: string;
          status?: SessionStatus;
          started_at?: string | null;
          ended_at?: string | null;
        };
        Update: {
          status?: SessionStatus;
          started_at?: string | null;
          ended_at?: string | null;
        };
      };
      messages: {
        Row: {
          id: string;
          session_id: string;
          role: MessageRole;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          role: MessageRole;
          content: string;
          created_at?: string;
        };
        Update: never;
      };
      reports: {
        Row: {
          id: string;
          session_id: string;
          summary: string | null;
          rubric_alignment: Record<string, unknown> | null;
          suggested_score: number | null;
          final_score: number | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          summary?: string | null;
          rubric_alignment?: Record<string, unknown> | null;
          suggested_score?: number | null;
          final_score?: number | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          summary?: string | null;
          rubric_alignment?: Record<string, unknown> | null;
          suggested_score?: number | null;
          final_score?: number | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
        };
      };
    };
    Enums: {
      user_role: UserRole;
      session_status: SessionStatus;
      message_role: MessageRole;
    };
  };
};
