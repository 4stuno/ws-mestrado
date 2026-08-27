"use client";

import { Alert, Badge, Card, Group, ScrollArea, Stack, Text, ThemeIcon, Title, Tooltip } from "@mantine/core";
import {
  IconBulb,
  IconClock,
  IconMessages,
  IconRoute,
} from "@tabler/icons-react";
import type { Story } from "@/lib/types";
import { highlightColor } from "@/lib/format";
import { HIGHLIGHT_LABELS } from "@/lib/events";

const CATEGORY_META: Record<string, { label: string; icon: typeof IconClock }> = {
  deadline: { label: "Prazo e urgência", icon: IconClock },
  prep: { label: "Preparação e percurso", icon: IconRoute },
  social: { label: "Fórum e engajamento social", icon: IconMessages },
  profile: { label: "Perfis comportamentais", icon: IconBulb },
};

interface Props {
  stories: Story[];
  storyFilterInfo?: {
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
}

export function StoriesPanel({ stories, storyFilterInfo }: Props) {
  const grouped = stories.reduce<Record<string, Story[]>>((acc, s) => {
    if (s.category === "bottleneck") {
      return acc;
    }
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});
  const removedRules = storyFilterInfo?.rules.filter((r) => r.status === "removed") ?? [];
  const adaptedRules = storyFilterInfo?.rules.filter((r) => r.status === "adapted") ?? [];

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <ThemeIcon variant="light" color="violet" size="lg" radius="md">
          <IconBulb size={20} />
        </ThemeIcon>
        <Title order={4}>Narrativas automáticas</Title>
      </Group>
      <Text size="sm" c="dimmed">
        Insights gerados a partir dos padrões detectados na turma filtrada.
      </Text>
      {storyFilterInfo?.enabled && (removedRules.length > 0 || adaptedRules.length > 0) && (
        <Alert color="yellow" variant="light" radius="md" title="Regras ajustadas pelo filtro de eventos">
          <Text size="xs">
            Removidas: {removedRules.length} · Adaptadas: {adaptedRules.length}
          </Text>
          {removedRules.slice(0, 4).map((r) => (
            <Text key={r.id} size="xs" mt={4}>
              {r.id}: {r.reason ?? "Regra removida"} {r.missing_events.length ? `(${r.missing_events.join(", ")})` : ""}
            </Text>
          ))}
        </Alert>
      )}
      <ScrollArea h={400} offsetScrollbars type="auto">
        {Object.keys(grouped).length === 0 && (
          <Text size="sm" c="dimmed" ta="center" py="lg">
            Nenhuma narrativa atingiu o limiar mínimo com os filtros atuais.
          </Text>
        )}
        {Object.entries(grouped).map(([cat, items]) => {
          const cm = CATEGORY_META[cat] ?? { label: cat, icon: IconBulb };
          return (
            <Stack key={cat} gap="xs" mb="lg">
              <Group gap={6}>
                <cm.icon size={16} color="#6366f1" />
                <Text size="xs" fw={700} tt="uppercase" c="indigo.7">
                  {cm.label}
                </Text>
              </Group>
              {items.map((s, i) => (
                <Card
                  key={s.id}
                  padding="md"
                  radius="md"
                  className="tl-card-hover tl-animate-in"
                  style={{
                    borderLeft: `4px solid ${highlightColor(s.highlight)}`,
                    animationDelay: `${i * 0.06}s`,
                    background: "rgba(255,255,255,0.9)",
                  }}
                >
                  <Group gap="xs" wrap="nowrap">
                    <Badge
                      size="sm"
                      variant="filled"
                      color={s.highlight === "risk" ? "red" : s.highlight === "good" ? "green" : "yellow"}
                    >
                      {s.id}
                    </Badge>
                    <Badge size="xs" variant="light" color="gray">
                      {HIGHLIGHT_LABELS[s.highlight] ?? s.highlight}
                    </Badge>
                  </Group>
                  <Text size="sm" fw={700} mt={8}>
                    {s.title}
                  </Text>
                  <Text size="xs" c="dimmed" mt={6}>
                    {s.question}
                  </Text>
                  <Text size="xs" mt={8} fw={600} c="indigo.7">
                    {s.affected_count} alunos impactados ({s.affected_pct}% da turma visível)
                  </Text>
                  {s.params && s.params.length > 0 && (
                    <Group gap={4} mt={8}>
                      {s.params.map((p) => (
                        <Tooltip key={p} label={`Parâmetro que influencia esta estória`} withArrow>
                          <Badge size="xs" variant="dot" color="indigo">
                            {p}
                          </Badge>
                        </Tooltip>
                      ))}
                    </Group>
                  )}
                </Card>
              ))}
            </Stack>
          );
        })}
      </ScrollArea>
    </Stack>
  );
}
