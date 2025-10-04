// ========================================
// Kochi Heat Analysis - PROJECTION FIXED
// ========================================

print('Starting analysis...');

// Define area in EPSG:4326 (standard lat/lon)
var kochi = ee.Geometry.Rectangle([76.19, 9.88, 76.35, 10.05], 'EPSG:4326', false);
Map.setCenter(76.27, 9.965, 11);

// Date range
var endDate = '2025-10-01';
var startDate = '2025-09-01';

print('Date range:', startDate, 'to', endDate);
print('Area of interest:', kochi);

// ============================================
// LST - Land Surface Temperature
// ============================================

print('');
print('Loading temperature data...');

var lstCollection = ee.ImageCollection("MODIS/061/MOD11A2")
  .filterDate(startDate, endDate)
  .filterBounds(kochi);

print('Temperature images found:', lstCollection.size());

// Get LST and reproject to EPSG:4326
var lstImage = lstCollection.select('LST_Day_1km').first();
var lstCelsius = lstImage
  .multiply(0.02)
  .subtract(273.15)
  .reproject('EPSG:4326', null, 1000)
  .clip(kochi);

Map.addLayer(lstCelsius, {
  min: 25, 
  max: 42, 
  palette: ['#0000FF', '#00FFFF', '#00FF00', '#FFFF00', '#FF8800', '#FF0000', '#8B0000']
}, 'Temperature (°C)');

print('✓ Temperature layer added');

// ============================================
// NDVI - Vegetation
// ============================================

print('');
print('Loading vegetation data...');

var ndviCollection = ee.ImageCollection("MODIS/061/MOD13Q1")
  .filterDate(startDate, endDate)
  .filterBounds(kochi);

print('Vegetation images found:', ndviCollection.size());

// Get NDVI and reproject to EPSG:4326
var ndviImage = ndviCollection.select('NDVI').first();
var ndviScaled = ndviImage
  .multiply(0.0001)
  .reproject('EPSG:4326', null, 250)
  .clip(kochi);

Map.addLayer(ndviScaled, {
  min: 0, 
  max: 0.8, 
  palette: ['ffffff', 'ce7e45', 'df923d', 'f1b555', 'fcd163',
           '99b718', '74a901', '66a000', '529400', '3e8601', '207401', '056201',
           '004c00', '023b01', '012e01', '011d01', '011301']
}, 'Vegetation (NDVI)', false);

print('✓ Vegetation layer added');

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
  value: 'Temperature (°C)',
  style: {fontWeight: 'bold', fontSize: '14px', margin: '0 0 6px 0'}
}));

var colors = ['#0000FF', '#00FFFF', '#00FF00', '#FFFF00', '#FF8800', '#FF0000', '#8B0000'];
var labels = ['25° Cool', '27°', '30°', '33°', '36°', '39°', '42° Hot'];

for (var i = 0; i < colors.length; i++) {
  var color = colors[i];
  var label = labels[i];
  var row = ui.Panel({
    widgets: [
      ui.Label({style: {backgroundColor: color, padding: '6px', margin: '0'}}),
      ui.Label({value: label, style: {margin: '0 0 0 4px', fontSize: '11px'}})
    ],
    layout: ui.Panel.Layout.Flow('horizontal'),
    style: {margin: '1px 0'}
  });
  legend.add(row);
}

Map.add(legend);

print('✓ Legend added');

// ============================================
// STATISTICS (Fixed to avoid undefined error)
// ============================================

print('');
print('Calculating statistics...');

// Calculate statistics with error handling
var lstStats = lstCelsius.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: kochi,
  scale: 1000,
  maxPixels: 1e10,
  bestEffort: true,
  tileScale: 4
});

var ndviStats = ndviScaled.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: kochi,
  scale: 250,
  maxPixels: 1e10,
  bestEffort: true,
  tileScale: 4
});

print('Temperature statistics:', lstStats);
print('Vegetation statistics:', ndviStats);

print('✓ Statistics calculated');

// ============================================
// EXPORTS
// ============================================

print('');
print('Setting up exports...');

// Export Temperature
Export.image.toDrive({
  image: lstCelsius,
  description: 'Temperature_Kochi',
  folder: 'HeatSafe_Data',
  region: kochi,
  scale: 1000,
  crs: 'EPSG:4326',
  maxPixels: 1e10,
  fileFormat: 'GeoTIFF'
});

// Export Vegetation
Export.image.toDrive({
  image: ndviScaled,
  description: 'Vegetation_Kochi',
  folder: 'HeatSafe_Data',
  region: kochi,
  scale: 250,
  crs: 'EPSG:4326',
  maxPixels: 1e10,
  fileFormat: 'GeoTIFF'
});

// Export Statistics
var statsFeature = ee.Feature(null, {
  'date_from': startDate,
  'date_to': endDate,
  'region': 'Kochi',
  'avg_temperature_C': lstStats.get('LST_Day_1km'),
  'avg_vegetation_NDVI': ndviStats.get('NDVI')
});

Export.table.toDrive({
  collection: ee.FeatureCollection([statsFeature]),
  description: 'Statistics_Kochi',
  folder: 'HeatSafe_Data',
  fileFormat: 'CSV'
});

print('');
print('========================================');
print('✅ SUCCESS! All layers loaded.');
print('');
print('📋 Next steps:');
print('   1. Go to TASKS tab (right panel)');
print('   2. Click RUN on each export:');
print('      • Temperature_Kochi');
print('      • Vegetation_Kochi');
print('      • Statistics_Kochi');
print('   3. Check Google Drive → HeatSafe_Data');
print('========================================');
