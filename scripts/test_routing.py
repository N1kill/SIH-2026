import rasterio
import numpy as np

with rasterio.open('data/processed/streams.tif') as src_str:
    streams = src_str.read(1)
    print("streams shape:", streams.shape, "max:", streams.max())

with rasterio.open('data/processed/flow_acc.tif') as src_acc:
    acc = src_acc.read(1)
    print("flow_acc shape:", acc.shape, "max:", acc.max())
    print("flow_acc at Dam (1668, 1658):", acc[1668, 1658])
    print("flow_acc at Morbi (1413, 1518):", acc[1413, 1518])
    print("flow_acc in 5x5 around Dam:\n", acc[1666:1671, 1656:1661])
