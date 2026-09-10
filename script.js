const BUSINESS_ADDRESS = "9 Square Léopold Fabre, 81250 Curvalle, France";
const PHOTON_API = "https://photon.komoot.io/api/";
const OSRM_API = "https://router.project-osrm.org/route/v1/driving";

const form = document.getElementById("calculator-form");
const addressInput = document.getElementById("address");
const button = document.getElementById("calculate-button");
const statusBox = document.getElementById("status");
const resultBox = document.getElementById("result");
const distanceValue = document.getElementById("distance-value");
const priceValue = document.getElementById("price-value");
const routeInfo = document.getElementById("route-info");
const suggestionsBox = document.getElementById("suggestions");
const fitRouteButton = document.getElementById("fit-route-button");

const map = L.map("map", {
  scrollWheelZoom: true
}).setView([43.93, 2.46], 10);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

let businessLocation = null;
let selectedDestination = null;
let destinationMarker = null;
let businessMarker = null;
let routeLayer = null;
let routeBounds = null;
let currentSuggestions = [];
let activeSuggestionIndex = -1;
let autocompleteTimer = null;
let autocompleteController = null;

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle("error", isError);
}

function getTravelPrice(distanceKm) {
  if (distanceKm <= 10) return 0;
  if (distanceKm <= 20) return 15;
  if (distanceKm <= 30) return 30;

  return 30 + ((distanceKm - 30) * 0.60);
}

function formatPrice(value) {
  if (value === 0) return "Gratuit";

  return `≈ ${value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} €`;
}

function escapeHtml(value = "") {
  return value.replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[character];
  });
}

function formatPhotonFeature(feature) {
  const p = feature.properties || {};

  const titleParts = [];
  if (p.housenumber) titleParts.push(p.housenumber);
  if (p.street) titleParts.push(p.street);

  let title = titleParts.join(" ").trim();

  if (!title) {
    title = p.name || p.city || p.town || p.village || p.locality || "Adresse";
  }

  const detailParts = [];
  if (p.postcode) detailParts.push(p.postcode);

  const city = p.city || p.town || p.village || p.locality || p.county;
  if (city && !title.includes(city)) detailParts.push(city);

  if (p.state && !detailParts.includes(p.state)) detailParts.push(p.state);
  if (p.country) detailParts.push(p.country);

  return {
    title,
    detail: detailParts.join(", "),
    full: [title, detailParts.join(", ")].filter(Boolean).join(", ")
  };
}

function hideSuggestions() {
  suggestionsBox.classList.add("hidden");
  suggestionsBox.innerHTML = "";
  currentSuggestions = [];
  activeSuggestionIndex = -1;
  addressInput.setAttribute("aria-expanded", "false");
  addressInput.setAttribute("aria-activedescendant", "");
}

function renderSuggestions(features) {
  currentSuggestions = features;
  activeSuggestionIndex = -1;
  suggestionsBox.innerHTML = "";

  if (!features.length) {
    hideSuggestions();
    return;
  }

  features.forEach((feature, index) => {
    const formatted = formatPhotonFeature(feature);

    const item = document.createElement("li");
    item.className = "suggestion";
    item.id = `suggestion-${index}`;
    item.setAttribute("role", "option");

    const suggestionButton = document.createElement("button");
    suggestionButton.type = "button";
    suggestionButton.innerHTML = `
      <span class="suggestion-title">${escapeHtml(formatted.title)}</span>
      <span class="suggestion-detail">${escapeHtml(formatted.detail)}</span>
    `;

    suggestionButton.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });

    suggestionButton.addEventListener("click", () => {
      chooseSuggestion(index);
    });

    item.appendChild(suggestionButton);
    suggestionsBox.appendChild(item);
  });

  suggestionsBox.classList.remove("hidden");
  addressInput.setAttribute("aria-expanded", "true");
}

function setActiveSuggestion(index) {
  if (!currentSuggestions.length) return;

  activeSuggestionIndex = Math.max(0, Math.min(index, currentSuggestions.length - 1));

  [...suggestionsBox.children].forEach((element, itemIndex) => {
    const isActive = itemIndex === activeSuggestionIndex;
    element.classList.toggle("active", isActive);
    element.setAttribute("aria-selected", String(isActive));
  });

  const activeId = `suggestion-${activeSuggestionIndex}`;
  addressInput.setAttribute("aria-activedescendant", activeId);

  document.getElementById(activeId)?.scrollIntoView({
    block: "nearest"
  });
}

async function searchPhoton(query, limit = 6) {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    lang: "fr",
    lat: "43.93",
    lon: "2.46"
  });

  const response = await fetch(`${PHOTON_API}?${params.toString()}`, {
    signal: autocompleteController?.signal,
    headers: {
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Le service de recherche d’adresse est momentanément indisponible.");
  }

  const data = await response.json();
  return Array.isArray(data.features) ? data.features : [];
}

async function getBusinessLocation() {
  if (businessLocation) return businessLocation;

  const oldController = autocompleteController;
  autocompleteController = null;

  const params = new URLSearchParams({
    q: BUSINESS_ADDRESS,
    limit: "1",
    lang: "fr"
  });

  const response = await fetch(`${PHOTON_API}?${params.toString()}`, {
    headers: { "Accept": "application/json" }
  });

  autocompleteController = oldController;

  if (!response.ok) {
    throw new Error("Impossible de localiser le point de départ à Curvalle.");
  }

  const data = await response.json();

  if (!data.features?.length) {
    throw new Error("Le point de départ AG Informatique 81 n’a pas pu être localisé.");
  }

  const [lon, lat] = data.features[0].geometry.coordinates;
  businessLocation = { lat, lon };

  if (!businessMarker) {
    businessMarker = L.marker([lat, lon])
      .addTo(map)
      .bindPopup("<strong>AG Informatique 81</strong><br>Départ à Curvalle");
  }

  return businessLocation;
}

async function getRoute(origin, destination) {
  const coordinates = `${origin.lon},${origin.lat};${destination.lon},${destination.lat}`;
  const url =
    `${OSRM_API}/${coordinates}` +
    "?overview=full&geometries=geojson&steps=false&alternatives=false";

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Impossible de calculer l’itinéraire pour le moment.");
  }

  const data = await response.json();

  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error("Aucun itinéraire routier n’a été trouvé.");
  }

  return data.routes[0];
}

function drawDestination(destination, label) {
  if (destinationMarker) {
    destinationMarker.remove();
  }

  destinationMarker = L.marker([destination.lat, destination.lon])
    .addTo(map)
    .bindPopup(`<strong>Intervention</strong><br>${escapeHtml(label)}`);

  map.setView([destination.lat, destination.lon], 16);
  destinationMarker.openPopup();
}

function drawRoute(route) {
  if (routeLayer) {
    routeLayer.remove();
  }

  routeLayer = L.geoJSON(route.geometry, {
    style: {
      weight: 6,
      opacity: 0.82
    }
  }).addTo(map);

  routeBounds = routeLayer.getBounds();
  map.fitBounds(routeBounds, {
    padding: [35, 35]
  });

  fitRouteButton.classList.remove("hidden");
}

async function calculateForDestination(destination, label) {
  button.disabled = true;
  resultBox.classList.add("hidden");
  setStatus("Calcul de l’itinéraire depuis Curvalle…");

  try {
    const origin = await getBusinessLocation();
    const route = await getRoute(origin, destination);
    const distanceKm = route.distance / 1000;
    const roundedDistance = Math.round(distanceKm * 10) / 10;
    const travelPrice = getTravelPrice(distanceKm);

    drawDestination(destination, label);
    drawRoute(route);

    distanceValue.textContent = `${roundedDistance.toLocaleString("fr-FR")} km`;
    priceValue.textContent = formatPrice(travelPrice);
    routeInfo.textContent =
      `Trajet aller depuis Curvalle vers ${label}. ` +
      "Estimation indicative, sous réserve de confirmation par AG Informatique 81.";

    resultBox.classList.remove("hidden");
    setStatus("");
  } catch (error) {
    setStatus(error.message || "Une erreur est survenue pendant le calcul.", true);
  } finally {
    button.disabled = false;
  }
}

function chooseSuggestion(index) {
  const feature = currentSuggestions[index];
  if (!feature) return;

  const [lon, lat] = feature.geometry.coordinates;
  const formatted = formatPhotonFeature(feature);

  selectedDestination = {
    lat,
    lon,
    label: formatted.full,
    feature
  };

  addressInput.value = formatted.full;
  hideSuggestions();

  drawDestination(selectedDestination, formatted.full);
  calculateForDestination(selectedDestination, formatted.full);
}

async function runAutocomplete() {
  const query = addressInput.value.trim();

  selectedDestination = null;

  if (query.length < 3) {
    hideSuggestions();
    return;
  }

  if (autocompleteController) {
    autocompleteController.abort();
  }

  autocompleteController = new AbortController();

  try {
    const features = await searchPhoton(query);

    if (addressInput.value.trim() !== query) return;

    renderSuggestions(features);
  } catch (error) {
    if (error.name !== "AbortError") {
      hideSuggestions();
    }
  }
}

addressInput.addEventListener("input", () => {
  clearTimeout(autocompleteTimer);

  autocompleteTimer = setTimeout(() => {
    runAutocomplete();
  }, 320);
});

addressInput.addEventListener("keydown", (event) => {
  if (suggestionsBox.classList.contains("hidden")) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    setActiveSuggestion(
      activeSuggestionIndex < currentSuggestions.length - 1
        ? activeSuggestionIndex + 1
        : 0
    );
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    setActiveSuggestion(
      activeSuggestionIndex > 0
        ? activeSuggestionIndex - 1
        : currentSuggestions.length - 1
    );
  }

  if (event.key === "Enter" && activeSuggestionIndex >= 0) {
    event.preventDefault();
    chooseSuggestion(activeSuggestionIndex);
  }

  if (event.key === "Escape") {
    hideSuggestions();
  }
});

addressInput.addEventListener("focus", () => {
  if (currentSuggestions.length) {
    suggestionsBox.classList.remove("hidden");
    addressInput.setAttribute("aria-expanded", "true");
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".address-wrap")) {
    hideSuggestions();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const query = addressInput.value.trim();

  if (!query) {
    setStatus("Veuillez saisir une adresse.", true);
    return;
  }

  if (selectedDestination) {
    await calculateForDestination(selectedDestination, selectedDestination.label);
    return;
  }

  button.disabled = true;
  setStatus("Recherche de l’adresse…");

  try {
    const params = new URLSearchParams({
      q: query,
      limit: "1",
      lang: "fr",
      lat: "43.93",
      lon: "2.46"
    });

    const response = await fetch(`${PHOTON_API}?${params.toString()}`);
    const data = await response.json();

    if (!response.ok || !data.features?.length) {
      throw new Error("Adresse introuvable. Choisissez de préférence une proposition affichée.");
    }

    const feature = data.features[0];
    const [lon, lat] = feature.geometry.coordinates;
    const formatted = formatPhotonFeature(feature);

    selectedDestination = {
      lat,
      lon,
      label: formatted.full,
      feature
    };

    addressInput.value = formatted.full;
    hideSuggestions();

    await calculateForDestination(selectedDestination, formatted.full);
  } catch (error) {
    setStatus(error.message || "Adresse introuvable.", true);
  } finally {
    button.disabled = false;
  }
});

fitRouteButton.addEventListener("click", () => {
  if (routeBounds) {
    map.fitBounds(routeBounds, {
      padding: [35, 35]
    });
  }
});

getBusinessLocation()
  .then((origin) => {
    map.setView([origin.lat, origin.lon], 12);
  })
  .catch(() => {
    // La carte reste utilisable même si le point de départ ne se charge pas immédiatement.
  });
