/* Pure algorithms: no DOM or animation. Also usable from Node for verification. */
(function (root) {
  'use strict';

  // Stable binary min-heap: equal priorities are removed in insertion order.
  class MinHeap {
    constructor() { this.items = []; this.sequence = 0; }
    get size() { return this.items.length; }
    before(a, b) { return a.priority < b.priority || (a.priority === b.priority && a.order < b.order); }
    push(id, priority, distance) {
      const item = { id, priority, distance, order: this.sequence++ };
      this.items.push(item);
      let i = this.size - 1;
      while (i > 0) {
        const parent = Math.floor((i - 1) / 2);
        if (!this.before(item, this.items[parent])) break;
        this.items[i] = this.items[parent];
        i = parent;
      }
      this.items[i] = item;
    }
    pop() {
      const first = this.items[0];
      const last = this.items.pop();
      if (this.size) {
        let i = 0;
        while (2 * i + 1 < this.size) {
          let child = 2 * i + 1;
          if (child + 1 < this.size && this.before(this.items[child + 1], this.items[child])) child++;
          if (!this.before(this.items[child], last)) break;
          this.items[i] = this.items[child];
          i = child;
        }
        this.items[i] = last;
      }
      return first;
    }
  }

  // Cell IDs are row * columns + column. Fixed order: up, right, down, left.
  function neighbors(grid, id) {
    const row = Math.floor(id / grid.cols), col = id % grid.cols;
    const result = [];
    if (row > 0) result.push(id - grid.cols);
    if (col < grid.cols - 1) result.push(id + 1);
    if (row < grid.rows - 1) result.push(id + grid.cols);
    if (col > 0) result.push(id - 1);
    return result.filter(next => grid.cells[next] !== -1);
  }

  function finish(grid, parents, expanded, found) {
    const path = [];
    if (found) {
      for (let id = grid.goal; id !== -1; id = parents[id]) path.push(id);
      path.reverse();
    }
    return {
      found, path, expanded,
      moves: found ? path.length - 1 : null,
      // Entering a cell incurs its terrain cost. The starting cell is free.
      cost: found ? path.slice(1).reduce((sum, id) => sum + grid.cells[id], 0) : null
    };
  }

  function breadthFirst(grid) {
    const parents = Array(grid.cells.length).fill(-1);
    const seen = new Set([grid.start]);
    const queue = [grid.start], expanded = [];
    // A moving head avoids Array.shift(), which would reindex the queue.
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head];
      expanded.push(current);
      if (current === grid.goal) return finish(grid, parents, expanded, true);
      for (const next of neighbors(grid, current)) {
        if (seen.has(next)) continue;
        seen.add(next); // Mark when enqueued, so each cell enters the queue once.
        parents[next] = current;
        queue.push(next); // BFS deliberately ignores terrain cost here.
      }
    }
    return finish(grid, parents, expanded, false);
  }

  function depthFirst(grid) {
    const parents = Array(grid.cells.length).fill(-1);
    const seen = new Set([grid.start]);
    const stack = [grid.start], expanded = [];
    while (stack.length) {
      const current = stack.pop();
      expanded.push(current);
      if (current === grid.goal) return finish(grid, parents, expanded, true);
      // Reverse insertion into the LIFO stack to prefer up, right, down, left.
      for (const next of neighbors(grid, current).reverse()) {
        if (seen.has(next)) continue;
        seen.add(next);
        parents[next] = current;
        stack.push(next);
      }
    }
    return finish(grid, parents, expanded, false);
  }

  // A* shares Dijkstra's relaxation logic; only the heap priority changes.
  function lowestCost(grid, useHeuristic = false, trace = null) {
    const parents = Array(grid.cells.length).fill(-1);
    const distance = Array(grid.cells.length).fill(Infinity);
    const settled = new Set(), expanded = [], heap = new MinHeap();
    function heuristic(id) {
      if (!useHeuristic) return 0;
      const rowDistance = Math.abs(Math.floor(id / grid.cols) - Math.floor(grid.goal / grid.cols));
      const colDistance = Math.abs(id % grid.cols - grid.goal % grid.cols);
      // Manhattan distance * minimum movement cost (1). Consistent and admissible.
      return (rowDistance + colDistance) * 1;
    }
    distance[grid.start] = 0;
    heap.push(grid.start, heuristic(grid.start), 0);
    if (trace) trace.push({ type: 'discover', id: grid.start, distance: 0 });
    while (heap.size) {
      const entry = heap.pop(), current = entry.id;
      // An improved distance gets a new heap entry. Ignore outdated entries.
      if (settled.has(current) || entry.distance !== distance[current]) continue;
      settled.add(current);
      expanded.push(current);
      if (trace) trace.push({ type: 'settle', id: current, distance: distance[current], goal: current === grid.goal });
      // Success only after a non-stale goal entry is removed from the heap.
      if (current === grid.goal) return finish(grid, parents, expanded, true);
      for (const next of neighbors(grid, current)) {
        if (settled.has(next)) continue;
        const candidate = distance[current] + grid.cells[next];
        const previous = distance[next], updated = candidate < previous;
        if (trace) trace.push({
          type: 'relax', from: current, id: next, currentDistance: distance[current],
          entryCost: grid.cells[next], candidate, previous, updated
        });
        if (updated) {
          distance[next] = candidate;
          parents[next] = current;
          heap.push(next, candidate + heuristic(next), candidate);
        }
      }
    }
    return finish(grid, parents, expanded, false);
  }

  // Educational recording is optional and never changes the search rules.
  // The UI records this separately from the timed pure algorithm run.
  function traceDijkstra(grid) {
    const events = [];
    const result = lowestCost(grid, false, events);
    return { result, events };
  }

  function pathBreakdown(grid, path) {
    const counts = {};
    for (const id of path.slice(1)) counts[grid.cells[id]] = (counts[grid.cells[id]] || 0) + 1;
    const terms = Object.keys(counts).map(Number).sort((a, b) => a - b)
      .map(cost => ({ cost, count: counts[cost] }));
    return { moves: Math.max(0, path.length - 1), cost: terms.reduce((sum, term) => sum + term.cost * term.count, 0), terms };
  }

  const algorithms = {
    BFS: breadthFirst,
    DFS: depthFirst,
    Dijkstra: grid => lowestCost(grid),
    'A*': grid => lowestCost(grid, true)
  };
  const api = { algorithms, neighbors, MinHeap, traceDijkstra, pathBreakdown };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Pathfinding = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
