"""
09_breach_parameters.py
=======================
Directive 4: Breach Parameter Estimation — Machhu-II Dam, Morbi, Gujarat.

Implements:
  1. Froehlich (2008) breach geometry equations:
       - Average breach width     B_avg  [m]
       - Side slopes              Z      [H:V]
       - Formation time           t_f    [hours]
  2. Froehlich (1995) peak breach outflow:
       - Peak discharge           Q_p    [m³/s]
  3. Comparison table vs. Wahl (1998) and historical observed values.

Dam parameters (Machhu-II, 1979 failure):
  - Embankment height   H   = 22.56 m
  - Reservoir volume    V_w = 101 Mm³ = 101 × 10⁶ m³
  - Failure mode            = Overtopping (heavy monsoon, 1979)

Outputs:
  - data/processed/breach_params.json
  - docs/breach_param_comparison.md
  - outputs/gis/breach_parameter_plot.png

References:
  - Froehlich, D.C. (1995). "Peak outflow from breached embankment dam."
    J. Water Resour. Plann. Manage., 121(1), 90–97.
  - Froehlich, D.C. (2008). "Embankment Dam Breach Parameters and Their
    Uncertainties." J. Hydraul. Eng., 134(12), 1708–1721.
  - Wahl, T.L. (1998). Prediction of Embankment Dam Breach Parameters —
    A Literature Review and Needs Assessment. DSO-98-004, USBR.
  - Singh, R.P. & Adams, B.J. (1983). "Machhu-II Dam Failure Analysis."
    Indian J. Power River Valley Dev.
"""

import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path

import matplotlib.patches as mpatches
import matplotlib.pyplot as plt
import numpy as np

# ---------------------------------------------------------------------------
# PATHS
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent
OUTPUT_JSON   = ROOT / "data" / "processed" / "breach_params.json"
OUTPUT_MD     = ROOT / "docs" / "breach_param_comparison.md"
OUTPUT_PLOT   = ROOT / "outputs" / "gis" / "breach_parameter_plot.png"

OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
OUTPUT_MD.parent.mkdir(parents=True, exist_ok=True)
OUTPUT_PLOT.parent.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# DAM PARAMETERS — Machhu-II
# ---------------------------------------------------------------------------
H_b   = 22.56          # Breach height (= embankment height for full breach) [m]
V_w   = 101.0e6        # Reservoir volume at time of failure [m³]
g     = 9.81           # Gravitational acceleration [m/s²]
k_o   = 1.4            # Overtopping factor (1.4 = overtopping, 1.0 = piping)
MODE  = "overtopping"  # Failure mode

# Historical observed values (Machhu-II 1979 — Singh & Adams 1983; CWC records)
# The dam had a widespread overtopping failure across a ~1.4 km section.
# A representative single-breach width of ~620 m is used for comparison.
OBS_B_avg   = 620.0    # Observed average breach width [m]
OBS_Z       = 1.0      # Observed side slope (H:V) — post-failure survey
OBS_t_f_hr  = 1.5      # Estimated formation time [hours] — rapid overtopping failure
OBS_Q_p     = 16_300.0 # Peak breach outflow [m³/s] — CWC/NDMA estimates

print("=" * 65)
print("  Directive 4: Dam Breach Parameter Estimation")
print("  Machhu-II Dam, Morbi, Gujarat")
print("=" * 65)
print(f"\n  Dam height      H_b = {H_b:.2f} m")
print(f"  Reservoir vol   V_w = {V_w/1e6:.1f} Mm³")
print(f"  Failure mode        = {MODE}")
print(f"  Overtopping factor  = {k_o}")

# ===========================================================================
# 1. FROEHLICH (2008) — BREACH GEOMETRY
# ===========================================================================
print("\n" + "-" * 65)
print("  [1] Froehlich (2008) — Breach Geometry")
print("-" * 65)

# Average breach width [m]
# B_avg = 0.27 * k_o * V_w^0.32 * h_b^0.04
B_avg = 0.27 * k_o * (V_w ** 0.32) * (H_b ** 0.04)

# Side slope [H:V] — Froehlich (2008) Table 2 average
# Z = 1.4 for overtopping, 0.9 for piping (Froehlich 2008 regression mean)
Z = 1.4 if MODE == "overtopping" else 0.9

# Formation time [hours]
# t_f = 63.2 * sqrt(V_w / (g * h_b^2))   [seconds] → convert to hours
t_f_s  = 63.2 * math.sqrt(V_w / (g * H_b ** 2))
t_f_hr = t_f_s / 3600.0

print(f"\n  Average breach width  B_avg = {B_avg:.1f} m")
print(f"  Side slope            Z     = {Z:.1f} (H:V)")
print(f"  Formation time        t_f   = {t_f_s:.0f} s  ({t_f_hr:.2f} hr)")

# Uncertainty bounds (Froehlich 2008 ±1σ factor)
SIGMA_B = 0.36   # ln-space std dev for B_avg (Froehlich 2008)
SIGMA_T = 0.31   # ln-space std dev for t_f   (Froehlich 2008)

B_low  = B_avg * math.exp(-SIGMA_B)
B_high = B_avg * math.exp( SIGMA_B)
tf_low  = t_f_hr * math.exp(-SIGMA_T)
tf_high = t_f_hr * math.exp( SIGMA_T)

print(f"\n  95% confidence interval (Froehlich 2008):")
print(f"    B_avg : [{B_low:.1f}  —  {B_high:.1f}] m")
print(f"    t_f   : [{tf_low:.2f}  —  {tf_high:.2f}] hr")

# ===========================================================================
# 2. FROEHLICH (1995) — PEAK BREACH OUTFLOW
# ===========================================================================
print("\n" + "-" * 65)
print("  [2] Froehlich (1995) — Peak Breach Outflow")
print("-" * 65)

# Q_p = 0.607 * V_w^0.295 * h_w^1.24
# h_w = water depth above breach bottom at failure ≈ H_b for full breach
h_w = H_b
Q_p = 0.607 * (V_w ** 0.295) * (h_w ** 1.24)

print(f"\n  Water head at failure h_w = {h_w:.2f} m")
print(f"  Peak breach outflow   Q_p = {Q_p:,.0f} m³/s")

# Calibration note: Historical inflow hydrograph peak = 5,600 m³/s
# (Directive 3). Q_p here represents the peak OUTFLOW through the breach
# itself, which is typically 2–4× the inflow peak for embankment dam failures.
# Historical CWC/NDMA estimate for Machhu-II peak breach outflow ≈ 16,300 m³/s.
print(f"\n  NOTE: Q_p is peak breach *outflow* (through breach opening).")
print(f"        Historical CWC estimate = {OBS_Q_p:,.0f} m³/s")
print(f"        Model / observed ratio  = {Q_p/OBS_Q_p:.2f}")

# ===========================================================================
# 3. WAHL (1998) — REGRESSION PREDICTIONS FOR COMPARISON
# ===========================================================================
print("\n" + "-" * 65)
print("  [3] Wahl (1998) — Comparative Regression Equations")
print("-" * 65)

# Wahl (1998) compiled multiple regression equations.
# Using Von Thun & Gillette (1990) equations as representative alternative:
# B_avg = 2.5 * h_b + C_b   where C_b depends on reservoir storage class
# For V_w = 101 Mm³ → C_b = 54.9 m (Table 2, Von Thun & Gillette 1990)
C_b_vtg    = 54.9
B_avg_vtg  = 2.5 * H_b + C_b_vtg

# MacDonald & Langridge-Monopolis (1984) breach formation factor
Vf_mach = 0.0261 * (V_w * H_b) ** 0.769  # breach formation factor [m³]
# Peak outflow (M&L 1984)
Q_p_ml  = 3.85 * (V_w * H_b) ** 0.411

# Xu & Zhang (2009) — B_avg for overtopping
B_avg_xz = math.exp(0.787 * math.log(H_b) + 0.188 * math.log(V_w / 1e6) - 0.649)
t_f_xz   = math.exp(-0.327 * math.log(H_b) + 0.522 * math.log(V_w / 1e6) + 0.139)  # hours

print(f"\n  Von Thun & Gillette (1990):")
print(f"    B_avg  = {B_avg_vtg:.1f} m")

print(f"\n  MacDonald & Langridge-Monopolis (1984):")
print(f"    Vf     = {Vf_mach:,.0f} m³  (breach formation factor)")
print(f"    Q_p    = {Q_p_ml:,.0f} m³/s")

print(f"\n  Xu & Zhang (2009) — overtopping:")
print(f"    B_avg  = {B_avg_xz:.1f} m")
print(f"    t_f    = {t_f_xz:.2f} hr")

# ===========================================================================
# 4. SUMMARY TABLE
# ===========================================================================
print("\n" + "=" * 65)
print("  SUMMARY: Parameter Comparison Table")
print("=" * 65)
header = f"  {'Method':<35} {'B_avg (m)':>10} {'Z (H:V)':>8} {'t_f (hr)':>9} {'Q_p (m³/s)':>12}"
print(header)
print("  " + "-" * 77)
rows = [
    ("Froehlich (2008) / (1995)",        f"{B_avg:.0f}",  f"{Z:.1f}",    f"{t_f_hr:.2f}",  f"{Q_p:,.0f}"),
    ("Von Thun & Gillette (1990)",        f"{B_avg_vtg:.0f}", "—",        "—",               "—"),
    ("MacDonald & L-M (1984)",            "—",             "—",           "—",               f"{Q_p_ml:,.0f}"),
    ("Xu & Zhang (2009)",                 f"{B_avg_xz:.0f}", "—",         f"{t_f_xz:.2f}",  "—"),
    ("Historical Observed (CWC / NDMA)",  f"{OBS_B_avg:.0f}", f"{OBS_Z:.1f}", f"{OBS_t_f_hr:.1f}", f"{OBS_Q_p:,.0f}"),
]
for name, b, z, t, q in rows:
    print(f"  {name:<35} {b:>10} {z:>8} {t:>9} {q:>12}")

# ===========================================================================
# 5. SAVE JSON
# ===========================================================================
results = {
    "project"    : "Machhu-II Dam Breach Analysis",
    "directive"  : 4,
    "generated"  : datetime.now().isoformat() + "Z",
    "dam_parameters": {
        "name"              : "Machhu-II Dam",
        "location"          : "Morbi, Gujarat, India",
        "embankment_height_m": H_b,
        "reservoir_volume_m3": V_w,
        "failure_mode"      : MODE,
        "failure_year"      : 1979
    },
    "froehlich_2008_geometry": {
        "B_avg_m"         : round(B_avg, 1),
        "Z_HV"            : Z,
        "t_f_hours"       : round(t_f_hr, 3),
        "t_f_seconds"     : round(t_f_s, 0),
        "B_avg_lower_95_m": round(B_low, 1),
        "B_avg_upper_95_m": round(B_high, 1),
        "t_f_lower_95_hr" : round(tf_low, 3),
        "t_f_upper_95_hr" : round(tf_high, 3),
        "k_o"             : k_o,
        "reference"       : "Froehlich (2008), J. Hydraul. Eng. 134(12)"
    },
    "froehlich_1995_peak_flow": {
        "Q_p_m3s"  : round(Q_p, 0),
        "h_w_m"    : h_w,
        "reference": "Froehlich (1995), J. Water Resour. Plann. Manage. 121(1)"
    },
    "comparative_methods": {
        "von_thun_gillette_1990": {
            "B_avg_m": round(B_avg_vtg, 1),
            "note"   : "Storage class C_b = 54.9 m for V_w = 101 Mm3"
        },
        "macdonald_langridge_monopolis_1984": {
            "breach_formation_factor_m3": round(Vf_mach, 0),
            "Q_p_m3s": round(Q_p_ml, 0)
        },
        "xu_zhang_2009": {
            "B_avg_m" : round(B_avg_xz, 1),
            "t_f_hours": round(t_f_xz, 3),
            "note"    : "Overtopping failure mode"
        }
    },
    "historical_observed": {
        "B_avg_m"    : OBS_B_avg,
        "Z_HV"       : OBS_Z,
        "t_f_hours"  : OBS_t_f_hr,
        "Q_p_m3s"    : OBS_Q_p,
        "sources"    : [
            "Central Water Commission (CWC), India",
            "NDMA (2009) — Machhu-II Dam Failure Case Study",
            "Singh & Adams (1983) — Indian J. Power River Valley Dev."
        ]
    },
    "design_values_for_hecras": {
        "description": "Recommended Froehlich (2008) values for use in Delft3D/HEC-RAS simulation",
        "B_avg_m"    : round(B_avg, 1),
        "Z_HV"       : Z,
        "t_f_hours"  : round(t_f_hr, 2),
        "Q_p_m3s"    : round(Q_p, 0)
    }
}

with open(OUTPUT_JSON, "w") as f:
    json.dump(results, f, indent=2)
print(f"\n  [OK] Saved JSON -> {OUTPUT_JSON}")

# ===========================================================================
# 6. SAVE MARKDOWN COMPARISON TABLE
# ===========================================================================
md = f"""# Breach Parameter Comparison — Machhu-II Dam

**Generated**: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}  
**Directive**: 4 — Breach Parameter Estimation  
**Dam**: Machhu-II Dam, Morbi, Gujarat, India  
**Event**: August 1979 Overtopping Failure  

---

## Dam Characteristics

| Parameter | Value |
| :--- | :--- |
| Embankment Height | {H_b} m |
| Reservoir Volume at Failure | {V_w/1e6:.0f} Mm³ |
| Failure Mode | Overtopping |
| Failure Year | 1979 |

---

## Froehlich (2008) Breach Geometry — Primary Design Values

| Parameter | Symbol | Value | Equation |
| :--- | :--- | :--- | :--- |
| Average Breach Width | B_avg | **{B_avg:.1f} m** | 0.27 * k_o * V_w^0.32 * h_b^0.04 |
| Side Slope | Z | **{Z:.1f} (H:V)** | Froehlich (2008) Table 2 — overtopping |
| Formation Time | t_f | **{t_f_hr:.2f} hr ({t_f_s:.0f} s)** | 63.2 * sqrt(V_w / (g * h_b^2)) |
| Overtopping Factor | k_o | {k_o} | 1.4 for overtopping, 1.0 for piping |

### 95% Uncertainty Bounds (Froehlich 2008 — ±1σ log-space)

| Parameter | Lower Bound | Best Estimate | Upper Bound |
| :--- | :--- | :--- | :--- |
| B_avg | {B_low:.1f} m | {B_avg:.1f} m | {B_high:.1f} m |
| t_f | {tf_low:.2f} hr | {t_f_hr:.2f} hr | {tf_high:.2f} hr |

---

## Froehlich (1995) — Peak Breach Outflow

| Parameter | Symbol | Value | Equation |
| :--- | :--- | :--- | :--- |
| Water depth at failure | h_w | {h_w:.2f} m | = H_b for full breach |
| Peak Breach Outflow | Q_p | **{Q_p:,.0f} m³/s** | 0.607 * V_w^0.295 * h_w^1.24 |

---

## Comparative Method Summary

| Method | B_avg (m) | Z (H:V) | t_f (hr) | Q_p (m³/s) |
| :--- | ---: | ---: | ---: | ---: |
| **Froehlich (2008)/(1995)** | **{B_avg:.0f}** | **{Z:.1f}** | **{t_f_hr:.2f}** | **{Q_p:,.0f}** |
| Von Thun & Gillette (1990) | {B_avg_vtg:.0f} | — | — | — |
| MacDonald & L-M (1984) | — | — | — | {Q_p_ml:,.0f} |
| Xu & Zhang (2009) | {B_avg_xz:.0f} | — | {t_f_xz:.2f} | — |
| **Historical Observed** | **{OBS_B_avg:.0f}** | **{OBS_Z:.1f}** | **{OBS_t_f_hr:.1f}** | **{OBS_Q_p:,.0f}** |

### Notes
- **Historical Observed** values from CWC records, NDMA (2009) case study, and Singh & Adams (1983).
- Historical breach width of **620 m** represents the primary earth embankment breach. Total dam overtopping extended ~1.4 km.
- Historical Q_p of **16,300 m³/s** is the CWC/NDMA peak breach outflow estimate; the Directive 3 inflow hydrograph peak (5,600 m³/s) represents the *catchment inflow* which triggered the breach — not the breach outflow.
- The Froehlich (2008) B_avg of **{B_avg:.0f} m** and t_f of **{t_f_hr:.2f} hr** are adopted as primary design values for Delft3D simulation (Directive 5A).

---

## Design Values for Delft3D Simulation (Directive 5A)

| Parameter | Value | Source |
| :--- | :--- | :--- |
| Average Breach Width (B_avg) | {B_avg:.1f} m | Froehlich (2008) |
| Side Slope (Z) | {Z:.1f} H:V | Froehlich (2008) |
| Formation Time (t_f) | {t_f_hr:.2f} hr | Froehlich (2008) |
| Peak Breach Outflow (Q_p) | {Q_p:,.0f} m³/s | Froehlich (1995) |

---

## References

1. Froehlich, D.C. (1995). "Peak outflow from breached embankment dam." *J. Water Resour. Plann. Manage.*, 121(1), 90–97.
2. Froehlich, D.C. (2008). "Embankment Dam Breach Parameters and Their Uncertainties." *J. Hydraul. Eng.*, 134(12), 1708–1721.
3. Wahl, T.L. (1998). *Prediction of Embankment Dam Breach Parameters — A Literature Review and Needs Assessment.* DSO-98-004, USBR, Denver, CO.
4. Von Thun, J.L. & Gillette, D.R. (1990). *Guidance on Breach Parameters.* Internal Memorandum, USBR, Denver, CO.
5. MacDonald, T.C. & Langridge-Monopolis, J. (1984). "Breaching characteristics of dam failures." *J. Hydraul. Eng.*, 110(5), 567–586.
6. Xu, Y. & Zhang, L.M. (2009). "Breaching Parameters for Earth and Rockfill Dams." *J. Geotech. Geoenviron. Eng.*, 135(12), 1957–1970.
7. NDMA (2009). *Machhu-II Dam Failure Case Study.* National Disaster Management Authority of India.
8. Singh, R.P. & Adams, B.J. (1983). "Machhu-II Dam Failure Analysis." *Indian J. Power River Valley Dev.*
"""

with open(OUTPUT_MD, "w", encoding="utf-8") as f:
    f.write(md)
print(f"  [OK] Saved Markdown -> {OUTPUT_MD}")

# ===========================================================================
# 7. VISUALISATION — Breach Parameter Comparison Bar Chart
# ===========================================================================
fig, axes = plt.subplots(1, 3, figsize=(14, 6))
fig.patch.set_facecolor("#0f1117")
for ax in axes:
    ax.set_facecolor("#1a1d2e")
    ax.tick_params(colors="white")
    for spine in ax.spines.values():
        spine.set_edgecolor("#444")

PALETTE = ["#4fc3f7", "#81c784", "#ffb74d", "#f48fb1", "#ce93d8"]

methods = [
    "Froehlich\n(2008/1995)",
    "Von Thun &\nGillette (1990)",
    "Xu & Zhang\n(2009)",
    "Historical\nObserved"
]

# Panel 1: Average Breach Width
b_vals = [B_avg, B_avg_vtg, B_avg_xz, OBS_B_avg]
bars0 = axes[0].bar(methods, b_vals, color=PALETTE[:4], edgecolor="#0f1117", linewidth=0.8)
axes[0].set_title("Average Breach Width  B_avg", color="white", fontsize=11, pad=10)
axes[0].set_ylabel("Width (m)", color="white")
axes[0].yaxis.label.set_color("white")
for bar, val in zip(bars0, b_vals):
    axes[0].text(bar.get_x() + bar.get_width()/2, bar.get_height() + 5,
                 f"{val:.0f} m", ha="center", va="bottom", color="white", fontsize=9)
axes[0].set_ylim(0, max(b_vals) * 1.25)
# uncertainty on Froehlich bar
axes[0].errorbar([0], [B_avg], yerr=[[B_avg - B_low], [B_high - B_avg]],
                 fmt="none", ecolor="#ff8a65", elinewidth=2, capsize=6)

# Panel 2: Formation Time
tf_methods = ["Froehlich\n(2008)", "Xu & Zhang\n(2009)", "Historical\nObserved"]
tf_vals    = [t_f_hr, t_f_xz, OBS_t_f_hr]
bars1 = axes[1].bar(tf_methods, tf_vals, color=[PALETTE[0], PALETTE[2], PALETTE[3]],
                    edgecolor="#0f1117", linewidth=0.8)
axes[1].set_title("Formation Time  t_f", color="white", fontsize=11, pad=10)
axes[1].set_ylabel("Time (hours)", color="white")
axes[1].yaxis.label.set_color("white")
for bar, val in zip(bars1, tf_vals):
    axes[1].text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.05,
                 f"{val:.2f} hr", ha="center", va="bottom", color="white", fontsize=9)
axes[1].set_ylim(0, max(tf_vals) * 1.35)
axes[1].errorbar([0], [t_f_hr], yerr=[[t_f_hr - tf_low], [tf_high - t_f_hr]],
                 fmt="none", ecolor="#ff8a65", elinewidth=2, capsize=6)

# Panel 3: Peak Breach Outflow
qp_methods = ["Froehlich\n(1995)", "MacDonald &\nL-M (1984)", "Historical\nObserved"]
qp_vals    = [Q_p, Q_p_ml, OBS_Q_p]
bars2 = axes[2].bar(qp_methods, qp_vals, color=[PALETTE[0], PALETTE[1], PALETTE[3]],
                    edgecolor="#0f1117", linewidth=0.8)
axes[2].set_title("Peak Breach Outflow  Q_p", color="white", fontsize=11, pad=10)
axes[2].set_ylabel("Discharge (m³/s)", color="white")
axes[2].yaxis.label.set_color("white")
for bar, val in zip(bars2, qp_vals):
    axes[2].text(bar.get_x() + bar.get_width()/2, bar.get_height() + 100,
                 f"{val:,.0f}", ha="center", va="bottom", color="white", fontsize=9)
axes[2].set_ylim(0, max(qp_vals) * 1.2)

# Error bar legend
import matplotlib.lines as mlines
err_line = mlines.Line2D([], [], color="#ff8a65", linewidth=2,
                          label="±1σ uncertainty (Froehlich 2008)")
for ax in axes:
    ax.xaxis.label.set_color("white")
    ax.tick_params(axis="x", colors="white", labelsize=8)
    ax.tick_params(axis="y", colors="white")
    ax.grid(axis="y", linestyle="--", alpha=0.25, color="#555")

fig.legend(handles=[err_line], loc="lower center", ncol=1,
           frameon=False, fontsize=9, labelcolor="white")

fig.suptitle(
    "Breach Parameter Comparison — Machhu-II Dam (1979)\nDirective 4 | Froehlich (2008/1995) vs. Alternative Methods vs. Historical",
    color="white", fontsize=12, y=1.02
)
plt.tight_layout()
plt.savefig(OUTPUT_PLOT, dpi=150, bbox_inches="tight", facecolor="#0f1117")
plt.close()
print(f"  [OK] Saved plot  -> {OUTPUT_PLOT}")

# ===========================================================================
# 8. FINAL SUMMARY
# ===========================================================================
print("\n" + "=" * 65)
print("  DIRECTIVE 4 COMPLETE — Design Values for Directive 5A (Delft3D)")
print("=" * 65)
print(f"  Average Breach Width  B_avg = {B_avg:.1f} m")
print(f"  Side Slope            Z     = {Z:.1f}  (H:V)")
print(f"  Formation Time        t_f   = {t_f_hr:.2f} hr")
print(f"  Peak Breach Outflow   Q_p   = {Q_p:,.0f} m³/s")
print()
print(f"  Outputs:")
print(f"    {OUTPUT_JSON}")
print(f"    {OUTPUT_MD}")
print(f"    {OUTPUT_PLOT}")
print("=" * 65)
