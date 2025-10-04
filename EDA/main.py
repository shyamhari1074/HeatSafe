import rasterio, os, numpy as np, matplotlib.pyplot as plt

# Look for .tif files in the current folder
files = os.listdir()
print("Found files:", files)

# Map them to variables based on keywords
def load_tif(keyword):
    for f in files:
        if keyword.lower() in f.lower() and f.endswith('.tif'):
            return rasterio.open(f).read(1)
    raise FileNotFoundError(f"No file found for {keyword}")

ndvi = load_tif("NDVI")
lst  = load_tif("LST")
aod  = load_tif("AOD")

# Normalize arrays
def normalize(arr):
    return (arr - np.nanmin(arr)) / (np.nanmax(arr) - np.nanmin(arr))

ndvi_norm, lst_norm, aod_norm = map(normalize, [ndvi, lst, aod])

# Compute comfort
comfort = ndvi_norm * 0.5 + (1 - lst_norm) * 0.3 + (1 - aod_norm) * 0.2

plt.imshow(comfort, cmap='YlGnBu')
plt.colorbar(label='Comfort Score')
plt.title('Urban Comfort Map - Kochi')
plt.show()
