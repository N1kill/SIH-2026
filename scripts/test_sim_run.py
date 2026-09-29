import rasterio
import numpy as np

with rasterio.open('data/processed/flow_acc.tif') as src_acc:
    acc = src_acc.read(1)

with rasterio.open('data/processed/dem_conditioned.tif') as src_dem:
    dem = src_dem.read(1)
    cell_size = 30.0

r_dam, c_dam = 1668, 1658
r_start = 1350
r_end = 1700
c_start = 1450
c_end = 1700

sub_dem = dem[r_start:r_end, c_start:c_end].copy()
sub_depth = np.zeros_like(sub_dem, dtype=np.float32)
local_r_dam = r_dam - r_start
local_c_dam = c_dam - c_start

dt_sim = 120.0
n_substeps = 4
dt_sub = dt_sim / n_substeps
cell_area = cell_size * cell_size
manning_n = 0.035

directions = [
    ((-1, 0), cell_size),
    ((1, 0), cell_size),
    ((0, -1), cell_size),
    ((0, 1), cell_size),
    ((-1, -1), cell_size * 1.4142),
    ((-1, 1), cell_size * 1.4142),
    ((1, -1), cell_size * 1.4142),
    ((1, 1), cell_size * 1.4142),
]

src_cells = [(local_r_dam + dr, local_c_dam + dc) for dr in range(-1, 2) for dc in range(-2, 3)]

morbi_local_r = 1413 - r_start
morbi_local_c = 1518 - c_start

for step in range(90): # 3 hours
    t_hr = (step + 1) * dt_sim / 3600.0
    v_in = 6600.0 * dt_sim
    d_h = (v_in / len(src_cells)) / cell_area
    for sr, sc in src_cells:
        sub_depth[sr, sc] += d_h

    for _ in range(n_substeps):
        box_wse = sub_dem + sub_depth
        wet_mask = sub_depth > 0.05
        fluxes = []
        for (dr, dc), dist in directions:
            neighbor_wse = np.zeros_like(box_wse)
            r_src_start = max(0, dr)
            r_src_end = min(box_wse.shape[0], box_wse.shape[0] + dr)
            r_tgt_start = max(0, -dr)
            r_tgt_end = min(box_wse.shape[0], box_wse.shape[0] - dr)
            c_src_start = max(0, dc)
            c_src_end = min(box_wse.shape[1], box_wse.shape[1] + dc)
            c_tgt_start = max(0, -dc)
            c_tgt_end = min(box_wse.shape[1], box_wse.shape[1] - dc)
            neighbor_wse[r_tgt_start:r_tgt_end, c_tgt_start:c_tgt_end] = box_wse[r_src_start:r_src_end, c_src_start:c_src_end]

            slope_to_neighbor = (box_wse - neighbor_wse) / dist
            if dr < 0:
                slope_to_neighbor = np.maximum(slope_to_neighbor, 0.0015 * wet_mask)

            route_mask = wet_mask & (slope_to_neighbor > 0.0001)
            flux = np.zeros_like(sub_depth)
            if np.any(route_mask):
                v_flow = (1.0 / manning_n) * (sub_depth[route_mask] ** (2.0/3.0)) * np.sqrt(slope_to_neighbor[route_mask])
                v_flow = np.clip(v_flow, 0.0, 7.5)
                flux[route_mask] = v_flow * sub_depth[route_mask] * cell_size * dt_sub
            fluxes.append(((dr, dc), flux))

        total_out = sum(f for _, f in fluxes)
        max_out = sub_depth * cell_area * 0.85
        scale = np.ones_like(sub_depth)
        over = total_out > max_out
        scale[over] = max_out[over] / (total_out[over] + 1e-6)

        d_vol = np.zeros_like(sub_depth)
        for (dr, dc), flux in fluxes:
            s_f = flux * scale
            d_vol -= s_f
            r_src_start = max(0, -dr)
            r_src_end = min(sub_depth.shape[0], sub_depth.shape[0] - dr)
            r_tgt_start = max(0, dr)
            r_tgt_end = min(sub_depth.shape[0], sub_depth.shape[0] + dr)
            c_src_start = max(0, -dc)
            c_src_end = min(sub_depth.shape[1], sub_depth.shape[1] - dc)
            c_tgt_start = max(0, dc)
            c_tgt_end = min(sub_depth.shape[1], sub_depth.shape[1] + dc)
            d_vol[r_tgt_start:r_tgt_end, c_tgt_start:c_tgt_end] += s_f[r_src_start:r_src_end, c_src_start:c_src_end]

        sub_depth += (d_vol / cell_area)
        sub_depth = np.clip(sub_depth, 0.0, 22.56)

    wet_r, wet_c = np.where(sub_depth > 0.10)
    if len(wet_r) > 0 and (step + 1) % 15 == 0:
        lead_r = r_start + wet_r.min()
        dist_km = (r_dam - lead_r) * cell_size / 1000.0
        morbi_d = float(np.max(sub_depth[morbi_local_r-1:morbi_local_r+2, morbi_local_c-1:morbi_local_c+2]))
        print(f"t={t_hr:4.2f}h: Lead advance={dist_km:5.2f}km | Morbi depth={morbi_d:4.2f}m | Inundated={len(wet_r)*0.0009:.2f}km2")
