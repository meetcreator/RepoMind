"""Static analysis runner: Ruff, Bandit, ESLint, Semgrep, Lizard."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path


def _run(cmd: list[str], cwd: str) -> str:
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)
    return result.stdout


def run_ruff(repo_dir: str) -> list[dict]:
    out = _run(["ruff", "check", repo_dir, "--output-format=json", "--quiet"], repo_dir)
    if not out.strip():
        return []
    try:
        raw = json.loads(out)
    except json.JSONDecodeError:
        return []
    findings = []
    for item in raw:
        findings.append({
            "file_path": item.get("filename", ""),
            "line": item.get("location", {}).get("row"),
            "col": item.get("location", {}).get("column"),
            "category": "style",
            "severity": "warning",
            "message": item.get("message", ""),
            "tool": "ruff",
            "rule": item.get("code"),
        })
    return findings


def run_bandit(repo_dir: str) -> list[dict]:
    out = _run(["bandit", "-r", repo_dir, "-f", "json", "-q"], repo_dir)
    if not out.strip():
        return []
    try:
        raw = json.loads(out)
    except json.JSONDecodeError:
        return []
    findings = []
    severity_map = {"HIGH": "error", "MEDIUM": "warning", "LOW": "info"}
    for item in raw.get("results", []):
        findings.append({
            "file_path": item.get("filename", ""),
            "line": item.get("line_number"),
            "col": None,
            "category": "security",
            "severity": severity_map.get(item.get("issue_severity", "LOW"), "info"),
            "message": item.get("issue_text", ""),
            "tool": "bandit",
            "rule": item.get("test_id"),
        })
    return findings


def run_eslint(repo_dir: str) -> list[dict]:
    # ESLint requires a config; use a minimal inline config via --no-eslintrc
    eslint_cmd = [
        "eslint", repo_dir,
        "--ext", ".js,.jsx,.ts,.tsx",
        "--format", "json",
        "--no-eslintrc",
        "--rule", '{"no-unused-vars": "warn", "no-console": "warn"}',
        "--parser", "@typescript-eslint/parser",
        "--ignore-pattern", "node_modules/",
        "--ignore-pattern", "dist/",
    ]
    out = _run(eslint_cmd, repo_dir)
    findings = []
    if not out.strip():
        return findings
    try:
        raw = json.loads(out)
    except json.JSONDecodeError:
        return findings
    sev_map = {1: "warning", 2: "error"}
    for file_result in raw:
        for msg in file_result.get("messages", []):
            findings.append({
                "file_path": file_result.get("filePath", ""),
                "line": msg.get("line"),
                "col": msg.get("column"),
                "category": "style",
                "severity": sev_map.get(msg.get("severity", 1), "warning"),
                "message": msg.get("message", ""),
                "tool": "eslint",
                "rule": msg.get("ruleId"),
            })
    return findings


def run_semgrep(repo_dir: str) -> list[dict]:
    out = _run(
        ["semgrep", "--config=auto", repo_dir, "--json", "--quiet"],
        repo_dir,
    )
    if not out.strip():
        return []
    try:
        raw = json.loads(out)
    except json.JSONDecodeError:
        return []
    findings = []
    for item in raw.get("results", []):
        findings.append({
            "file_path": item.get("path", ""),
            "line": item.get("start", {}).get("line"),
            "col": item.get("start", {}).get("col"),
            "category": "security",
            "severity": "warning",
            "message": item.get("extra", {}).get("message", ""),
            "tool": "semgrep",
            "rule": item.get("check_id"),
        })
    return findings


def run_lizard(repo_dir: str) -> list[dict]:
    """Complexity hotspots: flag functions with CCN > 10."""
    out = _run(["lizard", repo_dir, "--json"], repo_dir)
    if not out.strip():
        return []
    try:
        raw = json.loads(out)
    except json.JSONDecodeError:
        return []
    findings = []
    for func in raw.get("function_list", []):
        ccn = func.get("cyclomatic_complexity", 0)
        if ccn > 10:
            findings.append({
                "file_path": func.get("filename", ""),
                "line": func.get("start_line"),
                "col": None,
                "category": "complexity",
                "severity": "warning" if ccn <= 20 else "error",
                "message": f"Function '{func.get('name', '')}' has cyclomatic complexity {ccn} (threshold: 10)",
                "tool": "lizard",
                "rule": "CCN",
            })
    return findings


def run_all(repo_dir: str) -> list[dict]:
    findings: list[dict] = []
    for runner in (run_ruff, run_bandit, run_eslint, run_semgrep, run_lizard):
        try:
            findings.extend(runner(repo_dir))
        except Exception as exc:
            print(f"[analyzer] {runner.__name__} failed: {exc}")
    # Make file paths relative to repo_dir for portability
    prefix = str(Path(repo_dir)) + "/"
    for f in findings:
        if f["file_path"].startswith(prefix):
            f["file_path"] = f["file_path"][len(prefix):]
    return findings
