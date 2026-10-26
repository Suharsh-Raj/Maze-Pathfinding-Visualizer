/* UI state and animation are separate from the pure pathfinding algorithms. */
'use strict';
const $ = id => document.getElementById(id);
let maze = MazeDemos.createGrid('routes');
let selectedTool = 'wall';
let running = false, paused = false, drawing = false;
let timer = null, animationVersion = 0, frames = [], frameIndex = 0;
let currentResult = null, focusCell = maze.start;
const cellButtons = [];
const terrainLabels = [], endpointLabels = [];
let renderedCols = 0, weightedDemoLoaded = false, expandedShown = 0;
const hints = {
  BFS: 'Shortest route by number of moves.',
  DFS: 'A valid route, without an optimality guarantee.',
  Dijkstra: 'Cheapest route, accounting for terrain costs.',
  'A*': 'Cheapest route, guided by Manhattan distance.'
};
const demoDescriptions = {
  routes: 'A corridor maze with junctions, dead ends, and alternative routes.',
  weighted: 'Three routes: short and expensive, medium with mixed costs, long and cheapest.',
  unreachable: 'Unreachable goal: an isolated passage cell. No route exists in this preset.',
  empty: 'An open grid with default start and goal positions.'
};
const difficultyHints = {
  easy: 'Straighter corridors, more alternatives, closer endpoints. Approximate difficulty.',
  medium: 'Balanced turns, alternative routes, and endpoint distance. Approximate difficulty.',
  hard: 'More turns, fewer alternatives, farther endpoints. Approximate difficulty.'
};

function buildGrid() {
  cellButtons.length = 0;
  terrainLabels.length = 0; endpointLabels.length = 0;
  renderedCols = maze.cols;
  focusCell = maze.start;
  $('grid').replaceChildren();
  $('grid').style.setProperty('--columns', maze.cols);
  $('grid').setAttribute('aria-rowcount', maze.rows);
  $('grid').setAttribute('aria-colcount', maze.cols);
  $('grid').setAttribute('aria-label', `Maze editor, ${maze.rows} rows and ${maze.cols} columns`);
  $('grid-dimensions').textContent = `${maze.rows} × ${maze.cols}`;
  $('grid').parentElement.style.setProperty('--grid-ratio', maze.cols / maze.rows);
  $('grid').parentElement.style.setProperty('--viewport-width', `${100 * maze.cols / maze.rows}vh`);
  $('grid').parentElement.style.setProperty('--reserved-width', `${340 * maze.cols / maze.rows}px`);
  const fragment = document.createDocumentFragment();
  for (let row = 0; row < maze.rows; row++) {
    const rowElement = document.createElement('div');
    rowElement.className = 'grid-row';
    rowElement.setAttribute('role', 'row');
    for (let col = 0; col < maze.cols; col++) {
      const id = row * maze.cols + col;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.id = id;
      button.setAttribute('role', 'gridcell');
      button.setAttribute('aria-rowindex', row + 1);
      button.setAttribute('aria-colindex', col + 1);
      button.tabIndex = id === focusCell ? 0 : -1;
      const terrain = document.createElement('span'); terrain.className = 'terrain-label';
      const endpoint = document.createElement('span'); endpoint.className = 'endpoint-entry';
      button.append(terrain, endpoint);
      terrainLabels.push(terrain); endpointLabels.push(endpoint);
      cellButtons.push(button);
      rowElement.append(button);
    }
    fragment.append(rowElement);
  }
  $('grid').append(fragment);
  paintGrid();
}

function paintCell(id) {
  const button = cellButtons[id];
  let type = maze.cells[id] === -1 ? 'wall' : maze.cells[id] > 1 ? 'weight' : 'empty';
  if (id === maze.start) type = 'start';
  if (id === maze.goal) type = 'goal';
  button.className = 'cell ' + type + (type === 'weight' ? ` cost-${maze.cells[id]}` : '');
  updateTerrainLabel(id);
  const entry = id === maze.start ? 'start, cost 0' : id === maze.goal ? 'goal, entry cost 1' : maze.cells[id] === -1 ? 'wall' : `entry cost ${maze.cells[id]}`;
  button.setAttribute('aria-label', `Row ${Math.floor(id / maze.cols) + 1}, column ${id % maze.cols + 1}: ${entry}`);
}
function updateTerrainLabel(id) {
  const showWeights = weightedDemoLoaded && $('demo').value === 'weighted';
  const isStart = id === maze.start, isGoal = id === maze.goal;
  terrainLabels[id].textContent = isStart ? 'S' : isGoal ? 'G' : showWeights && maze.cells[id] !== -1 ? String(maze.cells[id]) : '';
  endpointLabels[id].hidden = !showWeights || (!isStart && !isGoal);
  endpointLabels[id].textContent = showWeights && (isStart || isGoal) ? (isStart ? '0' : '1') : '';
}
function paintGrid() {
  if (cellButtons.length !== maze.cells.length || renderedCols !== maze.cols) { buildGrid(); return; }
  maze.cells.forEach((_, id) => paintCell(id));
}
function status(message, badge = 'READY') { $('status').textContent = message; $('state-badge').textContent = badge; }
function setControls() {
  for (const id of ['algorithm', 'demo', 'load-demo', 'difficulty', 'generate', 'run', 'compare']) $(id).disabled = running;
  document.querySelectorAll('.tool').forEach(button => { button.disabled = running; });
  cellButtons.forEach(button => { button.disabled = running; });
  $('pause').disabled = !running;
  $('pause').textContent = paused ? '▶ Resume' : 'Ⅱ Pause';
  $('grid-note').textContent = running ? 'Maze editing is locked while a search is active.' : 'Paint walls to change the journey.';
}
function clearMetrics() {
  for (const name of ['algorithm', 'moves', 'cost', 'expanded', 'time']) $('metric-' + name).textContent = '—';
  $('metric-found').textContent = 'No search yet';
}
function clearComparison() {
  $('comparison-body').innerHTML = '<tr><td colspan="6" class="table-empty">Your comparison will appear here. Select “Compare Algorithms” to begin.</td></tr>';
  $('pair-summary').hidden = true;
}

// Invalidate the old animation token as well as cancelling its timeout.
// A queued callback from a previous run can never paint over a newer run.
function resetSearch(message = 'Search reset. Your maze is preserved.') {
  animationVersion++;
  clearTimeout(timer);
  timer = null;
  running = false; paused = false; drawing = false;
  frames = []; frameIndex = 0; currentResult = null;
  expandedShown = 0;
  $('why-panel').hidden = true;
  $('pair-summary').hidden = true;
  paintGrid(); clearMetrics(); setControls(); status(message);
}

function editCell(id) {
  if (running || !Number.isInteger(id) || id < 0 || id >= maze.cells.length) return;
  if (id === maze.start || id === maze.goal) return;
  const value = selectedTool === 'wall' ? -1 : 1;
  if (!['start', 'goal'].includes(selectedTool) && maze.cells[id] === value) return;
  // Clear stale search/comparison data when the underlying maze changes.
  if (currentResult) resetSearch('Maze updated. Ready for another search.');
  clearComparison();
  if (selectedTool === 'start' || selectedTool === 'goal') {
    const oldId = maze[selectedTool];
    maze[selectedTool] = id;
    maze.cells[id] = 1;
    paintCell(oldId);
  } else maze.cells[id] = value;
  paintCell(id);
  // Generated metadata describes the original layout, not later manual edits.
  delete maze.generation;
  $('demo-description').textContent = 'Custom maze. Load a demo to restore a predefined example.';
  status('Maze updated. Ready for another search.');
}

function snapshot() { return { ...maze, cells: maze.cells.slice() }; }
function compute(name, grid) {
  const startTime = performance.now();
  const result = Pathfinding.algorithms[name](grid);
  const elapsed = performance.now() - startTime;
  return { ...result, name, elapsed };
}
function showResult(result) {
  $('metric-algorithm').textContent = result.name;
  $('metric-found').textContent = result.found ? 'Path found' : 'No path exists';
  $('metric-moves').textContent = result.moves ?? '—';
  $('metric-cost').textContent = result.cost ?? '—';
  $('metric-expanded').textContent = result.expanded.length;
  $('metric-time').textContent = result.elapsed.toFixed(3);
  if (result.name === 'Dijkstra' && result.found) {
    const breakdown = Pathfinding.pathBreakdown(maze, result.path);
    $('why-panel').hidden = false;
    $('why-summary').textContent = `${breakdown.moves} moves · total path cost ${breakdown.cost}.`;
    $('why-breakdown').textContent = breakdown.terms.map(term => `${term.count} ${term.count === 1 ? 'cell' : 'cells'} × ${term.cost}`).join(' + ') + ` = ${breakdown.cost}`;
  }
}

function showPairSummary(grid, bfs, dijkstra) {
  $('pair-summary').hidden = false;
  if (!bfs.found || !dijkstra.found) {
    $('pair-summary').textContent = 'Same unchanged maze: BFS and Dijkstra both report no path.';
    return;
  }
  const difference = bfs.cost > dijkstra.cost
    ? `Dijkstra saves ${bfs.cost - dijkstra.cost} cost units by considering entry costs; BFS minimizes moves and ignores weights.`
    : 'Both achieve the same cost on this maze; BFS optimizes moves, while Dijkstra optimizes total entry cost.';
  $('pair-summary').textContent = `Same unchanged maze — BFS: ${bfs.moves} moves, cost ${bfs.cost}; Dijkstra: ${dijkstra.moves} moves, cost ${dijkstra.cost}. ${difference}`;
}

function completeSearch() {
  running = false; timer = null;
  setControls(); showResult(currentResult);
  if (currentResult.name === 'BFS' || currentResult.name === 'Dijkstra') {
    const grid = snapshot();
    const bfs = currentResult.name === 'BFS' ? currentResult : Pathfinding.algorithms.BFS(grid);
    const dijkstra = currentResult.name === 'Dijkstra' ? currentResult : Pathfinding.algorithms.Dijkstra(grid);
    showPairSummary(grid, bfs, dijkstra);
  }
  status(currentResult.found
    ? `${currentResult.name}: path found — ${currentResult.moves} moves, total cost ${currentResult.cost}.`
    : `${currentResult.name}: No path exists. All reachable cells have been explored.`, 'COMPLETE');
}
function animationDelay() { return Math.round(2 + Math.pow((100 - Number($('speed').value)) / 99, 2) * 118); }
function animate(version) {
  if (version !== animationVersion || !running || paused) return;
  if (frameIndex === frames.length) {
    completeSearch();
    return;
  }
  const frame = frames[frameIndex++];
  cellButtons[frame.id].classList.add(frame.type);
  if (frame.type === 'explored') expandedShown++;
  status(frame.type === 'path' ? 'Path found. Tracing the final route…' : `Exploring with ${currentResult.name}… ${expandedShown} cells expanded.`, frame.type === 'path' ? 'TRACING' : 'RUNNING');
  if (frameIndex === frames.length) { completeSearch(); return; }
  // Slow the final trace slightly so the route is readable even at high speed.
  const delay = frame.type === 'path' ? Math.max(16, animationDelay() * 1.5) : animationDelay();
  timer = setTimeout(() => animate(version), delay);
}
function runSearch() {
  if (running) return;
  resetSearch();
  currentResult = compute($('algorithm').value, snapshot());
  const searchFrames = currentResult.expanded.map(id => ({ id, type: 'explored' }));
  frames = searchFrames.concat(currentResult.path.map(id => ({ id, type: 'path' })));
  running = true; setControls(); animate(animationVersion);
}
function compareAlgorithms() {
  if (running) return;
  const grid = snapshot(); // Every algorithm receives the same unmodified snapshot.
  const results = Object.keys(Pathfinding.algorithms).map(name => compute(name, grid));
  const body = $('comparison-body'); body.replaceChildren();
  for (const result of results) {
    const row = document.createElement('tr');
    for (const value of [result.name, result.found ? 'Yes' : 'No path exists', result.moves ?? '—', result.cost ?? '—', result.expanded.length, result.elapsed.toFixed(3)]) {
      const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
    }
    body.append(row);
  }
  showPairSummary(grid, results.find(result => result.name === 'BFS'), results.find(result => result.name === 'Dijkstra'));
  status('Comparison complete. All algorithms used the same unchanged grid; results are below.', 'COMPARED');
}

$('run').addEventListener('click', runSearch);
$('compare').addEventListener('click', compareAlgorithms);
$('pause').addEventListener('click', () => {
  if (!running) return;
  paused = !paused;
  clearTimeout(timer); timer = null; setControls();
  if (paused) status('Paused. Resume to continue, or reset the search.', 'PAUSED');
  else animate(animationVersion);
});
$('reset').addEventListener('click', () => resetSearch());
$('generate').addEventListener('click', () => {
  if (running) return;
  const difficulty = $('difficulty').value;
  maze = MazeGeneration.generateMaze(difficulty);
  weightedDemoLoaded = false;
  const label = difficulty[0].toUpperCase() + difficulty.slice(1);
  resetSearch(`${label} maze generated with randomized DFS backtracking. A route and alternatives are available.`);
  clearComparison();
  $('demo-description').textContent = `${label} generated maze · ${maze.generation.loopsAdded} extra connections. Demo choices load separate examples.`;
});
$('clear').addEventListener('click', () => {
  weightedDemoLoaded = false;
  maze = MazeDemos.createGrid(); resetSearch('Grid cleared. Default endpoints restored.'); clearComparison();
  $('demo').value = 'empty'; $('demo-description').textContent = demoDescriptions.empty;
});
$('load-demo').addEventListener('click', () => {
  if (running) return;
  maze = MazeDemos.createGrid($('demo').value);
  weightedDemoLoaded = $('demo').value === 'weighted';
  resetSearch('Demo loaded. Choose an algorithm and run the search.'); clearComparison();
  $('demo-description').textContent = demoDescriptions[$('demo').value];
});
$('algorithm').addEventListener('change', () => { $('algorithm-hint').textContent = hints[$('algorithm').value]; setControls(); });
$('demo').addEventListener('change', () => { cellButtons.forEach((_, id) => updateTerrainLabel(id)); });
$('difficulty').addEventListener('change', () => { $('difficulty-hint').textContent = difficultyHints[$('difficulty').value]; });
$('speed').addEventListener('input', () => {
  const value = Number($('speed').value);
  $('speed-value').textContent = value < 35 ? 'Slow' : value < 70 ? 'Medium' : value < 95 ? 'Fast' : 'Fastest';
});
document.querySelectorAll('.tool').forEach(button => button.addEventListener('click', () => {
  selectedTool = button.dataset.tool;
  document.querySelectorAll('.tool').forEach(tool => {
    const active = tool === button; tool.classList.toggle('active', active); tool.setAttribute('aria-pressed', active);
  });
}));
function cellAtPointer(event) {
  const target = document.elementFromPoint(event.clientX, event.clientY);
  return target && target.closest('#grid .cell');
}
$('grid').addEventListener('pointerdown', event => {
  if (running || event.button !== 0) return;
  const cell = cellAtPointer(event); if (!cell) return;
  event.preventDefault();
  editCell(Number(cell.dataset.id));
  drawing = !['start', 'goal'].includes(selectedTool);
});
window.addEventListener('pointermove', event => {
  if (!drawing || running) return;
  const cell = cellAtPointer(event); if (cell) editCell(Number(cell.dataset.id));
});
for (const event of ['pointerup', 'pointercancel', 'blur']) window.addEventListener(event, () => { drawing = false; });
// Keyboard and assistive-technology activation generates a click with detail 0.
$('grid').addEventListener('click', event => {
  const cell = event.target.closest('.cell');
  if (event.detail === 0 && cell) editCell(Number(cell.dataset.id));
});
$('grid').addEventListener('keydown', event => {
  const cell = event.target.closest('.cell'); if (!cell || running) return;
  const id = Number(cell.dataset.id), row = Math.floor(id / maze.cols), col = id % maze.cols;
  let next = id;
  if (event.key === 'ArrowUp') next = Math.max(0, row - 1) * maze.cols + col;
  else if (event.key === 'ArrowRight') next = row * maze.cols + Math.min(maze.cols - 1, col + 1);
  else if (event.key === 'ArrowDown') next = Math.min(maze.rows - 1, row + 1) * maze.cols + col;
  else if (event.key === 'ArrowLeft') next = row * maze.cols + Math.max(0, col - 1);
  else return;
  event.preventDefault(); cellButtons[focusCell].tabIndex = -1; focusCell = next;
  cellButtons[next].tabIndex = 0; cellButtons[next].focus();
});
buildGrid();
setControls();
