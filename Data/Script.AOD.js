// ========================================
// Kochi AOD (Air Quality) Analysis - Only
// ========================================

print('Loading AOD data for Kochi...');

// Define Kochi area
var kochi = ee.Geometry.Rectangle([76.19, 9.88, 76.35, 10.05], 'EPSG:4326', false);
Map.setCenter(76.27, 9.965, 11);

// Date range (last 30 days)
var today = ee.Date(new Date());
var monthAgo = today.advance(-30, 'day');

print('Date range:', monthAgo.format('YYYY-MM-dd'), 'to', today.format('YYYY-MM-dd'));

// ============================================
// AOD - Aerosol Optical Depth (Air Quality)
// ============================================

// Try MODIS 061 version (newer)
var aodCollection = ee.ImageCollection('MODIS/061/MCD19A2_GRANULES')
  .filterDate(monthAgo, today)
  .filterBounds(kochi)
  .select('Optical_Depth_047');

print('AOD images found:', aodCollection.size());

// Get mean AOD
var aodImage = aodCollection.mean();
var aod = aodImage.reproject('EPSG:4326', null, 1000).clip(kochi);

// Visualize AOD - using auto-stretch to see actual data
Map.addLayer(aod, {
  min: 0, 
  max: 2000,  // AOD data might be scaled
  palette: ['00FF00', 'FFFF00', 'FF6600', 'FF0000', '8B0000']
}, 'Air Quality (AOD)');

// Add another layer with different scaling
Map.addLayer(aod, {}, 'AOD (auto-scale)', false);

// ============================================
// LEGEND
// ============================================

var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px',
    backgroundColor: 'white'
  }
});

legend.add(ui.Label({
  value: 'AOD (Air Quality)',
  style: {fontWeight: 'bold', fontSize: '14px', margin: '0 0 6px 0'}
}));

var colors = ['00FF00', 'FFFF00', 'FF6600', 'FF0000', '8B0000'];
var labels = ['0.0 Clean', '0.25', '0.5 Moderate', '0.75 High', '1.0 Very High'];

for (var i = 0; i < colors.length; i++) {
  var row = ui.Panel({
    widgets: [
      ui.Label({style: {backgroundColor: '#' + colors[i], padding: '6px', margin: '0'}}),
      ui.Label({value: labels[i], style: {margin: '0 0 0 4px', fontSize: '11px'}})
    ],
    layout: ui.Panel.Layout.Flow('horizontal'),
    style: {margin: '1px 0'}
  });
  legend.add(row);
}

Map.add(legend);

// ============================================
// STATISTICS - Check actual AOD range
// ============================================

// Get min/max to see actual data range
var aodMinMax = aod.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: kochi,
  scale: 1000,
  maxPixels: 1e10,
  bestEffort: true
});

print('AOD Min:', aodMinMax.get('Optical_Depth_047_min'));
print('AOD Max:', aodMinMax.get('Optical_Depth_047_max'));

var aodStats = aod.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: kochi,
  scale: 1000,
  maxPixels: 1e10,
  bestEffort: true
});

print('Average AOD:', aodStats);

// ============================================
// EXPORT
// ============================================

Export.image.toDrive({
  image: aod,
  description: 'AOD_Kochi_30day',
  folder: 'HeatSafe_Data',
  region: kochi,
  scale: 1000,
  crs: 'EPSG:4326',
  maxPixels: 1e10,
  fileFormat: 'GeoTIFF'
});

var statsFeature = ee.Feature(null, {
  'date_from': monthAgo.format('YYYY-MM-dd'),
  'date_to': today.format('YYYY-MM-dd'),
  'region': 'Kochi',
  'avg_AOD': aodStats.get('Optical_Depth_047'),
  'min_AOD': aodMinMax.get('Optical_Depth_047_min'),
  'max_AOD': aodMinMax.get('Optical_Depth_047_max')
});

Export.table.toDrive({
  collection: ee.FeatureCollection([statsFeature]),
  description: 'AOD_Statistics_Kochi',
  folder: 'HeatSafe_Data',
  fileFormat: 'CSV'
});

print('');
print('========================================');
print('✅ AOD Analysis Complete!');
print('');
print('Go to TASKS tab and click RUN on:');
print('  • AOD_Kochi_30day (Image)');
print('  • AOD_Statistics_Kochi (CSV)');
print('');
print('📊 AOD Interpretation:');
print('   0.0-0.3 = Clean air (Good)');
print('   0.3-0.5 = Moderate pollution');
print('   0.5-1.0 = High pollution (Bad)');
print('========================================');
