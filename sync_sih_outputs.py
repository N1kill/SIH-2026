import shutil
from pathlib import Path

root = Path(__file__).resolve().parent

src_gis = root / 'outputs' / 'gis'
src_sim = root / 'outputs' / 'simulation'

dst_sih_gis = root / 'outputs' / 'SIH-2026' / 'outputs' / 'gis'
dst_sih_sim = root / 'outputs' / 'SIH-2026' / 'outputs' / 'simulation'
dst_public_img = root / 'frontend-dam' / 'public' / 'images' / 'outputs'

dst_sih_gis.mkdir(parents=True, exist_ok=True)
dst_sih_sim.mkdir(parents=True, exist_ok=True)
dst_public_img.mkdir(parents=True, exist_ok=True)

# Copy GIS outputs
for f in src_gis.glob('*.*'):
    shutil.copy2(f, dst_sih_gis / f.name)
    if f.suffix.lower() in ['.png', '.jpg', '.jpeg']:
        shutil.copy2(f, dst_public_img / f.name)

# Copy simulation outputs
for f in src_sim.glob('*.*'):
    shutil.copy2(f, dst_sih_sim / f.name)

print('Synchronized files successfully!')
print('SIH GIS files:', len(list(dst_sih_gis.glob('*.*'))))
print('SIH Sim files:', len(list(dst_sih_sim.glob('*.*'))))
print('Public Image files:', len(list(dst_public_img.glob('*.*'))))
