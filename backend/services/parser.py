"""Tree-sitter based code parser for Python, JavaScript/TypeScript, and Go."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from tree_sitter import Node
from tree_sitter_languages import get_language, get_parser

EXTENSION_LANGUAGE: dict[str, str] = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".go": "go",
}

SKIP_DIRS: set[str] = {
    ".git", "node_modules", "__pycache__", ".venv", "venv",
    "dist", "build", ".next", "vendor", ".mypy_cache",
}


@dataclass
class ParsedFunction:
    name: str
    start_line: int
    end_line: int
    body: str


@dataclass
class ParsedClass:
    name: str
    start_line: int
    end_line: int
    body: str


@dataclass
class ParsedFile:
    path: str
    language: str
    functions: list[ParsedFunction] = field(default_factory=list)
    classes: list[ParsedClass] = field(default_factory=list)
    imports: list[str] = field(default_factory=list)


def _child_text(node: Node, field_name: str, source: bytes) -> str:
    child = node.child_by_field_name(field_name)
    if child:
        return source[child.start_byte:child.end_byte].decode("utf-8", errors="replace")
    return ""


def _node_body(node: Node, source_lines: list[str]) -> str:
    lines = source_lines[node.start_point[0]: node.end_point[0] + 1]
    return "\n".join(lines)[:3000]


def _parse_python(tree_root: Node, source: bytes, source_lines: list[str]) -> tuple[list[ParsedFunction], list[ParsedClass], list[str]]:
    funcs: list[ParsedFunction] = []
    classes: list[ParsedClass] = []
    imports: list[str] = []

    def walk(node: Node) -> None:
        if node.type == "function_definition":
            name_node = node.child_by_field_name("name")
            name = source[name_node.start_byte:name_node.end_byte].decode() if name_node else "<anon>"
            funcs.append(ParsedFunction(
                name=name,
                start_line=node.start_point[0] + 1,
                end_line=node.end_point[0] + 1,
                body=_node_body(node, source_lines),
            ))
        elif node.type == "class_definition":
            name_node = node.child_by_field_name("name")
            name = source[name_node.start_byte:name_node.end_byte].decode() if name_node else "<anon>"
            classes.append(ParsedClass(
                name=name,
                start_line=node.start_point[0] + 1,
                end_line=node.end_point[0] + 1,
                body=_node_body(node, source_lines),
            ))
        elif node.type in ("import_statement", "import_from_statement"):
            imports.append(source[node.start_byte:node.end_byte].decode("utf-8", errors="replace").strip())
        for child in node.children:
            walk(child)

    walk(tree_root)
    return funcs, classes, imports


def _parse_js_ts(tree_root: Node, source: bytes, source_lines: list[str]) -> tuple[list[ParsedFunction], list[ParsedClass], list[str]]:
    funcs: list[ParsedFunction] = []
    classes: list[ParsedClass] = []
    imports: list[str] = []

    def walk(node: Node) -> None:
        if node.type in ("function_declaration", "function"):
            name_node = node.child_by_field_name("name")
            name = source[name_node.start_byte:name_node.end_byte].decode() if name_node else "<anon>"
            funcs.append(ParsedFunction(
                name=name,
                start_line=node.start_point[0] + 1,
                end_line=node.end_point[0] + 1,
                body=_node_body(node, source_lines),
            ))
        elif node.type in ("method_definition", "method_signature"):
            name_node = node.child_by_field_name("name")
            name = source[name_node.start_byte:name_node.end_byte].decode() if name_node else "<anon>"
            funcs.append(ParsedFunction(
                name=name,
                start_line=node.start_point[0] + 1,
                end_line=node.end_point[0] + 1,
                body=_node_body(node, source_lines),
            ))
        elif node.type in ("class_declaration", "class"):
            name_node = node.child_by_field_name("name")
            name = source[name_node.start_byte:name_node.end_byte].decode() if name_node else "<anon>"
            classes.append(ParsedClass(
                name=name,
                start_line=node.start_point[0] + 1,
                end_line=node.end_point[0] + 1,
                body=_node_body(node, source_lines),
            ))
        elif node.type == "import_statement":
            imports.append(source[node.start_byte:node.end_byte].decode("utf-8", errors="replace").strip())
        for child in node.children:
            walk(child)

    walk(tree_root)
    return funcs, classes, imports


def _parse_go(tree_root: Node, source: bytes, source_lines: list[str]) -> tuple[list[ParsedFunction], list[ParsedClass], list[str]]:
    funcs: list[ParsedFunction] = []
    classes: list[ParsedClass] = []
    imports: list[str] = []

    def walk(node: Node) -> None:
        if node.type == "function_declaration":
            name_node = node.child_by_field_name("name")
            name = source[name_node.start_byte:name_node.end_byte].decode() if name_node else "<anon>"
            funcs.append(ParsedFunction(
                name=name,
                start_line=node.start_point[0] + 1,
                end_line=node.end_point[0] + 1,
                body=_node_body(node, source_lines),
            ))
        elif node.type == "method_declaration":
            name_node = node.child_by_field_name("name")
            name = source[name_node.start_byte:name_node.end_byte].decode() if name_node else "<anon>"
            funcs.append(ParsedFunction(
                name=name,
                start_line=node.start_point[0] + 1,
                end_line=node.end_point[0] + 1,
                body=_node_body(node, source_lines),
            ))
        elif node.type == "type_declaration":
            for child in node.children:
                if child.type == "type_spec":
                    name_node = child.child_by_field_name("name")
                    name = source[name_node.start_byte:name_node.end_byte].decode() if name_node else "<anon>"
                    classes.append(ParsedClass(
                        name=name,
                        start_line=node.start_point[0] + 1,
                        end_line=node.end_point[0] + 1,
                        body=_node_body(node, source_lines),
                    ))
        elif node.type == "import_declaration":
            imports.append(source[node.start_byte:node.end_byte].decode("utf-8", errors="replace").strip())
        for child in node.children:
            walk(child)

    walk(tree_root)
    return funcs, classes, imports


def parse_file(file_path: str) -> ParsedFile | None:
    path = Path(file_path)
    lang = EXTENSION_LANGUAGE.get(path.suffix.lower())
    if not lang:
        return None

    try:
        source = path.read_bytes()
        parser = get_parser(lang)
        tree = parser.parse(source)
        source_lines = source.decode("utf-8", errors="replace").splitlines()

        if lang == "python":
            funcs, classes, imports = _parse_python(tree.root_node, source, source_lines)
        elif lang in ("javascript", "typescript", "tsx"):
            funcs, classes, imports = _parse_js_ts(tree.root_node, source, source_lines)
        elif lang == "go":
            funcs, classes, imports = _parse_go(tree.root_node, source, source_lines)
        else:
            return None

        return ParsedFile(path=str(path), language=lang, functions=funcs, classes=classes, imports=imports)
    except Exception as exc:
        print(f"[parser] Error parsing {file_path}: {exc}")
        return None


def walk_repo(repo_dir: str) -> list[ParsedFile]:
    results: list[ParsedFile] = []
    for root, dirs, files in os.walk(repo_dir):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
        for fname in files:
            fpath = os.path.join(root, fname)
            parsed = parse_file(fpath)
            if parsed is not None:
                results.append(parsed)
    return results
