const BUSINESS_ADDRESS = "9 Square Léopold Fabre, 81250 Curvalle, France";

const form = document.getElementById("calculator-form");
const addressInput = document.getElementById("address");
const button = document.getElementById("calculate-button");
const statusBox = document.getElementById("status");
const resultBox = document.getElementById("result");
const distanceValue = document.getElementById("distance-value");
const priceValue = document.getElementById("price-value");
const routeInfo = document.getElementById("route-info");

let cachedBusinessLocation = null;

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle("error", isError);
}

function getTravelPrice(distanceKm) {
  if (distanceKm <= 10) {
    return "Gratuit";
  }

  if (distanceKm <= 20) {
    return "15 €";
  }

  if (distanceKm <= 30) {
    return "30 €";
  }

  return "Sur devis";
}

async function geocode(address) {
  const params = new URLSearchParams({
    format: "jsonv2",
    q: address,
    limit: "1",
    countrycodes: "fr"
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    {
      headers: {
        "Accept": "application/json",
        "Accept-Language": "fr"
      }
    }
  );

  if (!response.ok) {
    throw new Error("Le service de recherche d’adresse est momentanément indisponible.");
  }

  const results = await response.json();

  if (!results.length) {
    throw new Error("Adresse introuvable. Vérifiez l’adresse, la commune et le code postal.");
  }

  return {
    lat: Number(results[0].lat),
    lon: Number(results[0].lon),
    displayName: results[0].display_name
  };
}

async function getBusinessLocation() {
  if (cachedBusinessLocation) {
    return cachedBusinessLocation;
  }

  cachedBusinessLocation = await geocode(BUSINESS_ADDRESS);
  return cachedBusinessLocation;
}

async function getRoadDistanceKm(origin, destination) {
  const coordinates = `${origin.lon},${origin.lat};${destination.lon},${destination.lat}`;
  const url =
    `https://router.project-osrm.org/route/v1/driving/${coordinates}` +
    "?overview=false&alternatives=false&steps=false";

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Impossible de calculer l’itinéraire pour le moment.");
  }

  const data = await response.json();

  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error("Aucun itinéraire routier n’a été trouvé pour cette adresse.");
  }

  return data.routes[0].distance / 1000;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const customerAddress = addressInput.value.trim();

  if (!customerAddress) {
    setStatus("Veuillez saisir une adresse.", true);
    return;
  }

  button.disabled = true;
  resultBox.classList.add("hidden");
  setStatus("Recherche de l’adresse et calcul de l’itinéraire…");

  try {
    const business = await getBusinessLocation();

    // Petite pause pour rester courtois avec le service public Nominatim.
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const customer = await geocode(customerAddress);
    const distanceKm = await getRoadDistanceKm(business, customer);
    const roundedDistance = Math.round(distanceKm * 10) / 10;

    distanceValue.textContent = `${roundedDistance.toLocaleString("fr-FR")} km`;
    priceValue.textContent = getTravelPrice(distanceKm);
    routeInfo.textContent = `Adresse trouvée : ${customer.displayName}`;

    resultBox.classList.remove("hidden");
    setStatus("");
  } catch (error) {
    setStatus(error.message || "Une erreur est survenue pendant le calcul.", true);
  } finally {
    button.disabled = false;
  }
});
