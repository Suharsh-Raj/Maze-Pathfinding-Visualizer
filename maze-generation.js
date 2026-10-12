/* Maze creation is separate from the selected pathfinding algorithm.
   -1 = wall, 1 = passage. This module does not read or change the page. */
(function (root) {
  'use strict';

  const ROWS = 21, COLS = 31;
  // These change the feel of a maze; they are not formal difficulty guarantees.
  const PRESETS = {
    easy: { straightChance: 0.70, loops: 18, distanceRange: [0.65, 0.78] },
    medium: { straightChance: 0.35, loops: 10, distanceRange: [0.82, 0.92] },
    hard: { straightChance: 0.10, loops: 4, distanceRange: [0.95, 1.00] }
  };
  const DIRECTIONS = [[-2, 0], [0, 2], [2, 0], [0, -2]];

  // A repeatable random source for demonstrations and automated verification.
  function createSeededRandom(seed) {
    let state = seed >>> 0;
    return function () {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function choose(items, random) { return items[Math.floor(random() * items.length)]; }
  function edgeKey(a, b) { return a < b ? `${a}:${b}` : `${b}:${a}`; }

  function passageNeighbors(cells, id) {
    const row = Math.floor(id / COLS), col = id % COLS;
    const next = [];
    if (row > 0 && cells[id - COLS] !== -1) next.push(id - COLS);
    if (col < COLS - 1 && cells[id + 1] !== -1) next.push(id + 1);
    if (row < ROWS - 1 && cells[id + COLS] !== -1) next.push(id + COLS);
    if (col > 0 && cells[id - 1] !== -1) next.push(id - 1);
    return next;
  }

  // Generation-only breadth-first distances help place endpoints. This is not
  // a visualizer run and is never counted in pathfinding computation timing.
  function passageDistances(cells, start, cycleEdges = new Set()) {
    const distance = Array(cells.length).fill(-1);
    const parent = Array(cells.length).fill(-1);
    const hasAlternative = Array(cells.length).fill(false);
    const queue = [start];
    distance[start] = 0;
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head];
      for (const next of passageNeighbors(cells, current)) {
        if (distance[next] !== -1) continue;
        distance[next] = distance[current] + 1;
        parent[next] = current;
        // A path using an edge on a cycle has another way around that cycle.
        hasAlternative[next] = hasAlternative[current] || cycleEdges.has(edgeKey(current, next));
        queue.push(next);
      }
    }
    return { distance, parent, hasAlternative };
  }

  function generateMaze(difficulty = 'medium', random = Math.random) {
    if (!Object.hasOwn(PRESETS, difficulty)) difficulty = 'medium';
    const preset = PRESETS[difficulty];
    const cells = Array(ROWS * COLS).fill(-1);
    const logicalCells = [];
    for (let row = 1; row < ROWS - 1; row += 2) {
      for (let col = 1; col < COLS - 1; col += 2) logicalCells.push(row * COLS + col);
    }

    // Randomized DFS backtracking generates the initial connected maze tree.
    // Logical cells lie at odd row/column indices. A two-cell step opens its
    // intervening wall, preserving a wall between adjacent corridors.
    const first = choose(logicalCells, random);
    cells[first] = 1;
    const stack = [{ id: first, direction: -1 }];
    while (stack.length) {
      const current = stack[stack.length - 1];
      const row = Math.floor(current.id / COLS), col = current.id % COLS;
      const options = [];
      DIRECTIONS.forEach(([dr, dc], direction) => {
        const nr = row + dr, nc = col + dc;
        if (nr <= 0 || nr >= ROWS - 1 || nc <= 0 || nc >= COLS - 1) return;
        const id = nr * COLS + nc;
        if (cells[id] === -1) options.push({ id, direction });
      });
      if (!options.length) { stack.pop(); continue; }
      const straight = options.find(option => option.direction === current.direction);
      const turns = options.filter(option => option.direction !== current.direction);
      const next = straight && (!turns.length || random() < preset.straightChance)
        ? straight : choose(turns.length ? turns : options, random);
      cells[(current.id + next.id) / 2] = 1;
      cells[next.id] = 1;
      stack.push(next);
    }

    // Every candidate separates two existing passages. Opening it adds exactly
    // one independent cycle. Even/even intersections and outer walls stay shut,
    // so openings never merge the corridors into a 2 x 2 room.
    const separatingWalls = [];
    for (const id of logicalCells) {
      const row = Math.floor(id / COLS), col = id % COLS;
      if (col + 2 < COLS - 1 && cells[id + 1] === -1) {
        separatingWalls.push({ id: id + 1, a: id, b: id + 2 });
      }
      if (row + 2 < ROWS - 1 && cells[id + COLS] === -1) {
        separatingWalls.push({ id: id + COLS, a: id, b: id + 2 * COLS });
      }
    }
    const cycleEdges = new Set();
    const loopsAdded = Math.min(preset.loops, separatingWalls.length);
    for (let count = 0; count < loopsAdded; count++) {
      const index = Math.floor(random() * separatingWalls.length);
      const wall = separatingWalls.splice(index, 1)[0];
      // Remember the existing route plus the new opening: together they form
      // a cycle. Endpoint selection below requires a cycle on its actual route.
      const { parent } = passageDistances(cells, wall.a);
      for (let id = wall.b; id !== wall.a; id = parent[id]) {
        cycleEdges.add(edgeKey(id, parent[id]));
      }
      cells[wall.id] = 1;
      cycleEdges.add(edgeKey(wall.a, wall.id));
      cycleEdges.add(edgeKey(wall.id, wall.b));
    }

    // Choose endpoints after opening loops because shortcuts change distances.
    // At only 150 logical cells, trying each source is simple and inexpensive.
    // Requiring a cycle edge on a shortest route avoids a loop hidden entirely
    // in an unrelated dead-end branch: there really are alternative S–G paths.
    const pairs = [];
    let referenceDistance = 0;
    for (let i = 0; i < logicalCells.length; i++) {
      const start = logicalCells[i];
      const { distance, hasAlternative } = passageDistances(cells, start, cycleEdges);
      for (let j = i + 1; j < logicalCells.length; j++) {
        const goal = logicalCells[j];
        if (!hasAlternative[goal]) continue;
        const moves = distance[goal];
        referenceDistance = Math.max(referenceDistance, moves);
        pairs.push({ start, goal, moves });
      }
    }
    const [low, high] = preset.distanceRange;
    let suitable = pairs.filter(pair => pair.moves >= low * referenceDistance && pair.moves <= high * referenceDistance);
    // Distances are integers; keep the nearest pair if a narrow band is empty.
    if (!suitable.length) {
      const target = referenceDistance * (low + high) / 2;
      const nearest = Math.min(...pairs.map(pair => Math.abs(pair.moves - target)));
      suitable = pairs.filter(pair => Math.abs(pair.moves - target) === nearest);
    }
    const endpoints = choose(suitable, random);
    return {
      rows: ROWS, cols: COLS, cells, start: endpoints.start, goal: endpoints.goal,
      generation: {
        difficulty, method: 'Randomized DFS backtracking', loopsAdded,
        endpointDistance: endpoints.moves, referenceDistance,
        straightChance: preset.straightChance,
        distanceRange: preset.distanceRange.slice()
      }
    };
  }

  const api = { generateMaze, createSeededRandom };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MazeGeneration = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
