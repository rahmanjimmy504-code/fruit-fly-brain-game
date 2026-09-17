/* Brain configuration and capability tiers.
 * The game uses one public interface regardless of backend.
 */
window.FLY_BRAIN_CONFIG = {
  flyWire: {
    name: 'FlyWire FAFB v783',
    neurons: 139255,
    connectome: 'https://github.com/snedea/flybrain',
    annotations: 'https://github.com/flyconnectome/flywire_annotations'
  },
  tiers: {
    mobile: { label: 'Mobile FlyWire', maxNeurons: 12000, tickMs: 80 },
    desktop: { label: 'FlyWire LIF', maxNeurons: 50000, tickMs: 50 },
    full: { label: 'FlyWire 139K', maxNeurons: 139255, tickMs: 20 }
  },
  groups: ['VISION', 'ODOR', 'TASTE', 'TOUCH', 'CENTRAL', 'DRIVE', 'MOTOR'],
  sensory: ['vision', 'odor', 'taste', 'touch'],
  motor: ['turn', 'forward', 'escape', 'feed', 'fly']
};
