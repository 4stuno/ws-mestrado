"use client";

import { Alert, Group, Loader, Text, Transition } from "@mantine/core";
import { IconCheck, IconClock, IconLoader2 } from "@tabler/icons-react";

export type TimelineLoadPhase = "idle" | "pending" | "loading" | "success" | "error";

interface Props {
  phase: TimelineLoadPhase;
  successMessage: string | null;
  onDismissSuccess?: () => void;
}

export function TimelineStatus({ phase, successMessage, onDismissSuccess }: Props) {
  const showPending = phase === "pending";
  const showLoading = phase === "loading";
  const showSuccess = phase === "success" && !!successMessage;

  return (
    <>
      <Transition mounted={showPending} transition="slide-down" duration={200}>
        {(styles) => (
          <Alert
            style={styles}
            mb="md"
            radius="md"
            variant="light"
            color="blue"
            icon={<IconClock size={18} />}
            title="Aguardando"
          >
            Você alterou os filtros — a timeline será atualizada em instantes.
          </Alert>
        )}
      </Transition>

      <Transition mounted={showLoading} transition="slide-down" duration={200}>
        {(styles) => (
          <Alert
            style={styles}
            mb="md"
            radius="md"
            variant="light"
            color="indigo"
            icon={<Loader size={16} />}
            title="Processando"
          >
            <Group gap="xs">
              <IconLoader2 size={14} className="tl-spin" />
              <Text size="sm">Gerando sequências no servidor… isso pode levar alguns segundos na primeira vez.</Text>
            </Group>
          </Alert>
        )}
      </Transition>

      <Transition mounted={showSuccess} transition="slide-down" duration={200}>
        {(styles) => (
          <Alert
            style={styles}
            mb="md"
            radius="md"
            variant="light"
            color="teal"
            icon={<IconCheck size={18} />}
            title="Timeline atualizada"
            withCloseButton
            onClose={onDismissSuccess}
          >
            {successMessage}
          </Alert>
        )}
      </Transition>
    </>
  );
}
