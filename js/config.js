/* ============================================================
   RAKSHAGRID DIGITAL — config.js
   Shared, non-sensitive data used by the UI and 3D scenes.
   All values are conceptual UI data — NOT real infrastructure.
   ============================================================ */
(function () {
  "use strict";

  /* Featured Indian cities — conceptual UI nodes only. */
  var CITIES = [
    { name: "Ahmedabad", lat: 23.0225, lon: 72.5714, primary: true },
    { name: "Mumbai", lat: 19.0760, lon: 72.8777, primary: true },
    { name: "Delhi", lat: 28.6139, lon: 77.2090, primary: true },
    { name: "Bengaluru", lat: 12.9716, lon: 77.5946, primary: true },
    { name: "Hyderabad", lat: 17.3850, lon: 78.4867, primary: false },
    { name: "Chennai", lat: 13.0827, lon: 80.2707, primary: false },
    { name: "Pune", lat: 18.5204, lon: 73.8567, primary: false },
    { name: "Surat", lat: 21.1702, lon: 72.8311, primary: false },
    { name: "Jaipur", lat: 26.9124, lon: 75.7873, primary: false },
    { name: "Kolkata", lat: 22.5726, lon: 88.3639, primary: false }
  ];

  /* Simplified, stylised outline of India as [lon, lat] pairs.
     Intentionally abstract — a brand graphic, not a survey map. */
  var INDIA_OUTLINE = [
    [68.2, 23.7], [68.8, 24.3], [70.0, 24.3], [70.6, 25.8], [71.0, 27.0],
    [72.0, 28.1], [73.0, 29.6], [74.5, 31.0], [74.0, 32.5], [73.9, 34.6],
    [75.2, 35.5], [76.6, 35.0], [78.0, 34.4], [79.1, 33.0], [79.6, 31.0],
    [81.0, 30.3], [83.0, 29.0], [85.2, 28.0], [88.0, 27.0], [88.9, 26.5],
    [88.0, 25.4], [89.1, 24.5], [90.6, 24.0], [91.6, 25.0], [92.6, 25.0],
    [93.6, 25.6], [94.6, 27.0], [95.6, 27.6], [97.0, 28.1], [96.4, 27.0],
    [97.4, 26.5], [97.0, 25.4], [95.0, 24.0], [94.0, 23.4], [93.5, 22.4],
    [92.5, 22.0], [91.5, 22.5], [90.5, 22.0], [89.0, 21.5], [87.5, 21.6],
    [86.5, 20.0], [85.0, 19.5], [83.5, 17.5], [82.0, 16.6], [80.5, 15.5],
    [80.1, 13.6], [79.6, 11.5], [78.5, 10.5], [77.6, 8.5], [77.1, 8.1],
    [76.5, 9.0], [75.5, 11.0], [74.5, 13.0], [73.5, 15.0], [72.8, 17.0],
    [72.6, 19.0], [72.8, 20.5], [72.5, 21.5], [71.0, 21.0], [70.0, 20.5],
    [69.0, 22.0], [68.5, 23.0]
  ];

  /* Projection bounds — keeps the silhouette centred and upright. */
  var GEO = { lonMin: 67, lonMax: 98, latMin: 7, latMax: 36, scale: 1 };

  /* Project lon/lat into a centred [-1,1]-ish coordinate space. */
  function project(lon, lat) {
    var x = (lon - (GEO.lonMin + GEO.lonMax) / 2) / ((GEO.lonMax - GEO.lonMin) / 2);
    var y = (lat - (GEO.latMin + GEO.latMax) / 2) / ((GEO.latMax - GEO.latMin) / 2);
    return { x: x, y: y };
  }

  /* Ray-casting point-in-polygon test (used to fill the silhouette). */
  function pointInPoly(x, y, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1];
      var xj = poly[j][0], yj = poly[j][1];
      var intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  window.RG = {
    CITIES: CITIES,
    INDIA_OUTLINE: INDIA_OUTLINE,
    GEO: GEO,
    project: project,
    pointInPoly: pointInPoly,
    /* Safe localStorage helpers — never store sensitive values. */
    store: {
      get: function (key, fallback) {
        try {
          var raw = window.localStorage.getItem("rg_" + key);
          return raw === null ? fallback : JSON.parse(raw);
        } catch (e) { return fallback; }
      },
      set: function (key, value) {
        try { window.localStorage.setItem("rg_" + key, JSON.stringify(value)); return true; }
        catch (e) { return false; }
      },
      remove: function (key) {
        try { window.localStorage.removeItem("rg_" + key); } catch (e) {}
      },
      clearAll: function () {
        try {
          Object.keys(window.localStorage).forEach(function (k) {
            if (k.indexOf("rg_") === 0) window.localStorage.removeItem(k);
          });
        } catch (e) {}
      }
    }
  };
})();
