import {
  IconBook,
  IconCheck,
  IconEye,
  IconMail,
  IconMailOpened,
  IconMessage,
  IconMessageCircle,
  IconPlayerPlay,
  IconSchool,
  IconSend,
} from "@tabler/icons-react";
import type { ComponentType } from "react";

type TablerIcon = ComponentType<{ size?: number; stroke?: number; color?: string }>;

export interface EventMeta {
  label: string;
  color: string;
  Icon: TablerIcon;
}

export const EVENT_META: Record<string, EventMeta> = {
  course_vis: { label: "Acesso ao curso", color: "indigo", Icon: IconSchool },
  resource_vis: { label: "Visualização de material", color: "cyan", Icon: IconBook },
  forum_vis: { label: "Acesso ao fórum", color: "violet", Icon: IconMessage },
  assignment_vis: { label: "Visualização da atividade", color: "blue", Icon: IconEye },
  assignment_try: { label: "Tentativa na atividade", color: "orange", Icon: IconPlayerPlay },
  assignment_sub: { label: "Submissão da atividade", color: "green", Icon: IconCheck },
  forum_participation: { label: "Participação no fórum", color: "grape", Icon: IconMessageCircle },
  message_read: { label: "Leitura de mensagem (chat)", color: "gray", Icon: IconMailOpened },
  message_sent: { label: "Envio de mensagem (chat)", color: "pink", Icon: IconSend },
};

export function getEventMeta(eventClass: string): EventMeta {
  const base = eventClass.replace(/_START|_END|_SOME|_MANY/g, "");
  return (
    EVENT_META[base] ?? {
      label: base.replace(/_/g, " "),
      color: "gray",
      Icon: IconMail,
    }
  );
}

export const SEGMENT_LABELS: Record<string, string> = {
  risk: "Em risco",
  high: "Alto desempenho",
  medium: "Desempenho médio",
  improving: "Tendência de melhora",
  dropping: "Tendência de queda",
};

export const HIGHLIGHT_LABELS: Record<string, string> = {
  risk: "Risco",
  good: "Destaque positivo",
  attention: "Atenção",
  neutral: "Neutro",
};
