async function _searchHandler(event) {
  event.preventDefault();
  event.stopPropagation();
  $("#results").html("<h3>Analysing...</h3>");
  const query = document.querySelector("input[type=search]").value;
  const link = document.querySelector("#mapLink");
  link.href = `https://nominatim.openstreetmap.org/search.php?polygon_geojson=1n&q=${query}`;
  try {
    const results = await searchAndTile(query);
    window.results = results;

    // Summary
    const dataStr = encodeURIComponent(JSON.stringify(results.tiles));
    const fname = `${query}.geojson`;
    $("#results").html(
      $(`<p>
        Tiled with ${results.tiles.features.length} squares: 
        <a href="data:text/json;charset=utf-8,${dataStr}" download="${fname}">${fname}</a>
      </p>`),
    );

    // Map
    const center = turf.center(results.region).geometry.coordinates;
    const bbox = turf.bbox(results.region);
    const zoom = 10;
    $("#results").append($(`<div id="map"></div>`));
    const map = L.map("map", { center: [center[1], center[0]], zoom });
    map.fitBounds([
      [bbox[1], bbox[0]],
      [bbox[3], bbox[2]],
    ]);
    window.map = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);
    L.geoJSON(results.region).addTo(map);
    L.geoJSON(results.tiles).addTo(map);
  } catch (err) {
    document.querySelector("#results").innerText =
      "Analysis Failed, search term probably did not return useful data. Please check spelling.";
    console.error(err);
  }
}

/**
 * Approximates the interior of a geographic area with uniform squares.
 * The search queries open street map and uses the first result, if any.
 * All returned rectangles must fit entirely within the polygon so coverage is
 * better with a smaller stride length (but takes more time).
 * @param {string} query Location search string
 * @param {number=0.01} stride Side length of tiles
 * @param {boolean=true} round Whether to round output coordinates to strides precision
 * @returns {number[][]} List of rectangles in the form [x, y, x2, y2]
 */
async function searchAndTile(query, stride = 0.005) {
  const poly = await searchForGeoPolygon(query);
  return tileGeoPolygon(poly, stride);
}

/**
 * Queries open street map and returns the GeoJSON polygon of the first result, if any.
 * @param {string} query Location search string
 * @returns {number[][]} GeoJSON polygon
 */
async function searchForGeoPolygon(query) {
  const url = `https://nominatim.openstreetmap.org/search.php?polygon_geojson=1&format=json&q=${query}`;
  const response = await fetch(url);
  const data = await response.json();
  let points = data[0].geojson.coordinates[0];
  if (points.length === 1) points = points[0];
  console.log(`Found region with ${points.length} points`);
  return points;
}

/**
 * Approximates the interior of a GeoJSON polygon with uniform squares.
 * All returned rectangles must fit entirely within the polygon so coverage is
 * better with a smaller stride length (but takes more time).
 * @param {number[][]} poly GeoJSON polygon to tile
 * @param {number} stride Side length of tiles
 * @returns {number[][]} List of rectangles in the form [x, y, x2, y2]
 */
function tileGeoPolygon(poly, stride) {
  const pointsX = poly.map((p) => p[0]);
  const pointsY = poly.map((p) => p[1]);
  const polyMinX = Math.min(...pointsX);
  const polyMinY = Math.min(...pointsY);
  const polyMaxX = Math.max(...pointsX);
  const polyMaxY = Math.max(...pointsY);

  console.log("Min X: ", polyMinX);
  console.log("Max X: ", polyMaxX);
  console.log("Min Y: ", polyMinY);
  console.log("Max Y: ", polyMaxY);
  console.log("Tileing with stride: ", stride);

  // Leave a slight margin to avoid excessive clipping on first row/column
  const startX = polyMinX + stride / 2;
  const startY = polyMinY + stride / 2;

  const polyTurf = turf.polygon([poly]);

  let rects = [];
  let possible = 0;

  // Scan all possible rectangles within bounding box
  let x = startX;
  while (x + stride < polyMaxX) {
    let y = startY;
    while (y + stride < polyMaxY) {
      // Check if rectangle is complexly within polygon
      const rectBB = [x, y, x + stride, y + stride];
      const rectTurf = turf.bboxPolygon(rectBB);
      if (turf.booleanWithin(rectTurf, polyTurf)) {
        rects.push(rectTurf);
        // console.log("Inside: ", rectBB);
      } else {
        // console.log("Outside: ", rectBB);
      }
      possible++;
      y += stride;
    }
    x += stride;
  }
  return {
    region: polyTurf,
    tiles: turf.featureCollection(rects),
    stride,
    possible,
  };
}
