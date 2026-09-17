# 🪰 Fruit Fly Brain Game

A browser game where you battle a fruit fly whose behaviour is driven by a biologically inspired Drosophila brain model.

## Vision

The project connects an accessible PC/mobile game with fruit-fly neuroscience, inspired by Neurokernel and the curated projects in awesome-fly.

**Scientific note:** this game uses a computational brain model/adapter. It does not claim that a literal biological brain is running inside the browser.

## Planned features

- 🧑 Player vs. 🪰 fruit fly arena
- 🧠 Brain-driven fly decisions
- 👀 Sensory inputs for player position, movement and hazards
- ⚡ Attack and evasion mechanics
- 📱 Touch controls
- 🖥️ Keyboard and mouse controls
- 🔬 Brain Lab visualisation
- 📊 Behaviour telemetry
- 🌐 Browser-first, zero-budget-friendly architecture

## Architecture

```text
Player input ─────► Game engine ◄──── Fly actions
                       ▲                 ▲
                       │                 │
                  Fly sensors ─────► Brain adapter
                                          │
                                  Drosophila model
```

The `FlyBrain` interface separates the game from the neuroscience model, allowing a lightweight browser model now and a more detailed one later.

## Technology

The first prototype uses browser-native JavaScript, HTML Canvas and CSS so it can run on desktop and mobile browsers.

## Research references

- Neurokernel: https://github.com/neurokernel/neurokernel
- awesome-fly: https://github.com/cobanov/awesome-fly

External projects, models, datasets and assets retain their own licenses. Check their individual terms before redistribution.
