import json
import glob
import os

print("VERIFYING OUTPUTS IN outputs/SIH-2026/outputs/")
for f in glob.glob("outputs/SIH-2026/outputs/**/*.json", recursive=True):
    print("\n--- " + f + " ---")
    try:
        with open(f, 'r', encoding='utf-8') as fp:
            data = json.load(fp)
            if isinstance(data, dict):
                for k in list(data.keys())[:12]:
                    v = str(data[k])
                    if len(v) > 70:
                        v = v[:70] + "..."
                    print(f"  {k}: {v}")
            elif isinstance(data, list):
                print(f"  List of {len(data)} items")
                if len(data) > 0:
                    print(f"  First: {str(data[0])[:70]}")
    except Exception as e:
        print("  Error:", e)
