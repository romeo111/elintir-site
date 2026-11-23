/* Airnet-inspired terrain and sky view. Terrarium heights are real DEM metres;
   the terrain's vertical scale and the sky dome are visual conventions. */
(() => {
  "use strict";
  const T = window.THREE;
  const viewport = document.getElementById("terrain-viewport");
  const status = document.getElementById("terrain-status");
  const heightLabel = document.getElementById("terrain-height");
  const tooltip = document.getElementById("terrain-tooltip");
  const reliefSlider = document.getElementById("relief-scale");
  const reliefValue = document.getElementById("relief-value");
  if (!viewport || !T || !T.OrbitControls) {
    if (status) status.textContent = "3D-бібліотека недоступна. Схема неба нижче працює окремо.";
    return;
  }

  const EARTH = 40075016.68557849;
  const TILE = 512;
  const GRID = 81;
  const RADIUS_M = 12000;
  const RADIUS_SCENE = 6.6;
  const DOME_R = 7.7;
  const DOME_Y = 1.25;
  const tileCache = new Map();
  const markers = new Map();
  const GROUP_COLORS = { RASSVET: 0x8ce9e1, BEIDOU: 0xe6be83, CHINESE_COMM: 0xb4a2ed };
  let loadController = null, terrain = null, trail = null, currentKey = "", rows = [];
  let currentPlan = null, currentGrid = null, currentMap = null, reliefFraction = 1;
  let currentSelection = null, shown = true;

  let renderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
  } catch (_) {
    status.textContent = "WebGL недоступний. Користуйтеся плоскою схемою неба нижче.";
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x0b2636, 1);
  renderer.domElement.setAttribute("aria-hidden", "true");
  viewport.appendChild(renderer.domElement);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(43, 1, .1, 100);
  camera.position.set(15, 12, 17);
  const controls = new T.OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 2.2, 0);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 12;
  controls.maxDistance = 36;
  controls.minPolarAngle = .12;
  controls.maxPolarAngle = Math.PI * .49;
  controls.update();

  scene.add(new T.HemisphereLight(0xd8ffff, 0x122531, .9));
  const sun = new T.DirectionalLight(0xffffff, .95);
  sun.position.set(-7, 12, -8);
  scene.add(sun);
  const sky = new T.Group();
  scene.add(sky);
  const ground = new T.Group();
  scene.add(ground);

  function domePoint(az, el) {
    const a = az * Math.PI / 180, e = Math.max(0, el) * Math.PI / 180;
    return new T.Vector3(DOME_R * Math.cos(e) * Math.sin(a),
      DOME_Y + DOME_R * Math.sin(e), -DOME_R * Math.cos(e) * Math.cos(a));
  }
  function line(points, color, opacity, closed = false) {
    const geometry = new T.BufferGeometry().setFromPoints(points);
    const material = new T.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    return closed ? new T.LineLoop(geometry, material) : new T.Line(geometry, material);
  }
  for (const el of [0, 30, 60]) {
    const points = [];
    for (let az = 0; az < 360; az += 4) points.push(domePoint(az, el));
    sky.add(line(points, el === 0 ? 0x64bfca : 0x42717e, el === 0 ? .54 : .32, true));
  }
  for (let az = 0; az < 360; az += 45) {
    const points = [];
    for (let el = 0; el <= 90; el += 5) points.push(domePoint(az, el));
    sky.add(line(points, 0x356270, .25));
  }
  function compassSprite(text) {
    const canvas = document.createElement("canvas");
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#d5f5f2";
    ctx.font = "700 72px Montserrat, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 64, 65);
    const sprite = new T.Sprite(new T.SpriteMaterial({
      map: new T.CanvasTexture(canvas), transparent: true, depthTest: false
    }));
    sprite.scale.set(.7, .7, 1);
    return sprite;
  }
  for (const [label, az] of [["N", 0], ["E", 90], ["S", 180], ["W", 270]]) {
    const sprite = compassSprite(label);
    sprite.position.copy(domePoint(az, 0)).multiplyScalar(1.055);
    sprite.position.y = DOME_Y + .12;
    sky.add(sprite);
  }
  const sitePin = new T.Mesh(new T.ConeGeometry(.15, .42, 8),
    new T.MeshPhongMaterial({ color: 0xffcf84, emissive: 0x5d2d00 }));
  sitePin.rotation.x = Math.PI;
  sitePin.position.y = .3;
  ground.add(sitePin);
  const base = new T.Mesh(new T.CircleGeometry(RADIUS_SCENE, 96),
    new T.MeshBasicMaterial({ color: 0x09232f, side: T.DoubleSide }));
  base.rotation.x = -Math.PI / 2;
  base.position.y = -1.7;
  ground.add(base);

  function planTiles(lat, lon) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
        Math.abs(lat) > 85.05112878 || Math.abs(lon) > 180) throw Error("Рельєф для цих координат недоступний.");
    for (let z = 11; z >= 8; z--) {
      const n = 2 ** z;
      const mpp = EARTH * Math.cos(lat * Math.PI / 180) / (n * TILE);
      const cx = (lon + 180) / 360 * n * TILE;
      const cy = (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n * TILE;
      const x0 = Math.floor((cx - RADIUS_M / mpp - 1) / TILE);
      const x1 = Math.floor((cx + RADIUS_M / mpp + 1) / TILE);
      const y0 = Math.floor((cy - RADIUS_M / mpp - 1) / TILE);
      const y1 = Math.floor((cy + RADIUS_M / mpp + 1) / TILE);
      const tiles = [];
      if (y0 < 0 || y1 >= n) continue;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
        tiles.push({ z, x: ((x % n) + n) % n, y });
      if (tiles.length <= 16) return { z, n, mpp, cx, cy, tiles };
    }
    throw Error("Ділянка завелика для 3D-рельєфу.");
  }
  async function tilePixels(tile, signal) {
    const key = `${tile.z}/${tile.x}/${tile.y}`;
    if (tileCache.has(key)) return tileCache.get(key);
    const response = await fetch(`https://tiles.mapterhorn.com/${key}.webp`, { signal, mode: "cors" });
    if (!response.ok) throw Error(`Тайл висот: HTTP ${response.status}`);
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement("canvas");
    canvas.width = TILE; canvas.height = TILE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, TILE, TILE);
    bitmap.close();
    const pixels = ctx.getImageData(0, 0, TILE, TILE).data;
    tileCache.set(key, pixels);
    if (tileCache.size > 48) tileCache.delete(tileCache.keys().next().value);
    return pixels;
  }
  async function loadTiles(plan, signal) {
    const map = new Map(), queue = [...plan.tiles];
    async function worker() {
      while (queue.length) {
        const tile = queue.shift();
        const pixels = await tilePixels(tile, signal);
        map.set(`${tile.x},${tile.y}`, pixels);
      }
    }
    await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
    return map;
  }
  function pixelHeight(plan, tiles, xp, yp) {
    const tx = ((Math.floor(xp / TILE) % plan.n) + plan.n) % plan.n;
    const ty = Math.floor(yp / TILE);
    const pixels = tiles.get(`${tx},${ty}`);
    if (!pixels) return null;
    const xi = ((xp % TILE) + TILE) % TILE, yi = ((yp % TILE) + TILE) % TILE;
    const k = (yi * TILE + xi) * 4;
    if (pixels[k + 3] === 0) return null;
    return pixels[k] * 256 + pixels[k + 1] + pixels[k + 2] / 256 - 32768;
  }
  function sample(plan, tiles, east, south) {
    const px = plan.cx + east / plan.mpp - .5, py = plan.cy + south / plan.mpp - .5;
    const ix = Math.floor(px), iy = Math.floor(py), ax = px - ix, ay = py - iy;
    let h = 0;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const value = pixelHeight(plan, tiles, ix + i, iy + j);
      if (value === null) return null;
      h += value * (i ? ax : 1 - ax) * (j ? ay : 1 - ay);
    }
    return h;
  }
  function makeGrid(plan, tiles) {
    const heights = [], center = sample(plan, tiles, 0, 0);
    let min = Infinity, max = -Infinity;
    if (center === null) throw Error("У цій точці немає даних висот.");
    for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
      const east = (i / (GRID - 1) * 2 - 1) * RADIUS_M;
      const south = (j / (GRID - 1) * 2 - 1) * RADIUS_M;
      const h = east * east + south * south <= RADIUS_M ** 2 ?
        sample(plan, tiles, east, south) : null;
      heights.push(h);
      if (h !== null) { min = Math.min(min, h); max = Math.max(max, h); }
    }
    return { heights, center, min, max };
  }
  function disposeObject(object) {
    if (!object) return;
    object.traverse(node => {
      if (node.geometry) node.geometry.dispose();
      if (node.material) {
        node.material.map?.dispose();
        node.material.dispose();
      }
    });
    object.parent?.remove(object);
  }
  function drawTerrain(grid) {
    disposeObject(terrain);
    terrain = new T.Group();
    ground.add(terrain);
    const vertices = [], colors = [], indices = [];
    const low = new T.Color(0x163d50), high = new T.Color(0x8ebcb1);
    for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
      const k = j * GRID + i, h = grid.heights[k];
      const x = (i / (GRID - 1) * 2 - 1) * RADIUS_SCENE;
      const z = (j / (GRID - 1) * 2 - 1) * RADIUS_SCENE;
      vertices.push(x, h === null ? -1.7 : (h - grid.center) * .012 * reliefFraction, z);
      const t = h === null ? 0 : Math.max(0, Math.min(1, (h - grid.min) / Math.max(1, grid.max - grid.min)));
      const color = low.clone().lerp(high, t);
      colors.push(color.r, color.g, color.b);
      if (i < GRID - 1 && j < GRID - 1 &&
          [k, k + 1, k + GRID, k + GRID + 1].every(n => grid.heights[n] !== null))
        indices.push(k, k + GRID, k + 1, k + 1, k + GRID, k + GRID + 1);
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    terrain.add(new T.Mesh(geometry,
      new T.MeshPhongMaterial({ vertexColors: true, side: T.DoubleSide, shininess: 8 })));
    const strokes = [];
    for (let j = 0; j < GRID; j += 8) for (let i = 0; i < GRID - 1; i++)
      if (grid.heights[j * GRID + i] !== null && grid.heights[j * GRID + i + 1] !== null) {
        const a = (j * GRID + i) * 3, b = a + 3;
        strokes.push(new T.Vector3(vertices[a], vertices[a + 1] + .012, vertices[a + 2]),
          new T.Vector3(vertices[b], vertices[b + 1] + .012, vertices[b + 2]));
      }
    for (let i = 0; i < GRID; i += 8) for (let j = 0; j < GRID - 1; j++)
      if (grid.heights[j * GRID + i] !== null && grid.heights[(j + 1) * GRID + i] !== null) {
        const a = (j * GRID + i) * 3, b = ((j + 1) * GRID + i) * 3;
        strokes.push(new T.Vector3(vertices[a], vertices[a + 1] + .012, vertices[a + 2]),
          new T.Vector3(vertices[b], vertices[b + 1] + .012, vertices[b + 2]));
      }
    const wire = new T.LineSegments(new T.BufferGeometry().setFromPoints(strokes),
      new T.LineBasicMaterial({ color: 0xc1e5df, transparent: true, opacity: .16 }));
    terrain.add(wire);
    sitePin.position.y = .35;
  }
  function surfacePoint(lon, lat, plan, grid, lift = .045) {
    if (Math.abs(lat) > 85.05112878) return null;
    const xp = (lon + 180) / 360 * plan.n * TILE;
    const yp = (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * plan.n * TILE;
    const east = (xp - plan.cx) * plan.mpp, south = (yp - plan.cy) * plan.mpp;
    if (east * east + south * south > (RADIUS_M - 80) ** 2) return null;
    const u = (east / RADIUS_M + 1) * (GRID - 1) / 2;
    const v = (south / RADIUS_M + 1) * (GRID - 1) / 2;
    const i = Math.max(0, Math.min(GRID - 2, Math.floor(u)));
    const j = Math.max(0, Math.min(GRID - 2, Math.floor(v)));
    const a = u - i, b = v - j;
    const values = [grid.heights[j * GRID + i], grid.heights[j * GRID + i + 1],
      grid.heights[(j + 1) * GRID + i], grid.heights[(j + 1) * GRID + i + 1]];
    if (values.some(h => h === null)) return null;
    const h = values[0] * (1 - a) * (1 - b) + values[1] * a * (1 - b) +
      values[2] * (1 - a) * b + values[3] * a * b;
    return new T.Vector3(east / RADIUS_M * RADIUS_SCENE,
      (h - grid.center) * .012 * reliefFraction + lift, south / RADIUS_M * RADIUS_SCENE);
  }
  function placeSprite(name, major) {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 88;
    const ctx = canvas.getContext("2d");
    ctx.font = major ? "700 45px Montserrat, sans-serif" : "600 40px Montserrat, sans-serif";
    const labelWidth = Math.min(500, Math.max(100, ctx.measureText(name).width + 42));
    ctx.fillStyle = "rgba(5, 27, 36, .82)";
    ctx.fillRect((512 - labelWidth) / 2, 8, labelWidth, 72);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = major ? "#fff4d8" : "#dbf3ee";
    ctx.fillText(name, 256, 44, 485);
    const sprite = new T.Sprite(new T.SpriteMaterial({
      map: new T.CanvasTexture(canvas), transparent: true, depthTest: false, depthWrite: false
    }));
    sprite.scale.set(3.1, .52, 1);
    sprite.renderOrder = 4;
    return sprite;
  }
  function drawMapFeatures(data, plan, grid) {
    if (!terrain) return { roadCount: 0, placeCount: 0 };
    const overlay = new T.Group();
    terrain.add(overlay);
    let roadCount = 0, placeCount = 0, pointBudget = 11000;
    const roadColors = { motorway: 0xf4c281, trunk: 0xf1ba7c, primary: 0xeac296,
      secondary: 0xa9c6bd };
    const roadPoints = Object.fromEntries(Object.keys(roadColors).map(key => [key, []]));
    for (const road of data.roads) {
      if (pointBudget <= 0) break;
      for (const path of road.paths) {
        let previous = null;
        for (const coord of path) {
          const point = surfacePoint(coord[0], coord[1], plan, grid);
          if (point && previous) {
            roadPoints[road.class].push(previous, point);
            roadCount++;
          }
          previous = point;
          if (point) pointBudget--;
          if (pointBudget <= 0) break;
        }
        if (pointBudget <= 0) break;
      }
    }
    for (const [roadClass, points] of Object.entries(roadPoints)) {
      if (!points.length) continue;
      const geometry = new T.BufferGeometry().setFromPoints(points);
      const material = new T.LineBasicMaterial({ color: roadColors[roadClass],
        transparent: true, opacity: roadClass === "secondary" ? .52 : .72,
        depthTest: false, depthWrite: false });
      const line = new T.LineSegments(geometry, material);
      line.renderOrder = 2;
      overlay.add(line);
    }
    const seen = new Set(), placed = [];
    const order = { city: 0, town: 1, village: 2, suburb: 3 };
    const places = data.places.sort((a, b) =>
      order[a.class] - order[b.class] || a.rank - b.rank);
    for (const place of places) {
      if (placeCount >= 13 || seen.has(place.name)) continue;
      const point = surfacePoint(place.coord[0], place.coord[1], plan, grid, .16);
      if (!point || placed.some(other => other.distanceTo(point) < .9)) continue;
      seen.add(place.name); placed.push(point);
      const sprite = placeSprite(place.name, place.class === "city" || place.class === "town");
      sprite.position.copy(point); sprite.position.y += .3;
      overlay.add(sprite); placeCount++;
    }
    return { roadCount, placeCount };
  }
  function redrawRelief() {
    if (!currentGrid || !currentPlan) return;
    drawTerrain(currentGrid);
    if (currentMap) drawMapFeatures(currentMap, currentPlan, currentGrid);
  }
  reliefSlider?.addEventListener("input", () => {
    reliefFraction = Number(reliefSlider.value) / 4;
    const label = `${Number(reliefSlider.value) * 25}%`;
    reliefValue.textContent = label;
    reliefSlider.setAttribute("aria-valuetext", label);
    redrawRelief();
  });
  async function setLocation(lat, lon) {
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (key === currentKey) return;
    currentKey = key;
    loadController?.abort();
    loadController = new AbortController();
    const signal = loadController.signal;
    currentPlan = currentGrid = currentMap = null;
    disposeObject(terrain);
    terrain = null;
    status.textContent = "Завантажуємо висоти навколо точки…";
    heightLabel.textContent = "Рельєф завантажується…";
    try {
      const plan = planTiles(lat, lon);
      const tiles = await loadTiles(plan, signal);
      if (signal.aborted) return;
      const grid = makeGrid(plan, tiles);
      currentPlan = plan; currentGrid = grid;
      drawTerrain(grid);
      status.textContent = "Рельєф готовий · завантажуємо назви й дороги…";
      heightLabel.textContent = `висота точки ≈ ${Math.round(grid.center)} м · DEM`;
      try {
        const map = await window.RassvetMapData.load(plan, signal);
        if (signal.aborted) return;
        currentMap = map;
        const counts = drawMapFeatures(map, plan, grid);
        status.textContent = `Рельєф 12 км · ${counts.placeCount} назв · ${counts.roadCount} відрізків доріг`;
      } catch (mapError) {
        if (signal.aborted) return;
        status.textContent = "Рельєф готовий · назви й дороги тимчасово недоступні";
      }
    } catch (error) {
      if (signal.aborted) return;
      status.textContent = `Рельєф недоступний: ${error.message || "помилка завантаження"}.`;
      heightLabel.textContent = "висота невідома";
    }
  }

  function markerFor(sat) {
    const id = sat.id;
    if (markers.has(id)) return markers.get(id);
    const groupName = sat.group || "RASSVET";
    const baseColor = GROUP_COLORS[groupName] || 0xa6c7dc;
    const group = new T.Group();
    group.userData.id = id;
    const body = new T.Mesh(new T.OctahedronGeometry(.16),
      new T.MeshPhongMaterial({ color: baseColor, emissive: 0x14565b }));
    const panels = new T.Mesh(new T.BoxGeometry(.66, .035, .21),
      new T.MeshPhongMaterial({ color: 0x6baab4, emissive: 0x143848 }));
    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 320; labelCanvas.height = 72;
    const ctx = labelCanvas.getContext("2d");
    ctx.fillStyle = "rgba(4, 24, 34, .82)";
    ctx.fillRect(0, 0, 320, 72);
    ctx.fillStyle = "#f3d6a4";
    ctx.font = "700 29px Montserrat, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${groupName}  ·  ${id}`, 160, 37);
    const label = new T.Sprite(new T.SpriteMaterial({
      map: new T.CanvasTexture(labelCanvas), transparent: true, depthTest: false
    }));
    label.position.y = .6;
    label.scale.set(2.65, .6, 1);
    label.visible = false;
    group.add(body, panels, label);
    sky.add(group);
    markers.set(id, group);
    return group;
  }
  function update({ visible, minute, day, selectedSat, threshold, look }) {
    rows = visible;
    currentSelection = selectedSat;
    for (const group of markers.values()) group.visible = false;
    for (const row of visible) {
      const marker = markerFor(row.sat);
      marker.visible = true;
      marker.position.copy(domePoint(row.pos.az, row.pos.el));
      marker.scale.setScalar(row.sat.id === selectedSat ? 1.55 : row.pos.el < threshold ? .72 : 1);
      const selected = row.sat.id === selectedSat;
      marker.children[0].material.color.setHex(selected ? 0xffd38f :
        GROUP_COLORS[row.sat.group || "RASSVET"] || 0xa6c7dc);
      marker.children[0].material.emissive.setHex(selected ? 0x865014 : 0x14565b);
      marker.children[2].visible = selected;
    }
    disposeObject(trail);
    trail = null;
    const sat = day?.satellites.find(item => item.id === selectedSat);
    if (sat) {
      const points = [];
      for (let i = Math.max(0, minute - 20); i <= Math.min(day.sampleCount - 2, minute + 20); i++) {
        const p = look(sat, i);
        if (p.el >= 0) points.push(domePoint(p.az, p.el));
      }
      if (points.length > 1) {
        const curve = new T.CatmullRomCurve3(points, false, "centripetal");
        const center = new T.Vector3(0, DOME_Y, 0);
        const smooth = curve.getPoints((points.length - 1) * 8).map(point =>
          point.sub(center).normalize().multiplyScalar(DOME_R).add(center));
        trail = new T.Group();
        trail.add(line(smooth, 0xffd28f, .95));
        trail.add(new T.Points(new T.BufferGeometry().setFromPoints(points),
          new T.PointsMaterial({ color: 0xffe4b4, size: .065, sizeAttenuation: true, depthTest: false })));
        sky.add(trail);
      }
    }
  }

  const raycaster = new T.Raycaster(), pointer = new T.Vector2();
  function hit(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1,
      -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const objects = [...markers.values()].filter(group => group.visible);
    const found = raycaster.intersectObjects(objects, true)[0]?.object;
    let node = found;
    while (node && node.userData.id === undefined) node = node.parent;
    return node?.userData.id;
  }
  renderer.domElement.addEventListener("pointermove", event => {
    const id = hit(event), row = rows.find(item => item.sat.id === id);
    tooltip.hidden = !row;
    renderer.domElement.style.cursor = row ? "pointer" : "grab";
    if (row) {
      tooltip.textContent = `№ ${id} · ${row.pos.el.toFixed(1)}° вис. · ${row.pos.az.toFixed(0)}° аз.`;
      const rect = viewport.getBoundingClientRect();
      tooltip.style.left = `${Math.min(rect.width - 180, event.clientX - rect.left + 14)}px`;
      tooltip.style.top = `${Math.max(12, event.clientY - rect.top - 18)}px`;
    }
  });
  renderer.domElement.addEventListener("pointerleave", () => { tooltip.hidden = true; });
  renderer.domElement.addEventListener("click", event => {
    const id = hit(event);
    if (id !== undefined) document.dispatchEvent(
      new CustomEvent("rassvet-satellite-select", { detail: { id } }));
  });
  function resize() {
    const width = Math.max(1, viewport.clientWidth), height = Math.max(1, viewport.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(viewport);
  else window.addEventListener("resize", resize);
  if (window.IntersectionObserver)
    new IntersectionObserver(entries => { shown = entries[0]?.isIntersecting ?? true; }).observe(viewport);
  resize();
  function animate() {
    requestAnimationFrame(animate);
    if (!shown || document.hidden) return;
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
  window.RassvetScene = { setLocation, update };
})();
