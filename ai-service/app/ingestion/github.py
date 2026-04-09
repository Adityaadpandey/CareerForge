import json
from datetime import datetime, timedelta, timezone
from github import Github
from app.config import settings
from app.db.client import get_pool


async def ingest_github(student_profile_id: str, username: str) -> dict:
    """Fetch GitHub data and store in platform_connections."""
    pool = await get_pool()

    # Mark as syncing
    await pool.execute(
        """
        UPDATE "PlatformConnection"
        SET "syncStatus" = 'SYNCING', "lastSyncedAt" = NOW()
        WHERE "studentProfileId" = $1 AND platform = 'GITHUB'
        """,
        student_profile_id,
    )

    try:
        g = Github(settings.GITHUB_TOKEN or None)
        user = g.get_user(username)

        repos = list(user.get_repos(type="owner"))[:50]

        # Language stats
        lang_counts: dict[str, int] = {}
        for repo in repos:
            if not repo.fork:
                for lang, count in (repo.get_languages() or {}).items():
                    lang_counts[lang] = lang_counts.get(lang, 0) + count

        # Contribution graph (last 90 days)
        since = datetime.now(tz=timezone.utc) - timedelta(days=90)
        commits_90d = 0
        try:
            for repo in repos[:20]:
                commits = repo.get_commits(author=username, since=since)
                commits_90d += commits.totalCount
        except Exception:
            pass

        # Top projects
        top_projects = sorted(repos, key=lambda r: r.stargazers_count, reverse=True)[:5]

        parsed_data = {
            "total_repos": user.public_repos,
            "primary_languages": dict(sorted(lang_counts.items(), key=lambda x: -x[1])[:8]),
            "commit_count_90d": commits_90d,
            "avg_repo_stars": sum(r.stargazers_count for r in repos) / max(len(repos), 1),
            "has_readme_ratio": sum(1 for r in repos if r.has_wiki) / max(len(repos), 1),
            "top_projects": [
                {
                    "name": r.name,
                    "description": r.description or "",
                    "stars": r.stargazers_count,
                    "languages": list((r.get_languages() or {}).keys())[:5],
                }
                for r in top_projects
            ],
            "followers": user.followers,
            "bio": user.bio or "",
        }

        await pool.execute(
            """
            UPDATE "PlatformConnection"
            SET "syncStatus" = 'DONE', "parsedData" = $2, "rawData" = $3, "lastSyncedAt" = NOW()
            WHERE "studentProfileId" = $1 AND platform = 'GITHUB'
            """,
            student_profile_id,
            json.dumps(parsed_data),
            json.dumps({"username": username}),
        )

        return parsed_data

    except Exception as e:
        await pool.execute(
            """
            UPDATE "PlatformConnection"
            SET "syncStatus" = 'FAILED', "errorMessage" = $2
            WHERE "studentProfileId" = $1 AND platform = 'GITHUB'
            """,
            student_profile_id,
            str(e),
        )
        raise
