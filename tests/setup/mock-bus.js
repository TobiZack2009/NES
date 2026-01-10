/**
 * Mock Bus implementation for testing
 * Provides controlled memory I/O for isolated component testing
 */
export class MockBus {
    constructor() {
        this.memory = new Uint8Array(0x10000);
        this.ppu = null;
        this.controller = null;
        this.cartridge = null;
        this.cpu = null;
        this.apu = null;
        this.dmaTransfer = false;
        this.dmaPage = 0;
        this.dmaAddress = 0;
        this.dmaData = 0;
    }

    cpuRead(address) {
        return this.memory[address];
    }

    cpuWrite(address, data) {
        this.memory[address] = data;
    }

    read(address) {
        return this.cpuRead(address);
    }

    write(address, data) {
        this.cpuWrite(address, data);
    }

    connectCPU(cpu) {
        this.cpu = cpu;
    }

    connectPPU(ppu) {
        this.ppu = ppu;
    }

    connectController(controller) {
        this.controller = controller;
    }

    insertCartridge(cartridge) {
        this.cartridge = cartridge;
    }

    reset() {
        this.memory.fill(0);
    }

    clock() {
        // Mock implementation - no actual clock behavior
    }
}