"""Georeferenced results, transparent hazard screening, and evidence-based shelters."""

import json
import zipfile
from xml.etree import ElementTree as ET
import numpy as np
import rasterio
from rasterio.features import shapes, geometry_mask
from rasterio.warp import transform_geom, reproject, Resampling
from .project import input_path


def _mask_features(mask, terrain, properties):
    """Polygonize a model-grid mask and return WGS84 GeoJSON features."""
    features = []
    if not np.any(mask):
        return features
    for geom, value in shapes(
        mask.astype(np.uint8), mask=mask, transform=terrain.transform
    ):
        if int(value) != 1:
            continue
        features.append(
            {
                "type": "Feature",
                "geometry": transform_geom(terrain.crs, "EPSG:4326", geom),
                "properties": dict(properties),
            }
        )
    return features


def _export_flood_progression(directory, terrain, scenario):
    """Convert stored simulated wet cells into time-indexed map polygons."""
    steps = []
    shape = terrain.elevation.shape
    reached = np.zeros(shape, dtype=bool)
    for path in sorted(directory.glob("frame-*.json")):
        frame = json.loads(path.read_text(encoding="utf-8"))
        wet = np.zeros(shape, dtype=bool)
        indices = np.asarray(frame["downstream"]["indices"], dtype=np.int64)
        if len(indices):
            wet.ravel()[indices] = True
        reached |= wet
        metrics = frame["metrics"]
        steps.append(
            {
                "frame_index": frame["index"],
                "time_s": frame["time_s"],
                "time_hours": frame["time_s"] / 3600,
                "inundated_area_km2": metrics["inundated_area_km2"],
                "max_depth_m": metrics["max_depth_m"],
                "max_velocity_ms": metrics["max_velocity_ms"],
                "discharge_m3s": frame["downstream"]["inflow_m3s"],
                "features": _mask_features(
                    reached,
                    terrain,
                    {
                        "frame_index": frame["index"],
                        "time_s": frame["time_s"],
                        "time_hours": frame["time_s"] / 3600,
                        "data_status": "simulated",
                        "extent_basis": "cumulative cells reaching the wet-depth threshold by this time",
                        "wet_depth_threshold_m": scenario.wet_depth_m,
                    },
                ),
            }
        )
    result = {
        "simulation_id": directory.name,
        "data_status": "simulated",
        "model": "conservative diffusive-wave screening approximation",
        "crs": "EPSG:4326",
        "total_steps": len(steps),
        "max_time_hours": max((step["time_hours"] for step in steps), default=0),
        "steps": steps,
    }
    (directory / "flood_progression.json").write_text(
        json.dumps(result, allow_nan=False), encoding="utf-8"
    )
    return result


def export_results(directory, terrain, router, project, scenario):
    risk = np.zeros_like(router.depth, dtype=np.uint8)
    wet = router.max_depth >= scenario.wet_depth_m
    risk[wet] = 1
    for category, threshold in enumerate(scenario.risk_depths_m, start=2):
        risk[router.max_depth >= threshold] = category
    risk[wet & (router.max_velocity >= scenario.risk_velocity_ms)] = 4
    rasters = {
        "depth_max": router.max_depth,
        "velocity_max": router.max_velocity,
        "arrival_time": router.arrival,
        "flood_duration": router.duration,
        "risk": risk,
    }
    for name, data in rasters.items():
        with rasterio.open(
            directory / f"{name}.tif",
            "w",
            driver="GTiff",
            height=data.shape[0],
            width=data.shape[1],
            count=1,
            dtype="float32",
            crs=terrain.crs,
            transform=terrain.transform,
            nodata=-9999,
            compress="deflate",
        ) as dst:
            dst.write(np.where(terrain.valid, data.astype("float32"), -9999), 1)
            dst.update_tags(
                units={
                    "depth_max": "m",
                    "velocity_max": "m/s",
                    "arrival_time": "s; -1 means never wet",
                    "flood_duration": "s",
                    "risk": "1 LOW, 2 MODERATE, 3 HIGH, 4 VERY HIGH",
                }[name],
                solver="diffusive-wave screening approximation",
                scenario=scenario.name,
            )
    features = []
    labels = ["DRY", "LOW", "MODERATE", "HIGH", "VERY HIGH"]
    for geom, category in shapes(risk, mask=wet, transform=terrain.transform):
        category = int(category)
        cells = geometry_mask(
            [geom], out_shape=risk.shape, transform=terrain.transform, invert=True
        )
        arrivals = router.arrival[cells & (router.arrival >= 0)]
        features.append(
            {
                "type": "Feature",
                "geometry": transform_geom(terrain.crs, "EPSG:4326", geom),
                "properties": {
                    "risk": labels[category],
                    "category": category,
                    "maximum_depth_m": float(router.max_depth[cells].max()),
                    "maximum_velocity_ms": float(router.max_velocity[cells].max()),
                    "earliest_arrival_s": float(arrivals.min())
                    if len(arrivals)
                    else None,
                    "area_km2": float(cells.sum() * router.dx**2 / 1e6),
                    "priority_basis": "Hazard category, then earliest simulated arrival; population not supplied",
                    "basis": "configured maximum-depth and maximum-speed thresholds; not official designation",
                },
            }
        )
    collection = {
        "type": "FeatureCollection",
        "features": features,
        "thresholds": {
            "depth_m": scenario.risk_depths_m,
            "velocity_ms": scenario.risk_velocity_ms,
        },
    }
    (directory / "risk_zones.geojson").write_text(
        json.dumps(collection), encoding="utf-8"
    )
    ET.register_namespace("", "http://www.opengis.net/kml/2.2")
    ns = "{http://www.opengis.net/kml/2.2}"
    kml = ET.Element(ns + "kml")
    doc = ET.SubElement(kml, ns + "Document")
    for feature in features:
        pm = ET.SubElement(doc, ns + "Placemark")
        ET.SubElement(pm, ns + "name").text = feature["properties"]["risk"]
        poly = ET.SubElement(pm, ns + "Polygon")
        for i, ring in enumerate(feature["geometry"]["coordinates"]):
            boundary = ET.SubElement(
                poly, ns + ("outerBoundaryIs" if i == 0 else "innerBoundaryIs")
            )
            coords = ET.SubElement(
                ET.SubElement(boundary, ns + "LinearRing"), ns + "coordinates"
            )
            coords.text = " ".join(f"{x},{y},0" for x, y in ring)
    ET.ElementTree(kml).write(
        directory / "risk_zones.kml", encoding="utf-8", xml_declaration=True
    )
    from scipy.ndimage import distance_transform_edt

    distance = (
        distance_transform_edt(~wet) * router.dx
        if wet.any()
        else np.full(wet.shape, np.inf, dtype=float)
    )
    setback_m = max(250.0, 2 * router.dx)
    screened_dry = terrain.valid & ~wet & (distance >= setback_m)
    facilities = {
        "type": "FeatureCollection",
        "features": [],
        "status": "unavailable: supply facilities_path GeoJSON; no invented shelters",
    }
    safe_zone_features = []
    zone_radius_m = max(250.0, 2 * router.dx)
    if project.facilities_path:
        import geopandas as gpd

        data = gpd.read_file(input_path(project.facilities_path))
        if data.crs is None:
            raise ValueError("Facility data requires CRS metadata")
        data = data.to_crs(terrain.crs)
        from pyproj import Transformer

        to_geo = Transformer.from_crs(terrain.crs, 4326, always_xy=True)
        facilities["status"] = (
            "screened facility candidates; capacity/accessibility/safety require field verification"
        )
        facilities["simulation_id"] = directory.name
        facilities["setback_m"] = setback_m
        for index, row in data.iterrows():
            point = row.geometry.representative_point()
            r, c = rasterio.transform.rowcol(terrain.transform, point.x, point.y)
            covered = (
                0 <= r < risk.shape[0]
                and 0 <= c < risk.shape[1]
                and terrain.valid[r, c]
            )
            lon, lat = to_geo.transform(point.x, point.y)
            dry = bool(covered and not wet[r, c])
            flood_distance = float(distance[r, c]) if covered and wet.any() else None
            if not covered:
                screening_status = "OUTSIDE_MODEL"
            elif not dry:
                screening_status = "EXPOSED"
            elif not wet.any():
                screening_status = "CANDIDATE"
            elif flood_distance is not None and flood_distance >= setback_m:
                screening_status = "CANDIDATE"
            else:
                screening_status = "BUFFER"
            if screening_status == "CANDIDATE":
                rows, cols = np.ogrid[: risk.shape[0], : risk.shape[1]]
                radius_cells = zone_radius_m / router.dx
                local_zone = (
                    (rows - r) ** 2 + (cols - c) ** 2 <= radius_cells**2
                ) & screened_dry
                safe_zone_features.extend(
                    _mask_features(
                        local_zone,
                        terrain,
                        {
                            "classification": "facility_centered_candidate_refuge",
                            "facility_name": str(row.get("name", f"Facility {index}")),
                            "facility_index": str(index),
                            "candidate_only": True,
                            "minimum_setback_m": setback_m,
                            "screening_radius_m": zone_radius_m,
                            "distance_to_flood_m": flood_distance,
                            "basis": "Supplied facility outside maximum simulated inundation and model-grid setback",
                            "limitations": "Not an officially designated safe zone; access, capacity, structural safety, and other hazards require field verification",
                        },
                    )
                )
            facilities["features"].append(
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [lon, lat]},
                    "properties": {
                        "name": str(row.get("name", f"Facility {index}")),
                        "candidate_only": True,
                        "amenity": str(row.get("amenity", "unknown")),
                        "screening_status": screening_status,
                        "local_x_m": point.x - terrain.origin[0],
                        "local_z_m": terrain.origin[1] - point.y,
                        "elevation_m": float(terrain.elevation[r, c])
                        if covered
                        else None,
                        "outside_simulated_inundation": dry if covered else None,
                        "covered_by_model": bool(covered),
                        "depth_m": float(router.max_depth[r, c]) if covered else None,
                        "distance_to_flood_m": flood_distance,
                        "arrival_time_s": float(router.arrival[r, c])
                        if covered and router.arrival[r, c] >= 0
                        else None,
                        "capacity": None,
                        "road_access_verified": False,
                    },
                }
            )
    (directory / "shelters.geojson").write_text(
        json.dumps(facilities), encoding="utf-8"
    )
    safe_zones = {
        "type": "FeatureCollection",
        "features": safe_zone_features,
        "status": (
            "facility-centered model-screened candidate refuges; not official safety designations"
            if safe_zone_features
            else "unavailable: no supplied facility passed the simulated flood-setback screen"
        ),
        "simulation_id": directory.name,
        "setback_m": setback_m,
        "screening_radius_m": zone_radius_m,
        "wet_depth_threshold_m": scenario.wet_depth_m,
    }
    (directory / "safe_zones.geojson").write_text(
        json.dumps(safe_zones, allow_nan=False), encoding="utf-8"
    )
    evacuation_routes = {
        "type": "FeatureCollection",
        "features": [],
        "simulation_id": directory.name,
        "status": "unavailable: no verified routable road network is supplied",
        "relationship_to_priority_zones": (
            "Priority zones are simulated hazard areas. No evacuation path has been "
            "inferred through or around them."
        ),
        "requirements": [
            "georeferenced routable road network",
            "current closure and passability status",
            "verified refuge destinations",
        ],
    }
    (directory / "evacuation_routes.geojson").write_text(
        json.dumps(evacuation_routes, allow_nan=False), encoding="utf-8"
    )
    _export_flood_progression(directory, terrain, scenario)
    outputs = [f"{name}.tif" for name in rasters] + [
        "risk_zones.geojson",
        "risk_zones.kml",
        "safe_zones.geojson",
        "shelters.geojson",
        "evacuation_routes.geojson",
        "flood_progression.json",
    ]
    try:
        import geopandas as gpd

        if features:
            shp = directory / "shapefile"
            shp.mkdir()
            frame = gpd.GeoDataFrame.from_features(features, crs=4326)
            frame = frame[
                [
                    "risk",
                    "category",
                    "maximum_depth_m",
                    "maximum_velocity_ms",
                    "earliest_arrival_s",
                    "area_km2",
                    "geometry",
                ]
            ]
            frame.rename(
                columns={
                    "maximum_depth_m": "depth_m",
                    "maximum_velocity_ms": "speed_ms",
                    "earliest_arrival_s": "arrival_s",
                }
            ).to_file(shp / "risk.shp")
            outputs.extend(
                str(p.relative_to(directory)).replace("\\", "/") for p in shp.iterdir()
            )
    except ImportError:
        pass
    return outputs


def make_archive(directory):
    path = directory / "export.zip"
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        for item in sorted(directory.rglob("*")):
            if (
                item.is_file()
                and item.suffix != ".zip"
                and not item.name.startswith("frame-")
            ):
                archive.write(item, item.relative_to(directory))
    return path


def validate_result(directory, observed=None):
    summary = json.loads((directory / "summary.json").read_text(encoding="utf-8"))
    result = {
        "simulation_id": directory.name,
        "mass_error_percent": summary["mass_error_percent"],
        "mass_balance_pass": abs(summary["mass_error_percent"]) < 1e-6,
        "observational_validation": "unavailable: no observed extent supplied",
    }
    if observed:
        with (
            rasterio.open(directory / "depth_max.tif") as sim,
            rasterio.open(observed) as obs,
        ):
            if obs.crs is None:
                raise ValueError("Observation raster requires CRS")
            target = np.full(sim.shape, -9999, dtype="float32")
            reproject(
                rasterio.band(obs, 1),
                target,
                src_transform=obs.transform,
                src_crs=obs.crs,
                dst_transform=sim.transform,
                dst_crs=sim.crs,
                src_nodata=obs.nodata,
                dst_nodata=-9999,
                resampling=Resampling.nearest,
            )
            valid = (target != -9999) & (sim.read(1) != sim.nodata)
            if not valid.any():
                raise ValueError("Observed extent does not overlap simulation")
            predicted = sim.read(1) >= summary["scenario"]["wet_depth_m"]
            truth = target > 0
            intersection = int((predicted & truth & valid).sum())
            union = int(((predicted | truth) & valid).sum())
            result.update(
                observational_validation="binary extent comparison",
                iou=intersection / union if union else None,
                overlap_cells=int(valid.sum()),
                observed_path=str(observed),
            )
    return result
