export interface Repo {
  id: string;
  github_url: string;
  name: string;
  owner: string;
  status: "pending" | "analyzing" | "ready" | "failed";
  progress_msg: string;
  created_at: string;
  analyzed_at: string | null;
  error: string | null;
}

export interface RepoStatus {
  status: Repo["status"];
  progress_msg: string;
  error: string | null;
}

export interface GraphNodeData {
  label: string;
  type: string;
  file_path: string;
  start_line: number;
  end_line: number;
  language: string;
}

export interface GraphNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: GraphNodeData;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  animated: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Issue {
  id: number;
  repo_id: string;
  file_path: string;
  line: number | null;
  col: number | null;
  category: string;
  severity: "error" | "warning" | "info";
  message: string;
  tool: string;
  rule: string | null;
}

export interface Doc {
  id: number;
  repo_id: string;
  node_id: string;
  node_type: string;
  name: string;
  file_path: string;
  content: string;
  generated_at: string;
}

export interface OverviewStats {
  total_files: number;
  total_functions: number;
  total_classes: number;
  total_issues: number;
  health_score: number;
}

export interface Overview {
  stats: OverviewStats;
  mermaid_diagram: string;
  architecture_summary: string;
}

export interface PRFileChange {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch: string;
}

export interface PRReview {
  pr_number: number;
  title: string;
  body: string;
  files: PRFileChange[];
  ai_comments: string[];
}
