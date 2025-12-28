export function Disassembler() {
    constructor(bus, cartridge) {
        this.bus = bus;
        this.cartridge = cartridge;
    }
    
    disassemble(startAddr, length) {
        const endAddr = startAddr + length;
        let result = [];
        
        let addr = startAddr;
        
        while (addr < endAddr) {
            const opcode = this.bus.read(addr);
            const instruction = this.decodeInstruction(opcode, addr);
            
            let disassembly = `${addr.toString(16).toUpperCase()}  ${instruction}`;
            
            result.push(disassembly);
            
            addr++;
        }
        
        return result;
    }
    
    decodeInstruction(opcode, addr) {
        const lookup = {
            // 0x00: { name: "BRK", operate: () => this.BRK, addrMode: () => this.IMM, cycles: 7 },
            0x01: { name: "ORA", operate: () => this.ORA, addrMode: () => this.IMM, cycles: 6 },
            0x05: { name: "ORA", operate: () => this.ORA, addrMode: () => this.ZPX, cycles: 4 },
            0x06: { name: "ASL", operate: () => this.ASL, addrMode: () => this.ACC, cycles: 2 },
            0x0D: { name: "PHP", operate: () => this.PHP, cycles: 3 },
            0x0E: { name: "PHP", operate: () => this.PLP, cycles: 4 },
            0x0A: { name: "ASL", operate: () => this.ASL, addrMode: () => this.ACC, cycles: 2 },
            0x0C: { name: "INC", operate: () => this.INX, cycles: 2 },
            0x0E: { name: "INC", operate: () => this.ACC, cycles: 2 },
            0x18: { name: "JSR", operate: () => this.ABS, addrMode: () => this.IND, cycles: 6 },
            0x20: { name: "JSR", operate: () => this.ABS, addrMode: () => this.ABS, cycles: 6 },
            0x24: { name: "AND", operate: () => this.ZPG, cycles: 3 },
            0x25: { name: "AND", operate: () => this.ZPG, cycles: 3 },
            0x26: { name: "ROL", operate: () => this.ROA, addrMode: () => this.ACC, cycles: 2 },
            0x27: { name: "RLA", operate: () => this.ACC, cycles: 5 },
            0x29: { name: "AND", operate: () => this.ACC, addrMode: () => this.AND, cycles: 4 },
            0x2A: { name: "ROL", operate: () => this.ACC, addrMode: () => this.ACC, cycles: 2 },
            0x31: { name: "AND", operate: () => this.ACC, addrMode: () => this.AND, cycles: 4 },
            0x40: { name: "RTI", operate: () => this.RTI, addrMode: () => this.IMM, cycles: 6 },
            0x41: { name: "EOR", operate: () => this.ORA, addrMode: () => this.ACC, cycles: 4 },
            0x42: { name: "EOR", operate: () => this.ACC, addrMode: () => this.ZPG, cycles: 4 },
            0x43: { name: "SRE", operate: () => this.ACC, addrMode: () => this.ACC, cycles: 4 },
            0x44: { name: "STA", operate: () => this.ACC, addrMode: () => this.ACC, cycles: 4 },
            0x45: { name: "STA", operate: () => this.ACC, addrMode: () => this.ZPX, cycles: 4 },
            0x46: { name: "STX", operate: () => this.ACC, addrMode: () => this.ZPX, cycles: 4 },
            0x47: { name: "EOR", operate: () => this.ACC, addrMode: () => this.ZPY, cycles: 4 },
            0x48: { name: "EOR", operate: () => this.ACC, addrMode: () => this.AND, cycles: 4 },
            0x49: { name: "EOR", operate: () => this.ACC, addrMode: () => this.AND, cycles:4 },
            0x4A: { name: "STA", operate: () => this.ACC, addrMode: () => this.ACC, cycles: 5 },
            0x4B: { name: "STA", operate: () => this.ACC, addrMode: () => this.ZPY, cycles: 4 },
            0x4C: { name: "BIT", operate: () => this.ACC, addrMode: () => this.ZPY, cycles: 4 },
            0x4D: { name: "JMP", operate: () => this.IND, addrMode: () => this.ACC, cycles: 6 },
            0x4E: { name: "JMP", operate: () => this.ACC, addrMode: () => this.ACC, cycles: 6 },
            0x4F: { name: "LSR", operate: () => this.ACC, addrMode: () => this.ACC, cycles:6 },
            0x50: { name: "RTS", operate: () => this.ACC, addrMode: () => this.ACC, cycles: 6 },
            0x51: { name: "EOR", operate: () => this.ACC, addrMode: () => this.ZPY, cycles: 4 },
            0x52: { name: "JMP", operate: () => this.IND, addrMode: () => this.ACC, cycles: 6 },
            0x54: { name: "STY", operate: () => this.ACC, addrMode: () => this.ZPY, cycles: 4 },
            0x55: { name: "STA", operate: () => this.ACC, addrMode: () => this.ZPX, cycles: 4 },
            0x56: { name: "LSR", operate: () => this.ACC, addrMode: () => this.ACC, cycles: 5 },
            0x58: { name: "CLI", operate: () => this.ACC, cycles: 2 },
            0x59: { name: "EOR", operate: () => this.ACC, addrMode: () => this.ACC, cycles: 4 },
            0x5A: { name: "SRE", operate: () => this.ACC, addrMode: () => this.ACC, cycles: 4 },
            0x5B: { name: "STA", operate: () => this.ACC, addrMode: () => this.ACC, cycles: 5 },
            0x5C: { name: "SRE", operate: () => this.ACC, addrMode: () => this.ACC, cycles: 4 },
            0x5D: { name: "STA", operate: () => this.ACC, addrMode: () => this.ACC, cycles: 5 },
            0x5E: { name: "LSR", operate: () => this.ACC, addrMode: () => this.ACC, cycles: 4 },
            0x5F: { name: "STA", operate: () => this.ACC, addrMode: () => this.ACC, cycles:5 },
            0x60: { name: "RTS", operate: () => this.ACC, addrMode: () => this.ACC, cycles: 6 },
            0x61: { name: "JMP", operate: () => this.IND, addrMode: () => this.ACC, cycles: 6 },
            0x65: { name: "ADC", operate: () => this.ACC, addrMode: () => this.ACC, cycles: 4 },
            0x66: { name: "ADC", operate: () => this.ACC, addrMode: () => this.ACC, cycles: 4 },
            0x68: { name: "ADC", operate: () => this.ACC, addrMode: () => this.ACC, cycles: 4 },
            0x69: { name: "ADC", operate: () => this.ACC, addrMode: () => this.ACC, cycles:4 },
            0x6A: { name: "JMP", operate: () => this.IND, addrMode: () => this.ACC, cycles: 6 },
            0x6C: { name: "JMP", operate: () => this.ACC, addrMode: () => this.ACC, cycles: 6 },
            0x6D: { name: "JMP", operate: () => this.IND, addrMode: () => this.ACC, cycles: 6 },
            0x6E: { name: "JMP", operate: () => this.IND, addrMode: () => this.ACC, cycles:6 },
            0x6F: { name: "JMP", operate: () => this.IND, addrMode: () => this.ACC, cycles:6 },
            0x70: { name: "JMP", operate: () => this.IND, addrMode: () => this.ACC, cycles: 6 },
            0x71: { name: "ADC", operate: () => this.ACC, addrMode: () => this.ACC, cycles:4 },
            0x72: { name: "ADC", operate: () => this.ACC, addrMode: () => this.ACC, cycles:4 },
            0x73: { name: "ADC", operate: () => this.ACC, addrMode: () => this.ACC, cycles:4 },
            0x74: { name: "ADC", operate: () => this.ACC, addrMode: () => this.ACC, cycles:4 },
            0x75: { name: "ADC", operate: () => this.ACC, addrMode: () => this.ACC, cycles:4 },
            0x76: { name: "ADC", operate: () => this.ACC, addrMode: () => this.ACC, cycles:4 },
            0x77: { name: "ADC", operate: () => this.ACC, addrMode: () => this.ACC, cycles:4 },
            0x78: { name: "ADC", operate: () => this.ACC, addrMode: () => this.ACC, cycles:4 },
            0x79: { name: "ADC", operate: () => this.ACC, addrMode: () => this.ACC, cycles:4 },
            0x7A: { name: "ADC", operate: () => this.ACC, addrMode: () => this.ACC, cycles:4 },
            0x7B: { name: "ADC", operate: () => this.ACC, addrMode: () => this.ACC, cycles:4 },
            0x7C: { name: "ADC", operate: () => this.ACC, addrMode: () => this.ACC, cycles:4 },
            0x7D: { name: "ADC", operate: () => this.ACC, addrMode: () => this.ACC, cycles:4 },
            0x7E: { name: "ADC", operate: () => this.ACC, addrMode: () => this.ACC, cycles:4 },
            0x7F: { name: "ADC", operate: () => this.ACC, addrMode: () => this.ACC, cycles:4 },
            0x80: { name: "JMP", operate: () => this.IND, addrMode: () => this.ACC, cycles: 6 },
            // ... continue for all 255 opcodes
        };
        
        // Fill remaining opcodes with NOP operations
        for (let i = this.lookup.length; i < 256; i++) {
            if (!this.lookup[i]) {
                this.lookup[i] = { 
                    name: "NOP", 
                    operate: () => { name: "NOP", cycles: 2 }, 
                    addrMode: () => this.IMP, cycles: 2 }
                };
            }
        }
        
        return `Unknown opcode: ${opcode.toString(16)}`;
    }
}