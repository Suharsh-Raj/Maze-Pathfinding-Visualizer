/* Optional developer checks: node tests/maze-generation.test.js (no packages needed). */
'use strict';
const assert = require('node:assert/strict');
const { generateMaze } = require('../maze-generation.js');
const { algorithms } = require('../algorithms.js');
const { createGrid } = require('../demos.js');

function seededRandom(initialSeed) {
  let seed = initialSeed >>> 0;
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// Build the graph independently: do not use the generator's helpers or the
// pathfinding module's neighbor function to verify its own output.
function adjacent(grid, id) {
  const row = Math.floor(id / grid.cols), col = id % grid.cols;
  return [[row - 1, col], [row, col + 1], [row + 1, col], [row, col - 1]]
    .filter(([r, c]) => r >= 0 && r < grid.rows && c >= 0 && c < grid.cols)
    .map(([r, c]) => r * grid.cols + c)
    .filter(next => grid.cells[next] !== -1);
}

function explore(grid, removedEdge = null) {
  const parents = new Map([[grid.start, null]]), queue = [grid.start];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    for (const next of adjacent(grid, current)) {
      if (removedEdge && ((current === removedEdge[0] && next === removedEdge[1]) ||
        (current === removedEdge[1] && next === removedEdge[0]))) continue;
      if (parents.has(next)) continue;
      parents.set(next, current);
      queue.push(next);
    }
  }
  const path = [];
  if (parents.has(grid.goal)) {
    for (let id = grid.goal; id !== null; id = parents.get(id)) path.push(id);
    path.reverse();
  }
  return { visited: parents.size, path };
}

function graphStats(grid) {
  let vertices = 0, directedEdges = 0;
  for (let id = 0; id < grid.cells.length; id++) {
    if (grid.cells[id] === -1) continue;
    vertices++;
    directedEdges += adjacent(grid, id).length;
  }
  return { vertices, edges: directedEdges / 2 };
}

function hasAlternativeEndpointRoute(grid, path) {
  // A cycle elsewhere in a maze is not enough. At least one edge of a selected
  // start-goal route must be avoidable by a second start-goal route.
  for (let i = 1; i < path.length; i++) {
    if (explore(grid, [path[i - 1], path[i]]).path.length) return true;
  }
  return false;
}

function verifyPath(grid, name, result, minimumMoves) {
  assert(result.found, `${name}: goal should be reachable`);
  assert.equal(result.path[0], grid.start);
  assert.equal(result.path.at(-1), grid.goal);
  assert.equal(new Set(result.path).size, result.path.length, `${name}: repeated path cell`);
  assert.equal(result.moves, result.path.length - 1);
  assert.equal(result.cost, result.path.slice(1).reduce((sum, id) => sum + grid.cells[id], 0));
  assert.equal(new Set(result.expanded).size, result.expanded.length);
  assert(result.expanded.every(id => grid.cells[id] !== -1));
  for (let i = 1; i < result.path.length; i++) {
    assert(adjacent(grid, result.path[i - 1]).includes(result.path[i]), `${name}: invalid path edge`);
  }
  if (name !== 'DFS') assert.equal(result.moves, minimumMoves, `${name}: nonoptimal unweighted path`);
}

function verifyGenerated(grid) {
  assert.equal(grid.rows, 21);
  assert.equal(grid.cols, 31);
  assert.equal(grid.cells.length, grid.rows * grid.cols);
  assert(grid.cells.every(cost => cost === -1 || cost === 1), 'Generated mazes use only walls and ordinary terrain');
  assert(Number.isInteger(grid.start) && grid.start >= 0 && grid.start < grid.cells.length);
  assert(Number.isInteger(grid.goal) && grid.goal >= 0 && grid.goal < grid.cells.length);
  assert.notEqual(grid.start, grid.goal);
  assert.equal(grid.cells[grid.start], 1);
  assert.equal(grid.cells[grid.goal], 1);

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const id = row * grid.cols + col;
      if (row === 0 || col === 0 || row === grid.rows - 1 || col === grid.cols - 1) {
        assert.equal(grid.cells[id], -1, 'Outer boundary must remain walled');
      }
      if (row < grid.rows - 1 && col < grid.cols - 1) {
        const square = [id, id + 1, id + grid.cols, id + grid.cols + 1];
        assert(square.some(cell => grid.cells[cell] === -1), 'Open 2 x 2 room breaks narrow-corridor structure');
      }
    }
  }

  const independent = explore(grid), stats = graphStats(grid);
  assert.equal(independent.visited, stats.vertices, 'Every carved passage belongs to one connected maze');
  assert(independent.path.length > 0, 'Goal is reachable');
  const moves = independent.path.length - 1;
  assert(moves >= 20, 'Endpoints should be separated by a meaningful corridor distance');
  const cycles = stats.edges - stats.vertices + 1;
  assert(cycles > 0, 'Loop cuts must create cycles');
  assert(hasAlternativeEndpointRoute(grid, independent.path), 'Endpoints need alternative routes, not only a remote loop');
  assert(grid.generation && typeof grid.generation.method === 'string');
  assert(Number.isInteger(grid.generation.loopsAdded) && grid.generation.loopsAdded > 0);

  const snapshot = JSON.stringify(grid);
  for (const [name, run] of Object.entries(algorithms)) {
    verifyPath(grid, name, run(grid), moves);
    assert.equal(JSON.stringify(grid), snapshot, `${name} changed the generated maze`);
  }
  return { moves, cycles, loopsAdded: grid.generation.loopsAdded };
}

const seedsPerDifficulty = 100;
const summaries = {};
for (const difficulty of ['easy', 'medium', 'hard']) {
  const records = [];
  const distinctLayouts = new Set();
  for (let seed = 1; seed <= seedsPerDifficulty; seed++) {
    const testSeed = (seed * 2654435761) >>> 0;
    const grid = generateMaze(difficulty, seededRandom(testSeed));
    try {
      assert.equal(grid.generation.difficulty, difficulty);
      assert.deepEqual(grid, generateMaze(difficulty, seededRandom(testSeed)), 'Injected RNG should make generation reproducible');
      records.push(verifyGenerated(grid));
      distinctLayouts.add(grid.cells.join(','));
    } catch (error) {
      error.message = `${difficulty}, seed ${testSeed}: ${error.message}`;
      throw error;
    }
  }
  assert(distinctLayouts.size > 1, `${difficulty}: different RNG seeds should produce different mazes`);
  summaries[difficulty] = {
    averageMoves: records.reduce((sum, record) => sum + record.moves, 0) / records.length,
    averageLoops: records.reduce((sum, record) => sum + record.loopsAdded, 0) / records.length,
    minimumCycles: Math.min(...records.map(record => record.cycles))
  };
}

// Difficulty is approximate; compare populations, not every individual maze.
assert(summaries.easy.averageMoves < summaries.medium.averageMoves);
assert(summaries.medium.averageMoves < summaries.hard.averageMoves);
assert(summaries.easy.averageLoops > summaries.medium.averageLoops);
assert(summaries.medium.averageLoops > summaries.hard.averageLoops);

const weighted = createGrid('weighted');
const beforeComparison = JSON.stringify(weighted);
const bfs = algorithms.BFS(weighted), dijkstra = algorithms.Dijkstra(weighted);
assert.equal(bfs.moves, 21);
assert.equal(bfs.cost, 101);
assert.equal(dijkstra.moves, 31);
assert.equal(dijkstra.cost, 31);
assert(bfs.moves < dijkstra.moves && bfs.cost > dijkstra.cost);
assert(hasAlternativeEndpointRoute(weighted, explore(weighted).path));
assert.equal(JSON.stringify(weighted), beforeComparison, 'Weighted comparison must not change terrain');

const unreachable = createGrid('unreachable');
for (const run of Object.values(algorithms)) assert.equal(run(unreachable).found, false);

console.log(`PASS: ${3 * seedsPerDifficulty} seeded mazes, all four search algorithms, connected corridors, closed boundaries, no open 2 x 2 blocks, cycles, alternative endpoint routes, reproducibility, difficulty trends, weighted tradeoff, and unreachable example.`);
console.table(summaries);
