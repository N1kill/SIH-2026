from PIL import Image

im = Image.open(r'C:\Users\nikhil sai\.gemini\antigravity-ide\brain\1738f0ea-5353-4582-9354-9833537f3512\.tempmediaStorage\media_1789844524529.jpg')
w, h = im.size
crop = im.crop((int(w * 0.75), 0, w, int(h * 0.5)))
crop.save(r'C:\Users\nikhil sai\.gemini\antigravity-ide\brain\1738f0ea-5353-4582-9354-9833537f3512\user_panel_crop.png')
print("Cropped:", crop.size)
