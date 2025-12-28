import { Controller } from './controller.js';

export class Bus {
    constructor() {
        // Internal RAM (2KB)
        this.ram = new Uint8Array(0x0800);
        
        // Components
        this.cpu = null;
        this.ppu = null;
        this.cartridge = null;
        this.controller1 = new Controller();
        
        // System state
        this.clockCounter = 0;
    }
    
    connectCPU(cpu) {
        this.cpu = cpu;
    }
    
    connectPPU(ppu) {
        this.ppu = ppu;
    }

    connectController(controller) {
        this.controller1 = controller;
    }
    
    connectCartridge(cartridge) {
        this.cartridge = cartridge;
    }
    
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
            // Controller 1
            this.controller1.write(data);
        } else if (addr >= 0x4020 && addr <= 0xFFFF) {
            // Cartridge space
            this.cartridge?.cpuWrite(addr, data);
        }
    }
    
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
    
    reset() {
        this.ram.fill(0);
        this.clockCounter = 0;
        
        this.cpu?.reset();
        this.ppu?.reset();
    }
}