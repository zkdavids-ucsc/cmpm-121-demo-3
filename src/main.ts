import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
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
interface Momento<T> {
  toMomento(): T;
  fromMomento(momento: T): void;
}

// Location of our classroom (as identified on Google Maps)
const LOCATION = leaflet.latLng(36.98949379578401, -122.06277128548504);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_WIDTH = 1e-4;
const TILE_VISIBILITY_RADIUS = 6;
const CACHE_SPAWN_PROBABILITY = 0.1;
// const STORAGE_KEY = "gamestate-key";

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

// Display the player's points
const playerCoins: Coin[] = [];
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!; // element `statusPanel` is defined in index.html
statusPanel.innerHTML = "No coins yet...";

function updatePoints() {
  statusPanel.innerHTML = "You have " + playerCoins.length + ` coins: `;
  playerCoins.forEach((coin) => {
    statusPanel.innerHTML += `<br>${coin.i}:${coin.j}#${coin.serial}`;
  });
}

// Add a marker to represent the
let playerPosition = LOCATION;
const playerMarker = leaflet.marker(LOCATION);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);
let playerPath: leaflet.LatLng[] = [LOCATION];
// let geolocationId: number | null = null;
let playerPolyLine: leaflet.playerPolyLine | null = leaflet.polyline(
  playerPath,
);

//player movement
function movePlayer(i: number, j: number) {
  playerPosition = leaflet.latLng({
    lat: playerPosition.lat + i * TILE_WIDTH,
    lng: playerPosition.lng + j * TILE_WIDTH,
  });
  playerMarker.setLatLng(playerPosition);
  map.panTo(playerPosition);
  playerPath.push(leaflet.latLng(playerPosition.lat, playerPosition.lng));
  updatePlayerPath();
  updateCaches();
}

function updatePlayerPath() {
  if (playerPolyLine) {
    map.removeLayer(playerPolyLine);
  }
  playerPolyLine = leaflet.polyline(playerPath, { color: "red" }).addTo(map);
}

document
  .querySelector<HTMLButtonElement>("#north")
  ?.addEventListener("click", () => {
    movePlayer(1, 0);
  });
document
  .querySelector<HTMLButtonElement>("#south")
  ?.addEventListener("click", () => {
    movePlayer(-1, 0);
  });
document
  .querySelector<HTMLButtonElement>("#east")
  ?.addEventListener("click", () => {
    movePlayer(0, 1);
  });
document
  .querySelector<HTMLButtonElement>("#west")
  ?.addEventListener("click", () => {
    movePlayer(0, -1);
  });
document
  .querySelector<HTMLButtonElement>("#reset")
  ?.addEventListener("click", () => {
    playerPosition = LOCATION;
    playerMarker.setLatLng(playerPosition);
    map.panTo(playerPosition);
    playerPath = [playerPosition];
    map.removeLayer(playerPolyLine);
    updateCaches();
  });

let nearbyCaches: Cache[] = [];
const cacheMemory: Map<Cell, string> = new Map<Cell, string>();

class Cache implements Momento<string> {
  private cell: Cell;
  private coins: Coin[];
  private area: leaflet.Rectangle;
  constructor(cell: Cell) {
    this.cell = cell;
    this.coins = [];
    this.area = leaflet.rectangle(
      leaflet.latLngBounds(leaflet.latLng(0, 0), leaflet.latLng(0, 0)),
    );
  }
  toMomento() {
    return JSON.stringify(this.coins);
  }

  fromMomento(momento: string) {
    this.coins = JSON.parse(momento);
    this.area = this.createArea();
  }

  createNew() {
    const pointValue = Math.floor(
      luck([this.cell.i, this.cell.j, "initialValue"].toString()) * 100,
    );

    for (let k = 0; k < pointValue; k++) {
      this.coins[k] = {
        i: this.cell.i,
        j: this.cell.j,
        serial: k,
      };
    }
    this.area = this.createArea();
  }

  createArea(): leaflet.Rectangle {
    this.deleteArea();

    const area = leaflet.rectangle(board.getCellBounds(this.cell));
    area.addTo(map);

    // Handle interactions with the cache
    area.bindPopup(() => {
      // The popup offers a description and button
      const popupDiv = document.createElement("div");
      popupDiv.innerHTML = `
                <div>There is a cache here at "${this.cell.i},${this.cell.j}". It has value <span id="value">${this.coins.length}</span>.</div>
                <button id="collect">collect</button><button id="deposit">deposit</button>`;

      // Collecting coins from a cache
      popupDiv
        .querySelector<HTMLButtonElement>("#collect")!
        .addEventListener("click", () => {
          if (this.coins.length > 0) {
            //scuffed but it was giving me errors before
            const temp = this.coins.pop();
            if (temp) {
              playerCoins.push(temp);
            }
            popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = this
              .coins.length.toString();
            cacheMemory.set(this.cell, this.toMomento());
            updatePoints();
          }
        });
      // Deposit Coins onto a cache
      popupDiv
        .querySelector<HTMLButtonElement>("#deposit")!
        .addEventListener("click", () => {
          if (playerCoins.length > 0) {
            const temp = playerCoins.pop();
            if (temp) {
              this.coins.push(temp);
            }
            popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = this
              .coins.length.toString();
            cacheMemory.set(this.cell, this.toMomento());
            updatePoints();
          } else {
            statusPanel.innerHTML = `Not enough points to deposit :(`;
          }
        });

      return popupDiv;
    });
    return area;
  }

  deleteArea() {
    this.area.remove();
  }
}

// function saveGame(){
//   const gamestate = {
//     playerPosition,
//     playerCoins,
//   }
// }
// function loadGame(){

// }

//startup
const board = new Board(TILE_WIDTH, TILE_VISIBILITY_RADIUS);

updateCaches();

function updateCaches() {
  nearbyCaches.forEach((cache) => {
    cache.deleteArea();
  });
  nearbyCaches = [];

  board.getCellsNearPoint(playerPosition).forEach((cell) => {
    if (luck([cell.i, cell.j].toString()) < CACHE_SPAWN_PROBABILITY) {
      nearbyCaches.push(spawnCache(cell));
    }
  });
}

// Add caches to the map by cells
function spawnCache(cell: Cell): Cache {
  const cache = new Cache(cell);
  if (cacheMemory.has(cell)) {
    cache.fromMomento(cacheMemory.get(cell)!);
  } else {
    cache.createNew();
  }
  return cache;
}
