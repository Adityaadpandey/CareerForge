"""Shared agent infrastructure — LLM clients, error boundaries, tracing, and utilities.

Every agent in CareerForge uses this module instead of creating its own
OpenAI/Gemini clients or error handling patterns.
"""
import json
import time
import logging
import functools
import traceback
from typing import Any, Callable, TypeVar, Awaitable

from openai import AsyncOpenAI
import google.generativeai as genai

from app.config import settings

logger = logging.getLogger("agents")

T = TypeVar("T")

# ─── LLM CLIENTS (singletons) ───────────────────────────────────

_openai_client: AsyncOpenAI | None = None
_gemini_configured = False


def get_openai() -> AsyncOpenAI:
    """Lazy singleton OpenAI client."""
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=90.0,
            max_retries=2,
        )
    return _openai_client


def get_gemini_model(model_name: str = "gemini-3-flash-preview") -> genai.GenerativeModel:
    """Get a Gemini model, configuring API key once."""
    global _gemini_configured
    if not _gemini_configured:
        genai.configure(api_key=settings.GOOGLE_API_KEY)
        _gemini_configured = True
    return genai.GenerativeModel(model_name)


# ─── LLM CALL HELPERS ───────────────────────────────────────────

async def llm_json(
    prompt: str,
    *,
    model: str = "gpt-5-mini",
    system: str | None = None,
    temperature: float = 0.3,
    fallback: dict | None = None,
    label: str = "llm_call",
) -> dict:
    """Call OpenAI with JSON response format.

    Returns parsed dict on success, or `fallback` on any failure.
    Handles retries, timeouts, JSON parse errors gracefully.
    """
    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    t0 = time.monotonic()
    try:
        res = await get_openai().chat.completions.create(
            model=model,
            messages=messages,
            response_format={"type": "json_object"},
        )
        raw = res.choices[0].message.content or "{}"
        result = json.loads(raw)
        elapsed = time.monotonic() - t0
        logger.info(f"[{label}] ✓ LLM call ({model}) completed in {elapsed:.1f}s")
        return result

    except json.JSONDecodeError as e:
        elapsed = time.monotonic() - t0
        logger.error(f"[{label}] ✗ JSON parse error after {elapsed:.1f}s: {e}")
        return fallback or {}

    except Exception as e:
        elapsed = time.monotonic() - t0
        logger.error(f"[{label}] ✗ LLM call failed after {elapsed:.1f}s: {e}")
        return fallback or {}


async def gemini_json(
    prompt: str,
    *,
    model_name: str = "gemini-3-flash-preview",
    fallback: Any = None,
    label: str = "gemini_call",
) -> Any:
    """Call Gemini and try to parse JSON from the response."""
    t0 = time.monotonic()
    try:
        model = get_gemini_model(model_name)
        res = model.generate_content(prompt)
        text = res.text.strip()

        # Extract JSON from markdown-wrapped response
        start = text.find("[") if text.find("[") < text.find("{") and text.find("[") >= 0 else text.find("{")
        end = max(text.rfind("]"), text.rfind("}")) + 1
        if start >= 0 and end > start:
            result = json.loads(text[start:end])
            elapsed = time.monotonic() - t0
            logger.info(f"[{label}] ✓ Gemini call completed in {elapsed:.1f}s")
            return result

        elapsed = time.monotonic() - t0
        logger.warning(f"[{label}] No JSON found in Gemini response after {elapsed:.1f}s")
        return fallback

    except Exception as e:
        elapsed = time.monotonic() - t0
        logger.error(f"[{label}] ✗ Gemini call failed after {elapsed:.1f}s: {e}")
        return fallback


# ─── NODE DECORATOR ──────────────────────────────────────────────

def agent_node(
    name: str,
    *,
    critical: bool = True,
):
    """Decorator for LangGraph nodes with timing, logging, and error handling.

    Args:
        name: Human-readable node name for logs (e.g. "fetch_profile")
        critical: If True, errors propagate and kill the graph.
                  If False, errors are caught and the node returns state unchanged
                  (graceful degradation).
    """
    def decorator(fn: Callable[..., Awaitable[dict]]) -> Callable[..., Awaitable[dict]]:
        @functools.wraps(fn)
        async def wrapper(state: dict) -> dict:
            agent_name = state.get("_agent_name", "agent")
            t0 = time.monotonic()
            logger.info(f"[{agent_name}] ▶ {name}")

            try:
                result = await fn(state)
                elapsed = time.monotonic() - t0
                logger.info(f"[{agent_name}] ✓ {name} ({elapsed:.1f}s)")

                # Track execution trace
                trace = list(state.get("_trace", []))
                trace.append({"node": name, "elapsed_s": round(elapsed, 2), "status": "ok"})
                result["_trace"] = trace

                return result

            except Exception as e:
                elapsed = time.monotonic() - t0
                logger.error(
                    f"[{agent_name}] ✗ {name} failed ({elapsed:.1f}s): {e}\n"
                    f"{traceback.format_exc()}"
                )

                # Track failure in trace
                trace = list(state.get("_trace", []))
                trace.append({"node": name, "elapsed_s": round(elapsed, 2), "status": "error", "error": str(e)[:200]})

                if critical:
                    # Add trace to state before re-raising
                    state["_trace"] = trace
                    raise

                # Graceful degradation — return state unchanged
                state["_trace"] = trace
                return state

        return wrapper
    return decorator


# ─── UTILITIES ───────────────────────────────────────────────────

def safe_json(raw: str, fallback: Any = None) -> Any:
    """Safely parse JSON, returning fallback on failure."""
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return fallback or {}


def truncate(text: str, max_len: int = 2000) -> str:
    """Truncate text with ellipsis indicator."""
    if len(text) <= max_len:
        return text
    return text[:max_len] + "…[truncated]"


def init_state(agent_name: str, **kwargs) -> dict:
    """Create initial state for an agent run with tracing metadata."""
    return {
        "_agent_name": agent_name,
        "_trace": [],
        "_started_at": time.time(),
        **kwargs,
    }
