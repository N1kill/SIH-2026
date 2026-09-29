import rasterio
import numpy as np
from pyproj import Transformer
from rasterio.transform import rowcol, xy

with rasterio.open('data/processed/dem_conditioned.tif') as src:
    dem = src.read(1)
    tr = Transformer.from_crs('EPSG:4326', src.crs, always_xy=True)
    tr_inv = Transformer.from_crs(src.crs, 'EPSG:4326', always_xy=True)
    
    def test_snap(lat, lon, snap_radius=20):
        x, y = tr.transform(lon, lat)
        r, c = rowcol(src.transform, x, y)
        r_low = max(0, r - snap_radius)
        r_high = min(src.shape[0], r + snap_radius + 1)
        c_low = max(0, c - snap_radius)
        c_high = min(src.shape[1], c + snap_radius + 1)
        sub_elev = dem[r_low:r_high, c_low:c_high]
        min_idx = np.unravel_index(np.argmin(sub_elev), sub_elev.shape)
        return int(r_low + min_idx[0]), int(c_low + min_idx[1])
    
    s_dam_r, s_dam_c = test_snap(22.7580, 70.8870, 25)
    xd, yd = xy(src.transform, s_dam_r, s_dam_c)
    lond, latd = tr_inv.transform(xd, yd)
    print(f"Thalweg snapped Dam Toe: row={s_dam_r}, col={s_dam_c}, Elev={dem[s_dam_r, s_dam_c]:.2f}m")
    print(f"Exact Thalweg Dam Toe Coord: lat={latd:.5f}, lon={lond:.5f}")
    
    s_morbi_r, s_morbi_c = test_snap(22.8180, 70.8350, 20)
    xm, ym = xy(src.transform, s_morbi_r, s_morbi_c)
    lonm, latm = tr_inv.transform(xm, ym)
    print(f"Thalweg snapped Morbi: row={s_morbi_r}, col={s_morbi_c}, Elev={dem[s_morbi_r, s_morbi_c]:.2f}m")
    print(f"Exact Thalweg Morbi Coord: lat={latm:.5f}, lon={lonm:.5f}")
