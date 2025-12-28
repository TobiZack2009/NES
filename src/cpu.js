import { opcodes } from './opcodes.js';

/**
 * NES CPU processor flags bit definitions
 * @readonly
 * @enum {number}
 */
export const FLAGS = {
    /** Carry flag - bit 0 */
    C: (1 << 0),
    /** Zero flag - bit 1 */
    Z: (1 << 1),
    /** Interrupt disable flag - bit 2 */
    I: (1 << 2),
    /** Decimal mode flag - bit 3 (unused in NES) */
    D: (1 << 3),
    /** Break flag - bit 4 */
    B: (1 << 4),
    /** Unused flag - bit 5 (always set in hardware) */
    U: (1 << 5),
    /** Overflow flag - bit 6 */
    V: (1 << 6),
    /** Negative flag - bit 7 */
    N: (1 << 7),
};

/**
 * NES Ricoh 2A03 CPU emulation
 * Implements the 6502-based processor used in the Nintendo Entertainment System
 */
export class CPU {
    /**
     * Create a new CPU instance
     * @param {Bus} bus - System bus for memory access
     */
    constructor(bus) {
        /** @type {Bus} System bus for memory I/O */
        this.bus = bus;
        
        /** @type {number} Accumulator register (8-bit) */
        this.a = 0x00;
        
        /** @type {number} X index register (8-bit) */
        this.x = 0x00;
        
        /** @type {number} Y index register (8-bit) */
        this.y = 0x00;
        
        /** @type {number} Stack pointer register (8-bit, points to $0100-$01FF) */
        this.stkp = 0xFD;
        
        /** @type {number} Program counter register (16-bit) */
        this.pc = 0x0000;
        
        /** @type {number} Status register with flags */
        this.status = FLAGS.U | FLAGS.I;
        
        /** @type {number} Cycles remaining for current instruction */
        this.cycles = 0;
        
        /** @type {Array} Opcode lookup table */
        this.lookup = [];
        
        this.initOpcodeTable();
    }
    
    /**
     * Reset CPU to initial state
     */
    reset() {
        this.a = 0x00;
        this.x = 0x00;
        this.y = 0x00;
        this.stkp = 0xFD;
        this.status = FLAGS.U | FLAGS.I;
        this.cycles = 0;
        
        // Reset vector is at $FFFC-$FFFD
        this.pc = this.bus.read(0xFFFC) | (this.bus.read(0xFFFD) << 8);
    }
    
    /**
     * Set or clear a specific flag in the status register
     * @param {number} f - Flag bit to modify (from FLAGS enum)
     * @param {boolean} v - Value to set (true=set, false=clear)
     */
    setFlag(f, v) {
        if (v) this.status |= f;
        else this.status &= ~f;
    }
    
    /**
     * Get the value of a specific flag from the status register
     * @param {number} f - Flag bit to read (from FLAGS enum)
     * @returns {number} - 1 if flag is set, 0 if not set
     */
    getFlag(f) {
        return (this.status & f) > 0 ? 1 : 0;
    }

    /**
     * Get current CPU state for debugging and testing
     * @returns {Object} Object containing all CPU registers
     */
    getState() {
        return {
            A: this.a,
            X: this.x,
            Y: this.y,
            SP: this.stkp,
            P: this.status | FLAGS.U, // Always set unused bit for comparison
            PC: this.pc
        };
    }

    /**
     * Set CPU state from saved state (used in testing)
     * @param {Object} state - CPU state object from getState()
     */
    setState(state) {
        this.a = state.A;
        this.x = state.X;
        this.y = state.Y;
        this.stkp = state.SP;
        this.status = state.P;
        this.pc = state.address;
    }
    
    clock() {
        if (this.cycles === 0) {
            const opcode = this.bus.read(this.pc++);
            const instruction = this.lookup[opcode];
            
            if (!instruction) {
                console.log(`Unknown opcode: ${opcode.toString(16).padStart(2, '0')}`);
                return;
            }
            
            if (opcode === 0x38) {
                console.log(`Executing SEC instruction at $${(this.pc - 1).toString(16).padStart(4, '0').toUpperCase()}`);
            }
            
            // Store current addressing mode for operand fetching
            this.currentAddrMode = instruction.addrMode;
            
            // Calculate effective address
            const addrData = instruction.addrMode.call(this);
            
            // Execute operation logic
            const additionalCycle = instruction.operate.call(this, addrData);
            
            // Total cycles = base cycles + conditional cycles
            this.cycles += instruction.cycles + (additionalCycle & addrData.pageCrossed);
        }
        this.cycles--;
    }
    
    interruptRequest() {
        if (this.getFlag(FLAGS.I) === 0) {
            this.push(this.pc >> 8 & 0xFF);
            this.push(this.pc & 0xFF);
            this.push(this.status & ~FLAGS.B);
            this.setFlag(FLAGS.I, true);
            
            this.pc = this.bus.read(0xFFFE) | (this.bus.read(0xFFFF) << 8);
            this.cycles = 7;
        }
    }
    
    nonMaskableInterrupt() {
        this.push(this.pc >> 8 & 0xFF);
        this.push(this.pc & 0xFF);
        this.push(this.status & ~FLAGS.B);
        this.setFlag(FLAGS.I, true);
        
        this.pc = this.bus.read(0xFFFA) | (this.bus.read(0xFFFB) << 8);
        this.cycles = 8;
    }
    
    push(data) {
        this.bus.write(0x0100 + this.stkp, data & 0xFF);
        this.stkp = (this.stkp - 1) & 0xFF;
    }
    
    pull() {
        this.stkp = (this.stkp + 1) & 0xFF;
        return this.bus.read(0x0100 + this.stkp);
    }
    
    initOpcodeTable() {
        this.lookup = new Array(256);
        
        // Initialize opcode table
        this.lookup[0x69] = { name: "ADC", operate: opcodes.ADC, addrMode: this.IMM, cycles: 2 };
        this.lookup[0x65] = { name: "ADC", operate: opcodes.ADC, addrMode: this.ZPG, cycles: 3 };
        this.lookup[0x75] = { name: "ADC", operate: opcodes.ADC, addrMode: this.ZPX, cycles: 4 };
        this.lookup[0x6D] = { name: "ADC", operate: opcodes.ADC, addrMode: this.ABS, cycles: 4 };
        this.lookup[0x7D] = { name: "ADC", operate: opcodes.ADC, addrMode: this.ABX, cycles: 4 };
        this.lookup[0x79] = { name: "ADC", operate: opcodes.ADC, addrMode: this.ABY, cycles: 4 };
        this.lookup[0x61] = { name: "ADC", operate: opcodes.ADC, addrMode: this.IZX, cycles: 6 };
        this.lookup[0x71] = { name: "ADC", operate: opcodes.ADC, addrMode: this.IZY, cycles: 5 };
        
        this.lookup[0x29] = { name: "AND", operate: opcodes.AND, addrMode: this.IMM, cycles: 2 };
        this.lookup[0x25] = { name: "AND", operate: opcodes.AND, addrMode: this.ZPG, cycles: 3 };
        this.lookup[0x35] = { name: "AND", operate: opcodes.AND, addrMode: this.ZPX, cycles: 4 };
        this.lookup[0x2D] = { name: "AND", operate: opcodes.AND, addrMode: this.ABS, cycles: 4 };
        this.lookup[0x3D] = { name: "AND", operate: opcodes.AND, addrMode: this.ABX, cycles: 4 };
        this.lookup[0x39] = { name: "AND", operate: opcodes.AND, addrMode: this.ABY, cycles: 4 };
        this.lookup[0x21] = { name: "AND", operate: opcodes.AND, addrMode: this.IZX, cycles: 6 };
        this.lookup[0x31] = { name: "AND", operate: opcodes.AND, addrMode: this.IZY, cycles: 5 };
        
        this.lookup[0x0A] = { name: "ASL", operate: opcodes.ASL, addrMode: this.ACC, cycles: 2 };
        this.lookup[0x06] = { name: "ASL", operate: opcodes.ASL, addrMode: this.ZPG, cycles: 5 };
        this.lookup[0x16] = { name: "ASL", operate: opcodes.ASL, addrMode: this.ZPX, cycles: 6 };
        this.lookup[0x0E] = { name: "ASL", operate: opcodes.ASL, addrMode: this.ABS, cycles: 6 };
        this.lookup[0x1E] = { name: "ASL", operate: opcodes.ASL, addrMode: this.ABX, cycles: 7 };
        
        this.lookup[0x90] = { name: "BCC", operate: opcodes.BCC, addrMode: this.REL, cycles: 2 };
        this.lookup[0xB0] = { name: "BCS", operate: opcodes.BCS, addrMode: this.REL, cycles: 2 };
        this.lookup[0xF0] = { name: "BEQ", operate: opcodes.BEQ, addrMode: this.REL, cycles: 2 };
        
        this.lookup[0x24] = { name: "BIT", operate: opcodes.BIT, addrMode: this.ZPG, cycles: 3 };
        this.lookup[0x2C] = { name: "BIT", operate: opcodes.BIT, addrMode: this.ABS, cycles: 4 };
        
        this.lookup[0x30] = { name: "BMI", operate: opcodes.BMI, addrMode: this.REL, cycles: 2 };
        this.lookup[0xD0] = { name: "BNE", operate: opcodes.BNE, addrMode: this.REL, cycles: 2 };
        this.lookup[0x10] = { name: "BPL", operate: opcodes.BPL, addrMode: this.REL, cycles: 2 };
        this.lookup[0x00] = { name: "BRK", operate: opcodes.BRK, addrMode: this.IMP, cycles: 7 };
        this.lookup[0x50] = { name: "BVC", operate: opcodes.BVC, addrMode: this.REL, cycles: 2 };
        this.lookup[0x70] = { name: "BVS", operate: opcodes.BVS, addrMode: this.REL, cycles: 2 };
        
        this.lookup[0x18] = { name: "CLC", operate: opcodes.CLC, addrMode: this.IMP, cycles: 2 };
        this.lookup[0xD8] = { name: "CLD", operate: opcodes.CLD, addrMode: this.IMP, cycles: 2 };
        this.lookup[0x58] = { name: "CLI", operate: opcodes.CLI, addrMode: this.IMP, cycles: 2 };
        this.lookup[0xB8] = { name: "CLV", operate: opcodes.CLV, addrMode: this.IMP, cycles: 2 };
        
        this.lookup[0xC9] = { name: "CMP", operate: opcodes.CMP, addrMode: this.IMM, cycles: 2 };
        this.lookup[0xC5] = { name: "CMP", operate: opcodes.CMP, addrMode: this.ZPG, cycles: 3 };
        this.lookup[0xD5] = { name: "CMP", operate: opcodes.CMP, addrMode: this.ZPX, cycles: 4 };
        this.lookup[0xCD] = { name: "CMP", operate: opcodes.CMP, addrMode: this.ABS, cycles: 4 };
        this.lookup[0xDD] = { name: "CMP", operate: opcodes.CMP, addrMode: this.ABX, cycles: 4 };
        this.lookup[0xD9] = { name: "CMP", operate: opcodes.CMP, addrMode: this.ABY, cycles: 4 };
        this.lookup[0xC1] = { name: "CMP", operate: opcodes.CMP, addrMode: this.IZX, cycles: 6 };
        this.lookup[0xD1] = { name: "CMP", operate: opcodes.CMP, addrMode: this.IZY, cycles: 5 };
        
        this.lookup[0xE0] = { name: "CPX", operate: opcodes.CPX, addrMode: this.IMM, cycles: 2 };
        this.lookup[0xE4] = { name: "CPX", operate: opcodes.CPX, addrMode: this.ZPG, cycles: 3 };
        this.lookup[0xEC] = { name: "CPX", operate: opcodes.CPX, addrMode: this.ABS, cycles: 4 };
        
        this.lookup[0xC0] = { name: "CPY", operate: opcodes.CPY, addrMode: this.IMM, cycles: 2 };
        this.lookup[0xC4] = { name: "CPY", operate: opcodes.CPY, addrMode: this.ZPG, cycles: 3 };
        this.lookup[0xCC] = { name: "CPY", operate: opcodes.CPY, addrMode: this.ABS, cycles: 4 };
        
        this.lookup[0xC6] = { name: "DEC", operate: opcodes.DEC, addrMode: this.ZPG, cycles: 5 };
        this.lookup[0xD6] = { name: "DEC", operate: opcodes.DEC, addrMode: this.ZPX, cycles: 6 };
        this.lookup[0xCE] = { name: "DEC", operate: opcodes.DEC, addrMode: this.ABS, cycles: 6 };
        this.lookup[0xDE] = { name: "DEC", operate: opcodes.DEC, addrMode: this.ABX, cycles: 7 };
        
        this.lookup[0xCA] = { name: "DEX", operate: opcodes.DEX, addrMode: this.IMP, cycles: 2 };
        this.lookup[0x88] = { name: "DEY", operate: opcodes.DEY, addrMode: this.IMP, cycles: 2 };
        
        this.lookup[0x49] = { name: "EOR", operate: opcodes.EOR, addrMode: this.IMM, cycles: 2 };
        this.lookup[0x45] = { name: "EOR", operate: opcodes.EOR, addrMode: this.ZPG, cycles: 3 };
        this.lookup[0x55] = { name: "EOR", operate: opcodes.EOR, addrMode: this.ZPX, cycles: 4 };
        this.lookup[0x4D] = { name: "EOR", operate: opcodes.EOR, addrMode: this.ABS, cycles: 4 };
        this.lookup[0x5D] = { name: "EOR", operate: opcodes.EOR, addrMode: this.ABX, cycles: 4 };
        this.lookup[0x59] = { name: "EOR", operate: opcodes.EOR, addrMode: this.ABY, cycles: 4 };
        this.lookup[0x41] = { name: "EOR", operate: opcodes.EOR, addrMode: this.IZX, cycles: 6 };
        this.lookup[0x51] = { name: "EOR", operate: opcodes.EOR, addrMode: this.IZY, cycles: 5 };
        
        this.lookup[0xE6] = { name: "INC", operate: opcodes.INC, addrMode: this.ZPG, cycles: 5 };
        this.lookup[0xF6] = { name: "INC", operate: opcodes.INC, addrMode: this.ZPX, cycles: 6 };
        this.lookup[0xEE] = { name: "INC", operate: opcodes.INC, addrMode: this.ABS, cycles: 6 };
        this.lookup[0xFE] = { name: "INC", operate: opcodes.INC, addrMode: this.ABX, cycles: 7 };
        
        this.lookup[0xE8] = { name: "INX", operate: opcodes.INX, addrMode: this.IMP, cycles: 2 };
        this.lookup[0xC8] = { name: "INY", operate: opcodes.INY, addrMode: this.IMP, cycles: 2 };
        
        this.lookup[0x4C] = { name: "JMP", operate: opcodes.JMP, addrMode: this.ABS, cycles: 3 };
        this.lookup[0x6C] = { name: "JMP", operate: opcodes.JMP, addrMode: this.IND, cycles: 5 };
        
        this.lookup[0x20] = { name: "JSR", operate: opcodes.JSR, addrMode: this.ABS, cycles: 6 };
        
        this.lookup[0xA9] = { name: "LDA", operate: opcodes.LDA, addrMode: this.IMM, cycles: 2 };
        this.lookup[0xA5] = { name: "LDA", operate: opcodes.LDA, addrMode: this.ZPG, cycles: 3 };
        this.lookup[0xB5] = { name: "LDA", operate: opcodes.LDA, addrMode: this.ZPX, cycles: 4 };
        this.lookup[0xAD] = { name: "LDA", operate: opcodes.LDA, addrMode: this.ABS, cycles: 4 };
        this.lookup[0xBD] = { name: "LDA", operate: opcodes.LDA, addrMode: this.ABX, cycles: 4 };
        this.lookup[0xB9] = { name: "LDA", operate: opcodes.LDA, addrMode: this.ABY, cycles: 4 };
        this.lookup[0xA1] = { name: "LDA", operate: opcodes.LDA, addrMode: this.IZX, cycles: 6 };
        this.lookup[0xB1] = { name: "LDA", operate: opcodes.LDA, addrMode: this.IZY, cycles: 5 };
        
        this.lookup[0xA2] = { name: "LDX", operate: opcodes.LDX, addrMode: this.IMM, cycles: 2 };
        this.lookup[0xA6] = { name: "LDX", operate: opcodes.LDX, addrMode: this.ZPG, cycles: 3 };
        this.lookup[0xB6] = { name: "LDX", operate: opcodes.LDX, addrMode: this.ZPY, cycles: 4 };
        this.lookup[0xAE] = { name: "LDX", operate: opcodes.LDX, addrMode: this.ABS, cycles: 4 };
        this.lookup[0xBE] = { name: "LDX", operate: opcodes.LDX, addrMode: this.ABY, cycles: 4 };
        
        this.lookup[0xA0] = { name: "LDY", operate: opcodes.LDY, addrMode: this.IMM, cycles: 2 };
        this.lookup[0xA4] = { name: "LDY", operate: opcodes.LDY, addrMode: this.ZPG, cycles: 3 };
        this.lookup[0xB4] = { name: "LDY", operate: opcodes.LDY, addrMode: this.ZPX, cycles: 4 };
        this.lookup[0xAC] = { name: "LDY", operate: opcodes.LDY, addrMode: this.ABS, cycles: 4 };
        this.lookup[0xBC] = { name: "LDY", operate: opcodes.LDY, addrMode: this.ABX, cycles: 4 };
        
        this.lookup[0x4A] = { name: "LSR", operate: opcodes.LSR, addrMode: this.ACC, cycles: 2 };
        this.lookup[0x46] = { name: "LSR", operate: opcodes.LSR, addrMode: this.ZPG, cycles: 5 };
        this.lookup[0x56] = { name: "LSR", operate: opcodes.LSR, addrMode: this.ZPX, cycles: 6 };
        this.lookup[0x4E] = { name: "LSR", operate: opcodes.LSR, addrMode: this.ABS, cycles: 6 };
        this.lookup[0x5E] = { name: "LSR", operate: opcodes.LSR, addrMode: this.ABX, cycles: 7 };
        
        this.lookup[0xEA] = { name: "NOP", operate: opcodes.NOP, addrMode: this.IMP, cycles: 2 };
        
        this.lookup[0x09] = { name: "ORA", operate: opcodes.ORA, addrMode: this.IMM, cycles: 2 };
        this.lookup[0x05] = { name: "ORA", operate: opcodes.ORA, addrMode: this.ZPG, cycles: 3 };
        this.lookup[0x15] = { name: "ORA", operate: opcodes.ORA, addrMode: this.ZPX, cycles: 4 };
        this.lookup[0x0D] = { name: "ORA", operate: opcodes.ORA, addrMode: this.ABS, cycles: 4 };
        this.lookup[0x1D] = { name: "ORA", operate: opcodes.ORA, addrMode: this.ABX, cycles: 4 };
        this.lookup[0x19] = { name: "ORA", operate: opcodes.ORA, addrMode: this.ABY, cycles: 4 };
        this.lookup[0x01] = { name: "ORA", operate: opcodes.ORA, addrMode: this.IZX, cycles: 6 };
        this.lookup[0x11] = { name: "ORA", operate: opcodes.ORA, addrMode: this.IZY, cycles: 5 };
        
        this.lookup[0x48] = { name: "PHA", operate: opcodes.PHA, addrMode: this.IMP, cycles: 3 };
        this.lookup[0x08] = { name: "PHP", operate: opcodes.PHP, addrMode: this.IMP, cycles: 3 };
        this.lookup[0x68] = { name: "PLA", operate: opcodes.PLA, addrMode: this.IMP, cycles: 4 };
        this.lookup[0x28] = { name: "PLP", operate: opcodes.PLP, addrMode: this.IMP, cycles: 4 };
        
        this.lookup[0x2A] = { name: "ROL", operate: opcodes.ROL, addrMode: this.ACC, cycles: 2 };
        this.lookup[0x26] = { name: "ROL", operate: opcodes.ROL, addrMode: this.ZPG, cycles: 5 };
        this.lookup[0x36] = { name: "ROL", operate: opcodes.ROL, addrMode: this.ZPX, cycles: 6 };
        this.lookup[0x2E] = { name: "ROL", operate: opcodes.ROL, addrMode: this.ABS, cycles: 6 };
        this.lookup[0x3E] = { name: "ROL", operate: opcodes.ROL, addrMode: this.ABX, cycles: 7 };
        
        this.lookup[0x6A] = { name: "ROR", operate: opcodes.ROR, addrMode: this.ACC, cycles: 2 };
        this.lookup[0x66] = { name: "ROR", operate: opcodes.ROR, addrMode: this.ZPG, cycles: 5 };
        this.lookup[0x76] = { name: "ROR", operate: opcodes.ROR, addrMode: this.ZPX, cycles: 6 };
        this.lookup[0x6E] = { name: "ROR", operate: opcodes.ROR, addrMode: this.ABS, cycles: 6 };
        this.lookup[0x7E] = { name: "ROR", operate: opcodes.ROR, addrMode: this.ABX, cycles: 7 };
        
        this.lookup[0x40] = { name: "RTI", operate: opcodes.RTI, addrMode: this.IMP, cycles: 6 };
        this.lookup[0x60] = { name: "RTS", operate: opcodes.RTS, addrMode: this.IMP, cycles: 6 };
        
        this.lookup[0xE9] = { name: "SBC", operate: opcodes.SBC, addrMode: this.IMM, cycles: 2 };
        this.lookup[0xE5] = { name: "SBC", operate: opcodes.SBC, addrMode: this.ZPG, cycles: 3 };
        this.lookup[0xF5] = { name: "SBC", operate: opcodes.SBC, addrMode: this.ZPX, cycles: 4 };
        this.lookup[0xED] = { name: "SBC", operate: opcodes.SBC, addrMode: this.ABS, cycles: 4 };
        this.lookup[0xFD] = { name: "SBC", operate: opcodes.SBC, addrMode: this.ABX, cycles: 4 };
        this.lookup[0xF9] = { name: "SBC", operate: opcodes.SBC, addrMode: this.ABY, cycles: 4 };
        this.lookup[0xE1] = { name: "SBC", operate: opcodes.SBC, addrMode: this.IZX, cycles: 6 };
        this.lookup[0xF1] = { name: "SBC", operate: opcodes.SBC, addrMode: this.IZY, cycles: 5 };
        
        this.lookup[0x38] = { name: "SEC", operate: opcodes.SEC, addrMode: this.IMP, cycles: 2 };
        this.lookup[0xF8] = { name: "SED", operate: opcodes.SED, addrMode: this.IMP, cycles: 2 };
        this.lookup[0x78] = { name: "SEI", operate: opcodes.SEI, addrMode: this.IMP, cycles: 2 };
        
        this.lookup[0x85] = { name: "STA", operate: opcodes.STA, addrMode: this.ZPG, cycles: 3 };
        this.lookup[0x95] = { name: "STA", operate: opcodes.STA, addrMode: this.ZPX, cycles: 4 };
        this.lookup[0x8D] = { name: "STA", operate: opcodes.STA, addrMode: this.ABS, cycles: 4 };
        this.lookup[0x9D] = { name: "STA", operate: opcodes.STA, addrMode: this.ABX, cycles: 5 };
        this.lookup[0x99] = { name: "STA", operate: opcodes.STA, addrMode: this.ABY, cycles: 5 };
        this.lookup[0x81] = { name: "STA", operate: opcodes.STA, addrMode: this.IZX, cycles: 6 };
        this.lookup[0x91] = { name: "STA", operate: opcodes.STA, addrMode: this.IZY, cycles: 6 };
        
        this.lookup[0x86] = { name: "STX", operate: opcodes.STX, addrMode: this.ZPG, cycles: 3 };
        this.lookup[0x96] = { name: "STX", operate: opcodes.STX, addrMode: this.ZPY, cycles: 4 };
        this.lookup[0x8E] = { name: "STX", operate: opcodes.STX, addrMode: this.ABS, cycles: 4 };
        
        this.lookup[0x84] = { name: "STY", operate: opcodes.STY, addrMode: this.ZPG, cycles: 3 };
        this.lookup[0x94] = { name: "STY", operate: opcodes.STY, addrMode: this.ZPX, cycles: 4 };
        this.lookup[0x8C] = { name: "STY", operate: opcodes.STY, addrMode: this.ABS, cycles: 4 };
        
        this.lookup[0xAA] = { name: "TAX", operate: opcodes.TAX, addrMode: this.IMP, cycles: 2 };
        this.lookup[0xA8] = { name: "TAY", operate: opcodes.TAY, addrMode: this.IMP, cycles: 2 };
        this.lookup[0xBA] = { name: "TSX", operate: opcodes.TSX, addrMode: this.IMP, cycles: 2 };
        this.lookup[0x8A] = { name: "TXA", operate: opcodes.TXA, addrMode: this.IMP, cycles: 2 };
        this.lookup[0x9A] = { name: "TXS", operate: opcodes.TXS, addrMode: this.IMP, cycles: 2 };
        this.lookup[0x98] = { name: "TYA", operate: opcodes.TYA, addrMode: this.IMP, cycles: 2 };
        
        // Fill remaining opcodes with illegal instructions
        for (let i = 0; i < 256; i++) {
            if (!this.lookup[i]) {
                this.lookup[i] = { name: "???", operate: opcodes.NOP, addrMode: this.IMP, cycles: 2 };
            }
        }
    }
    
    // Addressing Modes
    IMM() {
        return { addr: this.pc++, pageCrossed: 0 };
    }
    
    ZPG() {
        const addr = this.bus.read(this.pc++);
        return { addr: addr & 0x00FF, pageCrossed: 0 };
    }
    
    ZPX() {
        const addr = (this.bus.read(this.pc++) + this.x) & 0xFF;
        return { addr: addr & 0x00FF, pageCrossed: 0 };
    }
    
    ZPY() {
        const addr = (this.bus.read(this.pc++) + this.y) & 0xFF;
        return { addr: addr & 0x00FF, pageCrossed: 0 };
    }
    
    ABS() {
        const lo = this.bus.read(this.pc++);
        const hi = this.bus.read(this.pc++);
        return { addr: (hi << 8) | lo, pageCrossed: 0 };
    }
    
    ABX() {
        const lo = this.bus.read(this.pc++);
        const hi = this.bus.read(this.pc++);
        const addr = (hi << 8) | lo;
        const finalAddr = addr + this.x;
        return { addr: finalAddr & 0xFFFF, pageCrossed: (addr & 0xFF00) !== (finalAddr & 0xFF00) ? 1 : 0 };
    }
    
    ABY() {
        const lo = this.bus.read(this.pc++);
        const hi = this.bus.read(this.pc++);
        const addr = (hi << 8) | lo;
        const finalAddr = addr + this.y;
        return { addr: finalAddr & 0xFFFF, pageCrossed: (addr & 0xFF00) !== (finalAddr & 0xFF00) ? 1 : 0 };
    }
    
    IND() {
        const lo = this.bus.read(this.pc++);
        const hi = this.bus.read(this.pc++);
        const ptr = (hi << 8) | lo;
        
        // Simulate 6502 bug: if lo = 0xFF, it wraps around
        if ((ptr & 0x00FF) === 0x00FF) {
            const addrLo = this.bus.read(ptr);
            const addrHi = this.bus.read(ptr & 0xFF00);
            return { addr: (addrHi << 8) | addrLo, pageCrossed: 0 };
        } else {
            const addrLo = this.bus.read(ptr);
            const addrHi = this.bus.read(ptr + 1);
            return { addr: (addrHi << 8) | addrLo, pageCrossed: 0 };
        }
    }
    
    IZX() {
        const ptr = this.bus.read(this.pc++);
        const lo = this.bus.read((ptr + this.x) & 0xFF);
        const hi = this.bus.read((ptr + this.x + 1) & 0xFF);
        return { addr: (hi << 8) | lo, pageCrossed: 0 };
    }
    
    IZY() {
        const ptr = this.bus.read(this.pc++);
        const lo = this.bus.read(ptr);
        const hi = this.bus.read((ptr + 1) & 0xFF);
        const addr = (hi << 8) | lo;
        const finalAddr = addr + this.y;
        return { addr: finalAddr & 0xFFFF, pageCrossed: (addr & 0xFF00) !== (finalAddr & 0xFF00) ? 1 : 0 };
    }
    
    REL() {
        const offset = this.bus.read(this.pc++);
        let addr = this.pc + offset;
        
        if (offset >= 0x80) {
            addr -= 0x100;
        }
        
        const pageCrossed = ((this.pc & 0xFF00) !== (addr & 0xFF00)) ? 1 : 0;
        return { addr: addr & 0xFFFF, pageCrossed };
    }
    
    ACC() {
        return { addr: 0, pageCrossed: 0 }; // Use accumulator directly
    }
    
    IMP() {
        return { addr: 0, pageCrossed: 0 }; // Implicit addressing
    }
    
    fetchOperand(addr) {
        if (this.currentAddrMode && this.currentAddrMode.name === 'ACC') {
            return this.a;
        }
        return this.bus.read(addr);
    }
    
    isAccumulatorMode() {
        return this.currentAddrMode && this.currentAddrMode.name === 'ACC';
    }
}