"""Cache public georeferenced Sentinel-2 RGB and optional OSM facility candidates.

Explicit --imagery/--facilities request network work. Existing supplied paths win.
The default action only validates and prepares local terrain.
"""
import argparse
from datetime import datetime, timezone
import json
import sys
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from src.project import ROOT, projects
from src.terrain import load_terrain, build_twin
from src.run_engine import write_json


def request_json(url):
    with urlopen(Request(url,headers={"User-Agent":"SIH-2026-research/1.0"}),timeout=40) as response:
        return json.load(response)


def acquire_imagery(project, date_range):
    if project.imagery_path:
        return project
    import rasterio
    from rasterio.vrt import WarpedVRT
    from rasterio.transform import from_bounds
    from rasterio.enums import Resampling
    target=ROOT/"data/raw/imagery"/f"{project.dam_id}-sentinel2-rgb.tif"
    metadata=target.with_suffix(".json")
    if not target.exists():
        lon,lat=project.longitude,project.latitude
        query=urlencode({"collections":"sentinel-2-l2a","bbox":f"{lon-.01},{lat-.01},{lon+.01},{lat+.01}",
                         "limit":30,"datetime":date_range})
        response=request_json("https://earth-search.aws.element84.com/v1/search?"+query)
        features=[f for f in response["features"] if "visual" in f["assets"]]
        if not features:raise ValueError("No Sentinel-2 RGB imagery found for requested dates")
        item=min(features,key=lambda f:f["properties"].get("eo:cloud_cover",100))
        href=item["assets"]["visual"]["href"]
        terrain=load_terrain(project)
        transform=from_bounds(*terrain.metadata["bounds"],1024,1024)
        target.parent.mkdir(parents=True,exist_ok=True)
        with rasterio.Env(GDAL_HTTP_TIMEOUT=40,GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif"):
            with rasterio.open(href) as source, WarpedVRT(source,crs=terrain.crs,transform=transform,width=1024,height=1024,resampling=Resampling.bilinear) as vrt:
                rgb=vrt.read([1,2,3])
                with rasterio.open(target,"w",driver="GTiff",width=1024,height=1024,count=3,dtype=rgb.dtype,
                    crs=terrain.crs,transform=transform,compress="deflate") as dst:dst.write(rgb)
        write_json(metadata,{"source":href,"dataset":"Sentinel-2 L2A RGB","scene":item["id"],
            "acquisition_date":item["properties"].get("datetime"),"cloud_cover_percent":item["properties"].get("eo:cloud_cover"),
            "fetched_at":datetime.now(timezone.utc).isoformat(),"crs":terrain.crs,"resolution_m":transform.a,
            "license":"Copernicus Sentinel data terms", "reference":"https://dataspace.copernicus.eu/explore-data/data-collections/sentinel-data",
            "processing":["RGB COG window","metric reprojection","12 km domain resampled to 1024 pixels"],
            "note":"Contemporary context, not imagery of the 1979 event"})
    project.imagery_path=str(target.relative_to(ROOT)).replace("\\","/")
    project.provenance.append(json.loads(metadata.read_text(encoding="utf-8")))
    return project


def acquire_facilities(project):
    if project.facilities_path:return project
    target=ROOT/"data/raw/facilities"/f"{project.dam_id}-osm.geojson"
    if not target.exists():
        lat,lon=project.latitude,project.longitude
        query=f'[out:json][timeout:25];nwr["amenity"~"school|community_centre|hospital|shelter"](around:12000,{lat},{lon});out center tags;'
        data=request_json("https://overpass-api.de/api/interpreter?"+urlencode({"data":query}))
        features=[]
        for item in data.get("elements",[]):
            center=item.get("center",item)
            if "lat" not in center:continue
            features.append({"type":"Feature","geometry":{"type":"Point","coordinates":[center["lon"],center["lat"]]},
                "properties":{**item.get("tags",{}),"osm_id":f"{item['type']}/{item['id']}","source":"OpenStreetMap contributors",
                "license":"ODbL 1.0","candidate_only":True}})
        target.parent.mkdir(parents=True,exist_ok=True)
        write_json(target,{"type":"FeatureCollection","features":features})
    project.facilities_path=str(target.relative_to(ROOT)).replace("\\","/")
    project.provenance.append({"source":"https://www.openstreetmap.org/copyright","dataset":"OSM facility candidates",
        "fetched_at":datetime.now(timezone.utc).isoformat(),"license":"ODbL 1.0","note":"Not designated/verified shelters"})
    return project


def acquire_geometry(project):
    """Use only named mapped reservoir polygons and nearby mapped dam ways."""
    target=ROOT/"data/raw/geometry"/f"{project.dam_id}-osm.json"
    if target.exists():data=json.loads(target.read_text(encoding="utf-8"))
    else:
        lat,lon=project.latitude,project.longitude
        query=f'[out:json][timeout:25];(way["waterway"="dam"](around:3000,{lat},{lon});way["water"="reservoir"](around:8000,{lat},{lon}););out geom;'
        data=request_json("https://overpass-api.de/api/interpreter?"+urlencode({"data":query}))
        target.parent.mkdir(parents=True,exist_ok=True);write_json(target,data)
    dams=[];reservoirs=[]
    for item in data.get("elements",[]):
        tags=item.get("tags",{});coords=[(p['lon'],p['lat']) for p in item.get('geometry',[])]
        if len(coords)<2:continue
        if tags.get('waterway')=='dam':dams.append((item,coords))
        if tags.get('water')=='reservoir' and len(coords)>=4 and coords[0]==coords[-1]:reservoirs.append((item,coords))
    if len(dams)==1 and not project.crest_coordinates:
        from pyproj import Geod
        geod=Geod(ellps="WGS84")
        coords=dams[0][1]
        closest=min(geod.inv(project.longitude,project.latitude,lon,lat)[2] for lon,lat in coords)
        length=sum(geod.inv(*coords[i-1],*coords[i])[2] for i in range(1,len(coords)))
        plausible_length=(project.dam_length_m is None or .5*project.dam_length_m<=length<=1.5*project.dam_length_m)
        if closest<=500 and plausible_length:
            project.crest_coordinates=coords
            project.provenance.append({"source":f"https://www.openstreetmap.org/way/{dams[0][0]['id']}","dataset":"Mapped dam crest","license":"ODbL 1.0","note":"OSM geometry, not engineering survey"})
        else:
            print(f"Rejected mapped dam way: closest point {closest:.0f} m from configured dam, length {length:.0f} m")
    named=[(item,c) for item,c in reservoirs if 'mach' in item.get('tags',{}).get('name','').lower()] if project.dam_id=='machhu-ii' else []
    if len(named)==1 and not project.reservoir_polygon_path:
        path=target.with_name(f"{project.dam_id}-reservoir.geojson")
        write_json(path,{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Polygon","coordinates":[named[0][1]]},"properties":named[0][0].get('tags',{})}]})
        project.reservoir_polygon_path=str(path.relative_to(ROOT)).replace('\\','/')
        project.provenance.append({"source":f"https://www.openstreetmap.org/way/{named[0][0]['id']}","dataset":"Mapped reservoir boundary","license":"ODbL 1.0","note":"Mapped shoreline, not historical 1979 extent"})
    print(f"Mapped geometry candidates: {len(dams)} dam ways, {len(reservoirs)} reservoir ways; ambiguous matches remain unselected")
    return project


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project",default="machhu-ii")
    parser.add_argument("--imagery",action="store_true")
    parser.add_argument("--facilities",action="store_true")
    parser.add_argument("--geometry",action="store_true")
    parser.add_argument("--dates",default="2025-01-01T00:00:00Z/2025-02-01T00:00:00Z")
    args=parser.parse_args();project=projects()[args.project]
    if args.imagery:project=acquire_imagery(project,args.dates)
    if args.facilities:project=acquire_facilities(project)
    if args.geometry:project=acquire_geometry(project)
    if args.imagery or args.facilities or args.geometry:
        directory=ROOT/"data/projects";directory.mkdir(parents=True,exist_ok=True)
        write_json(directory/f"{project.dam_id}.json",project.model_dump())
    result=build_twin(project)
    print(json.dumps({"project":project.dam_id,"cache_key":result["cache_key"],"imagery":result["imagery"],
                      "facilities":project.facilities_path},indent=2))


if __name__=="__main__":main()
