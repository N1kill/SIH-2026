import hashlib
import importlib.util
import json
import struct
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from src import dam_scene as ds
from src.dam_scene_api import router


class SceneTests(unittest.TestCase):
    def test_reference_is_explicit(self):
        p = ds.reference_package()
        self.assertEqual(p.classification, 'reconstructed')
        self.assertIsNone(p.project_id)
        self.assertIn('not Machhu-II', p.assumptions[0])

    def test_unsafe_ids(self):
        for value in ['../secret', 'a/b', 'C:\\x', '..', 'A']:
            with self.assertRaises(ValueError): ds.package_path(value)

    def test_invalid_units_and_dimensions(self):
        p=ds.reference_package().model_dump()
        for key,value in [('units','feet'),('up_axis','Z')]:
            with self.assertRaises(ValueError): ds.ScenePackage.model_validate({**p,key:value})
        with self.assertRaises(ValueError): ds.SpillwayGeometry(height_m=10,gate_height_m=12)

    def test_import_hash_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);inbox=root/'inbox';store=root/'store';folder=inbox/'test';folder.mkdir(parents=True)
            p=ds.reference_package().model_dump();p['package_id']='test-v1'
            content=json.dumps({'asset':{'version':'2.0'},'nodes':[{'name':'gate'}]}).encode();content+=b' '*((-len(content))%4)
            glb=struct.pack('<4sIIII',b'glTF',2,20+len(content),len(content),0x4E4F534A)+content
            (folder/'model.glb').write_bytes(glb)
            p['assets']=[{'filename':'model.glb','sha256':hashlib.sha256(glb).hexdigest(),'role':'model','license':'test fixture'}]
            (folder/'scene.json').write_text(json.dumps(p))
            with patch.object(ds,'STORE',store),patch.object(ds,'INBOX',inbox):
                self.assertTrue(ds.import_package('test')['valid'])
                with self.assertRaisesRegex(ValueError,'already exists'):ds.import_package('test')
                (folder/'model.glb').write_bytes(b'corrupt')
                with self.assertRaisesRegex(ValueError,'SHA-256'):ds.validate_assets(ds.ScenePackage.model_validate(p),folder)

    def test_external_glb_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'model.glb';body=json.dumps({'buffers':[{'uri':'https://example.com/secret'}]}).encode();body+=b' '*((-len(body))%4)
            p.write_bytes(struct.pack('<4sIIII',b'glTF',2,20+len(body),len(body),0x4E4F534A)+body)
            with self.assertRaisesRegex(ValueError,'embed'):ds.inspect_glb(p)

    def test_api(self):
        app=FastAPI();app.include_router(router);client=TestClient(app)
        self.assertEqual(client.get('/api/dam-scene/packages').status_code,200)
        self.assertTrue(client.get('/api/dam-scene/packages/spillway-reference').json()['validation']['valid'])
        self.assertEqual(client.get('/api/dam-scene/packages/missing').status_code,404)
        self.assertEqual(client.get('/api/dam-scene/packages/spillway-reference/assets/private.glb').status_code,404)
        self.assertEqual(client.get('/api/dam-scene/packages?limit=999').status_code,422)


@unittest.skipUnless(importlib.util.find_spec('mcp'), 'Optional requirements-mcp.txt not installed')
class MCPTests(unittest.IsolatedAsyncioTestCase):
    async def test_stdio_roundtrip(self):
        import sys
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client
        params=StdioServerParameters(command=sys.executable,args=[str(ds.ROOT/'scripts/dam_scene_mcp.py')])
        async with stdio_client(params) as (read,write):
            async with ClientSession(read,write) as session:
                await session.initialize()
                names={t.name for t in (await session.list_tools()).tools}
                self.assertEqual(len(names),4)
                result=await session.call_tool('dam_validate_package',{'package_id':'spillway-reference'})
                self.assertFalse(result.isError)
                self.assertTrue(json.loads(result.content[0].text)['valid'])
                schema=await session.read_resource('dam-scene://schema')
                self.assertIn('schema_version',schema.contents[0].text)
