# Breach Parameter Comparison — Machhu-II Dam

**Generated**: 2026-08-30 08:37 UTC  
**Directive**: 4 — Breach Parameter Estimation  
**Dam**: Machhu-II Dam, Morbi, Gujarat, India  
**Event**: August 1979 Overtopping Failure  

---

## Dam Characteristics

| Parameter | Value |
| :--- | :--- |
| Embankment Height | 22.56 m |
| Reservoir Volume at Failure | 101 Mm³ |
| Failure Mode | Overtopping |
| Failure Year | 1979 |

---

## Froehlich (2008) Breach Geometry — Primary Design Values

| Parameter | Symbol | Value | Equation |
| :--- | :--- | :--- | :--- |
| Average Breach Width | B_avg | **156.0 m** | 0.27 * k_o * V_w^0.32 * h_b^0.04 |
| Side Slope | Z | **1.4 (H:V)** | Froehlich (2008) Table 2 — overtopping |
| Formation Time | t_f | **2.50 hr (8989 s)** | 63.2 * sqrt(V_w / (g * h_b^2)) |
| Overtopping Factor | k_o | 1.4 | 1.4 for overtopping, 1.0 for piping |

### 95% Uncertainty Bounds (Froehlich 2008 — ±1σ log-space)

| Parameter | Lower Bound | Best Estimate | Upper Bound |
| :--- | :--- | :--- | :--- |
| B_avg | 108.8 m | 156.0 m | 223.5 m |
| t_f | 1.83 hr | 2.50 hr | 3.40 hr |

---

## Froehlich (1995) — Peak Breach Outflow

| Parameter | Symbol | Value | Equation |
| :--- | :--- | :--- | :--- |
| Water depth at failure | h_w | 22.56 m | = H_b for full breach |
| Peak Breach Outflow | Q_p | **6,647 m³/s** | 0.607 * V_w^0.295 * h_w^1.24 |

---

## Comparative Method Summary

| Method | B_avg (m) | Z (H:V) | t_f (hr) | Q_p (m³/s) |
| :--- | ---: | ---: | ---: | ---: |
| **Froehlich (2008)/(1995)** | **156** | **1.4** | **2.50** | **6,647** |
| Von Thun & Gillette (1990) | 111 | — | — | — |
| MacDonald & L-M (1984) | — | — | — | 27,006 |
| Xu & Zhang (2009) | 14 | — | 4.61 | — |
| **Historical Observed** | **620** | **1.0** | **1.5** | **16,300** |

### Notes
- **Historical Observed** values from CWC records, NDMA (2009) case study, and Singh & Adams (1983).
- Historical breach width of **620 m** represents the primary earth embankment breach. Total dam overtopping extended ~1.4 km.
- Historical Q_p of **16,300 m³/s** is the CWC/NDMA peak breach outflow estimate; the Directive 3 inflow hydrograph peak (5,600 m³/s) represents the *catchment inflow* which triggered the breach — not the breach outflow.
- The Froehlich (2008) B_avg of **156 m** and t_f of **2.50 hr** are adopted as primary design values for Delft3D simulation (Directive 5A).

---

## Design Values for Delft3D Simulation (Directive 5A)

| Parameter | Value | Source |
| :--- | :--- | :--- |
| Average Breach Width (B_avg) | 156.0 m | Froehlich (2008) |
| Side Slope (Z) | 1.4 H:V | Froehlich (2008) |
| Formation Time (t_f) | 2.50 hr | Froehlich (2008) |
| Peak Breach Outflow (Q_p) | 6,647 m³/s | Froehlich (1995) |

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
