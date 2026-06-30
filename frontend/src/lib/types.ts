export interface TimelineRequest {
  assignment_id?: number | null;
  t_start?: number | null;
  t_end?: number | null;
  user_ids?: number[] | null;
  cities?: string[] | null;
  event_classes?: string[] | null;
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
