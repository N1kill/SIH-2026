import json
import rasterio
from rasterio.features import shapes
from rasterio.warp import transform_geom
import numpy as np

# Test dummy mask
mask = np.zeros((100, 100), dtype=np.uint8)
mask[40:60, 40:60] = 1

with rasterio.open('data/processed/dem_conditioned.tif') as src:
    transform = src.transform
    crs = src.crs

sub_transform = rasterio.windows.transform(rasterio.windows.Window(1600, 1600, 100, 100), transform)

for geom, val in shapes(mask, mask=(mask==1), transform=sub_transform):
    wgs84_geom = transform_geom(crs, "EPSG:4326", geom)
    print("Geometry type:", wgs84_geom["type"])
    print("Coords count:", len(wgs84_geom["coordinates"][0]))
    print("Sample coord:", wgs84_geom["coordinates"][0][0])
