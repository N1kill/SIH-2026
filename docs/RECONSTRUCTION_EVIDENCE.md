# Machhu-II approximate reconstruction evidence

Status: **unapproved candidate**.

> Approximate, evidence-backed reconstruction suitable for demonstration and
> screening; not suitable for engineering design, emergency operations, or certification.

## Research result

The web-search work reviewed 252 result slots across four workstreams, deep-read eight
high-value pages, and deduplicated 18 shortlisted records to 11 unique sources. The
machine-readable subset used by the candidate is in
`data/evidence/machhu-ii/evidence.json`; every item points to a hashed local artifact.

The configured `22.8212, 70.8414` point appears to be near Morbi rather than the dam.
The CWC register gives a coarse `22°46'0\"N, 70°52'0\"E` point. A nearby search seed
was used to acquire orthorectified Sentinel-2 imagery. Visual tracing places the
spillway near `22.766744, 70.866135` and produces a 4.882 km axis, close to the 4.930
km India-WRIS inventory length. This convergence supports an approximate candidate,
not automatic approval.

Primary/high-value sources:

- [India-WRIS dam inventory](https://indiawris.gov.in/wiki/doku.php?id=dams_in_gujarat)
- [Government of Gujarat project data bank](https://guj-nwrws.gujarat.gov.in/showpage.aspx/mediafiles/file/pdf/showpage.aspx?contentid=2038&lang=English)
- [Government of Gujarat storage report, 2022-02-22](https://wrd-dam.gujarat.gov.in/downloads/home_pdf.php?dt=MjAyMi0wMi0yMg%3D%3D)
- [CWC National Register of Specified Dams](https://dharma.cwc.gov.in/dharma/public/uploads/front_upload_file/174860534186541140.pdf)
- [Sentinel-2 product specification](https://sentinels.copernicus.eu/data-products/-/asset_publisher/fp37fc19FN8F/content/id/4715515)
- [ASDSO photo discovery page](https://damfailures.org/case-study/machhu-dam-ii-gujarat-india-1979)

## Preserved conflicts and uncertainty

- Published total length values conflict: 4,930 m (India-WRIS), 5,125 m (Gujarat
  project page), and older/current project values. They are not averaged.
- Published gross capacity values include 87.90 and 100.55 MCM for different tables or
  configurations. The draft uses 87.90 MCM and preserves the conflict.
- Published water levels have no confirmed vertical datum. DEM alignment is approximate.
- The DEM shoreline is 6.38 km² versus a published 13.96 km² full-reservoir area, a
  54.3% difference. It is not validated shoreline geometry.
- Crest alignment uncertainty is ±20–40 m; dam dimensions remain ±5–10% length and
  ±1–3 m height; spillway location is ±20–50 m.
- ASDSO photographs are discovery-only because reuse permission and camera metadata
  were not found. They were not downloaded.

## Approval boundary

Research and `draft` only write under `data/evidence/`, `data/raw/imagery/`, and
`data/candidates/`. `data/projects/machhu-ii.json` remains unchanged. Promotion requires
a named human reviewer and the exact acceptance phrase documented in `README.md`.
