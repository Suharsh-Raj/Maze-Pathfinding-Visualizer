/* Deterministic examples. -1 = wall, 1 = normal, 5 = weighted terrain. */
(function (root) {
  'use strict';
  const generator = typeof module !== 'undefined' && module.exports
    ? require('./maze-generation.js') : root.MazeGeneration;

  function createGrid(example = 'empty') {
    const rows = 21, cols = 31;
    const cells = Array(rows * cols).fill(1);
    const grid = { rows, cols, cells, start: 10 * cols + 4, goal: 10 * cols + 25 };
    if (example === 'routes') {
      // Same corridor maze each time, including loops and distant endpoints.
      return generator.generateMaze('medium', generator.createSeededRandom(1729));
    }

    if (example === 'weighted') {
      cells.fill(-1);
      // The direct corridor: 21 moves, including 20 expensive cells; cost 101.
      // The upper detour: 5 + 21 + 5 = 31 normal moves; cost 31.
      for (let col = 4; col <= 25; col++) {
        cells[10 * cols + col] = col > 4 && col < 25 ? 5 : 1;
        cells[5 * cols + col] = 1;
      }
      for (let row = 5; row <= 10; row++) {
        cells[row * cols + 4] = 1;
        cells[row * cols + 25] = 1;
      }
      // Bent dead-end branches add junctions without adding another S–G route.
      for (let row = 2; row <= 4; row++) cells[row * cols + 9] = 1;
      for (let col = 9; col <= 14; col++) cells[2 * cols + col] = 1;
      for (let row = 2; row <= 4; row++) cells[row * cols + 20] = 1;
      for (let col = 17; col <= 20; col++) cells[2 * cols + col] = 1;
      for (let row = 11; row <= 16; row++) cells[row * cols + 7] = 1;
      for (let col = 3; col <= 7; col++) cells[16 * cols + col] = 1;
      for (let row = 11; row <= 14; row++) cells[row * cols + 16] = 1;
      for (let col = 16; col <= 21; col++) cells[14 * cols + col] = 1;
      for (let row = 14; row <= 18; row++) cells[row * cols + 21] = 1;
      for (let col = 26; col <= 28; col++) cells[8 * cols + col] = 1;
      for (let row = 8; row <= 12; row++) cells[row * cols + 28] = 1;
    } else if (example === 'unreachable') {
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
  const api = { createGrid };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MazeDemos = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
