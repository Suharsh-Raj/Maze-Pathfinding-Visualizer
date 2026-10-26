/* node weighted-demo.test.js — independent route enumeration and trace checks. */
'use strict';
const assert = require('node:assert/strict');
const { createGrid } = require('./demos.js');
const { algorithms, traceDijkstra, pathBreakdown } = require('./algorithms.js');

function neighbors(grid, id) {
  const row = Math.floor(id / grid.cols), col = id % grid.cols;
  return [[row - 1, col], [row, col + 1], [row + 1, col], [row, col - 1]]
    .filter(([r, c]) => r >= 0 && r < grid.rows && c >= 0 && c < grid.cols)
    .map(([r, c]) => r * grid.cols + c).filter(next => grid.cells[next] !== -1);
}
function allSimpleRoutes(grid) {
  const routes = [], path = [grid.start], seen = new Set(path);
  function visit(id) {
    if (id === grid.goal) { routes.push(path.slice()); return; }
    for (const next of neighbors(grid, id)) {
      if (seen.has(next)) continue;
      seen.add(next); path.push(next); visit(next); path.pop(); seen.delete(next);
    }
  }
  visit(grid.start);
  return routes;
}
function independentCost(grid, path) { return path.slice(1).reduce((total, id) => total + grid.cells[id], 0); }
function verifyDemo(grid) {
  const before = JSON.stringify(grid), routes = allSimpleRoutes(grid);
  assert.equal(routes.length, 3, 'Exactly three simple routes; no unintended shortcuts');
  const choices = routes.map(path => ({ moves: path.length - 1, cost: independentCost(grid, path) }));
  const minimumMoves = Math.min(...choices.map(route => route.moves));
  const minimumCost = Math.min(...choices.map(route => route.cost));
  for (const [name, run] of Object.entries(algorithms)) {
    const result = run(grid), breakdown = pathBreakdown(grid, result.path);
    assert(routes.some(route => JSON.stringify(route) === JSON.stringify(result.path)));
    assert.equal(result.cost, independentCost(grid, result.path));
    assert.equal(result.moves, result.path.length - 1);
    assert.equal(breakdown.cost, result.cost);
    assert.equal(breakdown.moves, result.moves);
    assert.equal(breakdown.terms.reduce((sum, term) => sum + term.count, 0), result.moves);
    if (name === 'BFS') assert.equal(result.moves, minimumMoves);
    if (name === 'Dijkstra' || name === 'A*') assert.equal(result.cost, minimumCost);
  }
  assert.equal(JSON.stringify(grid), before);
  return choices.sort((a, b) => a.moves - b.moves);
}

const grid = createGrid('weighted');
assert.equal(grid.cells[grid.start], 1); assert.equal(grid.cells[grid.goal], 1);
assert.deepEqual(verifyDemo(grid), [{ moves: 10, cost: 70 }, { moves: 16, cost: 30 }, { moves: 20, cost: 20 }]);
assert.deepEqual([...new Set(grid.cells.filter(cost => cost !== -1))].sort((a, b) => a - b), [1, 2, 5, 9]);

// Independently replay recorded events and prove each removal uses the lowest
// current distance, each candidate is correct, and the goal isn't an early exit.
function verifyTrace(grid) {
  const { result, events } = traceDijkstra(grid), distance = new Map(), settled = new Set();
  let previousSettlement = -Infinity, goalDiscovery = -1, goalSettlement = -1;
  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    if (event.type === 'discover') { assert.equal(event.id, grid.start); distance.set(event.id, 0); }
    if (event.type === 'settle') {
      assert(!settled.has(event.id));
      const unsettled = [...distance].filter(([id]) => !settled.has(id)).map(([, cost]) => cost);
      assert.equal(event.distance, Math.min(...unsettled));
      assert(event.distance >= previousSettlement); previousSettlement = event.distance;
      settled.add(event.id);
      if (event.id === grid.goal) { goalSettlement = index; assert(event.goal); }
    }
    if (event.type === 'relax') {
      assert(settled.has(event.from)); assert(!settled.has(event.id));
      assert(neighbors(grid, event.from).includes(event.id));
      assert.equal(event.currentDistance, distance.get(event.from));
      assert.equal(event.entryCost, grid.cells[event.id]);
      assert.equal(event.candidate, event.currentDistance + event.entryCost);
      assert.equal(event.previous, distance.get(event.id) ?? Infinity);
      assert.equal(event.updated, event.candidate < event.previous);
      if (event.updated) distance.set(event.id, event.candidate);
      if (event.id === grid.goal && goalDiscovery === -1) goalDiscovery = index;
    }
  }
  assert(goalDiscovery >= 0 && goalSettlement > goalDiscovery);
  assert.equal(goalSettlement, events.length - 1, 'Stop after settling the goal');
  assert.deepEqual(result, algorithms.Dijkstra(grid));
}
verifyTrace(grid);
grid.cells[7 * grid.cols + 6] = 9;
verifyDemo(grid); verifyTrace(grid);
assert.equal(algorithms.Dijkstra(grid).cost, 28);
grid.cells[8 * grid.cols + 6] = 9;
verifyDemo(grid); verifyTrace(grid);
assert.equal(algorithms.Dijkstra(grid).moves, 16);
assert.equal(algorithms.Dijkstra(grid).cost, 30);
for (let col = 7; col < 16; col++) grid.cells[6 * grid.cols + col] = 1;
verifyDemo(grid); verifyTrace(grid);
assert.equal(algorithms.Dijkstra(grid).moves, 10);
assert.equal(algorithms.Dijkstra(grid).cost, 10);
console.log('PASS: exactly three routes, no shortcuts, independent move/cost optima, all four terrain costs, actual-path breakdown, heap/relaxation trace, goal settlement, and edited-weight reruns.');
