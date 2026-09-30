from PIL import Image

im = Image.open(r'C:\Users\nikhil sai\.gemini\antigravity-ide\brain\1738f0ea-5353-4582-9354-9833537f3512\pos3_water_active_1789881766803.png')
w, h = im.size

# Let's crop a box around the center dam region (X: 0.40 to 0.60, Y: 0.25 to 0.75) and save it
crop_box = (int(w * 0.40), int(h * 0.25), int(w * 0.65), int(h * 0.75))
cropped = im.crop(crop_box)
cropped.save(r'C:\Users\nikhil sai\.gemini\antigravity-ide\brain\1738f0ea-5353-4582-9354-9833537f3512\spillway_crop.png')
print("Cropped spillway saved. Crop box:", crop_box)
