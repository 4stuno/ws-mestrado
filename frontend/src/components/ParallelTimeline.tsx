"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { Box, Text } from "@mantine/core";
import type { TimelineUser } from "@/lib/types";
import { formatTs, highlightColor } from "@/lib/format";
import { getEventMeta, HIGHLIGHT_LABELS } from "@/lib/events";
import { EventLabel } from "./EventLabel";

interface Props {
  users: TimelineUser[];
  eventClasses: string[];
  width?: number;
  height?: number;
  selectedUserId?: number | null;
  onSelectUser?: (id: number | null) => void;
}

export function ParallelTimeline({
  users,
  eventClasses,
  width = 1100,
  height = 560,
  selectedUserId,
  onSelectUser,
}: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [chartKey, setChartKey] = useState(0);

  const margin = useMemo(() => ({ top: 48, right: 28, bottom: 40, left: 24 }), []);
  const labelWidth = 200;
  const innerW = width - margin.left - margin.right - labelWidth;
  const innerH = height - margin.top - margin.bottom;

  useEffect(() => {
    setChartKey((k) => k + 1);
  }, [users, eventClasses, selectedUserId]);

  useEffect(() => {
    if (!ref.current || !users.length || !eventClasses.length) return;

    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    svg.attr("width", width).attr("height", height);

    const g = svg.append("g").attr("transform", `translate(${labelWidth + margin.left},${margin.top})`);

    const maxSeq = d3.max(users, (u) => d3.max(u.events, (e) => e.seq_index) ?? 0) ?? 1;

    const x = d3.scaleLinear().domain([0, maxSeq]).range([0, innerW]);
    const y = d3.scalePoint<string>().domain(eventClasses).range([0, innerH]).padding(0.4);

    g.append("defs")
      .append("linearGradient")
      .attr("id", "tl-grid-grad")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%")
      .selectAll("stop")
      .data([
        { o: "0%", c: "#e0e7ff" },
        { o: "100%", c: "#ccfbf1" },
      ])
      .join("stop")
      .attr("offset", (d) => d.o)
      .attr("stop-color", (d) => d.c);

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(10).tickFormat((d) => `Passo ${d}`))
      .selectAll("text")
      .attr("fill", "#64748b")
      .attr("font-size", 11);

    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 34)
      .attr("fill", "#475569")
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("font-weight", 600)
      .text("Ordem na sequência de estudo →");

    eventClasses.forEach((cls) => {
      const meta = getEventMeta(cls);
      g.append("line")
        .attr("x1", 0)
        .attr("x2", innerW)
        .attr("y1", y(cls)!)
        .attr("y2", y(cls)!)
        .attr("stroke", "#e2e8f0")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "6,5")
        .attr("opacity", 0)
        .transition()
        .duration(400)
        .delay(eventClasses.indexOf(cls) * 40)
        .attr("opacity", 1);
    });

    const line = d3
      .line<{ seq_index: number; class: string }>()
      .x((d) => x(d.seq_index))
      .y((d) => y(d.class) ?? 0)
      .curve(d3.curveMonotoneX);

    const tooltip = d3
      .select("body")
      .selectAll<HTMLDivElement, unknown>(".tl-tooltip")
      .data([null])
      .join("div")
      .attr("class", "tl-tooltip")
      .style("position", "fixed")
      .style("pointer-events", "none")
      .style("background", "rgba(15, 23, 42, 0.94)")
      .style("color", "#f8fafc")
      .style("padding", "10px 14px")
      .style("border-radius", "10px")
      .style("font-size", "12px")
      .style("line-height", "1.5")
      .style("opacity", 0)
      .style("z-index", 9999)
      .style("transition", "opacity 0.15s ease");

    users.forEach((user, ui) => {
      const isSelected = selectedUserId === user.userid;
      const dimmed = selectedUserId != null && !isSelected;
      const color = highlightColor(user.highlight);

      const path = g
        .append("path")
        .datum(user.events)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", isSelected ? 3 : dimmed ? 0.5 : 1.2)
        .attr("opacity", 0)
        .attr("d", line);

      path
        .transition()
        .duration(650)
        .delay(ui * 4)
        .ease(d3.easeCubicOut)
        .attr("opacity", dimmed ? 0.08 : isSelected ? 1 : 0.45);

      path.style("cursor", "pointer").on("click", () => onSelectUser?.(isSelected ? null : user.userid));

      const dots = g
        .selectAll(null)
        .data(user.events)
        .join("circle")
        .attr("cx", (d) => x(d.seq_index))
        .attr("cy", (d) => y(d.class) ?? 0)
        .attr("r", 0)
        .attr("fill", color)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .attr("opacity", dimmed ? 0.15 : 1);

      dots
        .transition()
        .duration(400)
        .delay((_, i) => ui * 3 + i * 25)
        .attr("r", isSelected ? 5 : 3.5);

      dots
        .style("cursor", "pointer")
        .on("mouseover", (_ev, d) => {
          const evMeta = getEventMeta(d.class);
          tooltip.style("opacity", 1).html(
            `<strong>${evMeta.label}</strong><br/>
            <span style="color:#94a3b8">${formatTs(d.time)}</span><br/>
            Aluno: <strong>${user.userid}</strong> · Passo ${d.seq_index}<br/>
            Nota média: ${((user.grade_ratio ?? 0) * 100).toFixed(0)}% · Aderência: ${(user.adherence * 100).toFixed(0)}%<br/>
            <span style="color:#94a3b8">${HIGHLIGHT_LABELS[user.highlight] ?? user.highlight}</span>`
          );
        })
        .on("mousemove", (ev) => {
          const e = ev as MouseEvent;
          tooltip.style("left", `${e.clientX + 14}px`).style("top", `${e.clientY + 14}px`);
        })
        .on("mouseout", () => tooltip.style("opacity", 0));
    });

    return () => {
      tooltip.remove();
    };
  }, [users, eventClasses, width, height, selectedUserId, onSelectUser, chartKey, margin, innerW, innerH, labelWidth]);

  const yPositions = useMemo(() => {
    const y = d3.scalePoint<string>().domain(eventClasses).range([0, innerH]).padding(0.4);
    return eventClasses.map((cls) => ({ cls, top: margin.top + (y(cls) ?? 0) - 14 }));
  }, [eventClasses, innerH, margin.top]);

  if (!users.length) {
    return (
      <Text ta="center" c="dimmed" py="xl">
        Nenhum dado para exibir com os filtros atuais.
      </Text>
    );
  }

  return (
    <Box style={{ position: "relative", width: "100%", overflowX: "auto" }} key={chartKey}>
      <div style={{ position: "relative", width, minWidth: 720, height }}>
        {yPositions.map(({ cls, top }, i) => (
          <div
            key={cls}
            className="tl-animate-in"
            style={{
              position: "absolute",
              left: 0,
              top,
              width: labelWidth,
              zIndex: 2,
              animationDelay: `${i * 0.04}s`,
            }}
          >
            <EventLabel eventClass={cls} compact />
          </div>
        ))}
        <svg ref={ref} style={{ display: "block", width: "100%" }} />
      </div>
    </Box>
  );
}
