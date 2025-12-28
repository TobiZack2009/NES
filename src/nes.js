import { Bus } from './bus.js';
import { CPU } from './cpu.js';
import { PPU } from './ppu.js';
import { Cartridge } from './cartridge.js';

/**
 * Main NES emulator class
 * Coordinates all hardware components and provides the main emulation interface
 */
export class NES {
    /**
     * Create new NES emulator instance
     */
    constructor() {
        /** @type {Bus} System bus connecting all components */
        this.bus = new Bus();
        
        /** @type {CPU} CPU processor */
        this.cpu = new CPU(this.bus);
        
        /** @type {PPU|null} Picture Processing Unit (created when cartridge loaded) */
        this.ppu = null;
        
        /** @type {Cartridge|null} Currently loaded cartridge */
        this.cartridge = null;
        
        // Connect components
        this.bus.connectCPU(this.cpu);
    }
    
    /**
     * Reset the entire NES system
     */
    reset() {
        this.bus.reset();
    }
    
    /**
     * Execute one system clock cycle
     */
    clock() {
        this.bus.clock();
    }
    
    /**
     * Execute one CPU instruction (may span multiple clock cycles)
     */
    step() {
        this.bus.clock();
    }
    
    async loadCartridge(cartridgeOrFile) {
        // Handle both cartridge objects and files
        let cartridge;
        if (cartridgeOrFile instanceof Uint8Array) {
            // Assume it's raw ROM data
            cartridge = Cartridge.fromINES(cartridgeOrFile);
        } else {
            cartridge = cartridgeOrFile;
        }
        
        this.cartridge = cartridge;
        
        // Create and connect PPU
        this.ppu = new PPU(this.bus);
        this.ppu.connectCartridge(cartridge);
        this.bus.connectPPU(this.ppu);
        
        this.bus.connectCartridge(cartridge);
        this.reset();
        
        return cartridge;
    }
    
    // For testing/debugging
    dumpCPUState() {
        return {
            a: this.cpu.a.toString(16).padStart(2, '0'),
            x: this.cpu.x.toString(16).padStart(2, '0'),
            y: this.cpu.y.toString(16).padStart(2, '0'),
            stkp: this.cpu.stkp.toString(16).padStart(2, '0'),
            pc: this.cpu.pc.toString(16).padStart(4, '0'),
            status: this.cpu.status.toString(2).padStart(8, '0')
        };
    }
    
    getScreen() {
        return this.ppu ? this.ppu.getScreen() : null;
    }
}