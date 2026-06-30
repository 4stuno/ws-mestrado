"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppShell,
  Badge,
  Box,
  Grid,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconChartDots3, IconTimeline } from "@tabler/icons-react";
import { getMeta, postTimeline } from "@/lib/api";
import type { MetaResponse, TimelineRequest, TimelineResponse } from "@/lib/types";
import { FilterPanel } from "@/components/FilterPanel";
import { ParallelTimeline } from "@/components/ParallelTimeline";
import { StoriesPanel } from "@/components/StoriesPanel";
import { KpiBar } from "@/components/KpiBar";
import { ActivityChart } from "@/components/ActivityChart";
import { TimelineStatus, type TimelineLoadPhase } from "@/components/TimelineStatus";
import { findScenario, scenarioDisplayName } from "@/lib/scenarios";

const defaultFilters: TimelineRequest = {
  assignment_id: 12841,
  scenario: 7,
  thresholds: {
    low_grade: 0.5,
    high_grade: 0.75,
    delta_drop: 0.2,
    delta_rise: 0.15,
    late_try_hours: 24,
    inactivity_days: 5,
    resource_prep_days: 7,
  },
  declutter_mode: "first_class",
  max_users: 300,
  hide_rare_classes: true,
  compare_mode: "team",
};

export default function DashboardPage() {
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [filters, setFilters] = useState<TimelineRequest>(defaultFilters);
  const [debouncedFilters] = useDebouncedValue(filters, 350);
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadPhase, setLoadPhase] = useState<TimelineLoadPhase>("idle");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [timelineRevision, setTimelineRevision] = useState(0);
  const requestId = useRef(0);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtersPending = JSON.stringify(filters) !== JSON.stringify(debouncedFilters);
  const isBusy = loading || filtersPending;

  const loadTimeline = useCallback(async (req: TimelineRequest, metaSnapshot: MetaResponse | null) => {
    const id = ++requestId.current;
    setLoading(true);
    setLoadPhase("loading");
    setError(null);
    setSuccessMessage(null);
    if (successTimer.current) clearTimeout(successTimer.current);

    try {
      const res = await postTimeline(req);
      if (id !== requestId.current) return;

      setData(res);
      setTimelineRevision((r) => r + 1);

      if (req.user_ids?.length === 1) {
        setSelectedUser(req.user_ids[0]);
      }

      const scenario = findScenario(metaSnapshot?.scenarios, req.scenario);
      const scenarioLabel = scenario
        ? scenarioDisplayName(scenario, metaSnapshot?.default_scenario ?? 7)
        : "cenário selecionado";
      const quizName = res.quiz?.name ? ` · ${res.quiz.name}` : "";
      const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      setSuccessMessage(
        `${res.kpis.users_filtered} alunos exibidos · ${scenarioLabel}${quizName} · ${time}`,
      );
      setLoadPhase("success");
      successTimer.current = setTimeout(() => {
        setLoadPhase("idle");
        setSuccessMessage(null);
      }, 6000);
    } catch (e) {
      if (id === requestId.current) {
        setError(e instanceof Error ? e.message : "Não foi possível carregar a timeline.");
        setLoadPhase("error");
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    getMeta()
      .then((m) => {
        setMeta(m);
        if (m.default_scenario != null) {
          setFilters((f) => ({ ...f, scenario: m.default_scenario }));
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar metadados."));
  }, []);

  useEffect(() => {
    if (!meta) return;
    loadTimeline(debouncedFilters, meta);
  }, [meta, debouncedFilters, loadTimeline]);

  useEffect(() => {
    if (filtersPending && !loading) {
      setLoadPhase("pending");
    }
  }, [filtersPending, loading]);

  useEffect(() => {
    if (filters.user_ids?.length !== 1) {
      setSelectedUser(null);
    }
  }, [filters.user_ids]);

  const studentName =
    filters.user_ids?.[0] && meta?.students
      ? meta.students.find((s) => s.userid === filters.user_ids![0])?.name
      : null;

  return (
    <AppShell header={{ height: 72 }} padding="md" styles={{ main: { background: "transparent" } }}>
      <AppShell.Header className="tl-header-glass" px="lg">
        <Group justify="space-between" h="100%">
          <Group gap="md">
            <Box
              style={{
                background: "rgba(255,255,255,0.15)",
                borderRadius: 12,
                padding: 10,
                display: "flex",
              }}
            >
              <IconTimeline size={28} color="#fff" stroke={1.5} />
            </Box>
            <div>
              <Title order={3} c="white" lh={1.2}>
                Trajetórias de Aprendizagem
              </Title>
              <Text size="sm" c="rgba(255,255,255,0.85)">
                {meta?.course.name ?? "Carregando curso..."}
              </Text>
            </div>
          </Group>
          <Group gap="sm">
            {isBusy && (
              <Badge variant="white" color="dark" leftSection={<Loader size={10} color="indigo" />}>
                {filtersPending && !loading ? "Aplicando filtros…" : "Processando…"}
              </Badge>
            )}
            {!isBusy && loadPhase === "success" && (
              <Badge variant="white" color="teal">
                Atualizado
              </Badge>
            )}
            <Badge variant="light" color="gray" style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}>
              {meta?.users_with_logs ?? "—"} alunos com registros
            </Badge>
          </Group>
        </Group>
        {isBusy && <Box className="tl-loading-bar" style={{ position: "absolute", bottom: 0, left: 0, right: 0 }} />}
      </AppShell.Header>

      <AppShell.Main>
        {error && (
          <Alert color="red" mb="md" radius="md" title="Algo deu errado" variant="light">
            {error}
          </Alert>
        )}

        <TimelineStatus
          phase={loadPhase}
          successMessage={successMessage}
          onDismissSuccess={() => {
            setLoadPhase("idle");
            setSuccessMessage(null);
            if (successTimer.current) clearTimeout(successTimer.current);
          }}
        />

        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Paper
              p="lg"
              radius="lg"
              className="tl-animate-in"
              style={{
                background: "rgba(255,255,255,0.92)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(99, 102, 241, 0.15)",
                position: "sticky",
                top: 88,
                maxHeight: "calc(100vh - 100px)",
                overflowY: "auto",
              }}
            >
              <FilterPanel
                meta={meta}
                filters={filters}
                onChange={setFilters}
                filtersPending={filtersPending}
              />
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 9 }}>
            <Stack gap="lg">
              {data && (
                <div className="tl-animate-in">
                  <KpiBar kpis={data.kpis} declutterSuggested={data.declutter_suggested} />
                </div>
              )}

              <Paper
                p="lg"
                radius="lg"
                className="tl-animate-in tl-stagger-2"
                style={{
                  background: "rgba(255,255,255,0.94)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(99, 102, 241, 0.12)",
                  minHeight: 400,
                }}
              >
                <Group justify="space-between" mb="md" wrap="wrap">
                  <Group gap="xs">
                    <IconChartDots3 size={22} color="#4f46e5" />
                    <div>
                      <Text fw={700} size="lg">
                        Timeline em coordenadas paralelas
                      </Text>
                      <Text size="sm" c="dimmed">
                        Eixo horizontal: ordem dos eventos · Eixo vertical: tipo de ação
                        {studentName ? ` · Aluno: ${studentName}` : ""}
                      </Text>
                    </div>
                  </Group>
                  {data?.quiz && (
                    <Badge size="lg" variant="gradient" gradient={{ from: "indigo", to: "cyan" }}>
                      {data.quiz.name} ·{" "}
                      {new Date(data.quiz.t_open * 1000).toLocaleDateString("pt-BR")} —{" "}
                      {new Date(data.quiz.t_close * 1000).toLocaleDateString("pt-BR")}
                    </Badge>
                  )}
                </Group>

                {loading && !data ? (
                  <Stack align="center" py={80} gap="md">
                    <Loader color="indigo" size="lg" type="dots" />
                    <Text c="dimmed">Processando trajetórias...</Text>
                  </Stack>
                ) : data ? (
                  <>
                <Box style={{ position: "relative" }}>
                  {isBusy && data && (
                    <Box
                      style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 10,
                        background: "rgba(255,255,255,0.72)",
                        backdropFilter: "blur(2px)",
                        borderRadius: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Stack align="center" gap="sm">
                        <Loader color="indigo" size="lg" type="dots" />
                        <Text c="dimmed" size="sm" fw={500}>
                          {filtersPending && !loading
                            ? "Aplicando seus filtros…"
                            : "Gerando trajetórias no servidor…"}
                        </Text>
                      </Stack>
                    </Box>
                  )}

                  <ParallelTimeline
                    key={timelineRevision}
                    users={data.users}
                    eventClasses={data.event_classes}
                    selectedUserId={selectedUser}
                    onSelectUser={setSelectedUser}
                  />
                </Box>
                    <Group gap="md" mt="md">
                      <Badge color="red" variant="dot">
                        Vermelho — risco
                      </Badge>
                      <Badge color="green" variant="dot">
                        Verde — bom desempenho
                      </Badge>
                      <Badge color="gray" variant="dot">
                        Clique numa trilha para isolar o aluno
                      </Badge>
                    </Group>
                  </>
                ) : null}
              </Paper>

              {data && !isBusy && (
                <Grid gutter="lg" className="tl-animate-in tl-stagger-3">
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <Paper
                      p="lg"
                      radius="lg"
                      className="tl-card-hover"
                      style={{ background: "rgba(255,255,255,0.92)", border: "1px solid rgba(99,102,241,0.1)" }}
                    >
                      <Text fw={700} mb="md">
                        Volume por tipo de evento
                      </Text>
                      <ActivityChart users={data.users} eventClasses={data.event_classes} />
                    </Paper>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 8 }}>
                    <Paper
                      p="lg"
                      radius="lg"
                      style={{ background: "rgba(255,255,255,0.92)", border: "1px solid rgba(99,102,241,0.1)" }}
                    >
                      <StoriesPanel stories={data.stories ?? []} />
                    </Paper>
                  </Grid.Col>
                </Grid>
              )}
            </Stack>
          </Grid.Col>
        </Grid>
      </AppShell.Main>
    </AppShell>
  );
}
