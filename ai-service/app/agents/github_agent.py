"""Deep GitHub Profile Analysis Agent v4.

A production-grade LangGraph agent that goes INSIDE a student's projects —
reading actual source code, analyzing commit diffs, understanding architecture
from directory trees, and evaluating open-source contributions.

Architecture:
  fetch_profile ──→ fetch_repos_deep ──→ fetch_code_deep ──→ fetch_contributions
                                                                     │
                          ┌──────────────────────────────────────────┘
                          ▼
                    fetch_commit_patterns ──→ analyze_code_quality ──→ synthesize_profile
                                                                            │
                          ┌─────────────────────────────────────────────────┘
                          ▼
                    write_results ──→ END

Design:
- CRITICAL: fetch_profile, fetch_repos_deep, write_results
- NON-CRITICAL: fetch_code_deep, fetch_contributions, fetch_commit_patterns,
                analyze_code_quality, synthesize_profile
- Conditional: skip LLM if < 2 repos
- fetch_code_deep reads actual source files + dir trees + commit diffs
- fetch_contributions finds PRs/commits on repos they don't own
"""
import json
import re
import logging
from datetime import datetime, timedelta, timezone
from typing import TypedDict, Any
from collections import Counter
from base64 import b64decode

from github import Github
from github.Repository import Repository
from github.GithubException import GithubException, UnknownObjectException
from langgraph.graph import StateGraph, END

from app.config import settings
from app.db.client import get_pool
from app.agents.base import agent_node, llm_json, init_state, truncate

logger = logging.getLogger(__name__)


# ─── CONSTANTS ──────────────────────────────────────────────────

CI_INDICATORS = [".github/workflows", "Dockerfile", "docker-compose", ".gitlab-ci", "Jenkinsfile", ".circleci"]
TEST_INDICATORS = ["test/", "tests/", "__tests__/", "spec/", "_test.go", "_test.py", "test_", ".test.ts", ".test.js", ".spec.ts", ".spec.js"]
DEP_FILES = ["package.json", "requirements.txt", "Pipfile", "go.mod", "Cargo.toml", "pom.xml", "build.gradle", "Gemfile", "pyproject.toml", "composer.json"]
CONVENTIONAL_RE = re.compile(r"^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?:")
MIN_REPOS_FOR_LLM = 2

# Entry-point files to look for (in priority order)
ENTRY_POINTS = [
    "src/index.ts", "src/index.js", "src/main.ts", "src/main.py", "src/app.ts", "src/app.py",
    "app/main.py", "app/app.py", "main.py", "main.go", "src/main.rs", "src/lib.rs",
    "index.ts", "index.js", "app.py", "server.py", "manage.py",
    "pages/index.tsx", "src/App.tsx", "src/App.jsx", "app/page.tsx",
    "cmd/main.go", "lib/main.dart",
]
# Config/infra files that reveal architecture
CONFIG_FILES = [
    "docker-compose.yml", "docker-compose.yaml", ".github/workflows/ci.yml",
    "Makefile", "tsconfig.json", "next.config.js", "next.config.ts",
    "vite.config.ts", "webpack.config.js", ".eslintrc.json", ".prettierrc",
    "package.json", "requirements.txt", "Cargo.toml", "go.mod", "pom.xml"
]
MAX_FILE_SIZE = 3000  # chars per source file
CROWN_JEWEL_MAX_SIZE = 15000  # allow larger file for the crown jewel review


# ─── STATE ──────────────────────────────────────────────────────

class GitHubAgentState(TypedDict):
    student_profile_id: str
    username: str
    _agent_name: str
    _trace: list[dict]
    _started_at: float
    profile: dict
    repos_deep: list[dict]
    lang_totals: dict[str, int]
    code_samples: list[dict]        # actual code from repos plus crown_jewel
    extracted_stack: list[str]      # deeply extracted exact tech stack (e.g., Zod, Tailwind)
    contributions: list[dict]       # OSS contributions
    commit_patterns: dict
    workflow_analysis: dict         # PR strategy vs straight to main
    code_quality: dict
    synthesis: dict
    final_parsed: dict
    _github: Any


# ─── GITHUB HELPERS ─────────────────────────────────────────────

def _create_github(token: str | None = None) -> Github:
    """Create GitHub client. Prefers user OAuth token for private repo access."""
    t = token or settings.GITHUB_TOKEN or None
    return Github(t, timeout=30, retry=3, per_page=100)


def _check_tree(repo: Repository, patterns: list[str]) -> bool:
    try:
        contents = repo.get_contents("")
        if not isinstance(contents, list):
            contents = [contents]
        names = {c.path.lower() for c in contents}
        return any(p.lower() in name for p in patterns for name in names)
    except Exception:
        return False


def _get_readme(repo: Repository, max_chars: int = 2500) -> str:
    try:
        return repo.get_readme().decoded_content.decode("utf-8", errors="replace")[:max_chars]
    except Exception:
        return ""


def _get_recent_commits(repo: Repository, username: str, count: int = 8) -> list[dict]:
    try:
        since = datetime.now(tz=timezone.utc) - timedelta(days=90)
        return [
            {
                "message": (c.commit.message or "")[:200],
                "date": c.commit.author.date.isoformat() if c.commit.author and c.commit.author.date else "",
            }
            for i, c in enumerate(repo.get_commits(author=username, since=since))
            if i < count
        ]
    except Exception:
        return []


def _detect_deps(repo: Repository) -> list[str]:
    try:
        contents = repo.get_contents("")
        if not isinstance(contents, list):
            contents = [contents]
        names = {c.path.lower() for c in contents}
        return [d for d in DEP_FILES if d.lower() in names]
    except Exception:
        return []


def _repo_score(r: Repository) -> float:
    """Composite score heavily weighted toward recency (latest pushed first)."""
    recency = 0
    if r.pushed_at:
        days_ago = (datetime.now(tz=timezone.utc) - r.pushed_at.replace(tzinfo=timezone.utc)).days
        recency = max(0, 365 - days_ago) / 365
    # Recency is dominant — we want their latest work first
    return recency * 50 + r.stargazers_count * 3 + r.forks_count * 2 + r.size / 1000


def _fetch_file_content(repo: Repository, path: str, max_chars: int = MAX_FILE_SIZE) -> str | None:
    """Fetch a single file's content from a repo. Returns None if not found."""
    try:
        content = repo.get_contents(path)
        if isinstance(content, list):
            return None  # it's a directory
        if content.size > 50000:  # skip huge files
            return None
        decoded = content.decoded_content.decode("utf-8", errors="replace")
        return decoded[:max_chars]
    except (UnknownObjectException, GithubException):
        return None
    except Exception:
        return None


def _get_dir_tree(repo: Repository, max_depth: int = 3) -> list[str]:
    """Get the directory tree using git tree API (single API call, recursive)."""
    try:
        tree = repo.get_git_tree(repo.default_branch, recursive=True)
        paths = []
        for item in tree.tree:
            # Limit depth
            depth = item.path.count("/")
            if depth < max_depth:
                prefix = "📁 " if item.type == "tree" else "📄 "
                paths.append(f"{prefix}{item.path}")
        return paths[:100]  # cap at 100 entries
    except Exception:
        return []


def _get_commit_diffs(repo: Repository, username: str, count: int = 5) -> list[dict]:
    """Fetch recent commit diffs to understand what code was actually written."""
    diffs = []
    try:
        since = datetime.now(tz=timezone.utc) - timedelta(days=60)
        for i, commit in enumerate(repo.get_commits(author=username, since=since)):
            if i >= count:
                break
            try:
                files_changed = []
                for f in commit.files or []:
                    patch = (f.patch or "")[:800] if f.patch else ""
                    files_changed.append({
                        "filename": f.filename,
                        "status": f.status,  # added, modified, removed
                        "additions": f.additions,
                        "deletions": f.deletions,
                        "patch_excerpt": patch,
                    })

                diffs.append({
                    "sha": commit.sha[:8],
                    "message": (commit.commit.message or "")[:200],
                    "date": commit.commit.author.date.isoformat() if commit.commit.author and commit.commit.author.date else "",
                    "stats": {"additions": commit.stats.additions, "deletions": commit.stats.deletions, "total": commit.stats.total},
                    "files": files_changed[:8],  # cap files per commit
                })
            except Exception:
                continue
    except Exception:
        pass
    return diffs


# ─── NODE 1: FETCH PROFILE (critical) ──────────────────────────

async def _get_user_oauth_token(student_profile_id: str) -> str | None:
    """Look up the student's GitHub OAuth token from the Account table.

    Chain: StudentProfile.userId → Account(provider='github').access_token
    This gives us access to their private repos.
    """
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT a.access_token
        FROM "Account" a
        JOIN "StudentProfile" sp ON sp."userId" = a."userId"
        WHERE sp.id = $1 AND a.provider = 'github'
        LIMIT 1
        """,
        student_profile_id,
    )
    if row and row["access_token"]:
        return row["access_token"]
    return None


@agent_node("fetch_profile", critical=True)
async def fetch_profile(state: GitHubAgentState) -> GitHubAgentState:
    """Fetch user profile using their OAuth token (for private repo access)."""
    # Try to get the user's own OAuth token — this unlocks private repos
    oauth_token = await _get_user_oauth_token(state["student_profile_id"])
    if oauth_token:
        logger.info("[github-agent] Using student's OAuth token — private repos accessible")
        g = _create_github(token=oauth_token)
        # With OAuth token, get_user() returns the authenticated user
        user = g.get_user()
    else:
        logger.info("[github-agent] No OAuth token found — using server PAT (public repos only)")
        g = _create_github()
        user = g.get_user(state["username"])

    orgs = []
    try:
        orgs = [o.login for o in user.get_orgs()]
    except Exception:
        pass

    created = user.created_at
    now = datetime.now(tz=timezone.utc)
    age_months = max(1, (now.year - created.year) * 12 + (now.month - created.month))

    total_repos = user.public_repos
    try:
        # With OAuth token, we can count private repos too
        total_private = user.total_private_repos or 0
        total_repos += total_private
    except Exception:
        total_private = 0

    return {
        **state,
        "_github": g,
        "profile": {
            "login": user.login,
            "name": user.name or "",
            "bio": user.bio or "",
            "company": user.company or "",
            "blog": user.blog or "",
            "location": user.location or "",
            "hireable": user.hireable or False,
            "public_repos": user.public_repos,
            "private_repos": total_private,
            "total_repos": total_repos,
            "followers": user.followers,
            "following": user.following,
            "account_age_months": age_months,
            "created_at": created.isoformat(),
            "organizations": orgs,
            "avatar_url": user.avatar_url or "",
        },
    }


# ─── NODE 2: FETCH REPOS DEEP (critical) ───────────────────────

@agent_node("fetch_repos_deep", critical=True)
async def fetch_repos_deep(state: GitHubAgentState) -> GitHubAgentState:
    """Fetch ALL repos (including private), sorted by most recently pushed."""
    g: Github = state.get("_github") or _create_github()
    username = state["username"]

    # If we have an OAuth token, get_user() returns authenticated user
    # and get_repos() includes private repos automatically
    try:
        # Try authenticated user first (gives private repos)
        user = g.get_user()
        if user.login.lower() != username.lower():
            # Fallback: we're using server PAT, fetch by username
            user = g.get_user(username)
            all_repos = list(user.get_repos(type="owner"))
        else:
            # Authenticated — get ALL repos including private
            all_repos = list(user.get_repos(affiliation="owner", sort="pushed", direction="desc"))
    except Exception:
        user = g.get_user(username)
        all_repos = list(user.get_repos(type="owner"))

    non_fork = [r for r in all_repos if not r.fork]
    # Sort by recency-weighted composite score (latest pushed first)
    sorted_repos = sorted(non_fork, key=_repo_score, reverse=True)

    private_count = sum(1 for r in non_fork if r.private)
    public_count = len(non_fork) - private_count
    logger.info(
        f"[github-agent] Found {len(non_fork)} non-fork repos "
        f"({public_count} public, {private_count} private), sorted by recency"
    )

    # Language totals across all non-fork repos (public + private)
    lang_totals: dict[str, int] = {}
    for repo in non_fork[:40]:
        try:
            for lang, count in (repo.get_languages() or {}).items():
                lang_totals[lang] = lang_totals.get(lang, 0) + count
        except Exception:
            pass

    repos_deep = []
    for i, repo in enumerate(sorted_repos[:25]):
        is_deep = i < 10

        data: dict[str, Any] = {
            "name": repo.name,
            "full_name": repo.full_name,
            "description": repo.description or "",
            "private": repo.private,
            "stars": repo.stargazers_count,
            "forks": repo.forks_count,
            "open_issues": repo.open_issues_count,
            "size_kb": repo.size,
            "license": repo.license.spdx_id if repo.license else None,
            "languages": list((repo.get_languages() or {}).keys())[:8],
            "created_at": repo.created_at.isoformat() if repo.created_at else "",
            "pushed_at": repo.pushed_at.isoformat() if repo.pushed_at else "",
            "updated_at": repo.updated_at.isoformat() if repo.updated_at else "",
            "default_branch": repo.default_branch,
            "_repo_obj": repo if is_deep else None,
            "total_commits": 0,
            "is_potentially_boilerplate": False,
        }

        if is_deep:
            data["topics"] = repo.get_topics()
            data["has_ci"] = _check_tree(repo, CI_INDICATORS)
            data["has_tests"] = _check_tree(repo, TEST_INDICATORS)
            data["dep_files"] = _detect_deps(repo)
            data["readme_excerpt"] = _get_readme(repo, max_chars=2000)
            data["recent_commits"] = _get_recent_commits(repo, username)
            try:
                data["total_commits"] = repo.get_commits().totalCount
                # Flag as boilerplate if large project but <= 3 commits total
                if data["total_commits"] <= 3 and data["size_kb"] > 500:
                    data["is_potentially_boilerplate"] = True
            except Exception:
                pass
        else:
            data.update(topics=[], has_ci=False, has_tests=False, dep_files=[],
                        readme_excerpt="", recent_commits=[], total_commits=0, is_potentially_boilerplate=False)

        repos_deep.append(data)

    return {
        **state,
        "repos_deep": repos_deep,
        "lang_totals": dict(sorted(lang_totals.items(), key=lambda x: -x[1])[:15]),
    }


# ─── NODE 3: FETCH CODE DEEP (non-critical) ────────────────────

@agent_node("fetch_code_deep", critical=False)
async def fetch_code_deep(state: GitHubAgentState) -> GitHubAgentState:
    """Go INSIDE the top repos — dir tree, entry-point source code, commit diffs.

    This is what gives us a real understanding of the developer:
    - Directory structure reveals architecture patterns
    - Source code reveals coding style, patterns, quality
    - Commit diffs reveal what they actually built vs boilerplate
    """
    repos = state["repos_deep"]
    username = state["username"]
    g: Github = state.get("_github") or _create_github()

    code_samples = []

    for repo_data in repos[:5]:  # deep dive top 5 only
        repo: Repository | None = repo_data.get("_repo_obj")
        if not repo:
            try:
                repo = g.get_repo(repo_data.get("full_name", f"{username}/{repo_data['name']}"))
            except Exception:
                continue

        sample: dict[str, Any] = {
            "repo_name": repo_data["name"],
            "dir_tree": [],
            "entry_point_code": {},
            "config_files": {},
            "commit_diffs": [],
        }

        # 1) Directory tree + Crown Jewel detection — single API call
        extracted_stack = state.get("extracted_stack", [])
        try:
            tree = repo.get_git_tree(repo.default_branch, recursive=True)
            paths = []
            files_by_size = []
            valid_exts = {".ts", ".tsx", ".py", ".go", ".rs", ".java", ".cpp", ".c", ".rb"}
            ignore_dirs = {"node_modules/", "vendor/", "dist/", "build/", "test", "spec", "mock", ".min."}
            
            for item in tree.tree:
                depth = item.path.count("/")
                if depth < 3:
                    prefix = "📁 " if item.type == "tree" else "📄 "
                    paths.append(f"{prefix}{item.path}")
                
                if item.type == "blob" and any(item.path.endswith(ext) for ext in valid_exts):
                    if not any(ignore in item.path for ignore in ignore_dirs):
                        files_by_size.append(item)
            
            sample["dir_tree"] = paths[:100]
            logger.info(f"[github-agent] Tree for {repo_data['name']}: {len(sample['dir_tree'])} entries")
            
            # Crown Jewel extraction
            files_by_size.sort(key=lambda x: x.size, reverse=True)
            if files_by_size:
                cj_item = files_by_size[0]
                cj_content = _fetch_file_content(repo, cj_item.path, max_chars=CROWN_JEWEL_MAX_SIZE)
                if cj_content:
                    sample["crown_jewel"] = {
                        "path": cj_item.path,
                        "size": cj_item.size,
                        "content": cj_content
                    }
                    logger.info(f"[github-agent] Crown Jewel found: {cj_item.path} ({cj_item.size} bytes)")
        except Exception as e:
            logger.warning(f"[github-agent] Tree fetch failed for {repo_data['name']}: {e}")

        # 2) Fetch entry-point source files — the code they actually wrote
        files_fetched = 0
        for path in ENTRY_POINTS:
            if files_fetched >= 3:  # max 3 entry points per repo
                break
            content = _fetch_file_content(repo, path, max_chars=MAX_FILE_SIZE)
            if content:
                sample["entry_point_code"][path] = content
                files_fetched += 1

        # 3) Fetch config/infra files + AST stack extraction
        configs_fetched = 0
        for path in CONFIG_FILES:
            if configs_fetched >= 3:
                break
            content = _fetch_file_content(repo, path, max_chars=1500)
            if content:
                sample["config_files"][path] = content
                configs_fetched += 1
                
                # Tech Stack Extraction (AST-lite)
                if path == "package.json":
                    try:
                        pkg = json.loads(content)
                        deps = list(pkg.get("dependencies", {}).keys()) + list(pkg.get("devDependencies", {}).keys())
                        for dep in deps:
                            if dep not in extracted_stack and not dep.startswith(("@types/", "eslint", "prettier", "typescript", "ts-node")):
                                extracted_stack.append(dep)
                    except Exception:
                        pass
                elif path == "requirements.txt":
                    for line in content.split("\n"):
                        dep = line.split("==")[0].split(">=")[0].strip()
                        if dep and dep not in extracted_stack and not dep.startswith("#"):
                            extracted_stack.append(dep)

        # 4) Commit diffs — what code they actually changed
        sample["commit_diffs"] = _get_commit_diffs(repo, username, count=3)

        code_samples.append(sample)
        logger.info(
            f"[github-agent] Code samples for {repo_data['name']}: "
            f"{files_fetched} entry points, {configs_fetched} configs, "
            f"{len(sample['commit_diffs'])} diffs"
        )

    return {**state, "code_samples": code_samples, "extracted_stack": extracted_stack}


# ─── NODE 4: FETCH CONTRIBUTIONS (non-critical) ────────────────

@agent_node("fetch_contributions", critical=False)
async def fetch_contributions(state: GitHubAgentState) -> GitHubAgentState:
    """Find PRs and commits on repos the user doesn't own (OSS contributions)."""
    g: Github = state.get("_github") or _create_github()
    username = state["username"]

    contributions = []

    # Search for merged PRs by this user
    try:
        prs = g.search_issues(
            f"type:pr author:{username} is:merged",
            sort="updated", order="desc"
        )
        for i, pr in enumerate(prs):
            if i >= 15:  # cap
                break
            repo_name = pr.repository.full_name if pr.repository else ""
            # Skip own repos
            if repo_name.startswith(f"{username}/"):
                continue

            contributions.append({
                "type": "pr_merged",
                "repo": repo_name,
                "title": pr.title,
                "url": pr.html_url,
                "created_at": pr.created_at.isoformat() if pr.created_at else "",
                "labels": [lbl.name for lbl in (pr.labels or [])][:5],
            })
    except Exception as e:
        logger.warning(f"[github-agent] PR search failed: {e}")

    # Search for open PRs too
    try:
        open_prs = g.search_issues(
            f"type:pr author:{username} is:open",
            sort="updated", order="desc"
        )
        for i, pr in enumerate(open_prs):
            if i >= 5:
                break
            repo_name = pr.repository.full_name if pr.repository else ""
            if repo_name.startswith(f"{username}/"):
                continue
            contributions.append({
                "type": "pr_open",
                "repo": repo_name,
                "title": pr.title,
                "url": pr.html_url,
                "created_at": pr.created_at.isoformat() if pr.created_at else "",
            })
    except Exception as e:
        logger.warning(f"[github-agent] Open PR search failed: {e}")

    # Summarize
    oss_repos = list(set(c["repo"] for c in contributions if c.get("repo")))
    logger.info(f"[github-agent] Found {len(contributions)} contributions across {len(oss_repos)} repos")

    return {**state, "contributions": contributions}


# ─── NODE 5: FETCH COMMIT PATTERNS (non-critical) ──────────────

@agent_node("fetch_commit_patterns", critical=False)
async def fetch_commit_patterns(state: GitHubAgentState) -> GitHubAgentState:
    """Analyze commit frequency, streaks, and message quality over 90 days."""
    g: Github = state.get("_github") or _create_github()
    user = g.get_user(state["username"])
    username = state["username"]

    since = datetime.now(tz=timezone.utc) - timedelta(days=90)
    non_fork = [r for r in user.get_repos(type="owner") if not r.fork]

    all_dates: list[datetime] = []
    all_messages: list[str] = []
    hour_counts: Counter = Counter()
    day_counts: Counter = Counter()

    for repo in non_fork[:20]:
        try:
            for i, c in enumerate(repo.get_commits(author=username, since=since)):
                if i >= 50:
                    break
                if c.commit.author and c.commit.author.date:
                    dt = c.commit.author.date
                    all_dates.append(dt)
                    hour_counts[dt.hour] += 1
                    day_counts[dt.strftime("%A")] += 1
                msg = (c.commit.message or "").split("\n")[0]
                if msg:
                    all_messages.append(msg)
        except Exception:
            continue

    longest_streak = 0
    if all_dates:
        unique_days = sorted(set(d.date() for d in all_dates))
        streak = 1
        for i in range(1, len(unique_days)):
            if (unique_days[i] - unique_days[i-1]).days == 1:
                streak += 1
                longest_streak = max(longest_streak, streak)
            else:
                streak = 1
        longest_streak = max(longest_streak, 1)

    total_90d = len(all_dates)
    n_msg = max(len(all_messages), 1)
    conventional_count = sum(1 for m in all_messages if CONVENTIONAL_RE.match(m.lower()))

    # Workflow Analysis: Do they use PRs on their own repos?
    workflow = {
        "pr_driven": False,
        "classification": "SOLO_HACKER",
        "own_pr_count": 0
    }
    try:
        # Search for PRs authored by the user on their own repos
        own_prs = g.search_issues(f"type:pr author:{username} user:{username}", sort="updated", order="desc")
        pr_count = own_prs.totalCount
        workflow["own_pr_count"] = pr_count
        if pr_count > 0:
            workflow["pr_driven"] = True
            workflow["classification"] = "PRODUCTION_READY"
    except Exception as e:
        logger.warning(f"[github-agent] Workflow analysis PR search failed: {e}")

    return {
        **state,
        "commit_patterns": {
            "total_90d": total_90d,
            "weekly_avg": round(total_90d / 13, 1),
            "longest_streak_days": longest_streak,
            "most_active_day": day_counts.most_common(1)[0][0] if day_counts else "N/A",
            "most_active_hour": hour_counts.most_common(1)[0][0] if hour_counts else 0,
            "avg_message_length": round(sum(len(m) for m in all_messages) / n_msg, 1),
            "conventional_commit_ratio": round(conventional_count / n_msg, 2),
            "unique_active_days_90d": len(set(d.date() for d in all_dates)),
        },
        "workflow_analysis": workflow,
    }


# ─── NODE 6: ANALYZE CODE QUALITY (non-critical, LLM) ──────────

@agent_node("analyze_code_quality", critical=False)
async def analyze_code_quality(state: GitHubAgentState) -> GitHubAgentState:
    """LLM reviews actual source code, dir trees, and commit diffs."""
    repos = state["repos_deep"]
    code_samples = state.get("code_samples", [])

    if len(repos) < MIN_REPOS_FOR_LLM:
        return {**state, "code_quality": _default_quality_scores()}

    # Build rich context from code samples
    code_context_parts = []
    for sample in code_samples[:3]:  # top 3 repos with code
        is_private = next((r["private"] for r in repos if r["name"] == sample["repo_name"]), False)
        repo_type = " (Private Repo)" if is_private else ""
        parts = [f"\n### Project: {sample['repo_name']}{repo_type}"]

        # Directory tree
        if sample.get("dir_tree"):
            tree_str = "\n".join(sample["dir_tree"][:40])
            parts.append(f"**Directory structure:**\n```\n{tree_str}\n```")

        # Crown Jewel
        if sample.get("crown_jewel"):
            cj = sample["crown_jewel"]
            parts.append(f"**CROWN JEWEL (Largest Core Logic File) - {cj['path']} ({cj['size']} bytes):**\n```\n{truncate(cj['content'], 2500)}\n```")

        # Entry point code
        for path, code in list(sample.get("entry_point_code", {}).items())[:2]:
            parts.append(f"**{path}:**\n```\n{truncate(code, 1500)}\n```")

        # Config files
        for path, code in list(sample.get("config_files", {}).items())[:1]:
            parts.append(f"**{path}:**\n```\n{truncate(code, 1000)}\n```")

        # Commit diffs
        diffs = sample.get("commit_diffs", [])
        if diffs:
            diff_lines = []
            for d in diffs[:2]:
                diff_lines.append(f"Commit `{d['sha']}`: {d['message']}")
                for f in d.get("files", [])[:3]:
                    diff_lines.append(f"  {f['status']} {f['filename']} (+{f['additions']}/-{f['deletions']})")
                    if f.get("patch_excerpt"):
                        diff_lines.append(f"  ```diff\n  {truncate(f['patch_excerpt'], 500)}\n  ```")
            parts.append(f"**Recent commits:**\n" + "\n".join(diff_lines))

        code_context_parts.append("\n".join(parts))

    # Also include README-based context for repos without code samples
    readme_ctx = []
    for r in repos[:5]:
        if r.get("readme_excerpt") and r["name"] not in [s["repo_name"] for s in code_samples]:
            readme_ctx.append({
                "name": r["name"], "description": r["description"],
                "private": r.get("private", False),
                "languages": r["languages"], "has_ci": r.get("has_ci"),
                "has_tests": r.get("has_tests"), "dep_files": r.get("dep_files", []),
                "readme_excerpt": truncate(r.get("readme_excerpt", ""), 1000),
            })

    # Contribution context
    contributions = state.get("contributions", [])
    contrib_ctx = ""
    if contributions:
        oss_repos = list(set(c["repo"] for c in contributions if c.get("repo")))
        merged_count = sum(1 for c in contributions if c["type"] == "pr_merged")
        contrib_ctx = f"\n## Open Source Contributions:\n- {merged_count} merged PRs across {len(oss_repos)} repos: {', '.join(oss_repos[:5])}"

    ci_count = sum(1 for r in repos[:10] if r.get("has_ci"))
    test_count = sum(1 for r in repos[:10] if r.get("has_tests"))
    analyzed = min(len(repos), 10)

    code_section = "\n---\n".join(code_context_parts) if code_context_parts else "No source code available."

    result = await llm_json(
        prompt=f"""You are a SENIOR STAFF ENGINEER performing a deep code review of a developer's GitHub portfolio.
You have access to their actual source code, directory structures, and commit diffs.

## ACTUAL SOURCE CODE FROM THEIR PROJECTS:
{code_section}

## Additional projects (README only):
{json.dumps(readme_ctx, indent=2) if readme_ctx else "None"}

## Developer Metametrics:
- Extracted Tech Stack (from package/go.mod parsing): {json.dumps(state.get('extracted_stack', []))}
- Collaboration Workflow: {state.get('workflow_analysis', {}).get('classification')} (Own PR count: {state.get('workflow_analysis', {}).get('own_pr_count')})
- Boilerplate Projects Detected: {sum(1 for r in repos if r.get('is_potentially_boilerplate'))}
{contrib_ctx}

## Aggregate signals:
- CI/CD in {ci_count}/{analyzed} repos | Tests in {test_count}/{analyzed} repos
- Languages: {list(state['lang_totals'].keys())[:10]}
- Commit patterns: {json.dumps(state.get('commit_patterns', {}))}

## EVALUATE based on the actual code you see:

Score each 0-10 with specific evidence:
1. **readme_quality** — Documentation clarity and completeness
2. **architecture_maturity** — Evaluate the dir tree AND the Crown Jewel file. Do they separate concerns or dump it all together?
3. **tech_sophistication** — Based on the exact extracted stack and Crown Jewel contents. 
4. **code_style** — Variables, types, error handling visible in the Crown Jewel code.
5. **testing_adoption** — Test configs, imports
6. **ci_cd_adoption** — Workflows
7. **project_complexity** — If flagged as Boilerplate, penalize. Evaluate genuine algorithmic complexity of Crown Jewel.
8. **documentation_quality** — Inline docs and README
9. **overall** — Holistic assessment

Return JSON:
{{
  "scores": {{"readme_quality": 0, "architecture_maturity": 0, "tech_sophistication": 0, "code_style": 0, "testing_adoption": 0, "ci_cd_adoption": 0, "project_complexity": 0, "documentation_quality": 0, "overall": 0}},
  "project_tiers": {{"project_name": "toy|tutorial_boilerplate|learning|portfolio|production"}},
  "code_patterns_observed": ["pattern1: specific evidence", "pattern2: specific evidence"],
  "notable_observations": ["observation with specific code references"]
}}""",
        model="gpt-4o-mini",
        temperature=0.3,
        fallback=_default_quality_scores(),
        label="github/code_quality_deep",
    )

    tiers = result.get("project_tiers", {})
    for r in repos:
        r["complexity_tier"] = tiers.get(r["name"], "unknown")

    return {**state, "code_quality": result, "repos_deep": repos}


def _default_quality_scores() -> dict:
    return {
        "scores": {
            "readme_quality": 5, "architecture_maturity": 5,
            "tech_sophistication": 5, "code_style": 5, "testing_adoption": 3,
            "ci_cd_adoption": 3, "project_complexity": 5,
            "documentation_quality": 5, "overall": 4.5,
        },
        "project_tiers": {},
        "code_patterns_observed": [],
        "notable_observations": ["LLM analysis was skipped or unavailable — using defaults"],
    }


# ─── NODE 7: SYNTHESIZE PROFILE (non-critical, LLM) ────────────

@agent_node("synthesize_profile", critical=False)
async def synthesize_profile(state: GitHubAgentState) -> GitHubAgentState:
    """LLM produces a comprehensive, evidence-based developer assessment."""
    profile = state["profile"]
    repos = state["repos_deep"]
    commit = state.get("commit_patterns", {})
    quality = state.get("code_quality", {})
    contributions = state.get("contributions", [])
    langs = state["lang_totals"]

    top_projects = [
        {"name": r["name"], "description": r["description"], "languages": r["languages"],
         "private": r.get("private", False), "stars": r["stars"], "tier": r.get("complexity_tier", "unknown")}
        for r in repos[:8]
    ]

    # Contribution summary
    merged_prs = [c for c in contributions if c["type"] == "pr_merged"]
    oss_repos = list(set(c["repo"] for c in merged_prs))
    contrib_summary = ""
    if merged_prs:
        contrib_summary = f"""
## Open Source Contributions:
- {len(merged_prs)} merged PRs across repos: {', '.join(oss_repos[:5])}
- Notable PRs: {json.dumps([{'repo': c['repo'], 'title': c['title']} for c in merged_prs[:5]])}"""

    # Code patterns from analysis
    code_patterns = quality.get("code_patterns_observed", [])
    patterns_str = "\n".join(f"- {p}" for p in code_patterns[:8]) if code_patterns else "None available"

    result = await llm_json(
        prompt=f"""You are a career placement officer writing a comprehensive developer assessment.
You have deep code-level analysis available — use it to be SPECIFIC and EVIDENCE-BASED.

## Profile:
- Username: {profile['login']} | Bio: {profile['bio']}
- Account age: {profile['account_age_months']} months | Followers: {profile['followers']}
- Orgs: {profile['organizations']} | Public repos: {profile['public_repos']}

## Languages: {json.dumps(dict(list(langs.items())[:8]))}
## Top projects: {json.dumps(top_projects, indent=2)}
## Code quality (0-10): {json.dumps(quality.get('scores', {}))}
## Tech Stack Deep Extracted: {json.dumps(state.get('extracted_stack', []))}
## Workflow/Collaboration: {state.get('workflow_analysis', {}).get('classification')}
## Code patterns observed:
{patterns_str}
## Commit patterns (90d): {json.dumps(commit)}
{contrib_summary}

Write a DETAILED, HONEST assessment. Reference specific projects, code patterns, and evidence.

Return JSON:
{{
  "summary": "4-5 sentence assessment referencing specific projects, code patterns, and evidence from their actual code.",
  "strengths": ["specific strength with evidence"],
  "weaknesses": ["specific weakness with evidence"],
  "domain": "frontend | backend | fullstack | devops | ml | mobile | systems | data",
  "seniority": "beginner | intermediate | advanced",
  "placement_readiness": "CRITICAL | AT_RISK | CAPABLE | RISING_STAR",
  "tech_stack": ["Tech1", "Tech2"],
  "oss_contribution_level": "none | occasional | active | significant",
  "improvement_priorities": [{{"area": "...", "action": "specific advice referencing their code", "impact": "high|medium|low"}}],
  "interview_topics": ["topic based on their actual project experience"]
}}""",
        model="gpt-4o-mini",
        temperature=0.4,
        fallback={
            "summary": f"GitHub profile analysis for {state['username']} — synthesis unavailable.",
            "strengths": list(langs.keys())[:3],
            "weaknesses": ["Analysis incomplete"],
            "domain": "unknown", "seniority": "beginner",
            "placement_readiness": "UNASSESSED",
            "tech_stack": list(langs.keys())[:5],
            "oss_contribution_level": "unknown",
            "improvement_priorities": [], "interview_topics": [],
        },
        label="github/synthesize_deep",
    )

    return {**state, "synthesis": result}


# ─── NODE 8: WRITE RESULTS (critical) ──────────────────────────

@agent_node("write_results", critical=True)
async def write_results(state: GitHubAgentState) -> GitHubAgentState:
    """Persist enriched analysis to PlatformConnection.parsedData."""
    pool = await get_pool()
    spid = state["student_profile_id"]

    repos_clean = [
        {
            "name": r["name"], "description": r["description"],
            "private": r.get("private", False),
            "stars": r["stars"], "forks": r.get("forks", 0),
            "languages": r["languages"],
            "complexity_tier": r.get("complexity_tier", "unknown"),
            "has_ci": r.get("has_ci", False),
            "has_tests": r.get("has_tests", False),
            "topics": r.get("topics", []),
            "license": r.get("license"),
            "pushed_at": r.get("pushed_at", ""),
            "dep_files": r.get("dep_files", []),
            "total_commits": r.get("total_commits", 0),
            "is_potentially_boilerplate": r.get("is_potentially_boilerplate", False),
        }
        for r in state["repos_deep"]
    ]

    deep_count = min(len(repos_clean), 10)
    ci_ratio = round(sum(1 for r in repos_clean[:deep_count] if r["has_ci"]) / max(deep_count, 1), 2)
    test_ratio = round(sum(1 for r in repos_clean[:deep_count] if r["has_tests"]) / max(deep_count, 1), 2)
    license_ratio = round(sum(1 for r in repos_clean if r["license"]) / max(len(repos_clean), 1), 2)

    # Code samples summary (strip actual code, keep dir trees)
    code_summaries = []
    for sample in state.get("code_samples", []):
        code_summaries.append({
            "repo": sample["repo_name"],
            "dir_tree_depth": len(sample.get("dir_tree", [])),
            "entry_points_found": list(sample.get("entry_point_code", {}).keys()),
            "config_files_found": list(sample.get("config_files", {}).keys()),
            "commits_analyzed": len(sample.get("commit_diffs", [])),
        })

    # Contributions summary
    contributions = state.get("contributions", [])
    contribution_summary = {
        "total_prs": len(contributions),
        "merged_prs": sum(1 for c in contributions if c["type"] == "pr_merged"),
        "open_prs": sum(1 for c in contributions if c["type"] == "pr_open"),
        "oss_repos": list(set(c["repo"] for c in contributions if c.get("repo")))[:10],
        "notable": [{"repo": c["repo"], "title": c["title"]} for c in contributions[:5]],
    }

    trace = state.get("_trace", [])
    total_time = sum(t.get("elapsed_s", 0) for t in trace)
    failed_nodes = [t["node"] for t in trace if t.get("status") == "error"]

    final = {
        "profile": state["profile"],
        "repositories": {
            "total_count": state["profile"]["public_repos"],
            "non_fork_analyzed": len(state["repos_deep"]),
            "primary_languages": state["lang_totals"],
            "has_ci_ratio": ci_ratio,
            "has_tests_ratio": test_ratio,
            "license_ratio": license_ratio,
            "top_projects": repos_clean[:10],
        },
        "code_analysis": {
            "repos_with_code_review": code_summaries,
            "crown_jewel_review": next(
                ({"repo": s["repo_name"], "path": s["crown_jewel"]["path"], "size_kb": round(s["crown_jewel"]["size"]/1024, 1)} 
                 for s in state.get("code_samples", []) if s.get("crown_jewel")), 
                 None
            ),
            "code_patterns": state.get("code_quality", {}).get("code_patterns_observed", []),
            "tech_stack_extracted": state.get("extracted_stack", []),
        },
        "contributions": contribution_summary,
        "commit_patterns": state.get("commit_patterns", {}),
        "workflow_analysis": state.get("workflow_analysis", {}),
        "code_quality": state.get("code_quality", {}).get("scores", {}),
        "code_quality_observations": state.get("code_quality", {}).get("notable_observations", []),
        "synthesis": state.get("synthesis", {}),
        "_meta": {
            "agent_version": "5.0",
            "total_time_s": round(total_time, 1),
            "nodes_executed": len(trace),
            "nodes_failed": failed_nodes,
        },
    }

    await pool.execute(
        """
        UPDATE "PlatformConnection"
        SET "syncStatus" = 'DONE',
            "parsedData" = $2,
            "rawData" = $3,
            "lastSyncedAt" = NOW(),
            "errorMessage" = NULL
        WHERE "studentProfileId" = $1 AND platform = 'GITHUB'
        """,
        spid,
        json.dumps(final),
        json.dumps({"username": state["username"], "agent_version": "5.0", "trace": trace}),
    )

    return {**state, "final_parsed": final}


# ─── CONDITIONAL ROUTING ────────────────────────────────────────

def should_run_llm(state: GitHubAgentState) -> str:
    repos = state.get("repos_deep", [])
    if len(repos) < MIN_REPOS_FOR_LLM:
        return "write_results"
    return "fetch_code_deep"


# ─── GRAPH ──────────────────────────────────────────────────────

def build_github_agent():
    g = StateGraph(GitHubAgentState)

    g.add_node("fetch_profile", fetch_profile)
    g.add_node("fetch_repos_deep", fetch_repos_deep)
    g.add_node("fetch_code_deep", fetch_code_deep)
    g.add_node("fetch_contributions", fetch_contributions)
    g.add_node("fetch_commit_patterns", fetch_commit_patterns)
    g.add_node("analyze_code_quality", analyze_code_quality)
    g.add_node("synthesize_profile", synthesize_profile)
    g.add_node("write_results", write_results)

    g.set_entry_point("fetch_profile")
    g.add_edge("fetch_profile", "fetch_repos_deep")

    # Conditional: enough repos? → deep analysis : skip
    g.add_conditional_edges("fetch_repos_deep", should_run_llm, {
        "fetch_code_deep": "fetch_code_deep",
        "write_results": "write_results",
    })

    g.add_edge("fetch_code_deep", "fetch_contributions")
    g.add_edge("fetch_contributions", "fetch_commit_patterns")
    g.add_edge("fetch_commit_patterns", "analyze_code_quality")
    g.add_edge("analyze_code_quality", "synthesize_profile")
    g.add_edge("synthesize_profile", "write_results")
    g.add_edge("write_results", END)

    return g.compile()


github_agent_graph = build_github_agent()
