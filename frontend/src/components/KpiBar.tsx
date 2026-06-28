"use client";

import { Group, Paper, Text, ThemeIcon } from "@mantine/core";
import {
  IconAlertTriangle,
  IconChartArrows,
  IconChartBar,
  IconTrendingDown,
  IconTrendingUp,
  IconUsers,
} from "@tabler/icons-react";

interface Props {
  kpis: Record<string, number>;
  declutterSuggested?: boolean;
}

export function KpiBar({ kpis, declutterSuggested }: Props) {
  const items = [
    { label: "Alunos na visualização", value: kpis.users_filtered, icon: IconUsers, color: "indigo" },
    { label: "Em risco acadêmico", value: kpis.at_risk, icon: IconAlertTriangle, color: "red" },
    {
      label: "Média da turma",
      value: `${((kpis.mean_grade_ratio ?? 0) * 100).toFixed(1)}%`,
      icon: IconChartBar,
      color: "teal",
    },
    {
      label: "Melhora / Queda",
      value: `${kpis.improving ?? 0} / ${kpis.dropping ?? 0}`,
      icon: IconChartArrows,
      color: "grape",
    },
    { label: "Eventos exibidos", value: kpis.total_events_visible, icon: IconTrendingUp, color: "blue" },
  ];

  return (
    <Group gap="md" grow align="stretch">
      {items.map((it, i) => (
        <Paper
          key={it.label}
          p="md"
          radius="lg"
          className={`tl-card-hover tl-animate-in tl-stagger-${Math.min(i + 1, 4)}`}
          style={{
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(99, 102, 241, 0.12)",
          }}
        >
          <Group gap="sm">
            <ThemeIcon size={42} radius="md" variant="gradient" gradient={{ from: it.color, to: "cyan", deg: 135 }}>
              <it.icon size={22} stroke={1.6} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: 0.4 }}>
                {it.label}
              </Text>
              <Text size="xl" fw={800} lh={1.2}>
                {it.value}
              </Text>
            </div>
          </Group>
        </Paper>
      ))}
      {declutterSuggested && (
        <Paper
          p="md"
          radius="lg"
          className="tl-animate-in"
          style={{ background: "linear-gradient(135deg, #fffbeb, #fef3c7)", border: "1px solid #fcd34d" }}
        >
          <Group gap="xs">
            <ThemeIcon color="yellow" variant="light" size="lg">
              <IconTrendingDown size={18} />
            </ThemeIcon>
            <Text size="sm" fw={600}>
              Muitos pontos na tela — experimente &quot;Primeira ocorrência por tipo&quot; ou filtre por aluno.
            </Text>
          </Group>
        </Paper>
      )}
    </Group>
  );
}
