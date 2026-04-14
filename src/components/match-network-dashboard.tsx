"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  introStatusLabels,
  openLevelLabels,
  type DashboardIntroCase,
  type DashboardUser,
  type IntroStatus,
} from "@/lib/domain";
import { updateMemberExposureAction } from "@/app/actions";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

type MatchNetworkDashboardProps = {
  users: DashboardUser[];
  introCases: DashboardIntroCase[];
};

type RelationshipBucket = "UNCONNECTED" | "IN_PROGRESS" | "REJECTED" | "CONFIRMED";

type GraphNode = SimulationNodeDatum & {
  id: number;
  name: string;
  openLevel: DashboardUser["openLevel"];
  status: DashboardUser["status"];
  roles: string[];
  lastActionLabel: string;
  lastActionIso: string | null;
  degree: number;
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

const bucketLabel: Record<RelationshipBucket, string> = {
  UNCONNECTED: "미연결",
  IN_PROGRESS: "진행중",
  REJECTED: "리젝",
  CONFIRMED: "확정",
};

const bucketClassName: Record<RelationshipBucket, string> = {
  UNCONNECTED: "text-zinc-300 border-zinc-700 bg-zinc-900/70",
  IN_PROGRESS: "text-amber-200 border-amber-900/40 bg-amber-950/20",
  REJECTED: "text-rose-200 border-rose-900/40 bg-rose-950/20",
  CONFIRMED: "text-emerald-200 border-emerald-900/40 bg-emerald-950/20",
};

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

export function MatchNetworkDashboard({ users, introCases }: MatchNetworkDashboardProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [surfaceSize, setSurfaceSize] = useState<{ width: number; height: number }>({ width: 800, height: 560 });

  const { nodes, edges, edgesByNodeId, nodesById, buckets } = useMemo(() => {
    const nodesById = new Map<number, GraphNode>();
    for (const user of users) {
      nodesById.set(user.id, {
        id: user.id,
        name: user.name,
        openLevel: user.openLevel,
        status: user.status,
        roles: user.roles,
        lastActionLabel: "관계 없음",
        lastActionIso: null,
        degree: 0,
        x: Math.random() * 600 + 100,
        y: Math.random() * 420 + 70,
      });
    }

    // Deduplicate by pair; keep the most recently updated introCase per pair.
    const edgesByPair = new Map<string, GraphEdge>();
    for (const introCase of introCases) {
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

    for (const [nodeId, node] of nodesById.entries()) {
      const nodeEdges = edgesByNodeId.get(nodeId) ?? [];
      const newest = nodeEdges
        .slice()
        .sort((a, b) => (b.updatedAtIso ? Date.parse(b.updatedAtIso) : -1) - (a.updatedAtIso ? Date.parse(a.updatedAtIso) : -1))[0];
      if (!newest) continue;
      node.lastActionIso = newest.updatedAtIso;
      node.lastActionLabel = `${bucketLabel[newest.bucket]} · ${newest.updatedAtLabel}`;
    }

    const buckets: Record<RelationshipBucket, number> = {
      UNCONNECTED: 0,
      IN_PROGRESS: 0,
      REJECTED: 0,
      CONFIRMED: 0,
    };
    for (const edge of edges) buckets[edge.bucket] += 1;

    return {
      nodes: [...nodesById.values()],
      edges,
      edgesByNodeId,
      nodesById,
      buckets,
    };
  }, [users, introCases]);

  const [, setFrame] = useState(0);

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
      .alphaDecay(0.04)
      .velocityDecay(0.42)
      .force(
        "link",
        forceLink<GraphNode, GraphEdge>(edges)
          .id((d: GraphNode) => d.id)
          .distance((link: GraphEdge) => {
            const bucket = link.bucket;
            if (bucket === "CONFIRMED") return 130;
            if (bucket === "IN_PROGRESS") return 150;
            if (bucket === "REJECTED") return 170;
            return 190;
          })
          .strength(0.35),
      )
      .force("charge", forceManyBody().strength(-520))
      .force("collide", forceCollide<GraphNode>().radius((d: GraphNode) => 56 + Math.min(d.degree * 6, 26)).iterations(2))
      .force("center", forceCenter(surfaceSize.width / 2, surfaceSize.height / 2));

    let last = performance.now();
    let rafId: number | null = null;
    const tick = () => {
      const now = performance.now();
      // Throttle UI re-render; keep simulation running for that "alive" feeling.
      if (now - last >= 42) {
        last = now;
        setFrame((v) => (v + 1) % 1_000_000);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      sim.stop();
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
  const selectedEdge = selectedEdgeId
    ? edges.find((edge) => edge.id === selectedEdgeId) ?? null
    : null;

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-zinc-200 bg-white px-4 py-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Relationship Network</p>
          <h2 className="mt-2 text-lg font-bold text-zinc-950">소개팅 풀 관계 상태</h2>
          <p className="mt-1 text-sm text-zinc-600">노드를 클릭하면 상세 패널에서 관계 히스토리와 메모를 확인합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
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
        <div className="relative min-h-[560px] bg-[#0B0B0C]">
          <div ref={surfaceRef} className="lux-network-surface relative h-[72vh] min-h-[560px] w-full">
            <svg className="pointer-events-none absolute inset-0 h-full w-full">
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
                const x1 = clamp(source.x ?? surfaceSize.width / 2, 22, surfaceSize.width - 22);
                const y1 = clamp(source.y ?? surfaceSize.height / 2, 22, surfaceSize.height - 22);
                const x2 = clamp(target.x ?? surfaceSize.width / 2, 22, surfaceSize.width - 22);
                const y2 = clamp(target.y ?? surfaceSize.height / 2, 22, surfaceSize.height - 22);

                const dimmed = highlighted
                  ? !highlighted.connectedEdges.has(edge.id)
                  : false;
                const isSelected = selectedEdgeId === edge.id;
                const color = edgeColor(edge.bucket);
                const width = isSelected ? 2.1 : edge.bucket === "CONFIRMED" ? 1.6 : 1.15;
                const dash = edge.bucket === "IN_PROGRESS" ? "5 6" : edge.bucket === "UNCONNECTED" ? "2 8" : undefined;
                const dashClass =
                  edge.bucket === "IN_PROGRESS"
                    ? "lux-edge-dash"
                    : edge.bucket === "UNCONNECTED"
                      ? "lux-edge-dash-soft"
                      : "";

                return (
                  <line
                    key={edge.id}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={color}
                    strokeWidth={width}
                    strokeOpacity={dimmed ? 0.07 : edge.bucket === "CONFIRMED" ? 0.34 : 0.22}
                    strokeDasharray={dash}
                    className={dashClass}
                    filter={isSelected ? "url(#softGlow)" : undefined}
                  />
                );
              })}
            </svg>

            {nodes.map((node) => {
              const x = clamp((node.x ?? surfaceSize.width / 2) - 90, 10, surfaceSize.width - 190);
              const y = clamp((node.y ?? surfaceSize.height / 2) - 30, 10, surfaceSize.height - 86);
              const dimmed = highlighted ? !highlighted.connectedNodes.has(node.id) : false;
              const isSelected = selectedNodeId === node.id;

              return (
                <motion.button
                  key={node.id}
                  type="button"
                  onPointerEnter={() => setHoveredNodeId(node.id)}
                  onPointerLeave={() => setHoveredNodeId((prev) => (prev === node.id ? null : prev))}
                  onClick={() => {
                    setSelectedNodeId(node.id);
                    setSelectedEdgeId(null);
                  }}
                  className={
                    "absolute grid w-[180px] gap-1 rounded-lg border px-3 py-2 text-left transition " +
                    (isSelected
                      ? "border-white/30 bg-white/[0.08]"
                      : "border-white/10 bg-white/[0.05] hover:border-white/20 hover:bg-white/[0.07]")
                  }
                  style={{
                    left: x,
                    top: y,
                    opacity: dimmed ? 0.28 : 1,
                    transform: "translateZ(0)",
                  }}
                  initial={false}
                  animate={{
                    y: dimmed ? 0 : [0, -1.4, 0],
                    transition: {
                      duration: 4.8,
                      repeat: dimmed ? 0 : Infinity,
                      ease: "easeInOut",
                      delay: (node.id % 17) * 0.05,
                    },
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">{node.name}</p>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-zinc-300">
                        {openLevelLabels[node.openLevel]} · {node.status}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-bold ${nodeBadgeClass(node)}`}>
                      {node.degree}
                    </span>
                  </div>
                  <p className="truncate text-[11px] font-semibold text-zinc-400">{node.lastActionLabel}</p>
                </motion.button>
              );
            })}
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0B0B0C] to-transparent" />
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

            {selectedNode ? (
              <>
                <form action={updateMemberExposureAction} className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-3">
                  <input type="hidden" name="id" value={selectedNode.id} />
                  <label className="grid gap-1 text-xs font-semibold text-zinc-600">
                    상태
                    <select name="status" defaultValue={selectedNode.status} className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-[#FF3131] focus:ring-2 focus:ring-red-100">
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
                    <select name="openLevel" defaultValue={selectedNode.openLevel} className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-[#FF3131] focus:ring-2 focus:ring-red-100">
                      <option value="PRIVATE">Operator 매칭</option>
                      <option value="SEMI_OPEN">제한 노출</option>
                      <option value="FULL_OPEN">전체 라운드</option>
                    </select>
                  </label>
                  <button className="h-10 rounded-lg bg-[#FF3131] px-4 text-sm font-bold text-white transition hover:bg-[#E00E0E]">
                    상태 저장
                  </button>
                </form>

                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">Relations</p>
                  <p className="text-xs font-semibold text-zinc-500">{selectedNodeEdges.length}개</p>
                </div>

                <div className="grid gap-2">
                  {selectedNodeEdges
                    .slice()
                    .sort((a, b) => (b.updatedAtIso ? Date.parse(b.updatedAtIso) : -1) - (a.updatedAtIso ? Date.parse(a.updatedAtIso) : -1))
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
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.18 }}
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
  if (bucket === "CONFIRMED") return "rgba(16, 185, 129, 0.92)";
  if (bucket === "IN_PROGRESS") return "rgba(245, 158, 11, 0.92)";
  if (bucket === "REJECTED") return "rgba(244, 63, 94, 0.92)";
  return "rgba(161, 161, 170, 0.55)";
}

function nodeBadgeClass(node: GraphNode) {
  if (node.openLevel === "FULL_OPEN") return "border-white/20 bg-white/[0.06] text-white";
  if (node.openLevel === "SEMI_OPEN") return "border-amber-500/25 bg-amber-500/10 text-amber-200";
  return "border-zinc-500/25 bg-zinc-500/10 text-zinc-200";
}

function chipForBucket(bucket: RelationshipBucket) {
  if (bucket === "CONFIRMED") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (bucket === "IN_PROGRESS") return "border-amber-200 bg-amber-50 text-amber-800";
  if (bucket === "REJECTED") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-zinc-200 bg-zinc-50 text-zinc-700";
}
