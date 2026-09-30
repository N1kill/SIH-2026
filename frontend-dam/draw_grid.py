from PIL import Image, ImageDraw, ImageFont

im = Image.open(r'C:\Users\nikhil sai\.gemini\antigravity-ide\brain\1738f0ea-5353-4582-9354-9833537f3512\spillway_crop.png')
draw = ImageDraw.Draw(im)

w, h = im.size
# Draw grid every 40 px
for x in range(0, w, 40):
    draw.line([(x, 0), (x, h)], fill=(0, 255, 255, 128), width=1)
    draw.text((x + 2, 2), str(x), fill=(0, 255, 255))

for y in range(0, h, 40):
    draw.line([(0, y), (w, y)], fill=(255, 255, 0, 128), width=1)
    draw.text((2, y + 2), str(y), fill=(255, 255, 0))

im.save(r'C:\Users\nikhil sai\.gemini\antigravity-ide\brain\1738f0ea-5353-4582-9354-9833537f3512\spillway_crop_grid.png')
print("Grid saved.")
