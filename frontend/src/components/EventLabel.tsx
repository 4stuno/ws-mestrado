"use client";

import { Group, Text, ThemeIcon } from "@mantine/core";
import { getEventMeta } from "@/lib/events";

interface Props {
  eventClass: string;
  compact?: boolean;
}

export function EventLabel({ eventClass, compact }: Props) {
  const meta = getEventMeta(eventClass);
  return (
    <Group gap={6} wrap="nowrap" style={{ minHeight: compact ? 28 : 36 }}>
      <ThemeIcon size={compact ? 24 : 28} radius="md" variant="light" color={meta.color}>
        <meta.Icon size={compact ? 14 : 16} stroke={1.8} />
      </ThemeIcon>
      <Text size={compact ? "xs" : "sm"} fw={500} lineClamp={2} style={{ lineHeight: 1.2 }}>
        {meta.label}
      </Text>
    </Group>
  );
}
