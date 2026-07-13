"use client";
import { useEffect, useState } from "react";
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { getGraph, getRepo } from "@/lib/api";
import type { GraphData, Repo } from "@/types";
import { RepoNav, RepoTabBar } from "@/components/layout/RepoNav";

export default function GraphPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [repo, setRepo] = useState<Repo | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selected, setSelected] = useState<Node | null>(null);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRepo(id).then(setRepo);
    getGraph(id).then((data) => {
      setNodes(layoutNodes(data));
      setEdges(data.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: e.animated,
        style: { stroke: "#d1d5db" },
        labelStyle: { fontSize: 10, fill: "#6b7280" },
      })));
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const filteredNodes = filter
    ? nodes.filter((n) => (n.data?.label as string)?.toLowerCase().includes(filter.toLowerCase()))
    : nodes;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <RepoNav />
      {repo && <RepoTabBar id={id} />}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <div style={{ width: "240px", borderRight: "1px solid var(--border)", background: "var(--surface)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "0.75rem" }}>
            <input
              className="input"
              placeholder="Filter nodes..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ fontSize: "0.8125rem" }}
            />
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filteredNodes.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: "0.375rem 0.75rem",
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  borderLeft: selected?.id === n.id ? "2px solid var(--accent)" : "2px solid transparent",
                  color: selected?.id === n.id ? "var(--accent)" : "var(--text-muted)",
                }}
                onClick={() => setSelected(n)}
              >
                <span style={{ marginRight: "0.375rem" }}>{nodeIcon(n.type ?? "file")}</span>
                {n.data?.label as string}
              </div>
            ))}
          </div>
        </div>

        {/* Graph canvas */}
        <div style={{ flex: 1, position: "relative" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: "0.875rem" }}>
              Loading dependency graph...
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={(_, node) => setSelected(node)}
              fitView
              minZoom={0.2}
            >
              <Controls />
              <MiniMap zoomable pannable />
              <Background gap={16} color="#e5e7eb" />
            </ReactFlow>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ width: "280px", borderLeft: "1px solid var(--border)", background: "var(--surface)", padding: "1rem", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3>{selected.data?.label as string}</h3>
              <button className="btn btn-ghost" style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }} onClick={() => setSelected(null)}>✕</button>
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Type: {selected.type}</p>
            {selected.data?.file_path && (
              <p className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)", wordBreak: "break-all" }}>
                {selected.data.file_path as string}
                {selected.data.start_line ? `:${selected.data.start_line}` : ""}
              </p>
            )}
            {selected.data?.language && (
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>Language: {selected.data.language as string}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const TYPE_COLORS: Record<string, string> = {
  file: "#f9fafb",
  function: "#eff6ff",
  class: "#f0fdf4",
  module: "#faf5ff",
};

function layoutNodes(data: GraphData) {
  const cols = Math.ceil(Math.sqrt(data.nodes.length));
  return data.nodes.map((n, i) => ({
    id: n.id,
    type: n.type,
    position: { x: (i % cols) * 200, y: Math.floor(i / cols) * 100 },
    data: n.data,
    style: {
      background: TYPE_COLORS[n.type] ?? "#f9fafb",
      border: "1px solid #e5e7eb",
      borderRadius: 6,
      fontSize: 11,
      padding: "6px 10px",
    },
  }));
}

function nodeIcon(type: string) {
  return { file: "📄", function: "ƒ", class: "◈", module: "▣" }[type] ?? "•";
}
