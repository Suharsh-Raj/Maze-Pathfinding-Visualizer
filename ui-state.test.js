/* Optional state checks: node tests/ui-state.test.js.
 * Runs the real UI script with a small DOM/timer test double; this is not a
 * browser rendering test. No package installation or browser is required.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Pathfinding = require('./algorithms.js');
const MazeDemos = require('./demos.js');
const MazeGeneration = require('./maze-generation.js');

class Element {
  constructor(tag = 'div') {
    this.tagName = tag; this.children = []; this.attributes = {};
    this.dataset = {}; this.listeners = {}; this.className = '';
    this.textContent = ''; this.disabled = false; this.value = ''; this.tabIndex = -1;
    this.hidden = false; this.checked = false; this.style = { setProperty() {} };
    this.classList = {
      add: name => { if (!this.className.split(' ').includes(name)) this.className += ' ' + name; },
      toggle: (name, active) => {
        this.className = this.className.split(' ').filter(item => item !== name).join(' ');
        if (active) this.classList.add(name);
      }
    };
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(name, handler) { (this.listeners[name] ??= []).push(handler); }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  set innerHTML(value) { this.html = value; this.children = []; }
  get innerHTML() { return this.html; }
  closest(selector) { return selector.includes('.cell') && this.className.split(' ').includes('cell') ? this : null; }
  focus() { this.focused = true; }
  fire(name, data = {}) {
    for (const handler of this.listeners[name] ?? []) handler({ target: this, preventDefault() {}, ...data });
  }
}

// Derive IDs from the real HTML so missing UI elements cause a test failure.
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const elements = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element()]));
assert.equal(Object.keys(elements).length, [...html.matchAll(/id="([^"]+)"/g)].length, 'Duplicate HTML IDs');
const tools = ['wall', 'start', 'goal', 'erase'].map(name => {
  const element = new Element('button'); element.dataset.tool = name; return element;
});
elements.grid.parentElement = new Element();
const window = new Element();
let pointerCell = null, nextTimer = 0, clock = 0;
const pending = new Map();
const context = vm.createContext({
  Pathfinding, MazeDemos, MazeGeneration, window,
  document: {
    getElementById: id => elements[id] ?? null,
    createElement: tag => new Element(tag),
    createDocumentFragment: () => new Element('fragment'),
    querySelectorAll: selector => selector === '.tool' ? tools : [],
    elementFromPoint: () => pointerCell
  },
  performance: { now: () => ++clock },
  setTimeout: callback => { pending.set(++nextTimer, callback); return nextTimer; },
  clearTimeout: id => pending.delete(id)
});
elements.algorithm.value = 'BFS'; elements.demo.value = 'routes'; elements.speed.value = '80';
elements.difficulty.value = 'medium';
vm.runInContext(fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8'), context);
const read = expression => vm.runInContext(expression, context);
const state = () => read('JSON.stringify(maze)');
const cell = id => read(`cellButtons[${id}]`);
const click = id => { assert(!elements[id].disabled, `${id} is disabled`); elements[id].fire('click'); };
const tool = name => tools.find(element => element.dataset.tool === name).fire('click');
function paint(id) { elements.grid.fire('click', { target: cell(id), detail: 0 }); }
function tick() {
  const next = pending.entries().next();
  if (next.done) return;
  const [id, callback] = next.value; pending.delete(id); callback();
}
function finish() {
  let guard = 5000;
  while (pending.size && guard-- > 0) tick();
  assert(guard > 0, 'Animation never completed');
}
function load(name) { elements.demo.value = name; click('load-demo'); }

function verifyLabelVisibility() {
  function noNumbers() {
    assert(read('terrainLabels.every(label => !/[0-9]/.test(label.textContent))'));
    assert(read('endpointLabels.every(label => label.hidden && label.textContent === "")'));
    assert(read('cellButtons.every(button => button.children.length === 2)'), 'No cost badge nodes remain');
  }
  function weightedNumbers() {
    assert(read('maze.cells.every((cost, id) => id === maze.start || id === maze.goal || terrainLabels[id].textContent === (cost === -1 ? "" : String(cost)))'));
  }
  for (const id of ['terrain-cost', 'show-costs', 'step-mode', 'next-step', 'trace-panel']) assert(!elements[id]);
  assert(!html.includes('data-tool="weight"'));
  for (const demo of ['routes', 'empty', 'unreachable']) { load(demo); noNumbers(); assert(read('maze.cells.every(cost => cost === -1 || cost === 1)')); }
  for (const difficulty of ['easy', 'medium', 'hard']) {
    elements.difficulty.value = difficulty; click('generate'); noNumbers();
    assert(read('maze.cells.every(cost => cost === -1 || cost === 1)'));
  }
  for (const demo of ['routes', 'weighted']) {
    load(demo);
    for (const name of Object.keys(Pathfinding.algorithms)) {
      elements.algorithm.value = name; click('run'); tick();
      if (demo === 'weighted') weightedNumbers(); else noNumbers();
      finish(); assert.equal(elements['metric-found'].textContent, 'Path found');
      if (demo === 'weighted') weightedNumbers(); else noNumbers();
    }
  }
  const weights = state();
  const pathCells = read('cellButtons.filter(button => button.className.includes("path")).length');
  elements.demo.value = 'routes'; elements.demo.fire('change'); noNumbers();
  assert.equal(state(), weights, 'Selection does not edit terrain');
  assert.equal(read('cellButtons.filter(button => button.className.includes("path")).length'), pathCells);
  click('load-demo'); noNumbers();
  // Selecting weighted before loading must not put numbers on a normal maze.
  elements.demo.value = 'weighted'; elements.demo.fire('change'); noNumbers();
  click('load-demo'); weightedNumbers();
  click('generate'); noNumbers();
  load('weighted'); weightedNumbers(); click('clear'); noNumbers();
}
if (process.argv.includes('--labels-only')) {
  verifyLabelVisibility();
  console.log('PASS: normal/generated mazes have no numbers, weighted labels survive ordinary searches, and switching/clearing removes stale labels.');
  process.exit(0);
}

assert.equal(read('cellButtons.length'), 651);
assert.equal(read('cellButtons.filter(button => button.tabIndex === 0).length'), 1);
const { start: defaultStart, goal: defaultGoal } = MazeDemos.createGrid('empty');
const initialStart = read('maze.start'), initialGoal = read('maze.goal');
const original = state();
tool('wall'); paint(initialStart); paint(initialGoal);
assert.equal(state(), original, 'Endpoint terrain was overwritten');

tool('wall'); paint(0); assert.equal(read('maze.cells[0]'), -1);
tool('erase'); paint(0); assert.equal(read('maze.cells[0]'), 1);
tool('start'); paint(1); assert.equal(read('maze.start'), 1); assert.equal(read('maze.cells[1]'), 1);
paint(initialGoal); assert.notEqual(read('maze.start'), read('maze.goal'));
tool('goal'); paint(2); assert.equal(read('maze.goal'), 2);
assert.equal(read('cellButtons.filter(button => button.className === "cell start").length'), 1);
assert.equal(read('cellButtons.filter(button => button.className === "cell goal").length'), 1);
click('clear'); assert.equal(read('maze.start'), defaultStart); assert.equal(read('maze.goal'), defaultGoal);
assert(read('maze.cells.every(value => value === 1)'));

// Pointer painting and arrow-key navigation use the actual registered handlers.
tool('wall'); pointerCell = cell(0);
elements.grid.fire('pointerdown', { button: 0, clientX: 0, clientY: 0 });
pointerCell = cell(1); window.fire('pointermove', { clientX: 1, clientY: 0 });
window.fire('pointerup');
pointerCell = cell(2); window.fire('pointermove', { clientX: 2, clientY: 0 });
assert.equal(read('maze.cells[0]'), -1); assert.equal(read('maze.cells[1]'), -1);
assert.equal(read('maze.cells[2]'), 1);
elements.grid.fire('keydown', { target: cell(defaultStart), key: 'ArrowRight' });
assert.equal(cell(defaultStart + 1).tabIndex, 0);
assert(cell(defaultStart + 1).focused);

load('weighted');
const { start: weightedStart, goal: weightedGoal } = MazeDemos.createGrid('weighted');
assert.equal(read('cellButtons.length'), 345);
const beforeRun = state();
click('run');
assert(read('running')); assert(elements.run.disabled); assert(elements.compare.disabled);
assert(elements.algorithm.disabled && elements.demo.disabled && elements['load-demo'].disabled);
assert(elements.generate.disabled && elements.difficulty.disabled);
assert(tools.every(button => button.disabled)); assert(cell(0).disabled);
paint(0); assert.equal(state(), beforeRun, 'Editing was allowed during a run');
tick(); tick();
click('pause'); assert(read('paused')); assert.equal(pending.size, 0);
assert.equal(elements['state-badge'].textContent, 'PAUSED');
const pausedIndex = read('frameIndex'); tick(); assert.equal(read('frameIndex'), pausedIndex);
paint(0); assert.equal(state(), beforeRun, 'Editing was allowed while paused');
elements.generate.fire('click'); assert.equal(state(), beforeRun, 'Generation was allowed while paused');
assert.equal(read('terrainLabels[maze.start].textContent'), 'S'); assert.equal(read('terrainLabels[maze.goal].textContent'), 'G');
click('pause'); assert(!read('paused')); assert(read('frameIndex') > pausedIndex);
finish();
assert(!read('running')); assert(!elements.run.disabled); assert(elements.pause.disabled);
assert.equal(elements['metric-moves'].textContent, 10);
assert.equal(elements['metric-cost'].textContent, 70);
assert.equal(elements['metric-found'].textContent, 'Path found');
assert.equal(elements['metric-time'].textContent, '1.000');
assert.equal(read('cellButtons.filter(button => button.className.split(" ").includes("path")).length'), 11);
assert.equal(state(), beforeRun);
assert.equal(read('terrainLabels[maze.start].textContent'), 'S'); assert.equal(read('terrainLabels[maze.goal].textContent'), 'G');
assert(cell(weightedStart).className.includes('start') && cell(weightedGoal).className.includes('goal'));

// Reset cancels timers and ignores a captured callback even after a NEW run starts.
click('run'); const oldCallback = [...pending.values()][0];
click('reset'); assert.equal(pending.size, 0); assert.equal(state(), beforeRun);
assert.equal(elements['metric-moves'].textContent, '—');
assert.equal(read('cellButtons.filter(button => /explored|path/.test(button.className)).length'), 0);
elements.algorithm.value = 'Dijkstra'; click('run');
const newIndex = read('frameIndex'); oldCallback(); assert.equal(read('frameIndex'), newIndex);
finish(); assert.equal(elements['metric-moves'].textContent, 20); assert.equal(elements['metric-cost'].textContent, 20);
assert(!elements['why-panel'].hidden);
assert.equal(elements['why-breakdown'].textContent, '20 cells × 1 = 20');
click('run'); click('pause'); click('reset'); assert.equal(pending.size, 0); assert(!read('running || paused'));

// Comparison must not change the maze or launch animation; metrics match pure runs.
const beforeCompare = state(); click('compare'); assert.equal(state(), beforeCompare); assert.equal(pending.size, 0);
assert.equal(elements['comparison-body'].children.length, 4);
for (const row of elements['comparison-body'].children) {
  const name = row.children[0].textContent;
  const expected = Pathfinding.algorithms[name](JSON.parse(beforeCompare));
  assert.equal(row.children[2].textContent, expected.moves);
  assert.equal(row.children[3].textContent, expected.cost);
  assert.equal(row.children[4].textContent, expected.expanded.length);
}
click('compare'); assert.equal(elements['comparison-body'].children.length, 4, 'Repeated comparisons accumulated rows');
tool('erase'); paint(0); assert.equal(elements['comparison-body'].children.length, 0, 'Stale comparison survived a grid change');

load('unreachable');
for (const name of Object.keys(Pathfinding.algorithms)) {
  elements.algorithm.value = name; click('run'); finish();
  assert.equal(elements['metric-found'].textContent, 'No path exists');
  assert.equal(elements['metric-cost'].textContent, '—');
  assert(elements.status.textContent.includes('No path exists'));
}
click('compare');
assert(elements['comparison-body'].children.every(row => row.children[1].textContent === 'No path exists'));

// Clear is allowed during animation and restores both terrain and endpoints.
click('run'); const cancelledCallback = [...pending.values()][0]; click('clear'); cancelledCallback();
assert.equal(pending.size, 0); assert(read('maze.cells.every(value => value === 1)'));
assert.equal(read('maze.start'), defaultStart); assert.equal(read('maze.goal'), defaultGoal);
assert.equal(elements['state-badge'].textContent, 'READY');

// Generate all difficulty presets, compare and animate on them, then edit.
for (const difficulty of ['easy', 'medium', 'hard']) {
  elements.difficulty.value = difficulty; click('generate');
  assert.equal(read('maze.generation.difficulty'), difficulty);
  assert.equal(read('maze.rows * maze.cols'), 651);
  assert(read('maze.generation.loopsAdded > 0'));
  assert.equal(elements['comparison-body'].children.length, 0);
  const generated = state(); click('compare'); assert.equal(state(), generated);
  assert(elements['comparison-body'].children.every(row => row.children[1].textContent === 'Yes'));
  click('run'); tick(); click('pause'); click('reset');
  assert.equal(state(), generated); assert.equal(pending.size, 0);
  click('run'); finish();
  assert.equal(elements['metric-found'].textContent, 'Path found');
  assert.equal(read('terrainLabels[maze.start].textContent'), 'S');
  assert.equal(read('terrainLabels[maze.goal].textContent'), 'G');
  tool('erase'); paint(0);
  assert.equal(read('maze.cells[0]'), 1, 'Manual editing stopped working after generation');
  assert.equal(read('maze.generation'), undefined, 'Generated metadata survived manual editing');
  assert.equal(elements['comparison-body'].children.length, 0);
}
verifyLabelVisibility();
console.log('PASS: existing controls and demo-specific label visibility.');
