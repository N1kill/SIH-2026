# Specula Engineering & Design Standards

The following rules MUST pass code review on all UI components, marketing pages, and ReportLab PDF renderers. They are non-negotiable standards for the Specula brand.

## Pre-Commit Engineering & Design Checklist

*   **Zero Glassmorphism:** Ensure no `backdrop-filter: blur(...)` is applied; containers must use solid `#1C1844` on top of `#120E32`.
*   **Zero Drop Shadows:** Disallow soft drop shadows on dark backgrounds; depth must be structured entirely through 1px solid `var(--sp-color-border-grid)` borders.
*   **Sharp Contours:** Cap border-radius strictly at 2px (or 0px on tables/terminal panes). No pill-shaped buttons.
*   **Telemetry Data in Monospace:** Every hash (SHA-256), timestamp, IP address, Merkle leaf, and numeric benchmark metric must be explicitly rendered in `var(--sp-font-mono)` (Fira Code or JetBrains Mono).
*   **Deterministic Progress States:** Indefinite spinning indicators are prohibited; all agent operations must expose timestamped telemetry lines or bounded progress trackers (0%–100%).
*   **Copy Integrity:** Marketing and UI copy must reject SaaS buzzwords (magic, copilot, seamless, unlock) in favor of forensic, empirical language (admissible, reconstruct, topological, provenance).

Any agent modifying the UI or generating reports MUST adhere to these rules.
