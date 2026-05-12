export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: "professor" | "ta" | "student";
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role: "professor" | "ta" | "student";
          created_at?: string;
        };
        Update: {
          email?: string;
          full_name?: string | null;
          role?: "professor" | "ta" | "student";
        };
        Relationships: [];
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
        Relationships: [
          {
            foreignKeyName: "assignments_professor_id_fkey";
            columns: ["professor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "questions_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "assignments";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "submissions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      sessions: {
        Row: {
          id: string;
          submission_id: string;
          status: "pending" | "in_progress" | "completed";
          started_at: string | null;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          submission_id: string;
          status?: "pending" | "in_progress" | "completed";
          started_at?: string | null;
          ended_at?: string | null;
        };
        Update: {
          status?: "pending" | "in_progress" | "completed";
          started_at?: string | null;
          ended_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sessions_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          }
        ];
      };
      messages: {
        Row: {
          id: string;
          session_id: string;
          role: "ai" | "student";
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          role: "ai" | "student";
          content: string;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "messages_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          }
        ];
      };
      reports: {
        Row: {
          id: string;
          session_id: string;
          summary: string | null;
          rubric_alignment: Json | null;
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
          rubric_alignment?: Json | null;
          suggested_score?: number | null;
          final_score?: number | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          summary?: string | null;
          rubric_alignment?: Json | null;
          suggested_score?: number | null;
          final_score?: number | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reports_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: "professor" | "ta" | "student";
      session_status: "pending" | "in_progress" | "completed";
      message_role: "ai" | "student";
    };
    CompositeTypes: Record<string, never>;
  };
};
