"use client";

import {
  Accordion,
  Alert,
  Autocomplete,
  Badge,
  Group,
  MultiSelect,
  NumberInput,
  SegmentedControl,
  Select,
  Slider,
  Stack,
  Switch,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { IconAdjustments, IconFilter, IconRoute, IconUser } from "@tabler/icons-react";
import type { MetaResponse, StoryParams, TimelineRequest } from "@/lib/types";
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

  // opções de evento sem a contagem, para os seletores de parâmetro
  const eventSelectData =
    meta?.event_class_order.map((c) => ({ value: c, label: getEventMeta(c).label })) ?? [];

  const sp = filters.story_params;
  const setStory = (patch: Partial<StoryParams>) =>
    onChange({ ...filters, story_params: { ...sp, ...patch } });

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

        <Accordion.Item value="stories">
          <Accordion.Control icon={<IconRoute size={16} />}>
            Parâmetros das narrativas
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              <Text size="xs" c="dimmed">
                Definem como as 11 estórias são detectadas na sequência de passos. Poucos
                parâmetros influenciam várias estórias ao mesmo tempo.
              </Text>
              <Switch
                label="Estórias respeitam o filtro de tipos de evento"
                description="Quando ativo, regras podem ser removidas/adaptadas se eventos obrigatórios não estiverem selecionados."
                checked={!!filters.stories_respect_event_filter}
                onChange={(e) =>
                  onChange({ ...filters, stories_respect_event_filter: e.currentTarget.checked })
                }
              />

              <div>
                <Text size="sm" fw={600} mb={4}>
                  Modo de análise
                </Text>
                <SegmentedControl
                  fullWidth
                  size="xs"
                  data={[
                    { value: "passos", label: "Por passos" },
                    { value: "tempo", label: "Por tempo" },
                  ]}
                  value={sp.modo_analise}
                  onChange={(v) => setStory({ modo_analise: v as StoryParams["modo_analise"] })}
                />
                <Text size="xs" c="dimmed" mt={4}>
                  Passos = ordem na trilha (1º, 2º, 3º…). Tempo = data/hora real. Afeta 1 e 4.
                </Text>
              </div>

              <MultiSelect
                label="Fluxo ideal (ordem das etapas)"
                description="Caminho esperado. Afeta estórias 1 e 2."
                data={eventSelectData}
                value={sp.fluxo_ideal}
                onChange={(v) => setStory({ fluxo_ideal: v })}
                searchable
                hidePickedOptions
              />

              <Select
                label="Evento marco (entrega)"
                description="Âncora de 'antes/depois'. Afeta 1, 2, 3, 4, 7, 8, 10."
                data={eventSelectData}
                value={sp.evento_marco}
                onChange={(v) => v && setStory({ evento_marco: v })}
              />

              <Group grow>
                <Select
                  label="Evento preparação"
                  description="Estudar material. Afeta 1 e 4."
                  data={eventSelectData}
                  value={sp.evento_preparacao}
                  onChange={(v) => v && setStory({ evento_preparacao: v })}
                />
                <Select
                  label="Evento entrada"
                  description="Chegou à atividade. Afeta 5, 10, 11."
                  data={eventSelectData}
                  value={sp.evento_entrada}
                  onChange={(v) => v && setStory({ evento_entrada: v })}
                />
              </Group>

              <Group grow>
                <Select
                  label="Evento início"
                  description="Começou a tentativa. Afeta 3, 5, 10."
                  data={eventSelectData}
                  value={sp.evento_inicio}
                  onChange={(v) => v && setStory({ evento_inicio: v })}
                />
                <Select
                  label="Evento fórum"
                  description="Participação no fórum. Afeta 7. A 8 usa forum_vis (acesso)."
                  data={eventSelectData}
                  value={sp.evento_forum}
                  onChange={(v) => v && setStory({ evento_forum: v })}
                />
              </Group>

              <MultiSelect
                label="Eventos de navegação"
                description="'Navegar sem chegar à atividade'. Afeta 11."
                data={eventSelectData}
                value={sp.eventos_navegacao}
                onChange={(v) => setStory({ eventos_navegacao: v })}
                searchable
              />

              <Select
                label="Modo de aderência ao fluxo"
                description="Como medir se cumpriu o fluxo. Afeta 2."
                data={[
                  { value: "presenca", label: "Só presença das etapas" },
                  { value: "ordem_parcial", label: "Ordem parcial (permite saltos)" },
                  { value: "ordem_estrita", label: "Ordem estrita (sem pular etapas)" },
                ]}
                value={sp.modo_aderencia}
                onChange={(v) => v && setStory({ modo_aderencia: v as StoryParams["modo_aderencia"] })}
              />

              <div>
                <Text size="sm" fw={500}>
                  Limiar de aderência: {Math.round(sp.limiar_aderencia * 100)}%
                </Text>
                <Text size="xs" c="dimmed" mb={4}>
                  Abaixo disso, o aluno é marcado como fluxo incompleto. Afeta 2.
                </Text>
                <Slider
                  min={0}
                  max={1}
                  step={0.1}
                  label={(v) => `${Math.round(v * 100)}%`}
                  value={sp.limiar_aderencia}
                  onChange={(v) => setStory({ limiar_aderencia: v })}
                  marks={[
                    { value: 0.2, label: "20%" },
                    { value: 0.6, label: "60%" },
                    { value: 1, label: "100%" },
                  ]}
                />
              </div>

              <div>
                <Text size="sm" fw={500}>
                  Impacto mínimo para exibir: {Math.round(sp.min_impact_pct * 100)}%
                </Text>
                <Text size="xs" c="dimmed" mb={4}>
                  % mínima de alunos afetados para a estória aparecer. Afeta todas.
                </Text>
                <Slider
                  min={0}
                  max={0.5}
                  step={0.01}
                  label={(v) => `${Math.round(v * 100)}%`}
                  value={sp.min_impact_pct}
                  onChange={(v) => setStory({ min_impact_pct: v })}
                  marks={[
                    { value: 0, label: "0%" },
                    { value: 0.1, label: "10%" },
                    { value: 0.5, label: "50%" },
                  ]}
                />
              </div>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}
