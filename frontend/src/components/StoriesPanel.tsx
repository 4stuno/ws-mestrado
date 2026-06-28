"use client";

import { Badge, Card, Group, ScrollArea, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconBulb, IconClock, IconRoute, IconUserExclamation } from "@tabler/icons-react";
import type { Story } from "@/lib/types";
import { highlightColor } from "@/lib/format";
import { HIGHLIGHT_LABELS } from "@/lib/events";

const CATEGORY_META: Record<string, { label: string; icon: typeof IconClock }> = {
  deadline: { label: "Prazo e urgência", icon: IconClock },
  prep: { label: "Preparação e percurso", icon: IconRoute },
  bottleneck: { label: "Gargalos de conversão", icon: IconUserExclamation },
  profile: { label: "Perfis comportamentais", icon: IconBulb },
};

interface Props {
  stories: Story[];
}

export function StoriesPanel({ stories }: Props) {
  const grouped = stories.reduce<Record<string, Story[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});

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
      <ScrollArea h={400} offsetScrollbars type="auto">
        {stories.length === 0 && (
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
                  <Text size="xs" c="dimmed" mt={6} fs="italic">
                    {s.question}
                  </Text>
                  <Text size="xs" mt={8} fw={600} c="indigo.7">
                    {s.affected_count} alunos impactados ({s.affected_pct}% da turma visível)
                  </Text>
                </Card>
              ))}
            </Stack>
          );
        })}
      </ScrollArea>
    </Stack>
  );
}
