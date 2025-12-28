import { Controller } from './controller.js';

/**
 * NES System Bus - connects all components and handles memory mapping
 * Routes read/write operations to appropriate hardware components
 */
export class Bus {
    /**
     * Create new system bus
     */
    constructor() {
        /** @type {Uint8Array} Internal RAM (2KB) */
        this.ram = new Uint8Array(0x0800);
        
        /** @type {CPU|null} CPU component */
        this.cpu = null;
        
        /** @type {PPU|null} PPU component */
        this.ppu = null;
        
        /** @type {Cartridge|null} Cartridge component */
        this.cartridge = null;
        
        /** @type {Controller} Controller 1 */
        this.controller1 = new Controller();
        
        /** @type {number} System clock counter */
        this.clockCounter = 0;
    }
    
    /**
     * Connect CPU to the bus
     * @param {CPU} cpu - CPU instance to connect
     */
    connectCPU(cpu) {
        this.cpu = cpu;
    }
    
    /**
     * Connect PPU to the bus
     * @param {PPU} ppu - PPU instance to connect
     */
    connectPPU(ppu) {
        this.ppu = ppu;
    }

    /**
     * Connect controller to the bus
     * @param {Controller} controller - Controller instance to connect
     */
    connectController(controller) {
        this.controller1 = controller;
    }
    
    /**
     * Connect cartridge to the bus
     * @param {Cartridge} cartridge - Cartridge instance to connect
     */
    connectCartridge(cartridge) {
        this.cartridge = cartridge;
    }
    
    /**
     * Read byte from memory address
     * @param {number} addr - 16-bit memory address
     * @returns {number} Byte read from memory
     */
    read(addr) {
        addr &= 0xFFFF;
        
        if (addr >= 0x0000 && addr <= 0x1FFF) {
            // Internal RAM and mirrors
            return this.ram[addr & 0x07FF];
        } else if (addr >= 0x2000 && addr <= 0x3FFF) {
            // PPU Registers and mirrors
            return this.ppu?.readRegister(addr & 0x0007) || 0x00;
        } else if (addr === 0x4016) {
            // Controller 1
            return this.controller1.read();
        } else if (addr >= 0x4020 && addr <= 0xFFFF) {
            // Cartridge space
            return this.cartridge?.cpuRead(addr) || 0x00;
        }
        
        return 0x00;
    }
    
    /**
     * Write byte to memory address
     * @param {number} addr - 16-bit memory address
     * @param {number} data - 8-bit data to write
     */
    write(addr, data) {
        addr &= 0xFFFF;
        data &= 0xFF;
        
        if (addr >= 0x0000 && addr <= 0x1FFF) {
            // Internal RAM and mirrors
            this.ram[addr & 0x07FF] = data;
        } else if (addr >= 0x2000 && addr <= 0x3FFF) {
            // PPU Registers and mirrors
            this.ppu?.writeRegister(addr & 0x0007, data);
        } else if (addr === 0x4016) {
            // Controller strobe
            this.controller1.write(data);
        } else if (addr >= 0x4020 && addr <= 0xFFFF) {
            // Cartridge space
            this.cartridge?.cpuWrite(addr, data);
        }
    }
    
    /**
     * Execute one system clock cycle.
     * PPU runs 3 times faster than CPU.
     */
    clock() {
        // PPU runs 3 times faster than CPU
        this.ppu?.clock();
        this.ppu?.clock();
        this.ppu?.clock();
        
        // Check for NMI
        if (this.ppu?.checkNMI()) {
            this.cpu?.nonMaskableInterrupt();
        }
        
        this.cpu?.clock();
        
        this.clockCounter++;
    }
    
    /**
     * Reset all connected components
     */
    reset() {
        this.ram.fill(0);
        this.clockCounter = 0;
        
        this.cpu?.reset();
        this.ppu?.reset();
    }
}