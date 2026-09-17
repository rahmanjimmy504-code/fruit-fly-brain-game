# 🪰 Fruit Fly Brain Game

A zero-budget, browser-first arcade experiment where you battle a fruit fly controlled by a biologically inspired neural-state controller.

## 🎮 Play the prototype

Open `index.html` in a browser. No server, framework, paid API, external asset pack, or build step is required.

**Controls**
- 🖥️ Move: WASD or arrow keys
- ⚡ Attack: Space or click/tap
- 🔄 Reset: Reset button
- 📱 Mobile: touch/click the arena to attack; the game remains playable with a touchscreen browser

## 🧠 Brain-inspired design

The game deliberately separates **sensing → brain/controller → motor behaviour**. The fly receives simplified sensory signals for player distance, threat, target attraction and arena walls. A recurrent neural-state layer smooths those signals before producing steering, acceleration and behavioural mode outputs.

The controller has four visible behavioural modes:

- `SEARCH` — wander while scanning the arena
- `TRACK` — move toward the player when detected
- `ATTACK` — close in when the player is within an effective range
- `EVADE` — steer away from danger and use wall signals to escape corners

The **Brain Lab** panel exposes the live controller signals so the game can be used as a small interactive neuroscience visualisation as well as an arcade game.

> **Scientific note:** this is an original lightweight browser model inspired by fly connectome and embodied-simulation ideas. It is **not** a literal Neurokernel simulation and does not claim biological fidelity.

## 🏗️ Architecture

```text
                 ┌─────────────────────┐
Player input ───►│     Game engine      │◄──── Fly motor actions
                 └──────────┬──────────┘
                            │
                       Fly sensors
                            │
                            ▼
                 ┌─────────────────────┐
                 │ Brain-state adapter │
                 │ threat / target /   │
                 │ escape / attack /   │
                 │ wall                 │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │ Motor controller    │
                 │ steer + acceleration│
                 └─────────────────────┘
```

This adapter boundary is intentional: a future, more detailed Drosophila model can replace the lightweight controller without rewriting the game loop.

## 🔬 Research inspiration

This project uses the following repositories as **research and design references**, not as copied runtime code:

- [Neurokernel](https://github.com/neurokernel/neurokernel) — a Drosophila-focused neural simulation project whose repository describes topics including brain, Drosophila, neural simulation and GPU computing.
- [awesome-fly](https://github.com/cobanov/awesome-fly) — a curated collection covering fly connectomes, brain models, embodied simulation, browser experiments and games.

In particular, `awesome-fly` documents the useful distinction between a connectome, a simulation, sensory inputs and motor outputs. It also highlights browser/game experiments that connect fly-inspired neural controllers to interactive environments.

External projects, models, datasets and assets retain their own licenses. **Neurokernel currently has an `Other` / `NOASSERTION` repository license marker, so its code should not be copied into this project without checking its licensing terms.**

## 📁 Current files

```text
fruit-fly-brain-game/
├── index.html   # Game UI + Brain Lab
├── style.css    # Responsive desktop/mobile styling
├── game.js      # Canvas game + neural-state controller
└── README.md    # Project documentation
```

## 🚀 Future roadmap

1. Add a proper `FlyBrain` adapter interface.
2. Add optional Web Worker simulation so the brain model can run independently of rendering.
3. Add telemetry recording/replay for brain signals and fly actions.
4. Add richer sensory channels such as visual-field sectors, light and odour-like stimuli.
5. Add an optional connectome-backed research mode after model/data licensing and browser-performance requirements are verified.
6. Add automated GitHub Pages deployment for a public playable demo.
