# Fruit Fly Brain: Evolution Arena

The game now has a browser-native closed-loop architecture inspired by current Drosophila experimentation projects.

## Architecture

`habitat + visual/odor/touch/taste sensing -> FlyWire/LIF brain worker -> motor signals -> animated fly -> changed habitat state`

## Research inspirations

- FlyWire FAFB v783: 139,255 proofread neurons and whole-brain connectivity.
- FlyBrain: browser/Web Worker LIF simulation of 139,255 FlyWire neurons.
- NeuroMechFly/FlyGym: articulated body, vision, olfaction, mechanosensation and embodied control.
- FlyBody: detailed wing and abdomen degrees of freedom.
- FlyWire annotations: functional cell-type and neurotransmitter annotations.

## Browser constraint

The complete scientific NeuroMechFly/MuJoCo and GPU PyTorch stacks are Python/native workloads and are **not copied into the GitHub Pages game**. Their architecture is represented through browser-native equivalents. The brain interface is tiered so mobile devices can use a reduced workload while desktop devices can use a larger model.

## Controls

- WASD / arrows: move
- Space: attack
- E: defend
- Shift: dash
- Q: neural pulse
- Mobile: joystick + action buttons
- R: restart

## Visual systems

The fly is rendered procedurally so the project has no external asset dependency: six legs, articulated wing motion, abdomen segments, eyes and antennae are animated every frame. The habitat contains procedural grass/leaves/flowers/rocks and odor fields.
