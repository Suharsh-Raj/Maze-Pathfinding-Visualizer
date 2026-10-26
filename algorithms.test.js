/* Optional developer checks: node tests/algorithms.test.js (no packages needed). */
'use strict';
const assert = require('node:assert/strict');
const { algorithms, MinHeap } = require('./algorithms.js');
const { createGrid } = require('./demos.js');

// Independent Bellman-Ford oracle. Build edges directly, without using the
// application's neighbors or heap, to check both move and weighted optima.
function oracle(grid, weighted) {
  const edges = [];
  for (let a = 0; a < grid.cells.length; a++) {
    if (grid.cells[a] === -1) continue;
    for (let b = 0; b < grid.cells.length; b++) {
      if (grid.cells[b] === -1) continue;
      const dr = Math.abs(Math.floor(a / grid.cols) - Math.floor(b / grid.cols));
      const dc = Math.abs(a % grid.cols - b % grid.cols);
      if (dr + dc === 1) edges.push([a, b]);
    }
  }
  const distance = Array(grid.cells.length).fill(Infinity);
  distance[grid.start] = 0;
  for (let pass = 0; pass < grid.cells.length - 1; pass++) {
    let changed = false;
    for (const [a, b] of edges) {
      const candidate = distance[a] + (weighted ? grid.cells[b] : 1);
      if (candidate < distance[b]) { distance[b] = candidate; changed = true; }
    }
    if (!changed) break;
  }
  return distance[grid.goal];
}

let checked = 0;
function verify(grid) {
  const original = JSON.stringify(grid);
  const minimumMoves = oracle(grid, false), minimumCost = oracle(grid, true);
  for (const [name, run] of Object.entries(algorithms)) {
    const result = run(grid);
    assert.equal(JSON.stringify(grid), original, `${name} mutated the grid`);
    assert.deepEqual(run(grid), result, `${name} is not deterministic on repeated runs`);
    assert.equal(result.found, Number.isFinite(minimumMoves));
    assert.equal(new Set(result.expanded).size, result.expanded.length);
    assert.equal(result.expanded[0], grid.start);
    assert(result.expanded.every(id => grid.cells[id] !== -1));
    if (result.found) {
      assert.equal(result.path[0], grid.start);
      assert.equal(result.path.at(-1), grid.goal);
      assert.equal(result.expanded.at(-1), grid.goal);
      assert.equal(result.moves, result.path.length - 1);
      assert.equal(new Set(result.path).size, result.path.length);
      assert.equal(result.cost, result.path.slice(1).reduce((sum, id) => sum + grid.cells[id], 0));
      for (let i = 1; i < result.path.length; i++) {
        const a = result.path[i - 1], b = result.path[i];
        assert(b >= 0 && b < grid.cells.length && grid.cells[b] !== -1);
        assert.equal(Math.abs(Math.floor(a / grid.cols) - Math.floor(b / grid.cols)) + Math.abs(a % grid.cols - b % grid.cols), 1);
      }
      if (name === 'BFS') assert.equal(result.moves, minimumMoves);
      if (name === 'Dijkstra' || name === 'A*') assert.equal(result.cost, minimumCost);
    } else {
      assert.deepEqual(result.path, []);
      assert.equal(result.moves, null); assert.equal(result.cost, null);
    }
    checked++;
  }
}

for (const name of ['empty', 'routes', 'weighted', 'unreachable']) verify(createGrid(name));
const weighted = createGrid('weighted');
assert.equal(algorithms.BFS(weighted).moves, 10);
assert.equal(algorithms.BFS(weighted).cost, 70);
assert.equal(algorithms.Dijkstra(weighted).moves, 20);
assert.equal(algorithms.Dijkstra(weighted).cost, 20);
for (const name of ['empty', 'routes']) {
  const grid = createGrid(name);
  assert.equal(algorithms.BFS(grid).cost, algorithms.Dijkstra(grid).cost);
}
verify({ rows: 1, cols: 3, cells: [5, 5, 1], start: 0, goal: 2 }); // Starting cost excluded.
verify({ rows: 3, cols: 1, cells: [1, -1, 1], start: 0, goal: 2 });
verify({ rows: 1, cols: 2, cells: [1, 1], start: 0, goal: 1 });
verify({ rows: 1, cols: 1, cells: [1], start: 0, goal: 0 }); // Pure algorithm edge case.

let seed = 1729;
function random() { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }
for (let example = 0; example < 200; example++) {
  const rows = 2 + Math.floor(random() * 6), cols = 2 + Math.floor(random() * 6);
  const cells = Array.from({ length: rows * cols }, () => {
    const choice = random(); return choice < 0.28 ? -1 : [1, 2, 5, 9][Math.floor(random() * 4)];
  });
  const start = Math.floor(random() * cells.length);
  const goal = (start + 1 + Math.floor(random() * (cells.length - 1))) % cells.length;
  cells[start] = 1; cells[goal] = 1;
  verify({ rows, cols, cells, start, goal });
}

// Heap checks cover duplicate priorities and an interleaved push/pop workload.
const heap = new MinHeap(), expected = [];
for (let i = 0; i < 500; i++) {
  const priority = Math.floor(random() * 20);
  heap.push(i, priority, priority); expected.push({ id: i, priority });
}
expected.sort((a, b) => a.priority - b.priority || a.id - b.id);
for (const entry of expected) assert.equal(heap.pop().id, entry.id);
assert.equal(heap.size, 0);
heap.push(0, 10, 10); heap.push(1, 3, 3); assert.equal(heap.pop().id, 1);
heap.push(2, 1, 1); assert.equal(heap.pop().id, 2); assert.equal(heap.pop().id, 0);
console.log(`PASS: ${checked} algorithm cases, repeated-run determinism, immutable grids, optimality oracle, and binary heap.`);
