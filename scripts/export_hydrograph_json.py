import pandas as pd
import json
from pathlib import Path

csv_path = Path("outputs/gis/hydrograph.csv")
out_path = Path("frontend-dam/src/data/outputs/inflowHydrographData.json")

df = pd.read_csv(csv_path)
records = []
for idx, row in df.iterrows():
    # Only keep points where there is activity or sampled every 2 hours to keep it snappy
    records.append({
        "hour": int(idx),
        "datetime": str(row["datetime"]),
        "rainfall_mm": round(float(row["rainfall_mm"]), 2),
        "runoff_mm": round(float(row["runoff_mm"]), 2),
        "inflow_m3s": round(float(row["inflow_m3s"]), 1),
    })

out_path.parent.mkdir(parents=True, exist_ok=True)
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(records, f, indent=2)

print(f"Exported {len(records)} records to {out_path}")
