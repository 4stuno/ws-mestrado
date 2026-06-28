"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { TimelineUser } from "@/lib/types";
import { getEventMeta } from "@/lib/events";

const COLOR_MAP: Record<string, string> = {
  indigo: "#6366f1",
  cyan: "#06b6d4",
  violet: "#8b5cf6",
  blue: "#3b82f6",
  orange: "#f97316",
  green: "#22c55e",
  grape: "#a855f7",
  gray: "#94a3b8",
  pink: "#ec4899",
};

export function ActivityChart({ users, eventClasses }: { users: TimelineUser[]; eventClasses: string[] }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const counts: Record<string, number> = {};
    eventClasses.forEach((c) => (counts[c] = 0));
    users.forEach((u) =>
      u.events.forEach((e) => {
        counts[e.class] = (counts[e.class] ?? 0) + 1;
      })
    );

    const data = eventClasses.map((c) => ({ class: c, count: counts[c] ?? 0, meta: getEventMeta(c) }));
    const w = 420;
    const h = 220;
    const m = { top: 16, right: 12, bottom: 72, left: 44 };

    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    svg.attr("width", "100%").attr("viewBox", `0 0 ${w} ${h}`);

    const x = d3.scaleBand().domain(data.map((d) => d.class)).range([m.left, w - m.right]).padding(0.25);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.count) ?? 1])
      .nice()
      .range([h - m.bottom, m.top]);

    svg.append("g").attr("transform", `translate(0,${h - m.bottom})`).call(d3.axisBottom(x).tickSize(0)).selectAll("text").remove();

    svg
      .selectAll(".bar")
      .data(data)
      .join("rect")
      .attr("x", (d) => x(d.class)!)
      .attr("y", h - m.bottom)
      .attr("width", x.bandwidth())
      .attr("height", 0)
      .attr("rx", 6)
      .attr("fill", (d) => COLOR_MAP[d.meta.color] ?? "#6366f1")
      .transition()
      .duration(600)
      .delay((_, i) => i * 60)
      .ease(d3.easeElasticOut.amplitude(1).period(0.5))
      .attr("y", (d) => y(d.count))
      .attr("height", (d) => h - m.bottom - y(d.count));

    data.forEach((d) => {
      const meta = d.meta;
      svg
        .append("text")
        .attr("x", (x(d.class) ?? 0) + x.bandwidth() / 2)
        .attr("y", h - m.bottom + 14)
        .attr("text-anchor", "middle")
        .attr("font-size", 9)
        .attr("fill", "#64748b")
        .text(meta.label.split(" ")[0]);
    });

    svg.append("g").attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-w + m.left + m.right)).selectAll(".tick line").attr("stroke", "#e2e8f0");
  }, [users, eventClasses]);

  return <svg ref={ref} style={{ width: "100%", maxWidth: 420 }} />;
}
