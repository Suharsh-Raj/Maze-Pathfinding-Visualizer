/* Deterministic examples. -1 = wall; traversable entry costs are 1, 2, 5, 9. */
(function (root) {
  'use strict';
  const generator = typeof module !== 'undefined' && module.exports
    ? require('./maze-generation.js') : root.MazeGeneration;

  function createGrid(example = 'empty') {
    if (example === 'weighted') return createWeightedGrid();
    const rows = 21, cols = 31;
    const cells = Array(rows * cols).fill(1);
    const grid = { rows, cols, cells, start: 10 * cols + 4, goal: 10 * cols + 25 };
    if (example === 'routes') {
      // Same corridor maze each time, including loops and distant endpoints.
      return generator.generateMaze('medium', generator.createSeededRandom(1729));
    }

    if (example === 'unreachable') {
      const blocked = generator.generateMaze('medium', generator.createSeededRandom(31415));
      // Deliberately isolated goal; this preset is distinct from generated mazes.
      for (const id of [blocked.goal - cols, blocked.goal + 1, blocked.goal + cols, blocked.goal - 1]) {
        blocked.cells[id] = -1;
      }
      delete blocked.generation; // Its original reachable-distance data no longer applies.
      return blocked;
    }
    return grid;
  }

  function createWeightedGrid() {
    // Exactly three internally disjoint S–G corridors. Everything else stays
    // walled: adjacent routes cannot accidentally create a shortcut.
    const rows = 15, cols = 23, cells = Array(rows * cols).fill(-1);
    const start = 6 * cols + 6, goal = 6 * cols + 16;
    for (let col = 6; col <= 16; col++) {
      cells[6 * cols + col] = col === 6 || col === 16 ? 1 : (col % 3 === 0 ? 5 : 9);
      cells[3 * cols + col] = 1;
      cells[11 * cols + col] = 1;
    }
    for (let row = 3; row <= 11; row++) {
      cells[row * cols + 6] = 1;
      cells[row * cols + 16] = 1;
    }
    // Top: medium distance, mixed terrain. Bottom: long but all cost 1.
    for (let col = 7; col <= 12; col++) cells[3 * cols + col] = 2;
    cells[3 * cols + 13] = 5;
    cells[3 * cols + 14] = 5;
    return { rows, cols, cells, start, goal };
  }
  const api = { createGrid };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MazeDemos = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
