"""Numerical and lifecycle invariants; no external datasets needed for unit tests."""
import json
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch
import numpy as np
import rasterio
from rasterio.transform import from_origin
from fastapi.testclient import TestClient
from src.project import Project, Scenario
from src.terrain import Terrain, load_terrain
from src.flood_routing import FloodRouter
from src.reservoir import ReservoirState, StorageElevationCurve
from src.sph_breach import SPHBreachSolver, SPHParams
from src.run_engine import Run, RunManager, runoff_volume
from src.results import validate_result


def fixture_terrain():
    dem=np.tile(np.linspace(12,0,20)[:,None],(1,20))
    return Terrain(dem,np.ones((20,20),bool),from_origin(500000,2500000,10,10),
        "EPSG:32642",(500100,2499900,6),(10,10),{"crs":"EPSG:32642"})


def fixture_project():
    return Project(dam_id="test",dam_name="Test",latitude=22,longitude=69,dam_height_m=10,
        dam_length_m=200,reservoir_capacity_m3=10000,dem_path="unused",catchment_area_km2=1)


class PhysicsTests(unittest.TestCase):
    def test_reservoir_exhaustion_is_conservative(self):
        r=ReservoirState(StorageElevationCurve(coeff=1,exponent=1),100,100,storage_m3=10)
        record=r.step(2,3,100)
        self.assertGreaterEqual(r.storage_m3,0)
        self.assertAlmostEqual(10+6-r.storage_m3,record["breach_outflow_m3s"]*2)
        with self.assertRaises(ValueError):r.step(-1,0,1)

    def test_invalid_survey_rejected(self):
        with self.assertRaises(ValueError):StorageElevationCurve(elevations_m=np.array([1,2]),storages_m3=np.array([2,1]))

    def test_routing_conservation_and_no_wraparound(self):
        router=FloodRouter(fixture_terrain())
        for _ in range(50):router.step(.2,2)
        self.assertAlmostEqual(router.volume,20,places=9)
        self.assertGreaterEqual(router.depth.min(),0)
        self.assertEqual(router.depth[0,0],0)
        self.assertTrue(np.isfinite(router.velocity).all())
        self.assertTrue((router.arrival[router.max_depth>=.1]>=0).all())

    def test_dry_routing_stays_dry(self):
        router=FloodRouter(fixture_terrain());router.step(30,0)
        self.assertEqual(router.volume,0)
        self.assertTrue((router.arrival==-1).all())

    def test_sph_timestep_and_finite_state(self):
        sph=SPHBreachSolver(SPHParams(particle_spacing_m=1))
        sph.seed_reservoir_block(3,3,(0,2));start=sph.time_s
        for _ in range(10):
            result=sph.step(.001)
            self.assertLessEqual(result["dt_s"],.001)
        self.assertAlmostEqual(sph.time_s-start,.01)
        self.assertTrue(np.isfinite(sph.pos).all())
        self.assertGreaterEqual(sph.pressure.min(),0)

    def test_coordinate_roundtrip(self):
        terrain=fixture_terrain();x,y,z=terrain.local(69.01,22.6,10)
        lon,lat=terrain.geographic(x,z)
        self.assertAlmostEqual(lon,69.01,places=8);self.assertAlmostEqual(lat,22.6,places=8)

    def test_runoff_response(self):
        self.assertEqual(runoff_volume(0,75,2),0)
        self.assertGreater(runoff_volume(100,90,2),runoff_volume(100,60,2))

    def test_scenario_validation(self):
        for values in [{"dt_s":0},{"rainfall_mm":-1},{"breach_width_m":200,"max_breach_width_m":100},{"dt_s":float('nan')}]:
            with self.assertRaises(ValueError):Scenario(**values)

    def test_run_exports_replay_and_mass(self):
        with tempfile.TemporaryDirectory() as directory, patch('src.run_engine.load_terrain',return_value=fixture_terrain()):
            run=Run(fixture_project(),Scenario(project_id='test',duration_s=4,dt_s=1,output_interval_s=1,breach_depth_m=5),directory)
            run.execute();self.assertEqual(run.status()['status'],'COMPLETE',run.status())
            self.assertLess(abs(run.summary['mass_error_percent']),1e-8)
            self.assertTrue(validate_result(run.directory)['mass_balance_pass'])
            with rasterio.open(run.directory/'depth_max.tif') as raster:
                self.assertEqual(str(raster.crs),'EPSG:32642');self.assertEqual(raster.shape,(20,20))
            frame=json.loads((run.directory/'frame-0000.json').read_text())
            self.assertEqual(frame['protocol_version'],1)
            self.assertGreater(frame['breach']['discharge_m3s'],0)

    def test_cancellation(self):
        with tempfile.TemporaryDirectory() as directory, patch('src.run_engine.load_terrain',return_value=fixture_terrain()):
            run=Run(fixture_project(),Scenario(duration_s=100),directory);run.cancel.set();run.execute()
            self.assertEqual(run.status()['status'],'CANCELLED')


class APITests(unittest.TestCase):
    def test_health_validation_stream_and_export(self):
        from server import app
        with tempfile.TemporaryDirectory() as directory, patch('src.api.manager',RunManager(directory)), patch('src.api.project_for',return_value=fixture_project()), patch('src.run_engine.load_terrain',return_value=fixture_terrain()):
            with TestClient(app) as client:
                self.assertEqual(client.get('/api/health').status_code,200)
                self.assertEqual(client.post('/api/simulation/start',json={'dt_s':0}).status_code,422)
                response=client.post('/api/simulation/start',json={'project_id':'test','duration_s':4,'dt_s':1,'output_interval_s':1})
                self.assertEqual(response.status_code,202);run_id=response.json()['simulation_id']
                messages=[]
                with client.websocket_connect(f'/ws/simulation/{run_id}') as ws:
                    for _ in range(100):
                        event=ws.receive_json();messages.append(event)
                        if event['type'] in {'simulation_complete','simulation_error'}:break
                self.assertEqual(messages[-1]['type'],'simulation_complete',messages[-1])
                frames=[m for m in messages if m['type']=='simulation_frame']
                self.assertEqual([f['time_s'] for f in frames],sorted(f['time_s'] for f in frames))
                self.assertGreater(len(frames),1)
                self.assertEqual(client.get(f'/api/export/{run_id}').status_code,200)
                self.assertEqual(client.get('/api/simulation/results/bad').status_code,404)
                self.assertEqual(client.get(f'/api/simulation/results/{run_id}/frames/9999').status_code,404)


if __name__=='__main__':unittest.main()
