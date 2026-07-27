export interface StoryParams {
  fluxo_ideal: string[];
  evento_marco: string;
  evento_preparacao: string;
  evento_entrada: string;
  evento_inicio: string;
  evento_forum: string;
  eventos_navegacao: string[];
  modo_analise: "passos" | "tempo";
  modo_aderencia: "presenca" | "ordem_estrita" | "ordem_parcial";
  limiar_aderencia: number;
  modo_rapidez: "passos_adjacentes" | "mesma_sessao";
  max_materiais: number;
  min_eventos_navegacao: number;
  session_gap: number;
  min_impact_pct: number;
}

export interface TimelineRequest {
  assignment_id?: number | null;
  t_start?: number | null;
  t_end?: number | null;
  user_ids?: number[] | null;
  cities?: string[] | null;
  event_classes?: string[] | null;
  stories_respect_event_filter?: boolean;
  segment?: string | null;
  scenario: number;
  thresholds: {
    low_grade: number;
    high_grade: number;
    delta_drop: number;
    delta_rise: number;
    late_try_hours: number;
    inactivity_days: number;
    resource_prep_days: number;
  };
  story_params: StoryParams;
  declutter_mode: string;
  max_users: number;
  hide_rare_classes: boolean;
  compare_mode: string;
}

export interface TimelineEvent {
  event: string;
  class: string;
  time: number;
  seq_index: number;
}

export interface TimelineUser {
  userid: number;
  events: TimelineEvent[];
  highlight: string;
  segment: string;
  trend: string;
  grade_ratio?: number;
  delta?: number;
  adherence: number;
}

export interface Story {
  id: string;
  category: string;
  title: string;
  question: string;
  highlight: string;
  affected_count: number;
  affected_pct: number;
  params?: string[];
}

export interface TimelineResponse {
  users: TimelineUser[];
  event_classes: string[];
  kpis: Record<string, number>;
  declutter_suggested: boolean;
  course_start: number;
  course_end: number;
  quiz?: { id: number; name: string; t_open: number; t_close: number };
  stories: Story[];
  active_rules?: string[];
  story_filter_info?: {
    enabled: boolean;
    selected_event_classes: string[];
    rules: {
      id: string;
      status: "active" | "adapted" | "removed";
      reason?: string | null;
      missing_events: string[];
      adapted_fields: string[];
    }[];
  };
  flow_sequence: string[];
}

export interface StudentOption {
  userid: number;
  name: string;
  city: string;
}

export interface ScenarioOption {
  id: number;
  path: string;
  label: string;
  multilevel: boolean;
  spell: boolean;
  coalescing_repeating: boolean;
  coalescing_hidden: boolean;
  tf: boolean;
}

export interface MetaResponse {
  course: { id: number; name: string; start: number; end: number };
  quizzes: { id: number; name: string; t_open: number; t_close: number; section: string }[];
  sections: { section_name: string; section_closes: number }[];
  event_classes: Record<string, number>;
  event_class_order: string[];
  cities: { city: string; count: number }[];
  students: StudentOption[];
  users_registered: number;
  users_with_logs: number;
  segments: Record<string, number>;
  trends: Record<string, number>;
  thresholds_defaults: Record<string, number>;
  scenarios: ScenarioOption[];
  default_scenario: number;
}
