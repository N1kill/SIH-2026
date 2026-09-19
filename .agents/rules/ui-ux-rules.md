# Flood dashboard UI and report rules

Apply these rules only when changing user interfaces, maps, charts, or generated
reports in this repository.

- Prioritize emergency interpretation: flood extent, depth, velocity, arrival time,
  duration, timestamps, units, and data status must be unambiguous.
- Never communicate hazard severity by color alone. Pair colors with labels, values,
  patterns, or icons and maintain readable contrast.
- Preserve the dashboard's established dark command-center visual language unless the
  user asks for a redesign. Reuse existing CSS tokens before introducing new values.
- Use monospaced numerals where alignment materially improves telemetry readability.
- Prefer bounded progress when total work is known. For indeterminate work, show an
  explicit activity state, elapsed time or latest timestamp, and a useful status label.
- Maps and charts must include the relevant legend, units, time basis, and source or
  provenance note. Do not imply precision beyond the underlying simulation or data.
- Keep controls keyboard-accessible, provide visible focus states, label icon-only
  controls, and respect reduced-motion preferences.
- Test layouts at narrow and wide viewport sizes. Critical alerts and primary actions
  must not depend on hover.
- Use factual, operational language. Clearly distinguish observed, simulated,
  estimated, unavailable, and fallback data.
- For UI design or implementation, use the `ui-ux-pro-max` skill in
  `.agents/skills/ui-ux-pro-max/` when its specialized guidance is relevant.
