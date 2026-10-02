"""Generate memobase/config.yaml from the spike .env (keeps the LLM key out of commands and git)."""
import os
from pathlib import Path

from evalkit.common import ROOT, llm_model
from evalkit.embed import MODEL

cfg = f"""llm_style: openai
llm_base_url: {os.environ['LLM_BASE_URL']}
llm_api_key: {os.environ['LLM_API_KEY']}
best_llm_model: {llm_model()}
thinking_llm_model: {llm_model()}
summary_llm_model: {llm_model()}
embedding_provider: openai
embedding_base_url: http://host.docker.internal:{os.getenv('EMBED_PORT', '8790')}/v1
embedding_api_key: local
embedding_model: {MODEL}
embedding_dim: 384
persistent_chat_blobs: true
"""
path = ROOT / "memobase" / "config.yaml"
path.write_text(cfg)
Path(path).chmod(0o600)
print(f"wrote {path.relative_to(ROOT)}")
