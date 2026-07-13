from datetime import datetime
from typing import Optional
import uuid

from pydantic import BaseModel
from sqlmodel import Field, SQLModel


# ─── SQLite Tables (SQLModel) ─────────────────────────────────────────────────

class Repo(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    github_url: str
    name: str
    owner: str
    user_id: str
    status: str = "pending"  # pending | analyzing | ready | failed
    progress_msg: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    analyzed_at: Optional[datetime] = None
    error: Optional[str] = None
    default_branch: str = "main"


class Issue(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    repo_id: str = Field(index=True)
    file_path: str
    line: Optional[int] = None
    col: Optional[int] = None
    category: str   # security | complexity | style | error
    severity: str   # error | warning | info
    message: str
    tool: str       # ruff | bandit | eslint | semgrep | lizard
    rule: Optional[str] = None


class Doc(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    repo_id: str = Field(index=True)
    node_id: str
    node_type: str   # function | class | module
    name: str
    file_path: str
    content: str     # generated markdown
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# ─── API Request/Response Models (Pydantic) ───────────────────────────────────

class RepoCreateRequest(BaseModel):
    github_url: str


class RepoResponse(BaseModel):
    id: str
    github_url: str
    name: str
    owner: str
    status: str
    progress_msg: str
    created_at: datetime
    analyzed_at: Optional[datetime]
    error: Optional[str]

    model_config = {"from_attributes": True}


class GraphNodeData(BaseModel):
    label: str
    type: str
    file_path: str
    start_line: int = 0
    end_line: int = 0
    language: str = ""


class GraphNode(BaseModel):
    id: str
    type: str
    position: dict = Field(default_factory=lambda: {"x": 0, "y": 0})
    data: GraphNodeData


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: str
    animated: bool = False


class GraphData(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class ChatMessage(BaseModel):
    role: str   # user | assistant
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class IssueResponse(BaseModel):
    id: int
    repo_id: str
    file_path: str
    line: Optional[int]
    col: Optional[int]
    category: str
    severity: str
    message: str
    tool: str
    rule: Optional[str]

    model_config = {"from_attributes": True}


class DocResponse(BaseModel):
    id: int
    repo_id: str
    node_id: str
    node_type: str
    name: str
    file_path: str
    content: str
    generated_at: datetime

    model_config = {"from_attributes": True}


class OverviewStats(BaseModel):
    total_files: int
    total_functions: int
    total_classes: int
    total_issues: int
    health_score: int   # 0–100


class OverviewResponse(BaseModel):
    stats: OverviewStats
    mermaid_diagram: str
    architecture_summary: str


class PRFileChange(BaseModel):
    filename: str
    status: str
    additions: int
    deletions: int
    patch: str


class PRReviewResponse(BaseModel):
    pr_number: int
    title: str
    body: str
    files: list[PRFileChange]
    ai_comments: list[str]
