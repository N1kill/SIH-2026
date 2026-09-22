"""Manual live-server smoke check; excluded from pytest collection side effects."""
import asyncio, websockets, json


async def live_smoke_check():
    async with websockets.connect('ws://localhost:8050/ws/physics') as ws:
        while True:
            msg = json.loads(await ws.recv())
            if msg.get('sph', {}).get('particles'):
                print(msg['sph']['particles'][0])
                break


if __name__ == "__main__":
    asyncio.run(live_smoke_check())
