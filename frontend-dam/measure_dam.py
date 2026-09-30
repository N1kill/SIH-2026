from PIL import Image

im = Image.open(r'C:\Users\nikhil sai\.gemini\antigravity-ide\brain\1738f0ea-5353-4582-9354-9833537f3512\pos3_water_active_1789881766803.png')
w, h = im.size
print(f"Size: {w} x {h}")

# The red radial gates are red pixels (high R, lower G and B)
# Let's search for red pixels around Y from 0.25 to 0.40
red_pts = []
for y in range(int(h * 0.25), int(h * 0.42)):
    for x in range(int(w * 0.35), int(w * 0.55)):
        r, g, b, *a = im.getpixel((x, y))
        # Red gate has high red compared to green and blue
        if r > 110 and g < 60 and b < 60:
            red_pts.append((x, y))

if red_pts:
    min_x = min(p[0] for p in red_pts)
    max_x = max(p[0] for p in red_pts)
    min_y = min(p[1] for p in red_pts)
    max_y = max(p[1] for p in red_pts)
    print(f"Red gate bounds: X [{min_x}, {max_x}] (norm: [{min_x/w:.3f}, {max_x/w:.3f}]), Y [{min_y}, {max_y}] (norm: [{min_y/h:.3f}, {max_y/h:.3f}])")
    center_x = sum(p[0] for p in red_pts) / len(red_pts)
    center_y = sum(p[1] for p in red_pts) / len(red_pts)
    print(f"Red gate center: X={center_x:.1f} ({center_x/w:.3f}), Y={center_y:.1f} ({center_y/h:.3f})")
