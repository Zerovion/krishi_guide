"""Optional LLM-powered assistant backend for KrishiGuide.

Uses any OpenAI-compatible chat-completions endpoint (OpenAI, Z.ai GLM, Groq,
Ollama, LM Studio, vLLM...) when configured with environment variables:

  LLM_API_KEY    API key. If unset, the LLM assistant is disabled and the
                 transparent rule-based assistant answers instead.
  LLM_BASE_URL   Base URL, e.g. https://api.openai.com/v1
  LLM_MODEL      Model name, e.g. gpt-4o-mini / glm-4-flash / llama3.1

The LLM is used ONLY with a strict grounding prompt: it may use the crop
catalogue context and the live advisory summary given to it, and must tell
farmers to verify locally. It never fabricates prices or dosages.
"""
from __future__ import annotations

import os
import re
from datetime import datetime, timezone

import requests

DEFAULT_TIMEOUT = 25


def llm_config() -> dict:
    key = os.getenv('LLM_API_KEY', '').strip()
    base = os.getenv('LLM_BASE_URL', '').strip().rstrip('/')
    model = os.getenv('LLM_MODEL', '').strip()
    return {'enabled': bool(key and base and model), 'base_url': base, 'model': model}


SYSTEM_PROMPT = (
    'You are KrishiGuide Assistant, a careful farming helper for smallholder Indian farmers. '
    'Rules you must never break: (1) Use ONLY the CROP CATALOGUE and LIVE CONTEXT provided in '
    'the user message plus generally-known, low-risk agronomy. Do NOT invent mandi prices, yield '
    'guarantees, specific pesticide/fertilizer brands or dosages, or weather numbers that are not '
    'in the context. (2) Answer in the same language as the farmer question (English, Hindi or '
    'Marathi); use short sentences and simple words suitable for a farmer. (3) Keep the answer '
    'under 180 words. (4) Always end with one line reminding the farmer to confirm with their '
    'local Krishi Vigyan Kendra (KVK) or agriculture officer before acting. (5) If the question '
    'is outside farming or the provided context, say politely that you can help with crop '
    'planning, weather-aware advisories, rotation, water planning and government scheme pointers.'
)


def ask_llm(question: str, context_text: str, lang: str) -> dict | None:
    """Return {'answer': str, 'model': str} or None when disabled/failed."""
    cfg = llm_config()
    if not cfg['enabled']:
        return None
    lang_name = {'hi': 'Hindi (Devanagari)', 'mr': 'Marathi', 'en': 'English'}.get(lang, 'English')
    user_content = (
        f"CROP CATALOGUE AND LIVE CONTEXT (ground truth for this answer):\n{context_text}\n\n"
        f"Farmer's question ({lang_name}): {question}"
    )
    try:
        response = requests.post(
            f"{cfg['base_url']}/chat/completions",
            headers={'Authorization': f"Bearer {os.getenv('LLM_API_KEY', '')}"},
            json={
                'model': cfg['model'],
                'messages': [
                    {'role': 'system', 'content': SYSTEM_PROMPT},
                    {'role': 'user', 'content': user_content},
                ],
                'temperature': 0.2,
                'max_tokens': 600,
            },
            timeout=DEFAULT_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
        answer = re.sub(r'\s+', ' ', data['choices'][0]['message']['content']).strip()
        if not answer:
            return None
        return {'answer': answer, 'model': cfg['model'], 'answered_at': datetime.now(timezone.utc).isoformat()}
    except (requests.RequestException, ValueError, KeyError, IndexError):
        return None
