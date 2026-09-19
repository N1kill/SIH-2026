"""Georeferenced results, transparent hazard screening, and evidence-based shelters."""
import json
import zipfile
from xml.etree import ElementTree as ET
import numpy as np
import rasterio
from rasterio.features import shapes, geometry_mask
from rasterio.warp import transform_geom, reproject, Resampling
from .project import input_path


def export_results(directory, terrain, router, project, scenario):
    risk = np.zeros_like(router.depth,dtype=np.uint8)
    wet = router.max_depth>=scenario.wet_depth_m
    risk[wet] = 1
    for category,threshold in enumerate(scenario.risk_depths_m,start=2):
        risk[router.max_depth>=threshold] = category
    risk[wet & (router.max_velocity>=scenario.risk_velocity_ms)] = 4
    rasters = {"depth_max":router.max_depth,"velocity_max":router.max_velocity,
               "arrival_time":router.arrival,"flood_duration":router.duration,"risk":risk}
    for name, data in rasters.items():
        with rasterio.open(directory/f"{name}.tif","w",driver="GTiff",height=data.shape[0],width=data.shape[1],
            count=1,dtype="float32",crs=terrain.crs,transform=terrain.transform,nodata=-9999,compress="deflate") as dst:
            dst.write(np.where(terrain.valid,data.astype("float32"),-9999),1)
            dst.update_tags(units={"depth_max":"m","velocity_max":"m/s","arrival_time":"s; -1 means never wet",
                "flood_duration":"s","risk":"1 LOW, 2 MODERATE, 3 HIGH, 4 VERY HIGH"}[name],
                solver="diffusive-wave screening approximation",scenario=scenario.name)
    features = []
    labels = ["DRY","LOW","MODERATE","HIGH","VERY HIGH"]
    for geom,category in shapes(risk,mask=wet,transform=terrain.transform):
        category = int(category)
        cells=geometry_mask([geom],out_shape=risk.shape,transform=terrain.transform,invert=True)
        arrivals=router.arrival[cells & (router.arrival>=0)]
        features.append({"type":"Feature","geometry":transform_geom(terrain.crs,"EPSG:4326",geom),
                         "properties":{"risk":labels[category],"category":category,
                         "maximum_depth_m":float(router.max_depth[cells].max()),
                         "maximum_velocity_ms":float(router.max_velocity[cells].max()),
                         "earliest_arrival_s":float(arrivals.min()) if len(arrivals) else None,
                         "area_km2":float(cells.sum()*router.dx**2/1e6),
                         "priority_basis":"Hazard category, then earliest simulated arrival; population not supplied",
                         "basis":"configured maximum-depth and maximum-speed thresholds; not official designation"}})
    collection = {"type":"FeatureCollection","features":features,
                  "thresholds":{"depth_m":scenario.risk_depths_m,"velocity_ms":scenario.risk_velocity_ms}}
    (directory/"risk_zones.geojson").write_text(json.dumps(collection),encoding="utf-8")
    ET.register_namespace("", "http://www.opengis.net/kml/2.2")
    ns = "{http://www.opengis.net/kml/2.2}"
    kml = ET.Element(ns+"kml"); doc = ET.SubElement(kml,ns+"Document")
    for feature in features:
        pm = ET.SubElement(doc,ns+"Placemark"); ET.SubElement(pm,ns+"name").text=feature["properties"]["risk"]
        poly = ET.SubElement(pm,ns+"Polygon")
        for i,ring in enumerate(feature["geometry"]["coordinates"]):
            boundary = ET.SubElement(poly,ns+("outerBoundaryIs" if i==0 else "innerBoundaryIs"))
            coords = ET.SubElement(ET.SubElement(boundary,ns+"LinearRing"),ns+"coordinates")
            coords.text = " ".join(f"{x},{y},0" for x,y in ring)
    ET.ElementTree(kml).write(directory/"risk_zones.kml",encoding="utf-8",xml_declaration=True)
    facilities = {"type":"FeatureCollection","features":[],"status":"unavailable: supply facilities_path GeoJSON; no invented shelters"}
    if project.facilities_path:
        import geopandas as gpd
        data = gpd.read_file(input_path(project.facilities_path))
        if data.crs is None:
            raise ValueError("Facility data requires CRS metadata")
        data = data.to_crs(terrain.crs)
        from pyproj import Transformer
        from scipy.ndimage import distance_transform_edt
        distance = distance_transform_edt(~wet)*router.dx
        to_geo = Transformer.from_crs(terrain.crs,4326,always_xy=True)
        facilities["status"] = "screened candidates; capacity/accessibility/safety require field verification"
        for index,row in data.iterrows():
            point = row.geometry.representative_point()
            r,c = rasterio.transform.rowcol(terrain.transform,point.x,point.y)
            covered = 0<=r<risk.shape[0] and 0<=c<risk.shape[1] and terrain.valid[r,c]
            lon,lat = to_geo.transform(point.x,point.y)
            dry = bool(covered and not wet[r,c])
            facilities["features"].append({"type":"Feature","geometry":{"type":"Point","coordinates":[lon,lat]},
                "properties":{"name":str(row.get("name",f"Facility {index}")),"candidate_only":True,
                "amenity":str(row.get("amenity","unknown")),
                "local_x_m":point.x-terrain.origin[0],"local_z_m":terrain.origin[1]-point.y,
                "elevation_m":float(terrain.elevation[r,c]) if covered else None,
                "outside_simulated_inundation":dry if covered else None,"covered_by_model":bool(covered),
                "depth_m":float(router.max_depth[r,c]) if covered else None,
                "distance_to_flood_m":float(distance[r,c]) if covered and wet.any() else None,
                "arrival_time_s":float(router.arrival[r,c]) if covered and router.arrival[r,c]>=0 else None,
                "capacity":None,"road_access_verified":False}})
    (directory/"shelters.geojson").write_text(json.dumps(facilities),encoding="utf-8")
    outputs = [f"{name}.tif" for name in rasters]+["risk_zones.geojson","risk_zones.kml","shelters.geojson"]
    try:
        import geopandas as gpd
        if features:
            shp = directory/"shapefile"; shp.mkdir()
            frame=gpd.GeoDataFrame.from_features(features,crs=4326)
            frame=frame[["risk","category","maximum_depth_m","maximum_velocity_ms","earliest_arrival_s","area_km2","geometry"]]
            frame.rename(columns={"maximum_depth_m":"depth_m","maximum_velocity_ms":"speed_ms","earliest_arrival_s":"arrival_s"}).to_file(shp/"risk.shp")
            outputs.extend(str(p.relative_to(directory)).replace("\\","/") for p in shp.iterdir())
    except ImportError:
        pass
    return outputs


def make_archive(directory):
    path = directory/"export.zip"
    with zipfile.ZipFile(path,"w",zipfile.ZIP_DEFLATED) as archive:
        for item in sorted(directory.rglob("*")):
            if item.is_file() and item.suffix != ".zip" and not item.name.startswith("frame-"):
                archive.write(item,item.relative_to(directory))
    return path


def validate_result(directory, observed=None):
    summary = json.loads((directory/"summary.json").read_text(encoding="utf-8"))
    result = {"simulation_id":directory.name,"mass_error_percent":summary["mass_error_percent"],
              "mass_balance_pass":abs(summary["mass_error_percent"])<1e-6,
              "observational_validation":"unavailable: no observed extent supplied"}
    if observed:
        with rasterio.open(directory/"depth_max.tif") as sim, rasterio.open(observed) as obs:
            if obs.crs is None:
                raise ValueError("Observation raster requires CRS")
            target = np.full(sim.shape,-9999,dtype="float32")
            reproject(rasterio.band(obs,1),target,src_transform=obs.transform,src_crs=obs.crs,
                dst_transform=sim.transform,dst_crs=sim.crs,src_nodata=obs.nodata,dst_nodata=-9999,resampling=Resampling.nearest)
            valid = (target!=-9999)&(sim.read(1)!=sim.nodata)
            if not valid.any():
                raise ValueError("Observed extent does not overlap simulation")
            predicted = sim.read(1)>=summary["scenario"]["wet_depth_m"]
            truth = target>0
            intersection = int((predicted&truth&valid).sum()); union=int(((predicted|truth)&valid).sum())
            result.update(observational_validation="binary extent comparison",iou=intersection/union if union else None,
                          overlap_cells=int(valid.sum()),observed_path=str(observed))
    return result
