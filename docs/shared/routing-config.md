# LLM Routing Configuration & Multi-Tier Architecture

## Model Tiering Matrix
- **Tier 1 (Flagship / Main Generator)**:
  - Model: `gemini-3.7-flash` (atau `gemini-2.5-pro` jika deep reasoning diperlukan).
  - Role: Multimodal video analysis, complex storyboard synthesis, vision anchor extraction.
- **Tier 2 (Specialized / Vision & Reasoning)**:
  - Model: `gemini-3.7-flash`
  - Role: Quality validation, query council, content classification.
- **Tier 3 (Fast / Refiners)**:
  - Model: `gemini-3.6-flash`
  - Role: Copy refining, hashtag cleanup, formatting sanitizer.

## Fallback & Rate Limit Handling
- **Gateway**: `server/core/llm/routing/llmGateway.ts`
- **Key Rotation**: `server/core/llm/routing/apiKeyResolver.ts`
- **Auto-Failover**: Otomatis fallback ke model cadangan jika terjadi kuota limit / error 429.
