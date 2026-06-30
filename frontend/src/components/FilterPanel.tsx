"use client";

import {
  Accordion,
  Alert,
  Autocomplete,
  Badge,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  Slider,
  Stack,
  Switch,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { IconAdjustments, IconFilter, IconUser } from "@tabler/icons-react";
import type { MetaResponse, TimelineRequest } from "@/lib/types";
import { getEventMeta } from "@/lib/events";
import {
  buildScenarioSelectData,
  findScenario,
  scenarioDescription,
  scenarioDisplayName,
} from "@/lib/scenarios";

interface Props {
  meta: MetaResponse | null;
  filters: TimelineRequest;
  onChange: (f: TimelineRequest) => void;
  filtersPending?: boolean;
}

export function FilterPanel({ meta, filters, onChange, filtersPending }: Props) {
  const defaultScenario = meta?.default_scenario ?? 7;

  const studentOptions =
    meta?.students?.map((s) => ({
      value: String(s.userid),
      label: `${s.name} (ID ${s.userid}) — ${s.city}`,
    })) ?? [];

  const selectedStudentLabel =
    filters.user_ids?.[0] != null
      ? studentOptions.find((o) => o.value === String(filters.user_ids![0]))?.label ?? ""
      : "";

  const scenarioSelectData = buildScenarioSelectData(meta?.scenarios ?? [], defaultScenario);
  const selectedScenario = findScenario(meta?.scenarios, filters.scenario);

  const classOptions =
    meta?.event_class_order.map((c) => {
      const m = getEventMeta(c);
      return {
        value: c,
        label: `${m.label} (${meta.event_classes[c] ?? 0})`,
      };
    }) ?? [];

  return (
    <Stack gap="lg">
      <Group gap="xs">
        <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: "indigo", to: "cyan" }}>
          <IconFilter size={18} />
        </ThemeIcon>
        <Title order={4}>Filtros e parâmetros</Title>
      </Group>

      {filtersPending && (
        <Badge variant="light" color="blue" size="sm" fullWidth>
          Filtros alterados — atualizando em breve…
        </Badge>
      )}

      <Autocomplete
        label="Aluno"
        description="Busque por nome ou ID"
        placeholder="Digite para buscar um aluno..."
        leftSection={<IconUser size={16} />}
        data={studentOptions}
        value={selectedStudentLabel}
        onChange={(label) => {
          if (!label?.trim()) {
            onChange({ ...filters, user_ids: null, max_users: 300 });
            return;
          }
          const match = studentOptions.find((o) => o.label === label || o.value === label);
          if (match) {
            onChange({ ...filters, user_ids: [Number(match.value)], max_users: 1 });
          }
        }}
        clearable
        limit={30}
        maxDropdownHeight={280}
      />

      {filters.user_ids?.length === 1 && (
        <Badge variant="light" color="indigo" size="lg">
          Modo: trilha individual
        </Badge>
      )}

      <Select
        label="Atividade"
        placeholder="Curso completo"
        clearable
        data={meta?.quizzes.map((q) => ({ value: String(q.id), label: `${q.name} (${q.section})` })) ?? []}
        value={filters.assignment_id ? String(filters.assignment_id) : null}
        onChange={(v) => onChange({ ...filters, assignment_id: v ? Number(v) : null })}
      />

      <Select
        label="Segmento de desempenho"
        placeholder="Toda a turma"
        clearable
        data={[
          { value: "risk", label: "Em risco (média abaixo de 50%)" },
          { value: "high", label: "Alto desempenho (≥ 75%)" },
          { value: "improving", label: "Tendência de melhora" },
          { value: "dropping", label: "Tendência de queda" },
          { value: "medium", label: "Desempenho médio" },
        ]}
        value={filters.segment}
        onChange={(v) => onChange({ ...filters, segment: v })}
      />

      <MultiSelect
        label="Tipos de evento"
        placeholder="Todos os tipos"
        data={classOptions}
        value={filters.event_classes ?? []}
        onChange={(v) => onChange({ ...filters, event_classes: v.length ? v : null })}
        searchable
        clearable
        maxDropdownHeight={220}
      />

      <MultiSelect
        label="Cidade"
        placeholder="Todas as cidades"
        data={meta?.cities.map((c) => ({ value: c.city, label: `${c.city} (${c.count} alunos)` })) ?? []}
        value={filters.cities ?? []}
        onChange={(v) => onChange({ ...filters, cities: v.length ? v : null })}
        searchable
        clearable
      />

      <Accordion variant="separated" radius="md" defaultValue="simp">
        <Accordion.Item value="simp">
          <Accordion.Control icon={<IconAdjustments size={16} />}>Simplificação da sequência</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              <Select
                label="Como simplificar os eventos?"
                description="Escolha o conjunto de técnicas aplicadas à sequência de cada aluno"
                searchable
                data={scenarioSelectData}
                value={String(filters.scenario)}
                onChange={(v) =>
                  onChange({ ...filters, scenario: v ? Number(v) : defaultScenario })
                }
                maxDropdownHeight={320}
                nothingFoundMessage="Nenhum cenário encontrado"
              />
              {selectedScenario && (
                <Alert variant="light" color="indigo" radius="md" p="sm">
                  <Text size="sm" fw={600} mb={4}>
                    {scenarioDisplayName(selectedScenario, defaultScenario)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {scenarioDescription(selectedScenario)}
                  </Text>
                </Alert>
              )}
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="declutter">
          <Accordion.Control>Visualização e densidade</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              <Select
                label="Modo de exibição"
                data={[
                  { value: "none", label: "Sequência completa" },
                  { value: "first_class", label: "Primeira ocorrência por tipo" },
                ]}
                value={filters.declutter_mode}
                onChange={(v) => onChange({ ...filters, declutter_mode: v || "none" })}
              />
              <Switch
                label="Ocultar eventos raros (chat)"
                checked={filters.hide_rare_classes}
                onChange={(e) => onChange({ ...filters, hide_rare_classes: e.currentTarget.checked })}
              />
              <Text size="sm" fw={500}>
                Máximo de trilhas na timeline: {filters.max_users}
              </Text>
              <Slider
                min={50}
                max={500}
                step={25}
                value={filters.max_users}
                onChange={(v) => onChange({ ...filters, max_users: v })}
                marks={[
                  { value: 50, label: "50" },
                  { value: 300, label: "300" },
                  { value: 500, label: "500" },
                ]}
                disabled={!!filters.user_ids?.length}
              />
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="thresh">
          <Accordion.Control>Limiares das narrativas</Accordion.Control>
          <Accordion.Panel>
            <Group grow>
              <NumberInput
                label="Nota — limiar de risco"
                min={0}
                max={1}
                step={0.05}
                decimalScale={2}
                value={filters.thresholds.low_grade}
                onChange={(v) =>
                  onChange({ ...filters, thresholds: { ...filters.thresholds, low_grade: Number(v) || 0.5 } })
                }
              />
              <NumberInput
                label="Nota — alto desempenho"
                min={0}
                max={1}
                step={0.05}
                value={filters.thresholds.high_grade}
                onChange={(v) =>
                  onChange({ ...filters, thresholds: { ...filters.thresholds, high_grade: Number(v) || 0.75 } })
                }
              />
            </Group>
            <NumberInput
              mt="sm"
              label="Dias de inatividade antes do prazo"
              value={filters.thresholds.inactivity_days}
              onChange={(v) =>
                onChange({ ...filters, thresholds: { ...filters.thresholds, inactivity_days: Number(v) || 5 } })
              }
            />
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}
