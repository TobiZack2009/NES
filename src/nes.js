import { Bus } from './bus.js';
import { CPU } from './cpu.js';
import { PPU } from './ppu.js';
import { Cartridge } from './cartridge.js';

export class NES {
    constructor() {
        this.bus = new Bus();
        this.cpu = new CPU(this.bus);
        
        // PPU will be created when cartridge is loaded
        this.ppu = null;
        
        // Connect components
        this.bus.connectCPU(this.cpu);
        
        // Load a default cartridge if available
        this.cartridge = null;
    }
    
    reset() {
        this.bus.reset();
    }
    
    clock() {
        this.bus.clock();
    }
    
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