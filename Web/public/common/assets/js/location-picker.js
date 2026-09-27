/**
 * Map location picker shared by the admin (Settings > General) and the storefront (checkout, addresses).
 * OpenLayers with OpenStreetMap tiles; addresses come from Nominatim.
 *
 * Defaults come from the page: window.storeLocale (search country = locale region, result language)
 * and window.storeLocation (the store's map pin, used as the initial center).
 */
window.initLocationPicker = function(options) {
  options = options || {};

  const resolve = (target, fallbackSelector) => {
    if (typeof target === "string") return document.querySelector(target);
    return target || (fallbackSelector ? document.querySelector(fallbackSelector) : null);
  };

  const mapElement = resolve(options.mapTarget, "#boxMap");
  if (!mapElement) return null;

  const searchInput = resolve(options.searchInput, "#mapSearchInput");
  const searchBtn = resolve(options.searchBtn, "#mapSearchBtn");
  const addressInput = resolve(options.addressInput, '[name="address"], #shopSenderAddress');
  const latInput = resolve(options.latInput, '[name="latitude"], #shopLat');
  const lngInput = resolve(options.lngInput, '[name="longitude"], #shopLng');
  const clearButton = resolve(options.clearButton);
  let suggestionsBox = resolve(options.suggestionsBox, "#addressSuggestions");

  if (!suggestionsBox && searchInput && searchInput.parentElement) {
    suggestionsBox = document.createElement("div");
    suggestionsBox.id = "addressSuggestions";
    suggestionsBox.className = "list-group position-absolute w-100 shadow bg-white d-none";
    Object.assign(suggestionsBox.style, { zIndex: "1050", maxHeight: "240px", overflowY: "auto", top: "100%", left: "0" });
    searchInput.parentElement.style.position = "relative";
    searchInput.parentElement.appendChild(suggestionsBox);
  }

  // Nominatim search scope and language follow Settings > Storefront (e.g. vi-VN searches Vietnam in Vietnamese).
  const storeLocale = (window.storeLocale && window.storeLocale.locale) || "";
  let countryCode = options.countryCode || "";
  if (!countryCode && storeLocale && typeof Intl.Locale === "function") {
    try { countryCode = new Intl.Locale(storeLocale).region || ""; } catch (e) { countryCode = ""; }
  }
  const acceptLanguage = storeLocale ? `${storeLocale},en` : "en";
  const nominatim = (path, params, signal) => {
    const query = new URLSearchParams(Object.assign({ format: "json" }, params));
    if (path === "search" && countryCode) query.set("countrycodes", countryCode.toLowerCase());
    return fetch(`https://nominatim.openstreetmap.org/${path}?${query}`, {
      signal,
      headers: { "Accept-Language": acceptLanguage }
    }).then((res) => res.json());
  };

  const notifyError = (message) => {
    if (typeof notyf !== "undefined") notyf.error(message);
  };

  let map = null;
  let markerLayer = null;
  let debounceTimer = null;
  let activeAbortController = null;

  const setMarker = (lon, lat) => {
    if (!markerLayer) return;
    markerLayer.getSource().clear();
    const marker = new ol.Feature({ geometry: new ol.geom.Point(ol.proj.fromLonLat([lon, lat])) });
    marker.setStyle(new ol.style.Style({
      image: new ol.style.Icon({
        anchor: [0.5, 1],
        src: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        scale: 0.5
      })
    }));
    markerLayer.getSource().addFeature(marker);
  };

  const focusOn = (lon, lat) => {
    setMarker(lon, lat);
    if (map) map.getView().animate({ center: ol.proj.fromLonLat([lon, lat]), zoom: 16 });
  };

  const updateLocationData = (lon, lat, addressName) => {
    if (latInput) latInput.value = Number(lat).toFixed(6);
    if (lngInput) lngInput.value = Number(lon).toFixed(6);
    if (addressName) {
      if (addressInput) addressInput.value = addressName;
      if (searchInput) searchInput.value = addressName;
    }
    if (typeof options.onLocationSelected === "function") {
      options.onLocationSelected({ lon, lat, addressName });
    }
  };

  const clearPin = () => {
    if (latInput) latInput.value = "";
    if (lngInput) lngInput.value = "";
    if (markerLayer) markerLayer.getSource().clear();
  };

  const hideSuggestions = () => {
    if (!suggestionsBox) return;
    suggestionsBox.classList.add("d-none");
    suggestionsBox.replaceChildren();
  };

  const showMessage = (text, className) => {
    if (!suggestionsBox) return;
    const item = document.createElement("div");
    item.className = `list-group-item py-2 small ${className || "text-muted"}`;
    item.textContent = text;
    suggestionsBox.replaceChildren(item);
    suggestionsBox.classList.remove("d-none");
  };

  // Place names come from a third-party service, so they are set as text, never as HTML.
  const suggestionButton = (item) => {
    const displayName = item.display_name || "";
    const parts = displayName.split(",");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "list-group-item list-group-item-action py-2 text-start border-bottom";

    const title = document.createElement("div");
    title.className = "fw-semibold text-truncate text-dark";
    title.textContent = parts[0].trim();
    btn.appendChild(title);

    const subTitle = parts.slice(1).join(",").trim();
    if (subTitle) {
      const sub = document.createElement("div");
      sub.className = "text-muted small text-truncate";
      sub.textContent = subTitle;
      btn.appendChild(sub);
    }

    btn.addEventListener("click", () => {
      const lon = parseFloat(item.lon);
      const lat = parseFloat(item.lat);
      focusOn(lon, lat);
      updateLocationData(lon, lat, displayName);
      hideSuggestions();
    });
    return btn;
  };

  const fetchSuggestions = (query) => {
    const q = (query || "").trim();
    if (q.length < 2) {
      hideSuggestions();
      return;
    }
    if (!suggestionsBox) return;

    if (activeAbortController) activeAbortController.abort();
    activeAbortController = new AbortController();
    showMessage("Searching...");

    nominatim("search", { q, limit: 5 }, activeAbortController.signal)
      .then((data) => {
        if (!Array.isArray(data) || data.length === 0) {
          showMessage("No matching locations found.");
          return;
        }
        suggestionsBox.replaceChildren(...data.map(suggestionButton));
        suggestionsBox.classList.remove("d-none");
      })
      .catch((err) => {
        if (err.name !== "AbortError") showMessage("Failed to fetch locations. Please try again.", "text-danger");
      });
  };

  const executeSearch = () => {
    const keyword = searchInput ? searchInput.value.trim() : "";
    if (!keyword) {
      notifyError("Please enter a location to search!");
      return;
    }
    if (activeAbortController) activeAbortController.abort();
    hideSuggestions();

    nominatim("search", { q: keyword, limit: 1 })
      .then((data) => {
        if (!Array.isArray(data) || data.length === 0) {
          notifyError("No matching locations found!");
          return;
        }
        const lon = parseFloat(data[0].lon);
        const lat = parseFloat(data[0].lat);
        focusOn(lon, lat);
        updateLocationData(lon, lat, data[0].display_name);
      })
      .catch(() => notifyError("Location search failed!"));
  };

  const initialCenter = () => {
    const lat = latInput ? parseFloat(latInput.value) : NaN;
    const lon = lngInput ? parseFloat(lngInput.value) : NaN;
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lon, lat, zoom: 16, pinned: true };

    const store = window.storeLocation;
    if (store && Number.isFinite(store.lat) && Number.isFinite(store.lng)) return { lon: store.lng, lat: store.lat, zoom: 13 };

    return { lon: 0, lat: 20, zoom: 2 };
  };

  const initOpenLayersMap = () => {
    const center = initialCenter();
    map = new ol.Map({
      target: mapElement,
      layers: [new ol.layer.Tile({ source: new ol.source.OSM() })],
      view: new ol.View({ center: ol.proj.fromLonLat([center.lon, center.lat]), zoom: center.zoom })
    });

    markerLayer = new ol.layer.Vector({ source: new ol.source.Vector() });
    map.addLayer(markerLayer);
    if (center.pinned) setMarker(center.lon, center.lat);

    map.on("click", (event) => {
      const [lon, lat] = ol.proj.toLonLat(event.coordinate);
      setMarker(lon, lat);

      // The pin counts even when the reverse lookup fails; the address is then left for the user to type.
      nominatim("reverse", { lat, lon })
        .then((data) => updateLocationData(lon, lat, data && data.display_name))
        .catch(() => updateLocationData(lon, lat, null));
    });
  };

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchSuggestions(e.target.value), 350);
    });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        clearTimeout(debounceTimer);
        executeSearch();
      } else if (e.key === "Escape") {
        hideSuggestions();
      }
    });
  }

  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      clearTimeout(debounceTimer);
      executeSearch();
    });
  }

  if (clearButton) clearButton.addEventListener("click", clearPin);

  document.addEventListener("click", (e) => {
    if (!suggestionsBox) return;
    const inside = [searchInput, suggestionsBox, searchBtn].some((el) => el && el.contains(e.target));
    if (!inside) hideSuggestions();
  });

  if (typeof ol !== "undefined") {
    initOpenLayersMap();
  } else {
    if (!document.querySelector('link[href*="ol.min.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/openlayers@4.6.5/dist/ol.min.css";
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/openlayers@4.6.5/dist/ol.min.js";
    script.onload = initOpenLayersMap;
    script.onerror = () => notifyError("The map could not be loaded.");
    document.body.appendChild(script);
  }

  return {
    getMap: () => map,
    setMarker
  };
};
