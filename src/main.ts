// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

// Deterministic random number generator
import luck from "./luck.ts";

import "./board.ts";
import { Board } from "./board.ts";

interface Cell {
  readonly i: number;
  readonly j: number;
}
interface Coin {
  readonly i: number;
  readonly j: number;
  readonly serial: number;
}

// Location of our classroom (as identified on Google Maps)
const LOCATION = leaflet.latLng(36.98949379578401, -122.06277128548504);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_WIDTH = 1e-4;
const TILE_VISIBILITY_RADIUS = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

// Create the map (element with id "map" is defined in index.html)
const map = leaflet.map(document.getElementById("map")!, {
  center: LOCATION,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Populate the map with a background tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Add a marker to represent the player
const playerMarker = leaflet.marker(LOCATION);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

// Display the player's points
const playerCoins: Coin[] = [];
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!; // element `statusPanel` is defined in index.html
statusPanel.innerHTML = "No points yet...";

function updatePoints() {
  statusPanel.innerHTML = "You have " + playerCoins.length + ` coins: `;
  playerCoins.forEach((coin) => {
    statusPanel.innerHTML += `<br>${coin.i}:${coin.j}#${coin.serial}`;
  });
}

//Create board
const board = new Board(TILE_WIDTH, TILE_VISIBILITY_RADIUS);
board.getCellsNearPoint(LOCATION).forEach((cell) => {
  if (luck([cell.i, cell.j].toString()) < CACHE_SPAWN_PROBABILITY) {
    spawnCache(cell);
  }
});

// Add caches to the map by cells
function spawnCache(cell: Cell) {
  // Add cache (a rectangle) to the map where the cell is
  const cache: leaflet.Rectangle = leaflet.rectangle(
    board.getCellBounds(cell),
  );
  cache.addTo(map);

  // Handle interactions with the cache
  cache.bindPopup(() => {
    // Each cache has a random point value, mutable by the player
    const pointValue = Math.floor(
      luck([cell.i, cell.j, "initialValue"].toString()) * 100,
    );

    // The popup offers a description and button
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
                <div>There is a cache here at "${cell.i},${cell.j}". It has value <span id="value">${pointValue}</span>.</div>
                <button id="collect">collect</button><button id="deposit">deposit</button>`;

    const cacheCoins: Coin[] = [];
    for (let k = 0; k < pointValue; k++) {
      cacheCoins[k] = {
        i: cell.i,
        j: cell.j,
        serial: k,
      };
    }

    // Collecting coins from a cache
    popupDiv
      .querySelector<HTMLButtonElement>("#collect")!
      .addEventListener("click", () => {
        if (cacheCoins.length > 0) {
          //scuffed but it was giving me errors before
          const temp = cacheCoins.pop();
          if (temp) {
            playerCoins.push(temp);
          }
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            cacheCoins.length.toString();
          updatePoints();
        } else {
          statusPanel.innerHTML = `No more points to collect!`;
        }
      });
    // Deposit Coins onto a cache
    popupDiv
      .querySelector<HTMLButtonElement>("#deposit")!
      .addEventListener("click", () => {
        if (playerCoins.length > 0) {
          const temp = playerCoins.pop();
          if (temp) {
            cacheCoins.push(temp);
          }
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            cacheCoins.length.toString();
          updatePoints();
        } else {
          statusPanel.innerHTML = `Not enough points to deposit :(`;
        }
      });

    return popupDiv;
  });
}
