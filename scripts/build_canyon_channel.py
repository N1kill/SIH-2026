import json
import numpy as np

# Coordinates of Machhu River centerline from Machhu-II Dam to Morbi
# Format: [lat, lng]
centerline = [
    [22.7580, 70.8870],  # 0 km: Machhu-II Dam Toe (breach location)
    [22.7635, 70.8795],  # 0.8 km
    [22.7705, 70.8690],  # 1.8 km
    [22.7780, 70.8605],  # 2.8 km
    [22.7870, 70.8530],  # 3.8 km
    [22.7965, 70.8470],  # 4.6 km
    [22.8060, 70.8435],  # 5.4 km
    [22.8145, 70.8415],  # 6.2 km: Morbi outskirts
    [22.8210, 70.8400],  # 6.8 km: Morbi City
    [22.8245, 70.8400],  # 7.2 km: Step 0 boundary
]

# Generate a 220m wide gorge corridor around the centerline
# In degrees: 1 deg lat ~ 111,000m, 1 deg lng ~ 102,000m at 22.8N
# Half-width ~ 120m -> dlat ~ 0.0011, dlng ~ 0.0012
left_bank = []
right_bank = []

for i in range(len(centerline)):
    lat, lng = centerline[i]
    if i < len(centerline) - 1:
        dlat = centerline[i+1][0] - lat
        dlng = centerline[i+1][1] - lng
    else:
        dlat = lat - centerline[i-1][0]
        dlng = lng - centerline[i-1][1]
    
    # Normal vector perpendicular to flow
    norm = np.sqrt(dlat**2 + dlng**2)
    if norm == 0:
        continue
    nlat = -dlng / norm
    nlng = dlat / norm
    
    # Canyon width: wider near dam breach (280m) and near Morbi (240m), narrower in rocky canyon (160m)
    w = 0.0014 if (i <= 1 or i >= 7) else 0.0010
    
    # Coordinates in [lng, lat] for GeoJSON standard
    left_bank.append([float(round(lng + nlng * w, 5)), float(round(lat + nlat * w, 5))])
    right_bank.append([float(round(lng - nlng * w, 5)), float(round(lat - nlat * w, 5))])

canyon_poly = left_bank + right_bank[::-1] + [left_bank[0]]

print(f"Canyon corridor points: {len(canyon_poly)}")
print("Sample left bank:", left_bank[0])
print("Sample right bank:", right_bank[0])

# Save as standalone geojson
feature = {
    "type": "Feature",
    "properties": {
        "reach": "Machhu River Canyon Reach (Dam to Morbi)",
        "length_km": 5.2,
        "peak_depth_m": 21.44,
        "flow_direction": "North-Northwest (Downhill)"
    },
    "geometry": {
        "type": "Polygon",
        "coordinates": [canyon_poly]
    }
}

with open("frontend-dam/public/data/canyon_surge_channel.json", "w") as f:
    json.dump(feature, f, indent=2)

print("Saved frontend-dam/public/data/canyon_surge_channel.json successfully!")
