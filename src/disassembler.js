import { opcodes } from './opcodes.js';

/**
 * Addressing mode configurations for disassembly
 * @readonly
 * @type {Object.<string, {length: number, format: string}>}
 */
const addressingModes = {
    /** Immediate addressing */
    IMM: { length: 2, format: '#${val:02X}' },
    /** Zero page addressing */
    ZPG: { length: 2, format: '$${val:02X}' },
    /** Zero page indexed with X */
    ZPX: { length: 2, format: '$${val:02X},X' },
    /** Zero page indexed with Y */
    ZPY: { length: 2, format: '$${val:02X},Y' },
    /** Absolute addressing */
    ABS: { length: 3, format: '$${val:04X}' },
    /** Absolute indexed with X */
    ABX: { length: 3, format: '$${val:04X},X' },
    /** Absolute indexed with Y */
    ABY: { length: 3, format: '$${val:04X},Y' },
    /** Indirect addressing */
    IND: { length: 3, format: '($${val:04X})' },
    /** Indexed indirect with X */
    IZX: { length: 2, format: '($${val:02X},X)' },
    /** Indirect indexed with Y */
    IZY: { length: 2, format: '($${val:02X}),Y' },
    /** Relative addressing */
    REL: { length: 2, format: '$${val:04X}' },
    /** Accumulator addressing */
    ACC: { length: 1, format: 'A' },
    /** Implied addressing */
    IMP: { length: 1, format: '' },
};

const instructions = new Array(256);

function initInstructionTable() {
    // This function should be called only once
    if (instructions[0]) return;

    for (let i = 0; i < 256; i++) {
        instructions[i] = { name: '???', addrModeName: 'IMP' };
    }

    // This is a simplified version of the cpu.js lookup table
    // In a real scenario, you would share this data
    instructions[0x69] = { name: 'ADC', addrModeName: 'IMM' };
    instructions[0x65] = { name: 'ADC', addrModeName: 'ZPG' };
    instructions[0x75] = { name: 'ADC', addrModeName: 'ZPX' };
    instructions[0x6D] = { name: 'ADC', addrModeName: 'ABS' };
    instructions[0x7D] = { name: 'ADC', addrModeName: 'ABX' };
    instructions[0x79] = { name: 'ADC', addrModeName: 'ABY' };
    instructions[0x61] = { name: 'ADC', addrModeName: 'IZX' };
    instructions[0x71] = { name: 'ADC', addrModeName: 'IZY' };
    instructions[0x29] = { name: 'AND', addrModeName: 'IMM' };
    instructions[0x25] = { name: 'AND', addrModeName: 'ZPG' };
    instructions[0x35] = { name: 'AND', addrModeName: 'ZPX' };
    instructions[0x2D] = { name: 'AND', addrModeName: 'ABS' };
    instructions[0x3D] = { name: 'AND', addrModeName: 'ABX' };
    instructions[0x39] = { name: 'AND', addrModeName: 'ABY' };
    instructions[0x21] = { name: 'AND', addrModeName: 'IZX' };
    instructions[0x31] = { name: 'AND', addrModeName: 'IZY' };
    instructions[0x0A] = { name: 'ASL', addrModeName: 'ACC' };
    instructions[0x06] = { name: 'ASL', addrModeName: 'ZPG' };
    instructions[0x16] = { name: 'ASL', addrModeName: 'ZPX' };
    instructions[0x0E] = { name: 'ASL', addrModeName: 'ABS' };
    instructions[0x1E] = { name: 'ASL', addrModeName: 'ABX' };
    instructions[0x90] = { name: 'BCC', addrModeName: 'REL' };
    instructions[0xB0] = { name: 'BCS', addrModeName: 'REL' };
    instructions[0xF0] = { name: 'BEQ', addrModeName: 'REL' };
    instructions[0x24] = { name: 'BIT', addrModeName: 'ZPG' };
    instructions[0x2C] = { name: 'BIT', addrModeName: 'ABS' };
    instructions[0x30] = { name: 'BMI', addrModeName: 'REL' };
    instructions[0xD0] = { name: 'BNE', addrModeName: 'REL' };
    instructions[0x10] = { name: 'BPL', addrModeName: 'REL' };
    instructions[0x00] = { name: 'BRK', addrModeName: 'IMP' };
    instructions[0x50] = { name: 'BVC', addrModeName: 'REL' };
    instructions[0x70] = { name: 'BVS', addrModeName: 'REL' };
    instructions[0x18] = { name: 'CLC', addrModeName: 'IMP' };
    instructions[0xD8] = { name: 'CLD', addrModeName: 'IMP' };
    instructions[0x58] = { name: 'CLI', addrModeName: 'IMP' };
    instructions[0xB8] = { name: 'CLV', addrModeName: 'IMP' };
    instructions[0xC9] = { name: 'CMP', addrModeName: 'IMM' };
    instructions[0xC5] = { name: 'CMP', addrModeName: 'ZPG' };
    instructions[0xD5] = { name: 'CMP', addrModeName: 'ZPX' };
    instructions[0xCD] = { name: 'CMP', addrModeName: 'ABS' };
    instructions[0xDD] = { name: 'CMP', addrModeName: 'ABX' };
    instructions[0xD9] = { name: 'CMP', addrModeName: 'ABY' };
    instructions[0xC1] = { name: 'CMP', addrModeName: 'IZX' };
    instructions[0xD1] = { name: 'CMP', addrModeName: 'IZY' };
    instructions[0xE0] = { name: 'CPX', addrModeName: 'IMM' };
    instructions[0xE4] = { name: 'CPX', addrModeName: 'ZPG' };
    instructions[0xEC] = { name: 'CPX', addrModeName: 'ABS' };
    instructions[0xC0] = { name: 'CPY', addrModeName: 'IMM' };
    instructions[0xC4] = { name: 'CPY', addrModeName: 'ZPG' };
    instructions[0xCC] = { name: 'CPY', addrModeName: 'ABS' };
    instructions[0xC6] = { name: 'DEC', addrModeName: 'ZPG' };
    instructions[0xD6] = { name: 'DEC', addrModeName: 'ZPX' };
    instructions[0xCE] = { name: 'DEC', addrModeName: 'ABS' };
    instructions[0xDE] = { name: 'DEC', addrModeName: 'ABX' };
    instructions[0xCA] = { name: 'DEX', addrModeName: 'IMP' };
    instructions[0x88] = { name: 'DEY', addrModeName: 'IMP' };
    instructions[0x49] = { name: 'EOR', addrModeName: 'IMM' };
    instructions[0x45] = { name: 'EOR', addrModeName: 'ZPG' };
    instructions[0x55] = { name: 'EOR', addrModeName: 'ZPX' };
    instructions[0x4D] = { name: 'EOR', addrModeName: 'ABS' };
    instructions[0x5D] = { name: 'EOR', addrModeName: 'ABX' };
    instructions[0x59] = { name: 'EOR', addrModeName: 'ABY' };
    instructions[0x21] = { name: 'EOR', addrModeName: 'IZX' };
    instructions[0x51] = { name: 'EOR', addrModeName: 'IZY' };
    instructions[0xE6] = { name: 'INC', addrModeName: 'ZPG' };
    instructions[0xF6] = { name: 'INC', addrModeName: 'ZPX' };
    instructions[0xEE] = { name: 'INC', addrModeName: 'ABS' };
    instructions[0xFE] = { name: 'INC', addrModeName: 'ABX' };
    instructions[0xE8] = { name: 'INX', addrModeName: 'IMP' };
    instructions[0xC8] = { name: 'INY', addrModeName: 'IMP' };
    instructions[0x4C] = { name: 'JMP', addrModeName: 'ABS' };
    instructions[0x6C] = { name: 'JMP', addrModeName: 'IND' };
    instructions[0x20] = { name: 'JSR', addrModeName: 'ABS' };
    instructions[0xA9] = { name: 'LDA', addrModeName: 'IMM' };
    instructions[0xA5] = { name: 'LDA', addrModeName: 'ZPG' };
    instructions[0xB5] = { name: 'LDA', addrModeName: 'ZPX' };
    instructions[0xAD] = { name: 'LDA', addrModeName: 'ABS' };
    instructions[0xBD] = { name: 'LDA', addrModeName: 'ABX' };
    instructions[0xB9] = { name: 'LDA', addrModeName: 'ABY' };
    instructions[0xA1] = { name: 'LDA', addrModeName: 'IZX' };
    instructions[0xB1] = { name: 'LDA', addrModeName: 'IZY' };
    instructions[0xA2] = { name: 'LDX', addrModeName: 'IMM' };
    instructions[0xA6] = { name: 'LDX', addrModeName: 'ZPG' };
    instructions[0xB6] = { name: 'LDX', addrModeName: 'ZPY' };
    instructions[0xAE] = { name: 'LDX', addrModeName: 'ABS' };
    instructions[0xBE] = { name: 'LDX', addrModeName: 'ABY' };
    instructions[0xA0] = { name: 'LDY', addrModeName: 'IMM' };
    instructions[0xA4] = { name: 'LDY', addrModeName: 'ZPG' };
    instructions[0xB4] = { name: 'LDY', addrModeName: 'ZPX' };
    instructions[0xAC] = { name: 'LDY', addrModeName: 'ABS' };
    instructions[0xBC] = { name: 'LDY', addrModeName: 'ABX' };
    instructions[0x4A] = { name: 'LSR', addrModeName: 'ACC' };
    instructions[0x46] = { name: 'LSR', addrModeName: 'ZPG' };
    instructions[0x56] = { name: 'LSR', addrModeName: 'ZPX' };
    instructions[0x4E] = { name: 'LSR', addrModeName: 'ABS' };
    instructions[0x5E] = { name: 'LSR', addrModeName: 'ABX' };
    instructions[0xEA] = { name: 'NOP', addrModeName: 'IMP' };
    instructions[0x09] = { name: 'ORA', addrModeName: 'IMM' };
    instructions[0x05] = { name: 'ORA', addrModeName: 'ZPG' };
    instructions[0x15] = { name: 'ORA', addrModeName: 'ZPX' };
    instructions[0x0D] = { name: 'ORA', addrModeName: 'ABS' };
    instructions[0x1D] = { name: 'ORA', addrModeName: 'ABX' };
    instructions[0x19] = { name: 'ORA', addrModeName: 'ABY' };
    instructions[0x01] = { name: 'ORA', addrModeName: 'IZX' };
    instructions[0x11] = { name: 'ORA', addrModeName: 'IZY' };
    instructions[0x48] = { name: 'PHA', addrModeName: 'IMP' };
    instructions[0x08] = { name: 'PHP', addrModeName: 'IMP' };
    instructions[0x68] = { name: 'PLA', addrModeName: 'IMP' };
    instructions[0x28] = { name: 'PLP', addrModeName: 'IMP' };
    instructions[0x2A] = { name: 'ROL', addrModeName: 'ACC' };
    instructions[0x26] = { name: 'ROL', addrModeName: 'ZPG' };
    instructions[0x36] = { name: 'ROL', addrModeName: 'ZPX' };
    instructions[0x2E] = { name: 'ROL', addrModeName: 'ABS' };
    instructions[0x3E] = { name: 'ROL', addrModeName: 'ABX' };
    instructions[0x6A] = { name: 'ROR', addrModeName: 'ACC' };
    instructions[0x66] = { name: 'ROR', addrModeName: 'ZPG' };
    instructions[0x76] = { name: 'ROR', addrModeName: 'ZPX' };
    instructions[0x6E] = { name: 'ROR', addrModeName: 'ABS' };
    instructions[0x7E] = { name: 'ROR', addrModeName: 'ABX' };
    instructions[0x40] = { name: 'RTI', addrModeName: 'IMP' };
    instructions[0x60] = { name: 'RTS', addrModeName: 'IMP' };
    instructions[0xE9] = { name: 'SBC', addrModeName: 'IMM' };
    instructions[0xE5] = { name: 'SBC', addrModeName: 'ZPG' };
    instructions[0xF5] = { name: 'SBC', addrModeName: 'ZPX' };
    instructions[0xED] = { name: 'SBC', addrModeName: 'ABS' };
    instructions[0xFD] = { name: 'SBC', addrModeName: 'ABX' };
    instructions[0xF9] = { name: 'SBC', addrModeName: 'ABY' };
    instructions[0xE1] = { name: 'SBC', addrModeName: 'IZX' };
    instructions[0xF1] = { name: 'SBC', addrModeName: 'IZY' };
    instructions[0x38] = { name: 'SEC', addrModeName: 'IMP' };
    instructions[0xF8] = { name: 'SED', addrModeName: 'IMP' };
    instructions[0x78] = { name: 'SEI', addrModeName: 'IMP' };
    instructions[0x85] = { name: 'STA', addrModeName: 'ZPG' };
    instructions[0x95] = { name: 'STA', addrModeName: 'ZPX' };
    instructions[0x8D] = { name: 'STA', addrModeName: 'ABS' };
    instructions[0x9D] = { name: 'STA', addrModeName: 'ABX' };
    instructions[0x99] = { name: 'STA', addrModeName: 'ABY' };
    instructions[0x81] = { name: 'STA', addrModeName: 'IZX' };
    instructions[0x91] = { name: 'STA', addrModeName: 'IZY' };
    instructions[0x86] = { name: 'STX', addrModeName: 'ZPG' };
    instructions[0x96] = { name: 'STX', addrModeName: 'ZPY' };
    instructions[0x8E] = { name: 'STX', addrModeName: 'ABS' };
    instructions[0x84] = { name: 'STY', addrModeName: 'ZPG' };
    instructions[0x94] = { name: 'STY', addrModeName: 'ZPX' };
    instructions[0x8C] = { name: 'STY', addrModeName: 'ABS' };
    instructions[0xAA] = { name: 'TAX', addrModeName: 'IMP' };
    instructions[0xA8] = { name: 'TAY', addrModeName: 'IMP' };
    instructions[0xBA] = { name: 'TSX', addrModeName: 'IMP' };
    instructions[0x8A] = { name: 'TXA', addrModeName: 'IMP' };
    instructions[0x9A] = { name: 'TXS', addrModeName: 'IMP' };
    instructions[0x98] = { name: 'TYA', addrModeName: 'IMP' };
}

initInstructionTable();

/**
 * Disassemble a range of memory into human-readable assembly
 * @param {Bus} bus - System bus for memory access
 * @param {number} startAddr - Starting address to disassemble
 * @param {number} [count=20] - Number of instructions to disassemble
 * @returns {string} Formatted disassembly output
 */
export function disassemble(bus, startAddr, count = 20) {
    let output = '';
    let pc = startAddr;

    for (let i = 0; i < count; i++) {
        const addr = pc;
        const opcode = bus.read(pc);
        const instruction = instructions[opcode];
        
        if (!instruction || instruction.name === '???') {
            // Unknown opcode
            output += `${addr.toString(16).toUpperCase().padStart(4, '0')}:  ${opcode.toString(16).toUpperCase().padStart(2, '0')}        ???\n`;
            pc++;
            continue;
        }
        
        const addrMode = addressingModes[instruction.addrModeName];

        let operand = '';
        let value = 0;
        let bytes = [opcode];

        if (addrMode.length === 2) {
            value = bus.read(pc + 1);
            bytes.push(value);
            operand = addrMode.format.replace('${val:02X}', value.toString(16).toUpperCase().padStart(2, '0'));
        } else if (addrMode.length === 3) {
            const lo = bus.read(pc + 1);
            const hi = bus.read(pc + 2);
            value = (hi << 8) | lo;
            bytes.push(lo, hi);
            operand = addrMode.format.replace('${val:04X}', value.toString(16).toUpperCase().padStart(4, '0'));
        } else {
            operand = addrMode.format;
        }

        const bytesStr = bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

        output += `${addr.toString(16).toUpperCase().padStart(4, '0')}:  ${bytesStr.padEnd(8)}  ${instruction.name} ${operand}\n`;
        pc += addrMode.length;
    }

    return output;
}

/**
 * Disassemble a single instruction
 * @param {Bus} bus - System bus for memory access
 * @param {number} addr - Address of instruction to disassemble
 * @returns {Object} Instruction object with bytes, mnemonic, operand, etc.
 * @returns {number[]} returns.bytes - Raw instruction bytes
 * @returns {string} returns.mnemonic - Instruction mnemonic
 * @returns {string} returns.operand - Formatted operand
 * @returns {number} returns.length - Total instruction length
 * @returns {number} returns.addr - Instruction address
 */
export function disassembleInstruction(bus, addr) {
    const opcode = bus.read(addr);
    const instruction = instructions[opcode];
    
    if (!instruction || instruction.name === '???') {
        return {
            bytes: [opcode],
            mnemonic: '???',
            operand: '',
            length: 1,
            addr: addr
        };
    }
    
    const addrMode = addressingModes[instruction.addrModeName];
    
    let operand = '';
    let value = 0;
    let bytes = [opcode];

    if (addrMode.length === 2) {
        value = bus.read(addr + 1);
        bytes.push(value);
        operand = addrMode.format.replace('${val:02X}', value.toString(16).toUpperCase().padStart(2, '0'));
    } else if (addrMode.length === 3) {
        const lo = bus.read(addr + 1);
        const hi = bus.read(addr + 2);
        value = (hi << 8) | lo;
        bytes.push(lo, hi);
        operand = addrMode.format.replace('${val:04X}', value.toString(16).toUpperCase().padStart(4, '0'));
    } else {
        operand = addrMode.format;
    }

    return {
        bytes: bytes,
        mnemonic: instruction.name,
        operand: operand.trim(),
        length: addrMode.length,
        addr: addr
    };
}