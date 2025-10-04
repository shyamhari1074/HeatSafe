# compute_edge_comfort.py
import os
import geopandas as gpd
import osmnx as ox
from rasterstats import zonal_stats
import rasterio
import pandas as pd
import numpy as np
import networkx as nx

# ----- CONFIG -----
PLACE = "Kochi, India"
DATA_DIR = "data/raw"
LST_TIF = os.path.join(DATA_DIR, "LST_Kochi_last30d.tif")
NDVI_TIF = os.path.join(DATA_DIR, "NDVI_Kochi_last30d.tif")
AOD_TIF = os.path.join(DATA_DIR, "AOD_Kochi_last30d.tif")
BUFFER_M = 10  # buffer around road to sample raster (meters) — optional
# weights for comfort score
w_L, w_N, w_A = 0.50, 0.30, 0.20

# ----- 1. load OSM walking graph & convert to edges GeoDataFrame -----
print("Downloading OSM walk graph for:", PLACE)
G = ox.graph_from_place(PLACE, network_type='walk')
# ensure graph has length attribute; osmnx adds 'length' in meters
edges = ox.graph_to_gdfs(G, nodes=False, edges=True)

# Reproject edges to EPSG:4326 to match GEE exports (which we exported as EPSG:4326)
edges = edges.to_crs(epsg=4326)

# keep only relevant columns and reset index
edges = edges.reset_index()
print("Edges downloaded:", len(edges))

# ----- 2. compute zonal stats (mean) for each raster -----
def compute_mean_stat(raster_path, geoms):
    print("Computing zonal stats for:", raster_path)
    zs = zonal_stats(
        geoms,
        raster_path,
        stats=['mean'],
        all_touched=True,
        nodata=None,
        geojson_out=False
    )
    means = [s['mean'] if s['mean'] is not None else np.nan for s in zs]
    return means

edges['lst_mean'] = compute_mean_stat(LST_TIF, edges['geometry'])
edges['ndvi_mean'] = compute_mean_stat(NDVI_TIF, edges['geometry'])
edges['aod_mean'] = compute_mean_stat(AOD_TIF, edges['geometry'])

# Quick fill / sanity
print(edges[['lst_mean','ndvi_mean','aod_mean']].describe())

# ----- 3. normalize values 0-1 (min-max across edges) -----
def min_max(series):
    s = series.copy()
    s_min, s_max = np.nanmin(s), np.nanmax(s)
    if s_max - s_min < 1e-6:
        return np.zeros_like(s)
    return (s - s_min) / (s_max - s_min)

edges['LST_n'] = min_max(edges['lst_mean'])
edges['NDVI_n'] = min_max(edges['ndvi_mean'])
edges['AOD_n'] = min_max(edges['aod_mean'])

# Note: higher LST_n = hotter, higher NDVI_n = more vegetation, higher AOD_n = more pollution.

# ----- 4. comfort score -----
# Comfort = w_L*(1 - LST_n) + w_N*(NDVI_n) + w_A*(1 - AOD_n)
edges['comfort'] = (w_L*(1 - edges['LST_n'])
                    + w_N*(edges['NDVI_n'])
                    + w_A*(1 - edges['AOD_n']))

# cost for routing: lower cost = preferred
edges['cost'] = 1.0 - edges['comfort']

# Ensure we have 'u','v','key' columns (osmnx edges)
if not {'u','v','key'}.issubset(edges.columns):
    edges[['u','v','key']] = edges[['u','v','key']]  # placeholder

# ----- 5. push costs to graph G -----
print("Writing cost attributes to graph edges...")
# edges GeoDataFrame has columns 'u','v','key' matching G
for idx, row in edges.iterrows():
    try:
        u = int(row['u']); v = int(row['v']); key = int(row['key'])
        # handle if multiple edges exist:
        if key in G[u][v]:
            G[u][v][key]['comfort'] = float(row['comfort']) if not np.isnan(row['comfort']) else 0.5
            # length exists in G; multiply cost by length (meters) so routing considers distance
            length = G[u][v][key].get('length', 1.0)
            G[u][v][key]['cost'] = float(row['cost'])*(length/1000.0)  # length in km multiplier
    except Exception as e:
        # some edges may have issues; skip them
        continue

# ----- 6. persist edges+comfort for inspection -----
edges.to_file("data/processed/edges_with_comfort.geojson", driver='GeoJSON')
print("Saved edges_with_comfort.geojson")

# ----- 7. sample route function (example) -----
def find_coolest_route(orig_lat, orig_lon, dest_lat, dest_lon):
    # nearest nodes (ox.nearest_nodes expects lon,lat order)
    orig_node = ox.distance.nearest_nodes(G, orig_lon, orig_lat)
    dest_node = ox.distance.nearest_nodes(G, dest_lon, dest_lat)
    route = nx.shortest_path(G, orig_node, dest_node, weight='cost')
    return route

# Example (Kochi sample points) - replace with real lat/lon
# route_nodes = find_coolest_route(9.966,76.294, 9.961,76.299)
# print(route_nodes)

print("Done. Now you can call find_coolest_route(orig_lat, orig_lon, dest_lat, dest_lon)")
