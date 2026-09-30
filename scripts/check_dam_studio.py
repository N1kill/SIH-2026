"""Isolated headless WebGL smoke test; never attaches to a user's browser session."""

import asyncio
import base64
import json
import subprocess
import tempfile
import urllib.request
from pathlib import Path
import websockets

ROOT = Path(__file__).resolve().parents[1]


async def main():
    output = ROOT / ".tmp/visual-check"
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="studio-test-", dir=output) as profile:
        process = subprocess.Popen(
            [
                r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                "--headless=new",
                "--no-first-run",
                "--enable-unsafe-swiftshader",
                "--remote-debugging-port=0",
                f"--user-data-dir={profile}",
                "about:blank",
            ],
            creationflags=subprocess.CREATE_NO_WINDOW,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        try:
            portfile = Path(profile) / "DevToolsActivePort"
            for _ in range(100):
                if portfile.exists():
                    break
                await asyncio.sleep(0.1)
            port = int(portfile.read_text().splitlines()[0])
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/json") as response:
                tabs = json.load(response)
            tab = next(tab for tab in tabs if tab["type"] == "page")
            async with websockets.connect(
                tab["webSocketDebuggerUrl"], max_size=16 * 1024 * 1024
            ) as socket:
                seq = 0
                errors = []

                async def call(method, params=None):
                    nonlocal seq
                    seq += 1
                    current = seq
                    await socket.send(
                        json.dumps(
                            {"id": current, "method": method, "params": params or {}}
                        )
                    )
                    while True:
                        msg = json.loads(await socket.recv())
                        if msg.get("method") == "Runtime.exceptionThrown":
                            errors.append(msg["params"])
                        if (
                            msg.get("method") == "Runtime.consoleAPICalled"
                            and msg["params"]["type"] == "error"
                        ):
                            errors.append(msg["params"])
                        if msg.get("id") == current:
                            if "error" in msg:
                                raise RuntimeError(msg["error"])
                            return msg.get("result", {})

                await call("Runtime.enable")
                await call("Page.enable")
                for width, height in [(1440, 1000), (390, 900)]:
                    await call(
                        "Emulation.setDeviceMetricsOverride",
                        {
                            "width": width,
                            "height": height,
                            "deviceScaleFactor": 1,
                            "mobile": False,
                        },
                    )
                    navigation = await call(
                        "Page.navigate", {"url": "http://127.0.0.1:8052/studio.html"}
                    )
                    if "errorText" in navigation:
                        raise AssertionError(navigation)
                    for _ in range(100):
                        r = await call(
                            "Runtime.evaluate",
                            {
                                "expression": "document.body?.dataset.sceneReady",
                                "returnByValue": True,
                            },
                        )
                        if r.get("result", {}).get("value") == "true":
                            break
                        await asyncio.sleep(0.1)
                    else:
                        diagnostic = await call(
                            "Runtime.evaluate",
                            {
                                "expression": "JSON.stringify({url:location.href,html:document.documentElement.outerHTML})",
                                "returnByValue": True,
                            },
                        )
                        raise AssertionError({"page": diagnostic, "errors": errors})
                    await asyncio.sleep(0.5)
                    layout = await call(
                        "Runtime.evaluate",
                        {
                            "expression": 'JSON.stringify({width:innerWidth,scroll:document.documentElement.scrollWidth,status:document.querySelector("#status").textContent})',
                            "returnByValue": True,
                        },
                    )
                    value = json.loads(layout["result"]["value"])
                    assert value["scroll"] <= width, value
                    # Exercise UI programmatically within this isolated test page.
                    await call(
                        "Runtime.evaluate",
                        {
                            "expression": 'document.querySelector("#release").value=0;document.querySelector("#release").dispatchEvent(new Event("input"));document.querySelector("#release").value=35;document.querySelector("#release").dispatchEvent(new Event("input"));'
                        },
                    )
                    shot = await call(
                        "Page.captureScreenshot",
                        {"format": "png", "captureBeyondViewport": False},
                    )
                    (output / f"studio-verified-{width}.png").write_bytes(
                        base64.b64decode(shot["data"])
                    )
                    print(json.dumps(value))
                assert not errors, errors
                print(
                    "PASS: both viewport sizes, no horizontal overflow, no browser/shader errors"
                )
                await call("Browser.close")
        finally:
            if process.poll() is None:
                process.terminate()
            process.wait(timeout=10)


if __name__ == "__main__":
    asyncio.run(main())
