# Maze Pathfinding Visualizer and Algorithm Comparison

A college Design and Analysis of Algorithms (DAA) mini project built with plain HTML, CSS, and JavaScript. The objective is to visualize how different graph-search strategies explore the same maze, and distinguish the **fewest moves** from the **lowest movement cost**.

## Run locally

1. Keep `index.html`, `style.css`, `script.js`, `algorithms.js`, `maze-generation.js`, and `demos.js` in the same folder.
2. Double-click **index.html**, or open it with a modern browser such as Chrome, Edge, or Firefox.
3. Select an algorithm and press **Run search**.

No internet connection, backend, database, server, package installation, or build step is required. Scripts use ordinary deferred script tags rather than modules or network requests, so the page is designed to work directly from a `file://` URL. Node.js is only needed if you choose to run the optional developer tests.

## Features and controls

- 21 × 31 grid with up, right, down, and left movement; no diagonals.
- BFS, iterative DFS, Dijkstra, and A* implemented from scratch.
- **Generate Maze** creates narrow corridors, turns, junctions, and dead ends using randomized DFS backtracking. **Easy**, **Medium**, and **Hard** are approximate structure presets. Separating walls are removed afterward to add loops and alternative routes.
- Wall, weighted terrain, start, goal, and eraser tools. Click or drag to paint terrain. Click a cell to relocate an endpoint.
- Exactly one start and goal, always distinct. Wall, weight, and eraser tools cannot overwrite endpoints. Relocating an endpoint clears the destination terrain to normal.
- Normal terrain costs **1**, weighted terrain costs **5**. Walls are impassable. Moving **into** a cell incurs its cost; the starting cell costs **0**.
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
algorithms.js               Pure searches, path reconstruction, and binary min-heap
maze-generation.js          Randomized DFS carving, loops, and endpoint placement
demos.js                    Three deterministic demo mazes and the empty grid
README.md                   Setup, explanations, demonstration, and viva answers
tests/
  algorithms.test.js        Independent optimality and path-validity checks
  maze-generation.test.js   Generated-maze structure and reachability checks
  ui-state.test.js          UI state and timer checks using test doubles
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

The default **Corridor maze · loops** example is a Medium maze with a fixed seed, so it is reproducible. **Weighted · cost vs. distance** keeps its deliberate two-route weighted example, with bent dead-end branches and junctions. **Unreachable goal · no route** is a separate, clearly labeled exception to the generation reachability guarantee: its goal is intentionally isolated. All mazes remain manually editable after loading or generation; later edits can make a goal unreachable.

## How the algorithms work

Cells are graph vertices. A cell's integer ID is `row * columns + column`. The terrain array stores `-1` for walls, `1` for normal cells, and `5` for weighted cells. Neighbors are always considered **up, right, down, left**. DFS inserts neighbors in reverse order so the stack prefers that order. Equal-priority heap entries are removed in insertion order for reproducibility.

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

The deterministic **Cost vs. distance** demo has two corridors:

| Algorithm | Moves | Cost | What to discuss |
| --- | ---: | ---: | --- |
| BFS | 21 | 101 | The direct route is shortest in moves but passes through twenty cost-5 cells. |
| DFS | 31 | 31 | The fixed neighbor order happens to choose the cheap detour; this is not a general guarantee. |
| Dijkstra | 31 | 31 | The longer detour minimizes total cost. |
| A* | 31 | 31 | The heuristic guides an optimal-cost search. |

## What the results measure

Each completed run reports the algorithm, path-found status, moves, terrain cost, unique expanded cells, and approximate computation time in milliseconds.

**Expanded** means a unique cell removed from the queue, stack, or heap and processed, including the start and the goal if reached. Stale heap entries are excluded. This includes the final goal processing even though the algorithm stops without scanning its neighbors. Discovery (adding a cell to the frontier) is different from expansion.

`performance.now()` is called immediately before and after the pure algorithm call. The measurement includes algorithm bookkeeping, expansion recording, reconstruction, and path-cost calculation. Grid snapshot creation, DOM rendering, animation, and deliberate delays are outside the timed region. Three decimal places are displayed, but results are **approximate**: timer resolution, runtime warm-up, garbage collection, and scheduling can affect tiny-grid measurements. A single run should not be treated as a reliable speed ranking.

Animation uses a single scheduled timeout. Pause cancels the timeout; resume continues from the next frame. Reset also increments an animation-version token, so even an old callback cannot draw into a new run.

## Short classroom demonstration

1. **Corridor maze · loops:** load this deterministic corridor maze, run BFS, and show the expanding layers and final path. Pause, explain the queue, then resume. Highlight a junction, a loop, and a dead end.
2. Select **Compare Algorithms**. Explain why BFS and Dijkstra have equal optimal cost and why DFS can take a longer route. Discuss moves versus expanded cells.
3. Select **Easy**, then **Generate Maze**. Repeat with **Hard** and discuss the approximate changes in corridors, loops, and endpoint distance. Explain that randomized DFS constructs the maze while the algorithm selector chooses a separate search.
4. Load **Cost vs. distance** and compare again. Point out BFS's 21 moves / cost 101 versus Dijkstra's 31 moves / cost 31. Run Dijkstra to trace the cheaper detour.
5. Run **A*** and explain `f = g + h` using Manhattan distance. Compare expansion counts without claiming that one timing sample proves a performance advantage.
6. Load **Unreachable goal**. Run any algorithm and show “No path exists.” All four algorithms agree in the comparison.
7. Start another search, pause, then **Reset Search** to show the maze is preserved and animation is cancelled. **Clear Grid**, draw a few walls/weights, relocate an endpoint, and run again.



## Verification

Optional tests, from this folder with Node.js installed:

```text
node tests/algorithms.test.js
node tests/maze-generation.test.js
node tests/ui-state.test.js
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


