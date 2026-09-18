import sys

with open("outputs/3d/dashboard/index.html", "r") as f:
    content = f.read()

modal_html = """
    <!-- New Dam Simulation Modal -->
    <div id="sim-modal" class="modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 9999; justify-content: center; align-items: center;">
      <div class="modal-content" style="background: #1e1e24; padding: 30px; border-radius: 12px; width: 400px; color: white; font-family: 'Plus Jakarta Sans', sans-serif;">
        <h2 style="margin-top: 0;"><i class="fa-solid fa-water"></i> New Dam Simulation</h2>
        <form id="sim-form" style="display: flex; flex-direction: column; gap: 15px;">
          <input type="text" id="sim-name" placeholder="Dam Name" required style="padding: 10px; border-radius: 6px; border: 1px solid #444; background: #2a2a35; color: white;">
          <input type="number" step="any" id="sim-lat" placeholder="Latitude" required style="padding: 10px; border-radius: 6px; border: 1px solid #444; background: #2a2a35; color: white;">
          <input type="number" step="any" id="sim-lon" placeholder="Longitude" required style="padding: 10px; border-radius: 6px; border: 1px solid #444; background: #2a2a35; color: white;">
          <input type="number" step="any" id="sim-height" placeholder="Dam Height (m)" required style="padding: 10px; border-radius: 6px; border: 1px solid #444; background: #2a2a35; color: white;">
          <input type="number" step="any" id="sim-volume" placeholder="Reservoir Volume (m3)" required style="padding: 10px; border-radius: 6px; border: 1px solid #444; background: #2a2a35; color: white;">
          <button type="submit" style="padding: 12px; background: #06d6a0; color: #111; font-weight: bold; border: none; border-radius: 6px; cursor: pointer;">Initiate Simulation</button>
          <button type="button" id="sim-close" style="padding: 12px; background: #e63946; color: white; font-weight: bold; border: none; border-radius: 6px; cursor: pointer;">Cancel</button>
        </form>
        <div id="sim-log" style="margin-top: 15px; height: 150px; overflow-y: auto; background: #111; padding: 10px; font-family: monospace; font-size: 12px; display: none;"></div>
      </div>
    </div>
"""

# Insert modal before closing body
content = content.replace("</body>", modal_html + "\n</body>")

# Add a button in the nav or header
# Assuming there's a button list in the header
if '<div class="header-actions">' in content:
    content = content.replace('<div class="header-actions">', '<div class="header-actions">\n        <button id="btn-new-sim" class="action-btn dashboard-only"><i class="fa-solid fa-plus"></i> New Dam</button>')
else:
    # Fallback to appending near the top
    pass

# Add JavaScript script
js_code = """
<script>
document.addEventListener("DOMContentLoaded", function() {
    // Graceful degrade
    if (window.location.protocol === 'file:') {
        alert("Live backend disconnected. Running in demo mode with pre-computed scenario catalogs.");
    }
    
    const btnNewSim = document.getElementById("btn-new-sim");
    const modal = document.getElementById("sim-modal");
    const closeBtn = document.getElementById("sim-close");
    const form = document.getElementById("sim-form");
    const logDiv = document.getElementById("sim-log");
    
    if(btnNewSim) {
        btnNewSim.addEventListener("click", () => {
            modal.style.display = "flex";
            logDiv.style.display = "none";
            logDiv.innerHTML = "";
        });
    }
    
    if(closeBtn) {
        closeBtn.addEventListener("click", () => {
            modal.style.display = "none";
        });
    }
    
    if(form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (window.location.protocol === 'file:') {
                alert("Cannot initiate live simulation in local file mode. Please run the backend server.");
                return;
            }
            
            logDiv.style.display = "block";
            logDiv.innerHTML = "Submitting...<br>";
            
            const payload = {
                dam_name: document.getElementById("sim-name").value,
                lat: parseFloat(document.getElementById("sim-lat").value),
                lon: parseFloat(document.getElementById("sim-lon").value),
                height: parseFloat(document.getElementById("sim-height").value),
                volume: parseFloat(document.getElementById("sim-volume").value)
            };
            
            try {
                const res = await fetch("/api/simulate", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if(data.status === "started") {
                    const evtSource = new EventSource("/api/status");
                    evtSource.onmessage = function(event) {
                        if(event.data === "EOF") {
                            evtSource.close();
                            logDiv.innerHTML += "Simulation Complete.<br>";
                        } else {
                            logDiv.innerHTML += event.data + "<br>";
                            logDiv.scrollTop = logDiv.scrollHeight;
                        }
                    };
                } else {
                    logDiv.innerHTML += "Error: " + data.message + "<br>";
                }
            } catch(e) {
                logDiv.innerHTML += "Error connecting to backend.<br>";
            }
        });
    }
});
</script>
"""

content = content.replace("</body>", js_code + "\n</body>")

with open("outputs/3d/dashboard/index.html", "w") as f:
    f.write(content)
print("Refactored outputs/3d/dashboard/index.html")
