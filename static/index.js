$(document).ready(async function () {
  const params = new URLSearchParams(window.location.search);
  if (params.has("q")) {
    const q = params.get("q");
    if (q && q !== "") {
      $("#search input[type=search]").val(q);

      try {
        await _search(q);
      } catch (err) {
        $("#results").html(
          "<p class='error'>Analysis Failed, search term probably did not return useful data. Please check spelling.</p>",
        );
        console.error(err);
      }
    }
  }
});

async function _search(query) {
  // Set external map link
  const link = document.querySelector("#mapLink");
  link.href = `https://nominatim.openstreetmap.org/search.php?polygon_geojson=1n&q=${query}`;

  // Analyse
  $("#results").html("<h3>Analysing...</h3>");
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
}
