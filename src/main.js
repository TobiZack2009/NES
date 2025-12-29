import { NES } from './nes.js';
import { Controller } from './controller.js';
import { FLAGS } from './cpu.js';

const nes = new NES();
const controller = new Controller();

// Connect controller to the bus
nes.bus.connectController(controller);

// Make instances globally accessible for debugging, and export them for module usage
window.nes = nes;

export { nes, controller, FLAGS };
