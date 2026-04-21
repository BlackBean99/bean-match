"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { FormPendingFieldset } from "@/components/form-pending-fieldset";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  introStatusLabels,
  openLevelLabels,
  type DashboardIntroCase,
  type DashboardUser,
  type IntroStatus,
} from "@/lib/domain";
import {
  bulkApplyRoundParticipationDefaultsAction,
  updateMemberExposureAction,
} from "@/app/actions";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

type MatchNetworkDashboardProps = {
  users: DashboardUser[];
  introCases: DashboardIntroCase[];
  initialStatusFilter?: RelationshipStatusFilter;
};

type RelationshipBucket = "UNCONNECTED" | "IN_PROGRESS" | "REJECTED" | "CONFIRMED";
type RelationshipStatusFilter = "ALL" | IntroStatus;

type GraphNode = SimulationNodeDatum & {
  id: number;
  name: string;
  openLevel: DashboardUser["openLevel"];
  status: DashboardUser["status"];
  degree: number;
  z: number;
  variant: 0 | 1 | 2;
};

type GraphEdge = SimulationLinkDatum<GraphNode> & {
  id: string;
  introCaseId: number;
  status: IntroStatus;
  bucket: RelationshipBucket;
  updatedAtLabel: string;
  updatedAtIso: string | null;
  memo: string;
  invitor: string;
};

type TooltipState =
  | { kind: "node"; x: number; y: number; nodeId: number }
  | { kind: "edge"; x: number; y: number; edgeId: string }
  | null;

const bucketLabel: Record<RelationshipBucket, string> = {
  UNCONNECTED: "미연결",
  IN_PROGRESS: "진행중",
  REJECTED: "리젝",
  CONFIRMED: "확정",
};

const bucketClassName: Record<RelationshipBucket, string> = {
  UNCONNECTED: "text-zinc-300 border-zinc-700 bg-zinc-900/70",
  IN_PROGRESS: "text-sky-200 border-sky-900/40 bg-sky-950/20",
  REJECTED: "text-rose-200 border-rose-900/40 bg-rose-950/20",
  CONFIRMED: "text-emerald-200 border-emerald-900/40 bg-emerald-950/20",
};

const introStatusOrder: IntroStatus[] = [
  "OFFERED",
  "A_INTERESTED",
  "B_OFFERED",
  "WAITING_RESPONSE",
  "MATCHED",
  "CONNECTED",
  "MEETING_DONE",
  "RESULT_PENDING",
  "SUCCESS",
  "FAILED",
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
];

function bucketForIntroStatus(status: IntroStatus): RelationshipBucket {
  if (["DECLINED", "EXPIRED", "CANCELLED", "FAILED"].includes(status)) return "REJECTED";
  if (["CONNECTED", "SUCCESS"].includes(status)) return "CONFIRMED";
  if (["MATCHED", "MEETING_DONE", "RESULT_PENDING"].includes(status)) return "IN_PROGRESS";
  return "UNCONNECTED";
}

function parseIsoOrNull(value: string | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

const NODE_BASE_WIDTH = 94;
const NODE_BASE_HEIGHT = 30;

export function MatchNetworkDashboard({
  users,
  introCases,
  initialStatusFilter = "ALL",
}: MatchNetworkDashboardProps) {
  const [statusFilter, setStatusFilter] = useState<RelationshipStatusFilter>(initialStatusFilter);
  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [, setFrame] = useState(0);

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const simRef = useRef<Simulation<GraphNode, GraphEdge> | null>(null);
  const draggingRef = useRef<{ nodeId: number; pointerId: number; moved: boolean } | null>(null);
  const [surfaceSize, setSurfaceSize] = useState<{ width: number; height: number }>({ width: 800, height: 560 });

  const { nodes, edges, edgesByNodeId, nodesById, buckets, totalEdgeCount } = useMemo(() => {
    const nodesById = new Map<number, GraphNode>();
    for (const user of users) {
      const seed = hash(`node:${user.id}:${user.name}`);
      const z = ((seed % 100) / 100) * 0.9 + 0.1;
      const variant = (seed % 3) as 0 | 1 | 2;
      const angle = ((seed % 360) / 360) * Math.PI * 2;
      const ring = 160 + (((seed >>> 9) % 100) / 100) * 240;
      const jitterX = ((seed >>> 3) % 21) - 10;
      const jitterY = ((seed >>> 5) % 21) - 10;
      nodesById.set(user.id, {
        id: user.id,
        name: user.name,
        openLevel: user.openLevel,
        status: user.status,
        degree: 0,
        z,
        variant,
        // Deterministic initial placement reduces “stacked nodes” at time 0.
        x: 420 + Math.cos(angle) * ring + jitterX,
        y: 300 + Math.sin(angle) * ring * 0.72 + jitterY,
      });
    }

    const totalEdgesByPair = new Map<string, true>();
    for (const introCase of introCases) {
      if (introCase.participantIds.length !== 2) continue;
      const [a, b] = introCase.participantIds;
      if (!nodesById.has(a) || !nodesById.has(b)) continue;
      totalEdgesByPair.set([a, b].sort((x, y) => x - y).join(":"), true);
    }

    // Pair-dedupe: keep the most recently updated introCase per pair.
    const edgesByPair = new Map<string, GraphEdge>();
    for (const introCase of introCases) {
      if (statusFilter !== "ALL" && introCase.status !== statusFilter) continue;
      if (introCase.participantIds.length !== 2) continue;
      const [a, b] = introCase.participantIds;
      if (!nodesById.has(a) || !nodesById.has(b)) continue;

      const source = nodesById.get(a)!;
      const target = nodesById.get(b)!;
      const pairKey = [a, b].sort((x, y) => x - y).join(":");

      const updatedAtIso = parseIsoOrNull(introCase.updatedAtIso);
      const existing = edgesByPair.get(pairKey);
      if (existing) {
        const existingIso = existing.updatedAtIso ? Date.parse(existing.updatedAtIso) : -1;
        const nextIso = updatedAtIso ? Date.parse(updatedAtIso) : -1;
        if (nextIso <= existingIso) continue;
      }

      edgesByPair.set(pairKey, {
        id: `edge:${pairKey}`,
        source,
        target,
        introCaseId: introCase.id,
        status: introCase.status,
        bucket: bucketForIntroStatus(introCase.status),
        updatedAtLabel: introCase.updatedAt,
        updatedAtIso,
        memo: introCase.memo ?? "",
        invitor: introCase.invitor,
      });
    }

    const edges = [...edgesByPair.values()];
    const edgesByNodeId = new Map<number, GraphEdge[]>();
    for (const edge of edges) {
      const sourceId = (edge.source as GraphNode).id;
      const targetId = (edge.target as GraphNode).id;
      nodesById.get(sourceId)!.degree += 1;
      nodesById.get(targetId)!.degree += 1;
      edgesByNodeId.set(sourceId, [...(edgesByNodeId.get(sourceId) ?? []), edge]);
      edgesByNodeId.set(targetId, [...(edgesByNodeId.get(targetId) ?? []), edge]);
    }

    const buckets: Record<RelationshipBucket, number> = {
      UNCONNECTED: 0,
      IN_PROGRESS: 0,
      REJECTED: 0,
      CONFIRMED: 0,
    };
    for (const edge of edges) buckets[edge.bucket] += 1;

    if (statusFilter !== "ALL") {
      for (const [nodeId, node] of nodesById) {
        if (!edgesByNodeId.has(nodeId)) nodesById.delete(node.id);
      }
    }

    return {
      nodes: [...nodesById.values()],
      edges,
      edgesByNodeId,
      nodesById,
      buckets,
      totalEdgeCount: totalEdgesByPair.size,
    };
  }, [users, introCases, statusFilter]);

  useEffect(() => {
    if (!surfaceRef.current) return;
    const el = surfaceRef.current;

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setSurfaceSize({ width: Math.max(640, rect.width), height: Math.max(520, rect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const sim = forceSimulation<GraphNode>(nodes)
      .alpha(1)
      .alphaDecay(0.03)
      .velocityDecay(0.28)
      .force(
        "link",
        forceLink<GraphNode, GraphEdge>(edges)
          .id((d: GraphNode) => d.id)
          .distance((link: GraphEdge) => {
            const bucket = link.bucket;
            if (bucket === "CONFIRMED") return 132;
            if (bucket === "IN_PROGRESS") return 150;
            if (bucket === "REJECTED") return 170;
            return 190;
          })
          .strength(0.48),
      )
      .force("charge", forceManyBody().strength(-440))
      .force(
        "collide",
        forceCollide<GraphNode>()
          .radius((d: GraphNode) => nodeCollisionRadius(d) + Math.min(d.degree * 2.5, 14))
          .iterations(4),
      )
      .force("center", forceCenter(surfaceSize.width / 2, surfaceSize.height / 2))
      .force("x", forceX(surfaceSize.width / 2).strength(0.012))
      .force("y", forceY(surfaceSize.height / 2).strength(0.012));

    simRef.current = sim;

    let last = performance.now();
    let rafId: number | null = null;
    const tick = () => {
      const now = performance.now();
      if (now - last >= 42) {
        last = now;
        setFrame((v) => (v + 1) % 1_000_000);
      }

      const cx = surfaceSize.width / 2;
      const cy = surfaceSize.height / 2;
      // Boundaries must account for the visual node size (cards, not points).
      const margin = 12 + nodeMaxHalfDiagonal();
      for (const node of nodes) {
        if (node.fx !== null && node.fx !== undefined) continue;
        if (node.fy !== null && node.fy !== undefined) continue;
        const dx = (node.x ?? cx) - cx;
        const dy = (node.y ?? cy) - cy;
        const dist = Math.max(80, Math.sqrt(dx * dx + dy * dy));
        const spin = 0.00095;
        node.vx = (node.vx ?? 0) + (-dy / dist) * spin;
        node.vy = (node.vy ?? 0) + (dx / dist) * spin;

        // Keep nodes inside bounds without hard render-time clamping (which causes visual overlap).
        const x = node.x ?? cx;
        const y = node.y ?? cy;
        if (x < margin) {
          node.x = margin;
          node.vx = Math.abs(node.vx ?? 0) * 0.6;
        } else if (x > surfaceSize.width - margin) {
          node.x = surfaceSize.width - margin;
          node.vx = -Math.abs(node.vx ?? 0) * 0.6;
        }
        if (y < margin) {
          node.y = margin;
          node.vy = Math.abs(node.vy ?? 0) * 0.6;
        } else if (y > surfaceSize.height - margin) {
          node.y = surfaceSize.height - margin;
          node.vy = -Math.abs(node.vy ?? 0) * 0.6;
        }
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      sim.stop();
      simRef.current = null;
    };
  }, [nodes, edges, surfaceSize.width, surfaceSize.height]);

  const highlighted = useMemo(() => {
    if (!hoveredNodeId) return null;
    const connectedEdges = new Set((edgesByNodeId.get(hoveredNodeId) ?? []).map((edge) => edge.id));
    const connectedNodes = new Set<number>([hoveredNodeId]);
    for (const edge of edgesByNodeId.get(hoveredNodeId) ?? []) {
      const sourceId = (edge.source as GraphNode).id;
      const targetId = (edge.target as GraphNode).id;
      connectedNodes.add(sourceId);
      connectedNodes.add(targetId);
    }
    return { connectedEdges, connectedNodes };
  }, [edgesByNodeId, hoveredNodeId]);

  const selectedNode = selectedNodeId ? nodesById.get(selectedNodeId) ?? null : null;
  const selectedNodeEdges = selectedNodeId ? (edgesByNodeId.get(selectedNodeId) ?? []) : [];
  const selectedEdge = selectedEdgeId ? edges.find((edge) => edge.id === selectedEdgeId) ?? null : null;

  const hoveredNode = hoveredNodeId ? nodesById.get(hoveredNodeId) ?? null : null;
  const hoveredEdge = hoveredEdgeId ? edges.find((edge) => edge.id === hoveredEdgeId) ?? null : null;

  useEffect(() => {
    if (selectedNodeId && !nodesById.has(selectedNodeId)) setSelectedNodeId(null);
    if (hoveredNodeId && !nodesById.has(hoveredNodeId)) setHoveredNodeId(null);
    if (selectedEdgeId && !edges.some((edge) => edge.id === selectedEdgeId)) setSelectedEdgeId(null);
    if (hoveredEdgeId && !edges.some((edge) => edge.id === hoveredEdgeId)) setHoveredEdgeId(null);
    setTooltip((current) => {
      if (current?.kind === "node" && !nodesById.has(current.nodeId)) return null;
      if (current?.kind === "edge" && !edges.some((edge) => edge.id === current.edgeId)) return null;
      return current;
    });
  }, [edges, hoveredEdgeId, hoveredNodeId, nodesById, selectedEdgeId, selectedNodeId]);

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-zinc-200 bg-white px-4 py-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Cosmic Relationship Map</p>
          <h2 className="mt-2 text-lg font-bold text-zinc-950">소개팅 풀 관계 관리</h2>
          <p className="mt-1 text-sm text-zinc-600">
            상태별 관계를 필터링하고, hover에서 빠르게 읽고, click에서 상세를 확인합니다.
          </p>
        </div>
        <div className="flex flex-col gap-3 lg:items-end">
          <label className="grid gap-1 text-xs font-bold text-zinc-600">
            관계 상태 필터
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as RelationshipStatusFilter)}
              className="h-10 min-w-56 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-[#FF3131] focus:ring-2 focus:ring-red-100"
            >
              <option value="ALL">전체 상태</option>
              {introStatusOrder.map((status) => (
                <option key={status} value={status}>
                  {introStatusLabels[status]} ({status})
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs font-semibold text-zinc-500">
            표시 관계 {edges.length}개 / 전체 관계 {totalEdgeCount}개
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:basis-full">
          {(["UNCONNECTED", "IN_PROGRESS", "REJECTED", "CONFIRMED"] as const).map((bucket) => (
            <span
              key={bucket}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${bucketClassName[bucket]}`}
            >
              <span className="h-2 w-2 rounded-full bg-current opacity-70" />
              {bucketLabel[bucket]}
              <span className="rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-semibold text-current">
                {buckets[bucket]}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1.45fr_0.55fr]">
        <div className="relative min-h-[560px] bg-[#070709]">
          <div
            ref={surfaceRef}
            className="cosmic-network-surface relative h-[72vh] min-h-[560px] w-full"
            onPointerLeave={() => {
              setHoveredNodeId(null);
              setHoveredEdgeId(null);
              setTooltip(null);
            }}
          >
            <svg className="absolute inset-0 h-full w-full">
              <defs>
                <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2.4" result="blur" />
                  <feColorMatrix
                    in="blur"
                    type="matrix"
                    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.38 0"
                  />
                  <feMerge>
                    <feMergeNode />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {edges.map((edge) => {
                const source = edge.source as GraphNode;
                const target = edge.target as GraphNode;
                const edgeMargin = 8 + nodeMaxHalfDiagonal();
                const x1 = clamp(source.x ?? surfaceSize.width / 2, edgeMargin, surfaceSize.width - edgeMargin);
                const y1 = clamp(source.y ?? surfaceSize.height / 2, edgeMargin, surfaceSize.height - edgeMargin);
                const x2 = clamp(target.x ?? surfaceSize.width / 2, edgeMargin, surfaceSize.width - edgeMargin);
                const y2 = clamp(target.y ?? surfaceSize.height / 2, edgeMargin, surfaceSize.height - edgeMargin);

                const dimmed = highlighted ? !highlighted.connectedEdges.has(edge.id) : false;
                const isSelected = selectedEdgeId === edge.id;
                const color = edgeColor(edge.bucket);
                const width = isSelected ? 2.2 : edge.bucket === "CONFIRMED" ? 1.7 : 1.2;
                const dash = edge.bucket === "IN_PROGRESS" ? "5 6" : edge.bucket === "UNCONNECTED" ? "2 10" : undefined;
                const dashClass =
                  edge.bucket === "IN_PROGRESS"
                    ? "lux-edge-dash"
                    : edge.bucket === "UNCONNECTED"
                      ? "lux-edge-dash-soft"
                      : "";
                const d = curvedOrbitPath(x1, y1, x2, y2, edge.id);
                const mx = (x1 + x2) / 2;
                const my = (y1 + y2) / 2;

                return (
                  <g key={edge.id}>
                    <path
                      d={d}
                      stroke={color}
                      strokeWidth={width + 1.8}
                      strokeOpacity={dimmed ? 0.03 : 0.11}
                      filter="url(#softGlow)"
                      fill="none"
                      pointerEvents="none"
                    />
                    <path
                      d={d}
                      stroke={color}
                      strokeWidth={width}
                      strokeOpacity={dimmed ? 0.06 : edge.bucket === "CONFIRMED" ? 0.48 : 0.28}
                      strokeDasharray={dash}
                      className={dashClass}
                      fill="none"
                      pointerEvents="none"
                    />
                    <path
                      d={d}
                      stroke="transparent"
                      strokeWidth={12}
                      fill="none"
                      pointerEvents="stroke"
                      onPointerEnter={() => {
                        setHoveredEdgeId(edge.id);
                        setTooltip({ kind: "edge", x: mx, y: my, edgeId: edge.id });
                      }}
                      onPointerLeave={() => {
                        setHoveredEdgeId((prev) => (prev === edge.id ? null : prev));
                        setTooltip((prev) => (prev?.kind === "edge" && prev.edgeId === edge.id ? null : prev));
                      }}
                      onClick={() => {
                        setSelectedEdgeId(edge.id);
                        setSelectedNodeId((edge.source as GraphNode).id);
                      }}
                    />
                  </g>
                );
              })}
            </svg>

	            {nodes.map((node) => {
	              const x = node.x ?? surfaceSize.width / 2;
	              const y = node.y ?? surfaceSize.height / 2;
	              const dimmed = highlighted ? !highlighted.connectedNodes.has(node.id) : false;
	              const isSelected = selectedNodeId === node.id;
	              const { width: nodeWidth, height: nodeHeight, scale } = nodeDims(node);
	              const iconSize = Math.round(10 + node.z * 6) + (isSelected ? 2 : 0);
	              const shortName = compactName(node.name);

	              return (
	                <motion.button
                  key={node.id}
                  type="button"
                  onPointerEnter={() => {
                    setHoveredNodeId(node.id);
                    setTooltip({ kind: "node", x, y, nodeId: node.id });
                  }}
                  onPointerMove={() => {
                    if (hoveredNodeId !== node.id) return;
                    setTooltip({ kind: "node", x, y, nodeId: node.id });
                  }}
                  onPointerLeave={() => {
                    setHoveredNodeId((prev) => (prev === node.id ? null : prev));
                    setTooltip((prev) => (prev?.kind === "node" && prev.nodeId === node.id ? null : prev));
                  }}
                  onPointerDown={(event) => {
                    draggingRef.current = { nodeId: node.id, pointerId: event.pointerId, moved: false };
                    event.currentTarget.setPointerCapture(event.pointerId);
                    const sim = simRef.current;
                    if (sim) sim.alphaTarget(0.25).restart();
                    node.fx = x;
                    node.fy = y;
                  }}
                  onPointerMoveCapture={(event) => {
                    const dragging = draggingRef.current;
                    if (!dragging || dragging.nodeId !== node.id || dragging.pointerId !== event.pointerId) return;
                    const rect = surfaceRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const margin = 10 + nodeMaxHalfDiagonal();
                    const nx = clamp(event.clientX - rect.left, margin, surfaceSize.width - margin);
                    const ny = clamp(event.clientY - rect.top, margin, surfaceSize.height - margin);
                    node.fx = nx;
                    node.fy = ny;
                    dragging.moved = true;
                    setTooltip({ kind: "node", x: nx, y: ny, nodeId: node.id });
                  }}
                  onPointerUp={(event) => {
                    const dragging = draggingRef.current;
                    if (!dragging || dragging.nodeId !== node.id || dragging.pointerId !== event.pointerId) return;
                    draggingRef.current = null;
                    node.fx = null;
                    node.fy = null;
                    const sim = simRef.current;
                    if (sim) sim.alphaTarget(0);
                  }}
                  onClick={() => {
                    const dragging = draggingRef.current;
                    if (dragging?.nodeId === node.id && dragging.moved) return;
                    setSelectedNodeId(node.id);
                    setSelectedEdgeId(null);
                  }}
	                  className="absolute"
	                  style={{
	                    left: x - nodeWidth / 2,
	                    top: y - nodeHeight / 2,
	                    opacity: dimmed ? 0.28 : 1,
	                    transform: "translateZ(0)",
	                  }}
	                  initial={false}
	                  animate={{
	                    scale: dimmed ? scale : [scale, scale + 0.04, scale],
	                    transition: {
	                      duration: 3.8,
	                      repeat: dimmed ? 0 : Infinity,
	                      ease: "easeInOut",
	                      delay: (node.id % 17) * 0.05,
	                    },
	                  }}
	                >
	                  <span
	                    className={
	                      "pointer-events-none flex h-full w-full items-center gap-2 rounded-lg border px-2.5 " +
	                      "backdrop-blur transition " +
	                      (isSelected
	                        ? "border-white/22 bg-black/55 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_0_40px_rgba(56,189,248,0.07)]"
	                        : hoveredNodeId === node.id
	                          ? "border-white/18 bg-black/50 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_0_32px_rgba(255,255,255,0.05)]"
	                          : "border-white/12 bg-black/38 shadow-[0_0_0_1px_rgba(255,255,255,0.035)]")
	                    }
	                    style={{ width: nodeWidth, height: nodeHeight }}
	                  >
	                    <span className="relative grid place-items-center" style={{ width: iconSize, height: iconSize }}>
	                      <span
	                        className={`cosmic-star ${cosmicStarClass(node, hoveredNodeId === node.id, isSelected)}`}
	                        style={{ width: iconSize, height: iconSize }}
	                      />
	                      <span
	                        className={`absolute inset-0 rounded-full ${cosmicGlyphClass(node)}`}
	                        style={{
	                          transform: `rotate(${(hash(`glyph:${node.id}`) % 360).toString()}deg)`,
	                        }}
	                      />
	                    </span>
	                    <span className="min-w-0 flex-1">
	                      <span className="block truncate text-[12px] font-bold text-white/90">{shortName}</span>
	                    </span>
	                    <span
	                      aria-hidden
	                      className={`h-2.5 w-2.5 rounded-full ${openPipClass(node.openLevel)}`}
	                      title={openLevelLabels[node.openLevel]}
	                    />
	                  </span>
	                </motion.button>
	              );
	            })}

            <AnimatePresence>
              {tooltip && tooltip.kind === "node" && hoveredNode ? (
                <motion.div
                  key={`tooltip-node:${tooltip.nodeId}`}
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.14 }}
                  className="pointer-events-none absolute"
                  style={{
                    left: clamp(tooltip.x + 14, 12, surfaceSize.width - 260),
                    top: clamp(tooltip.y + 14, 12, surfaceSize.height - 120),
                  }}
                >
                  <div className="cosmic-tooltip w-[248px] rounded-lg border border-white/10 bg-black/45 px-3 py-2 text-white backdrop-blur">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{hoveredNode.name}</p>
                        <p className="mt-0.5 truncate text-[11px] font-semibold text-white/70">
                          {openLevelLabels[hoveredNode.openLevel]} · {hoveredNode.status}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-bold text-white/80">
                        {hoveredNode.degree}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] font-semibold text-white/55">
                      연결 {(edgesByNodeId.get(hoveredNode.id) ?? []).length} · 마지막 업데이트{" "}
                      {latestEdgeLabel(edgesByNodeId.get(hoveredNode.id) ?? [])}
                    </p>
                  </div>
                </motion.div>
              ) : null}

              {tooltip && tooltip.kind === "edge" && hoveredEdge ? (
                <motion.div
                  key={`tooltip-edge:${tooltip.edgeId}`}
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.14 }}
                  className="pointer-events-none absolute"
                  style={{
                    left: clamp(tooltip.x + 14, 12, surfaceSize.width - 260),
                    top: clamp(tooltip.y + 14, 12, surfaceSize.height - 110),
                  }}
                >
                  <div className="cosmic-tooltip w-[248px] rounded-lg border border-white/10 bg-black/45 px-3 py-2 text-white backdrop-blur">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-bold">Intro #{hoveredEdge.introCaseId}</p>
                      <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-bold text-white/80">
                        {bucketLabel[hoveredEdge.bucket]}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] font-semibold text-white/70">
                      {introStatusLabels[hoveredEdge.status]} · {hoveredEdge.updatedAtLabel}
                    </p>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#070709] to-transparent" />
          {edges.length === 0 ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center">
              <div className="rounded-lg border border-white/10 bg-black/45 px-4 py-3 text-white backdrop-blur">
                <p className="text-sm font-bold">표시할 관계가 없습니다.</p>
                <p className="mt-1 text-xs font-semibold text-white/60">다른 관계 상태를 선택하세요.</p>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="border-t border-zinc-200 bg-white lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
            <p className="text-sm font-bold text-zinc-950">{selectedNode ? `${selectedNode.name} 관계` : "노드 선택"}</p>
            {selectedNode ? (
              <Link href={`/users/${selectedNode.id}`} className="text-xs font-bold text-[#E00E0E]">
                사용자 상세
              </Link>
            ) : null}
          </div>

          <div className="grid gap-4 px-4 py-4">
            {selectedNode ? (
              <div className="rounded-lg border border-zinc-200 bg-white p-3">
                <p className="text-xs font-bold text-zinc-500">상태 / 노출</p>
                <p className="mt-1 text-sm font-bold text-zinc-950">
                  {selectedNode.status} · {openLevelLabels[selectedNode.openLevel]}
                </p>
                <p className="mt-2 text-xs text-zinc-500">ID {selectedNode.id} · 연결 {selectedNode.degree}개</p>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">그래프에서 노드를 클릭해 관계를 확인하세요.</p>
            )}

            <details className="rounded-lg border border-zinc-200 bg-white p-3" open>
              <summary className="cursor-pointer text-xs font-bold text-zinc-700">라운드 참여 기본값</summary>
              <form action={bulkApplyRoundParticipationDefaultsAction} className="mt-3 grid gap-3">
                <FormPendingFieldset className="grid gap-3">
                  <p className="text-xs leading-5 text-zinc-500">
                    라운드 기본 노출 상태를 한 번에 정리합니다. 일부 운영 대상만 비공개 매칭으로 유지합니다.
                  </p>
                  <label className="flex items-start gap-2 text-xs font-semibold text-zinc-700">
                    <input type="checkbox" name="confirm" className="mt-0.5" required />
                    이 변경을 즉시 적용합니다.
                  </label>
                  <FormSubmitButton
                    label="기본값 일괄 적용"
                    pendingLabel="적용 중..."
                    className="h-10 rounded-lg bg-[#FF3131] px-4 text-sm font-bold text-white transition hover:bg-[#E00E0E] disabled:cursor-not-allowed disabled:bg-zinc-300"
                  />
                </FormPendingFieldset>
              </form>
            </details>

            {selectedNode ? (
              <form action={updateMemberExposureAction} className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-3">
                <FormPendingFieldset className="grid gap-3">
                  <input type="hidden" name="id" value={selectedNode.id} />
                  <label className="grid gap-1 text-xs font-semibold text-zinc-600">
                    상태
                    <select
                      name="status"
                      defaultValue={selectedNode.status}
                      className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-[#FF3131] focus:ring-2 focus:ring-red-100"
                    >
                      <option value="INCOMPLETE">정보 미완성</option>
                      <option value="READY">소개 가능</option>
                      <option value="PROGRESSING">소개 진행 중</option>
                      <option value="HOLD">잠시 보류</option>
                      <option value="STOP_REQUESTED">탈퇴 요청</option>
                      <option value="ARCHIVED">보관 완료</option>
                      <option value="BLOCKED">운영 제한</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-zinc-600">
                    오픈 레벨
                    <select
                      name="openLevel"
                      defaultValue={selectedNode.openLevel}
                      className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-[#FF3131] focus:ring-2 focus:ring-red-100"
                    >
                      <option value="PRIVATE">Operator 매칭</option>
                      <option value="SEMI_OPEN">제한 노출</option>
                      <option value="FULL_OPEN">전체 라운드</option>
                    </select>
                  </label>
                  <FormSubmitButton
                    label="상태 저장"
                    pendingLabel="저장 중..."
                    className="h-10 rounded-lg bg-[#FF3131] px-4 text-sm font-bold text-white transition hover:bg-[#E00E0E] disabled:cursor-not-allowed disabled:bg-zinc-300"
                  />
                </FormPendingFieldset>
              </form>
            ) : null}

            {selectedNode ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">Relations</p>
                  <p className="text-xs font-semibold text-zinc-500">{selectedNodeEdges.length}개</p>
                </div>

                <div className="grid gap-2">
                  {selectedNodeEdges
                    .slice()
                    .sort(
                      (a, b) =>
                        (b.updatedAtIso ? Date.parse(b.updatedAtIso) : -1) -
                        (a.updatedAtIso ? Date.parse(a.updatedAtIso) : -1),
                    )
                    .map((edge) => {
                      const source = edge.source as GraphNode;
                      const target = edge.target as GraphNode;
                      const other = source.id === selectedNode.id ? target : source;
                      const active = selectedEdgeId === edge.id;
                      return (
                        <button
                          key={edge.id}
                          type="button"
                          onClick={() => setSelectedEdgeId(edge.id)}
                          className={
                            "grid gap-1 rounded-lg border px-3 py-2 text-left transition " +
                            (active
                              ? "border-red-200 bg-red-50"
                              : "border-zinc-200 bg-white hover:border-red-200 hover:bg-red-50/40")
                          }
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-bold text-zinc-950">{other.name}</p>
                            <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-bold ${chipForBucket(edge.bucket)}`}>
                              {bucketLabel[edge.bucket]}
                            </span>
                          </div>
                          <p className="truncate text-[11px] font-semibold text-zinc-500">
                            {introStatusLabels[edge.status]} · {edge.updatedAtLabel}
                          </p>
                        </button>
                      );
                    })}
                </div>

                <AnimatePresence mode="wait">
                  {selectedEdge ? (
                    <motion.section
                      key={selectedEdge.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="rounded-lg border border-zinc-200 bg-white p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-zinc-950">Intro #{selectedEdge.introCaseId}</p>
                        <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${chipForBucket(selectedEdge.bucket)}`}>
                          {bucketLabel[selectedEdge.bucket]}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-zinc-500">
                        {introStatusLabels[selectedEdge.status]} · {selectedEdge.updatedAtLabel}
                      </p>
                      <p className="mt-2 text-xs text-zinc-500">주선자 {selectedEdge.invitor}</p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{selectedEdge.memo || "-"}</p>
                    </motion.section>
                  ) : null}
                </AnimatePresence>
              </>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function edgeColor(bucket: RelationshipBucket) {
  if (bucket === "CONFIRMED") return "rgba(34, 197, 94, 0.92)";
  if (bucket === "IN_PROGRESS") return "rgba(56, 189, 248, 0.92)";
  if (bucket === "REJECTED") return "rgba(244, 63, 94, 0.92)";
  return "rgba(161, 161, 170, 0.6)";
}

function chipForBucket(bucket: RelationshipBucket) {
  if (bucket === "CONFIRMED") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (bucket === "IN_PROGRESS") return "border-sky-200 bg-sky-50 text-sky-800";
  if (bucket === "REJECTED") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-zinc-200 bg-zinc-50 text-zinc-700";
}

function cosmicStarClass(node: GraphNode, isHovered: boolean, isSelected: boolean) {
  const base = isSelected ? "cosmic-star--selected" : isHovered ? "cosmic-star--hovered" : "cosmic-star--idle";
  if (node.openLevel === "FULL_OPEN") return `${base} cosmic-star--open`;
  if (node.openLevel === "SEMI_OPEN") return `${base} cosmic-star--semi`;
  return `${base} cosmic-star--private`;
}

function cosmicGlyphClass(node: GraphNode) {
  // Variant overlay ring: gives each node a distinct “instrument” feel without becoming noisy.
  const common = "cosmic-glyph";
  const variant = node.variant;
  const level = node.openLevel === "FULL_OPEN" ? "cosmic-glyph--open" : node.openLevel === "SEMI_OPEN" ? "cosmic-glyph--semi" : "cosmic-glyph--private";
  return `${common} ${level} cosmic-glyph--v${variant}`;
}

function latestEdgeLabel(edges: GraphEdge[]) {
  const newest = edges
    .slice()
    .sort(
      (a, b) =>
        (b.updatedAtIso ? Date.parse(b.updatedAtIso) : -1) - (a.updatedAtIso ? Date.parse(a.updatedAtIso) : -1),
    )[0];
  return newest ? newest.updatedAtLabel : "-";
}

function curvedOrbitPath(x1: number, y1: number, x2: number, y2: number, seed: string) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(40, Math.sqrt(dx * dx + dy * dy));
  const nx = -dy / len;
  const ny = dx / len;
  const offset = (hash(seed) % 21 - 10) * 6;
  const cx = mx + nx * offset;
  const cy = my + ny * offset;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return h;
}

function nodeScale(node: GraphNode) {
  return 0.88 + node.z * 0.22;
}

function nodeDims(node: GraphNode) {
  const scale = nodeScale(node);
  return {
    width: Math.round(NODE_BASE_WIDTH * scale),
    height: Math.round(NODE_BASE_HEIGHT * scale),
    scale,
  };
}

function nodeCollisionRadius(node: GraphNode) {
  const { width, height } = nodeDims(node);
  return Math.sqrt((width / 2) ** 2 + (height / 2) ** 2);
}

function nodeMaxHalfDiagonal() {
  const scale = 0.88 + 1 * 0.22;
  const width = NODE_BASE_WIDTH * scale;
  const height = NODE_BASE_HEIGHT * scale;
  return Math.sqrt((width / 2) ** 2 + (height / 2) ** 2);
}

function compactName(name: string) {
  const trimmed = (name || "").trim();
  if (!trimmed) return "-";
  // Keep it readable in a dense graph: show first 3 glyphs (Korean names typically fit).
  return trimmed.length <= 3 ? trimmed : trimmed.slice(0, 3);
}

function openPipClass(openLevel: DashboardUser["openLevel"]) {
  if (openLevel === "FULL_OPEN") return "bg-sky-300 shadow-[0_0_18px_rgba(56,189,248,0.25)]";
  if (openLevel === "SEMI_OPEN") return "bg-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.18)]";
  return "bg-zinc-300/70 shadow-[0_0_16px_rgba(161,161,170,0.12)]";
}
