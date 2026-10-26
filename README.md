# Maze Pathfinding Visualizer and Algorithm Comparison

Design and Analysis of Algorithms (DAA) mini project built with plain HTML, CSS, and JavaScript. The objective is to visualize how different graph-search strategies explore the same maze, and distinguish the **fewest moves** from the **lowest movement cost**.

## Features and controls

- 21 × 31 generated grid, plus a smaller 15 × 23 weighted teaching demo; up, right, down, and left movement, without diagonals.
- BFS, iterative DFS, Dijkstra, and A* implemented from scratch.
- **Generate Maze** creates narrow corridors, turns, junctions, and dead ends using randomized DFS backtracking. **Easy**, **Medium**, and **Hard** are approximate structure presets. Separating walls are removed afterward to add loops and alternative routes.
- Wall, weighted terrain, start, goal, and eraser tools. Click or drag to paint terrain. Click a cell to relocate an endpoint.
- Exactly one start and goal, always distinct. Wall, weight, and eraser tools cannot overwrite endpoints. Relocating an endpoint clears the destination terrain to normal.
- The Weight tool selector supports entry costs **1, 2, 5, and 9**. Walls are impassable. Moving **into** a cell incurs its cost; the starting cell costs **0**, and the goal always has entry cost **1**. Moving an endpoint restores normal terrain there. Every passage keeps its terrain label through exploration and path highlighting.
- Optional **Show accumulated costs** displays Dijkstra's discovered distances as separate blue `g:` badges: light blue is tentative, dark blue is settled. Unknown cells remain blank. On small screens, the grid scrolls to keep both labels legible.
- **Step-by-step Dijkstra** and **Next step** show initialization, minimum-cost heap removal, each neighbor's candidate cost, accepted updates, rejected candidates, goal settlement, and the path trace. Manual stepping schedules no animation timer; Reset and Clear cancel it safely.
- After Dijkstra finishes, **Why this path?** calculates moves, total cost, and a grouped cost equation from the actual returned path. The comparison explains BFS versus Dijkstra on the same unchanged maze.
- Animated expansion order and reconstructed final path, with a legend and visible terrain numbers.
- **Pause/Resume** and an adjustable animation-speed slider, which remains usable during a search.
- **Reset Search** cancels animation and removes the search overlay and latest-run metrics while preserving the maze. Existing comparison results remain valid for that unchanged maze.
- **Clear Grid** cancels animation and restores an empty grid, default endpoints, and empty results.
- Editing, algorithm selection, maze generation, difficulty selection, demo loading, and comparison are disabled throughout a run, including while paused. Reset and Clear remain available.
- **Compare Algorithms** evaluates all four algorithms on the same unchanged grid without animation. Editing or loading a different maze clears the old comparison.
- A compact grid with square cells, dark walls, light passages, and distinct exploration, path, and weighted-terrain colors. Start and goal markers remain visible during animation; the latest result stays near the grid.
- Accessible labels, keyboard editing, and responsive controls. Tab to the grid, use arrow keys to move, and Enter/Space to apply the selected tool.

## Files

```text
index.html                  Interface, legend, comparison table, and learning notes
style.css                   Layout, responsive styles, and cell colors
script.js                   Editing, UI state, timing, results, and animation
algorithms.js               Pure searches, binary heap, optional trace, path breakdown
maze-generation.js          Randomized DFS carving, loops, and endpoint placement
demos.js                    Three deterministic demo mazes and the empty grid
README.md                   Setup, explanations, demonstration, and viva answers
algorithms.test.js          Independent optimality and path-validity checks
maze-generation.test.js     Generated-maze structure and reachability checks
ui-state.test.js            UI state and timer checks using test doubles
weighted-demo.test.js       Exhaustive three-route and teaching-trace verification
```

The algorithm files also export their functions for Node-based tests; the browser loads them as globals. No library is used for pathfinding.

## How maze generation works

**Randomized DFS backtracking is the maze-generation method.** It is separate from the selected pathfinding algorithm: selecting BFS, DFS, Dijkstra, or A* only changes how the finished maze is searched.

The generator starts with a wall in every cell. It treats interior cells at odd row and column positions as rooms. Starting from one room, it uses a stack to visit a randomly chosen unvisited room two positions away and carves both that room and the wall between them. When a room has no unvisited neighbors, it backtracks. The outside border stays walled, and walls remain between adjacent corridors. Every room is connected by this process.

DFS carving alone makes a tree, with exactly one simple route between any two passage cells. A second step removes a controlled number of walls separating already connected passages, without opening a 2 × 2 square or the outer border. Each such opening adds a cycle, creating alternative routes for comparing path quality. Start and goal are distinct normal passage cells, selected using passage-graph distances so they are far apart and a route is guaranteed. Their route includes part of a cycle, so the extra passages give alternatives between the endpoints rather than only in an unrelated branch.

The presets vary how often carving continues in the same direction, how many extra openings are added, and the target start-to-goal distance. Easy favors more alternatives and shorter trips; Hard favors fewer alternatives and longer trips; Medium is between them. These are **approximate difficulty presets**, not guarantees about a person's solving time or an algorithm's expansion count. Random generation can produce different results on each click.

| Preset | Extra wall openings | Straight-corridor preference | Endpoint distance target |
| --- | ---: | --- | --- |
| Easy | 18 | Higher | 65–78% of the farthest eligible pair |
| Medium | 10 | Moderate | 82–92% of the farthest eligible pair |
| Hard | 4 | Lower; more turns | 95–100% of the farthest eligible pair |

An eligible pair has a shortest route that includes a cycle edge; distance is measured along passages after loops are added, not as a straight line. If no pair falls in the target band, the closest eligible distance is used.

The default **Corridor maze · loops** example is a Medium maze with a fixed seed, so it is reproducible. **Weighted · cost vs. distance** contains three deliberately separated corridors, described below. **Unreachable goal · no route** is a separate, clearly labeled exception to the generation reachability guarantee: its goal is intentionally isolated. All mazes remain manually editable after loading or generation; later edits can make a goal unreachable.

## How the algorithms work

Cells are graph vertices. A cell's integer ID is `row * columns + column`. The terrain array stores `-1` for walls and an entry cost of `1`, `2`, `5`, or `9` for passages. Neighbors are always considered **up, right, down, left**. DFS inserts neighbors in reverse order so the stack prefers that order. Equal-priority heap entries are removed in insertion order for reproducibility.

| Algorithm | Main data structure and rule | Guarantee | Search time |
| --- | --- | --- | --- |
| BFS | FIFO queue; explore cells layer by layer | Minimum number of moves; minimum cost only when movement costs are equal | O(V + E) |
| DFS | LIFO stack; follow a branch before alternatives | A valid path if one exists; no shortest/cheapest guarantee | O(V + E) |
| Dijkstra | Binary min-heap ordered by cost so far, `g` | Minimum movement cost with nonnegative edge costs | O((V + E) log V) |
| A* | Binary min-heap ordered by `g + h` | Minimum movement cost with the consistent heuristic used here | O((V + E) log V) on this grid |

**V** is the number of traversable cells. **E** is the number of connections between neighboring traversable cells. Every cell has at most four neighbors, so **E = O(V)**. Directional traversal can assign different costs to the two directions of a connection because entering each destination incurs that destination's cost; this does not change the asymptotic edge count.

BFS and DFS mark cells when adding them to the queue or stack, preventing duplicate insertions. BFS uses an increasing queue-head index instead of `Array.shift()`, avoiding repeated array reindexing. DFS is iterative to avoid recursion depth issues.

Dijkstra and A* relax neighboring distances: if a newly found route is cheaper, replace its distance and parent and push a new heap entry. The implementation uses **lazy duplicate entries**, ignoring stale entries when popped. A binary heap inserts and removes entries in logarithmic time. There are O(E) insertions; the general lazy-heap bound is O(V + E log(E + 1)), giving O((V + E) log V) for this bounded-degree grid. Each cell is settled at most once, including for A* because the heuristic is consistent.

A* uses:

```text
h(cell) = (absolute row difference + absolute column difference) × 1
f(cell) = g(cell) + h(cell)
```

Manhattan distance counts the minimum four-direction moves on an obstacle-free grid. Multiplying by the minimum terrain cost (1) cannot overestimate the remaining cost: the heuristic is **admissible**. Along any move, Manhattan distance changes by at most 1 and the step costs at least 1, so `h(u) <= cost(u,v) + h(v)`: it is also **consistent**. Walls and heavier terrain do not invalidate this lower bound. A* can explore fewer cells, but is not guaranteed to be faster in every small example. Its stated complexity applies to this explicit finite grid and this consistent heuristic; it is not a universal bound for every A* search problem.

**Implementation overhead:** the graph-search bounds above use traversable V. This implementation initializes parent/distance arrays indexed by all N = rows × columns cells, including walls, adding O(N) time and space. BFS/DFS use O(V) auxiliary search storage beyond those arrays. The heap searches use O(V + E) auxiliary search storage, also O(V) on this grid. Returned expansion and path arrays use O(V) space.

### Path reconstruction

Every discovery or distance improvement stores a parent pointer. When the goal is reached, follow its parents back to the start and reverse the resulting list. The path includes both endpoints, so:

```text
moves = path.length - 1
cost  = sum of terrain costs for path[1] through path[last]
```

If the goal is unreachable, the path is empty and moves/cost are shown as a dash, not zero. Each search stops when the goal is removed from its frontier and processed, rather than merely discovered.

## Weighted versus unweighted behavior

BFS treats every permitted move equally during its search; its reported path cost still sums the actual terrain costs. DFS likewise reports the actual cost of whichever route it finds. Dijkstra and A* use terrain costs while choosing routes.

On an **equal-cost grid**, BFS and Dijkstra have the **same optimal path cost**, although exploration order and tie-breaking can differ. With this implementation's stable heap and fixed neighbor order, they also produce the same route on the supplied unweighted examples. Equal optimal cost does not in general require identical routes.

The deterministic **Weighted · cost vs. distance** demo has exactly three simple start-to-goal routes. The wall-separated interiors have no cross-connections:

| Route | Moves | Entered-cell breakdown | Total cost |
| --- | ---: | --- | ---: |
| Direct / short | 10 | 1 × 1 + 3 × 5 + 6 × 9 | 70 |
| Upper / medium | 16 | 8 × 1 + 6 × 2 + 2 × 5 | 30 |
| Lower / long | 20 | 20 × 1 | 20 |

All counts exclude the start and include the goal. Path length counts moves, so a route containing 21 cells has 20 moves. All other cells remain walls; loading the demo restores its original weights.

| Algorithm | Moves | Cost | What to discuss |
| --- | ---: | ---: | --- |
| BFS | 10 | 70 | The direct route minimizes moves while ignoring weights. |
| DFS | 16 | 30 | The fixed neighbor order happens to take the upper route; this is not an optimality guarantee. |
| Dijkstra | 20 | 20 | The lower route minimizes total accumulated entry cost. |
| A* | 20 | 20 | The admissible heuristic preserves minimum cost. |

### Explain and step through Dijkstra

Select Dijkstra and optionally enable **Show accumulated costs**. Terrain numbers remain separate from `g:` badges, including under overlays. A discovered badge is tentative until removal of that cell's current best heap entry settles it; stale entries are ignored. The trace also exposes settled state through cell labels for assistive technology. Undiscovered cells are blank, conceptually infinity.

Enable **Step-by-step Dijkstra**, click Run, then Next step. The highlighted blue cell is the current settled cell; a purple inset identifies the neighbor being examined. Each relaxation explains:

```text
candidate cost = current accumulated cost + neighbor entry cost
if candidate < previous distance: update distance and parent, then push to heap
otherwise: keep the existing distance and parent
```

New discoveries improve infinity to a finite cost. The code also handles any strictly cheaper finite candidate. In this destination-entry-cost grid, a cell's first discovery by Dijkstra is already optimal because predecessors are processed in increasing distance order; do not fabricate a finite decrease to illustrate the more general relaxation rule. A badge is still labeled tentative until settlement. The algorithm terminates when the goal's non-stale entry is **removed** from the heap, never merely when the goal is discovered. Path reconstruction/animation follows that settlement.

The **Why this path?** panel sums `path.slice(1)` and groups its real terrain costs, without hardcoded demo results. For example, change the first two lower-route cells below S to cost 9: Dijkstra switches to the upper route, and its panel becomes `16 moves`, cost `30`, with `8 cells × 1 + 6 cells × 2 + 2 cells × 5 = 30`. Change weights again and rerun to see the calculation change. Endpoints cannot be painted over.

**Compare Algorithms** uses one grid snapshot for all algorithms; its explanation reports BFS and Dijkstra's actual moves/costs. The same summary is refreshed after a BFS or Dijkstra run. Editing invalidates old results and explanations.

## What the results measure

Each completed run reports the algorithm, path-found status, moves, terrain cost, unique expanded cells, and approximate computation time in milliseconds.

**Expanded** means a unique cell removed from the queue, stack, or heap and processed, including the start and the goal if reached. Stale heap entries are excluded. This includes the final goal processing even though the algorithm stops without scanning its neighbors. Discovery (adding a cell to the frontier) is different from expansion.

`performance.now()` is called immediately before and after the pure algorithm call. The measurement includes algorithm bookkeeping, expansion recording, reconstruction, and path-cost calculation. Grid snapshot creation, educational trace recording/replay, DOM rendering, animation, and deliberate delays are outside the timed region. Dijkstra's trace is an optional second execution of the same search core after the timed run; comparisons do not record traces. Three decimal places are displayed, but results are **approximate**: timer resolution, runtime warm-up, garbage collection, and scheduling can affect tiny-grid measurements. A single run should not be treated as a reliable speed ranking.

Animation uses a single scheduled timeout. Pause cancels the timeout; resume continues from the next frame. Reset also increments an animation-version token, so even an old callback cannot draw into a new run.

## Short classroom demonstration

1. **Corridor maze · loops:** load this deterministic corridor maze, run BFS, and show the expanding layers and final path. Pause, explain the queue, then resume. Highlight a junction, a loop, and a dead end.
2. Select **Compare Algorithms**. Explain why BFS and Dijkstra have equal optimal cost and why DFS can take a longer route. Discuss moves versus expanded cells.
3. Select **Easy**, then **Generate Maze**. Repeat with **Hard** and discuss the approximate changes in corridors, loops, and endpoint distance. Explain that randomized DFS constructs the maze while the algorithm selector chooses a separate search.
4. Load **Weighted · cost vs. distance** and compare again. Point out BFS's 10 moves / cost 70 versus Dijkstra's 20 moves / cost 20. Run Dijkstra and show its computed cost breakdown. Enable accumulated costs and step mode to explain a candidate update and the minimum-cost heap selection. Finally paint two cells below S with cost 9 and rerun to show the upper route at 16 moves / cost 30.
5. Run **A*** and explain `f = g + h` using Manhattan distance. Compare expansion counts without claiming that one timing sample proves a performance advantage.
6. Load **Unreachable goal**. Run any algorithm and show “No path exists.” All four algorithms agree in the comparison.
7. Start another search, pause, then **Reset Search** to show the maze is preserved and animation is cancelled. **Clear Grid**, draw a few walls/weights, relocate an endpoint, and run again.



## Verification

Optional tests, from this folder with Node.js installed:

```text
node algorithms.test.js
node maze-generation.test.js
node weighted-demo.test.js
node ui-state.test.js
```

Performed checks:

- **300 seeded generated mazes passed:** 100 per difficulty. Independent graph checks confirm that every passage is connected, goals are reachable, boundaries stay walled, no open 2 × 2 rooms appear, cycles exist, and an alternative route connects the actual endpoints. All four searches return valid paths on each maze, without modifying it.
- Generation is reproducible with an injected seed. Across these samples, Easy/Medium/Hard added 18/10/4 cycles respectively and averaged approximately 55/90/137 start-to-goal moves. These are observed trends, not per-maze difficulty guarantees.
- **832 algorithm cases passed:** four algorithms over four demos, four edge cases, and 200 deterministic random grids. Every case is repeated to check reproducibility.
- An independent Bellman-Ford oracle checks BFS's minimum moves and Dijkstra/A*'s minimum cost. It builds its own neighbor edges and does not reuse the application heap or neighbor helper.
- Returned paths have correct endpoints, use only valid four-direction neighbors, avoid walls, contain no loops, and report correct moves and actual terrain costs. Starting cost is excluded.
- Unreachable goals, equal-cost agreement, weighted tradeoffs, unique expansions, heap ordering/ties, and unchanged input grids pass.
- The real UI script passes **DOM/timer test-double checks** for all three Generate Maze presets, disabled generation during a run or pause, preserved endpoint markers, manual editing after generation, endpoint protection, pointer and keyboard handlers, editing locks, pause/resume, repeated runs, reset while active or paused, stale callbacks after a new run, Clear during animation, unreachable results, and repeated comparison on an unchanged grid.
- JavaScript syntax checks pass.
- The weighted-demo test exhaustively enumerates exactly three simple paths (excluding unintended shortcuts), checks independent move/cost optima for all algorithms, replays every recorded relaxation/minimum-distance removal, checks goal settlement after discovery, and repeats after weight edits.
- UI-state checks cover the new weight selector, dynamic grid resizing, cost-label persistence, tentative/settled badges, timer-free manual stepping, Reset in step mode, derived explanations, and changed routes after weight edits.
- Local HTTP browser checks verify Dijkstra animation, manual neighbor calculations and completion, visible terrain/accumulated labels, comparison, and changing lower-route weights to select the medium route with the matching cost breakdown. Laptop and narrow layouts are inspected separately from the DOM/timer test doubles.

**Verification limits:** automated tests and the local preview do not establish GitHub Pages deployment success; the deployment must be checked after pushing. Physical touch devices, screen readers, and every browser/zoom combination are not exhaustively tested.


