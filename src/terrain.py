"""Bounded metric DEM extraction and a reversible shared coordinate contract."""
import hashlib
import json
import math
from dataclasses import dataclass
from datetime import datetime, timezone
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.vrt import WarpedVRT
from rasterio.transform import from_bounds, rowcol
from rasterio.features import rasterize
from pyproj import Transformer
from scipy.ndimage import label
from .project import Project, ROOT, input_path


@dataclass
class Terrain:
    elevation: np.ndarray
    valid: np.ndarray
    transform: object
    crs: str
    origin: tuple
    source_cell: tuple
    metadata: dict

    def local(self, lon, lat, elevation=0):
        x, y = Transformer.from_crs(4326, self.crs, always_xy=True).transform(lon, lat)
        return x-self.origin[0], elevation-self.origin[2], self.origin[1]-y

    def geographic(self, x, z):
        return Transformer.from_crs(self.crs, 4326, always_xy=True).transform(x+self.origin[0], self.origin[1]-z)

    def reservoir_mask(self, project, level):
        rows, cols = np.indices(self.elevation.shape)
        x = self.transform.c + (cols + .5)*self.transform.a-self.origin[0]
        north = self.transform.f + (rows + .5)*self.transform.e-self.origin[1]
        angle = math.radians(project.downstream_bearing_deg)
        upstream = x*math.sin(angle)+north*math.cos(angle) < -abs(self.transform.a)
        eligible = self.valid & upstream & (self.elevation < level)
        if project.reservoir_polygon_path:
            import geopandas as gpd
            geom = gpd.read_file(input_path(project.reservoir_polygon_path))
            if geom.crs is None:
                raise ValueError("Reservoir polygon requires CRS metadata")
            geom = geom.to_crs(self.crs)
            eligible = self.valid & (self.elevation < level) & rasterize(
                [(g, 1) for g in geom.geometry], out_shape=self.elevation.shape,
                transform=self.transform, fill=0).astype(bool)
        else:
            groups, _ = label(eligible)
            ids = np.argwhere(eligible)
            if len(ids):
                nearest = ids[np.argmin(np.sum((ids-np.array(self.source_cell))**2, axis=1))]
                eligible = groups == groups[tuple(nearest)]
        return eligible


def load_terrain(project: Project, half_width=6000, size=100) -> Terrain:
    if not project.dem_path:
        raise ValueError(f"{project.dam_name}: supply a DEM in the project configuration")
    path = input_path(project.dem_path)
    zone = min(60, int((project.longitude+180)//6)+1)
    crs = f"EPSG:{32600+zone if project.latitude >= 0 else 32700+zone}"
    ox, oy = Transformer.from_crs(4326, crs, always_xy=True).transform(project.longitude, project.latitude)
    bounds = (ox-half_width, oy-half_width, ox+half_width, oy+half_width)
    transform = from_bounds(*bounds, size, size)
    with rasterio.open(path) as src:
        if src.crs is None:
            raise ValueError("DEM has no CRS; supply a georeferenced raster")
        with WarpedVRT(src, crs=crs, transform=transform, width=size, height=size,
                       resampling=Resampling.bilinear, nodata=-9999) as vrt:
            masked = vrt.read(1, masked=True)
        source_x,source_y=Transformer.from_crs(4326,src.crs,always_xy=True).transform(project.longitude,project.latitude)
        sample=next(src.sample([(source_x,source_y)],masked=True))[0]
        if np.ma.is_masked(sample) or not np.isfinite(sample):
            raise ValueError("Dam location has no valid source DEM elevation")
        source_bed=float(sample)
        source = {"path": project.dem_path, "crs": str(src.crs), "resolution": list(src.res),
                  "source_modified_at": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(),
                  "acquisition_date": None, "license": "not supplied with local raster"}
    valid = ~np.ma.getmaskarray(masked) & np.isfinite(masked.data)
    rr, cc = rowcol(transform, ox, oy)
    if valid.sum() < size*size*.5 or not valid[rr, cc]:
        raise ValueError("DEM does not cover the dam and at least half the requested domain")
    dem = np.where(valid, masked.data, 0).astype(float)
    bed = source_bed
    # The outlet is immediately downstream of the dam, never an arbitrary percentage of a raster.
    a = math.radians(project.downstream_bearing_deg)
    outlet = rowcol(transform, ox+math.sin(a)*transform.a*1.5, oy+math.cos(a)*transform.a*1.5)
    if not valid[outlet]:
        raise ValueError("Downstream source cell has NoData")
    fingerprint = hashlib.sha256(json.dumps(["twin-v7",project.model_dump(), path.stat().st_mtime_ns,
                                            size, half_width], sort_keys=True).encode()).hexdigest()[:20]
    metadata = {"crs": crs, "bounds": list(bounds), "origin": [ox, oy, bed], "grid_size": size,
                "cell_size_m": transform.a, "transform": list(transform)[:6], "cache_key": fingerprint,
                "source": source, "vertical_exaggeration": 1,
                "coordinate_contract": "X=easting-origin_easting; Y=elevation-origin_elevation; Z=origin_northing-northing",
                "reconstruction_tier": "B" if project.crest_coordinates else "C: parameterized approximation",
                "reservoir_geometry": "supplied polygon intersected with DEM" if project.reservoir_polygon_path else "DEM-connected upstream approximation; not verified shoreline",
                "imagery": "supplied georeferenced raster" if project.imagery_path else "unavailable",
                "nodata_policy": "masked cells impermeable; not fabricated"}
    return Terrain(dem, valid, transform, crs, (ox, oy, bed), outlet, metadata)


def build_twin(project, half_width=6000, size=100):
    terrain = load_terrain(project, half_width, size)
    directory = ROOT / "data/cache/twins" / terrain.metadata["cache_key"]
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / "terrain.json"
    if target.exists():
        return json.loads(target.read_text(encoding="utf-8"))
    level = project.initial_water_level_m or (terrain.origin[2]+project.dam_height_m*.9)
    payload = {**terrain.metadata, "elevation": terrain.elevation.round(3).tolist(),
               "valid": terrain.valid.tolist(), "reservoir_mask": terrain.reservoir_mask(project, level).tolist(),
               "project": project.model_dump(), "initial_level_m": level,
               "dam_local": [0, 0, 0], "river_lines": []}
    # Near-dam LOD is derived from the source DEM, never upscaled as claimed new survey detail.
    dam_extent = (project.dam_length_m / 2 * 1.15) if project.dam_length_m else 1000
    detail_hw = min(half_width, max(1000, dam_extent))
    detail=load_terrain(project, detail_hw, min(size, 100))
    detail_mask_level = max(level, project.maximum_water_level_m or level)
    payload["detail"]={**detail.metadata,"elevation":detail.elevation.round(3).tolist(),
                       "valid":detail.valid.tolist(),
                       "reservoir_mask":detail.reservoir_mask(project, detail_mask_level).tolist(),
                       "reservoir_mask_level_m":detail_mask_level}
    if project.crest_coordinates:
        payload["crest_local"]=[list(terrain.local(lon,lat,level)) for lon,lat in project.crest_coordinates]
    else:
        payload["crest_local"]=None
    payload["geometry_assumptions"]={"crest_width_m":project.crest_width_m or 6,
        "embankment_side_slope":2,"note":"Unsurveyed cross-section. Replace dimensions/crest coordinates with engineering data."}
    if project.river_path:
        import geopandas as gpd
        river = gpd.read_file(input_path(project.river_path), bbox=None).to_crs(terrain.crs)
        from shapely.geometry import box
        for geom in river.geometry.intersection(box(*terrain.metadata["bounds"])):
            if geom.is_empty:
                continue
            lines = [geom] if geom.geom_type == "LineString" else getattr(geom, "geoms", [])
            for line in lines:
                if line.geom_type == "LineString":
                    payload["river_lines"].append([[x-terrain.origin[0], terrain.origin[1]-y] for x,y,*_ in line.coords])
    if project.imagery_path:
        with rasterio.open(input_path(project.imagery_path)) as image:
            if image.crs is None or image.count < 3:
                raise ValueError("Imagery must have CRS and at least three RGB bands")
            from PIL import Image
            with WarpedVRT(image, crs=terrain.crs, transform=from_bounds(*terrain.metadata["bounds"],2048,2048), width=2048,height=2048,
                           resampling=Resampling.bilinear) as vrt:
                rgb = vrt.read([1,2,3])
                source_mask = np.all(vrt.read_masks([1,2,3]) > 0, axis=0)
            if rgb.dtype != np.uint8:
                raise ValueError("Provide an 8-bit RGB imagery raster; no implicit spectral stretching")
            # Some visual COGs do not advertise an explicit nodata value; their
            # out-of-footprint fill is nevertheless exactly zero in all RGB bands.
            source_mask &= np.any(rgb != 0, axis=0)
            rgba = np.dstack((np.moveaxis(rgb,0,-1), source_mask.astype(np.uint8)*255))
            Image.fromarray(rgba, mode="RGBA").save(directory / "texture.png")
            payload["imagery_coverage_percent"] = round(float(source_mask.mean()*100), 1)
        payload["texture_url"] = f"/api/terrain/texture/{terrain.metadata['cache_key']}"
    target.write_text(json.dumps(payload, allow_nan=False), encoding="utf-8")
    return payload
