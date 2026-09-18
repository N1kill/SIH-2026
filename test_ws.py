import asyncio, websockets, json
async def test():
    async with websockets.connect('ws://localhost:8050/ws/physics') as ws:
        while True:
            msg = json.loads(await ws.recv())
            if msg.get('sph', {}).get('particles'):
                print(msg['sph']['particles'][0])
                break
asyncio.run(test())
