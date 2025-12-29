import { Bus } from './bus.js';
import { CPU } from './cpu.js';
import { PPU } from './ppu.js';
import { Cartridge } from './cartridge.js';
import { disassembleInstruction } from './disassembler.js';

/**
 * Main NES emulator class
 * Coordinates all hardware components and provides the main emulation interface
 */
export class NES {
    /**
     * Create new NES emulator instance
     */
    constructor() {
        this.bus = new Bus();
        this.cpu = new CPU(this.bus);
        this.ppu = null;
        this.cartridge = null;
        
        // Connect components
        this.bus.connectCPU(this.cpu);
        
        // Debugging and logging
        this.instructionLog = [];
        this.pcHistory = [];
    }
    
    /**
     * Reset the entire NES system
     */
    reset() {
        this.bus.reset();
        this.instructionLog = [];
        this.pcHistory = [];
    }
    
    /**
     * Execute one system clock cycle
     */
    clock() {
        // Store PC before clocking if a new instruction is about to start
        if (this.cpu.cycles === 0) {
            this.pcHistory.push(this.cpu.pc);
            if (this.pcHistory.length > 100) {
                this.pcHistory.shift();
            }
        }

        this.bus.clock();
        
        // If an instruction just finished, log it
        if (this.cpu.cycles === 0) {
            this._logInstruction();
        }
    }
    
    /**
     * Execute one CPU instruction (may span multiple clock cycles)
     */
    step() {
        this.clock();
    }
    
    /**
     * Loads a ROM from a Uint8Array.
     * @param {Uint8Array} romData - The raw byte data of the .nes file.
     * @returns {boolean} - True on successful load, false otherwise.
     */
    load(romData) {
        try {
            const cartridge = Cartridge.fromINES(romData);
            this.cartridge = cartridge;
            
            // Create and connect PPU
            this.ppu = new PPU(this.bus);
            this.ppu.connectCartridge(cartridge);
            this.bus.connectPPU(this.ppu);
            
            this.bus.connectCartridge(cartridge);
            this.reset();
            return true;
        } catch (e) {
            console.error("Error loading ROM:", e);
            return false;
        }
    }
    
    // --- Debugging Methods ---

    /**
     * Disassembles a range of memory addresses.
     * @param {number} startAddr - The starting address.
     * @param {number} endAddr - The ending address.
     * @returns {Array<Object>} - An array of disassembled instruction objects.
     */
    disassemble(startAddr, endAddr) {
        if (!this.cartridge) return [];

        const output = [];
        let addr = startAddr;
        
        while (addr <= endAddr) {
            const result = disassembleInstruction(this.bus, addr);
            const instruction = `${result.mnemonic} ${result.operand}`;
            output.push({ addr: result.addr, instruction });
            addr += result.length;
        }
        
        return output;
    }

    /**
     * Retrieves the internal instruction log.
     * @returns {string[]} - An array of formatted instruction log strings.
     */
    getInstructionLog() {
        return this.instructionLog;
    }

    /**
     * Internal helper to log the most recently executed instruction.
     * @private
     */
    _logInstruction() {
        if (!this.cartridge || this.pcHistory.length === 0) return;

        const pc = this.pcHistory.pop();
        const state = this.cpu.getState();
        const inst = disassembleInstruction(this.bus, pc);

        const stateStr = `A:${state.A.toString(16).toUpperCase().padStart(2, '0')} X:${state.X.toString(16).toUpperCase().padStart(2, '0')} Y:${state.Y.toString(16).toUpperCase().padStart(2, '0')} P:${state.P.toString(16).toUpperCase().padStart(2, '0')} SP:${state.SP.toString(16).toUpperCase().padStart(2, '0')}`;
        const logEntry = `0x${pc.toString(16).toUpperCase().padStart(4, '0')} - ${inst.mnemonic} ${inst.operand} - ${stateStr}`;
        
        this.instructionLog.push(logEntry);
        if (this.instructionLog.length > 100) {
            this.instructionLog.shift();
        }
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