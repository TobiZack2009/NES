// Define FLAGS locally to avoid circular dependency
const FLAGS = {
    C: (1 << 0), // Carry
    Z: (1 << 1), // Zero
    I: (1 << 2), // Interrupt Disable
    D: (1 << 3), // Decimal (Unused in NES)
    B: (1 << 4), // Break
    U: (1 << 5), // Unused
    V: (1 << 6), // Overflow
    N: (1 << 7), // Negative
};

// Opcode implementations
export const opcodes = {
    
    // ADC - Add with Carry
    ADC: function(addrData) {
        const fetched = this.fetchOperand(addrData.addr);
        const temp = this.a + fetched + this.getFlag(FLAGS.C);
        this.setFlag(FLAGS.C, temp > 0xFF);
        this.setFlag(FLAGS.Z, (temp & 0xFF) === 0);
        this.setFlag(FLAGS.V, ((~(this.a ^ fetched) & (this.a ^ temp)) & 0x80) !== 0);
        this.setFlag(FLAGS.N, (temp & 0x80) !== 0);
        this.a = temp & 0xFF;
        return 0;
    },
    
    // AND - Logical AND
    AND: function(addrData) {
        this.a &= this.fetchOperand(addrData.addr);
        this.setFlag(FLAGS.Z, this.a === 0);
        this.setFlag(FLAGS.N, (this.a & 0x80) !== 0);
        return 0;
    },
    
    // ASL - Arithmetic Shift Left
    ASL: function(addrData) {
        let data;
        if (addrData.addr === 0 && this.isAccumulatorMode()) {
            // Accumulator mode
            this.setFlag(FLAGS.C, (this.a & 0x80) !== 0);
            this.a = (this.a << 1) & 0xFF;
            data = this.a;
        } else {
            // Memory mode
            data = this.fetchOperand(addrData.addr);
            this.setFlag(FLAGS.C, (data & 0x80) !== 0);
            data = (data << 1) & 0xFF;
            this.bus.write(addrData.addr, data);
        }
        this.setFlag(FLAGS.Z, data === 0);
        this.setFlag(FLAGS.N, (data & 0x80) !== 0);
        return 0;
    },
    
    // BCC - Branch if Carry Clear
    BCC: function(addrData) {
        if (this.getFlag(FLAGS.C) === 0) {
            this.cycles++;
            if (addrData.pageCrossed) this.cycles++;
            this.pc = addrData.addr;
        }
        return 0;
    },
    
    // BCS - Branch if Carry Set
    BCS: function(addrData) {
        if (this.getFlag(FLAGS.C) === 1) {
            this.cycles++;
            if (addrData.pageCrossed) this.cycles++;
            this.pc = addrData.addr;
        }
        return 0;
    },
    
    // BEQ - Branch if Equal
    BEQ: function(addrData) {
        if (this.getFlag(FLAGS.Z) === 1) {
            this.cycles++;
            if (addrData.pageCrossed) this.cycles++;
            this.pc = addrData.addr;
        }
        return 0;
    },
    
    // BIT - Bit Test
    BIT: function(addrData) {
        const data = this.fetchOperand(addrData.addr);
        this.setFlag(FLAGS.Z, (data & this.a) === 0);
        this.setFlag(FLAGS.V, (data & 0x40) !== 0);
        this.setFlag(FLAGS.N, (data & 0x80) !== 0);
        return 0;
    },
    
    // BMI - Branch if Minus
    BMI: function(addrData) {
        if (this.getFlag(FLAGS.N) === 1) {
            this.cycles++;
            if (addrData.pageCrossed) this.cycles++;
            this.pc = addrData.addr;
        }
        return 0;
    },
    
    // BNE - Branch if Not Equal
    BNE: function(addrData) {
        if (this.getFlag(FLAGS.Z) === 0) {
            this.cycles++;
            if (addrData.pageCrossed) this.cycles++;
            this.pc = addrData.addr;
        }
        return 0;
    },
    
    // BPL - Branch if Positive
    BPL: function(addrData) {
        if (this.getFlag(FLAGS.N) === 0) {
            this.cycles++;
            if (addrData.pageCrossed) this.cycles++;
            this.pc = addrData.addr;
        }
        return 0;
    },
    
    // BRK - Break
    BRK: function(addrData) {
        this.pc++;
        this.setFlag(FLAGS.I, true);
        this.push((this.pc >> 8) & 0xFF);
        this.push(this.pc & 0xFF);
        this.setFlag(FLAGS.B, true);
        this.push(this.status);
        this.setFlag(FLAGS.B, false);
        this.pc = this.bus.read(0xFFFE) | (this.bus.read(0xFFFF) << 8);
        return 0;
    },
    
    // BVC - Branch if Overflow Clear
    BVC: function(addrData) {
        if (this.getFlag(FLAGS.V) === 0) {
            this.cycles++;
            if (addrData.pageCrossed) this.cycles++;
            this.pc = addrData.addr;
        }
        return 0;
    },
    
    // BVS - Branch if Overflow Set
    BVS: function(addrData) {
        if (this.getFlag(FLAGS.V) === 1) {
            this.cycles++;
            if (addrData.pageCrossed) this.cycles++;
            this.pc = addrData.addr;
        }
        return 0;
    },
    
    // CLC - Clear Carry
    CLC: function(addrData) {
        this.setFlag(FLAGS.C, false);
        return 0;
    },
    
    // CLD - Clear Decimal
    CLD: function(addrData) {
        this.setFlag(FLAGS.D, false);
        return 0;
    },
    
    // CLI - Clear Interrupt Disable
    CLI: function(addrData) {
        this.setFlag(FLAGS.I, false);
        return 0;
    },
    
    // CLV - Clear Overflow
    CLV: function(addrData) {
        this.setFlag(FLAGS.V, false);
        return 0;
    },
    
    // CMP - Compare
    CMP: function(addrData) {
        const data = this.fetchOperand(addrData.addr);
        const temp = this.a - data;
        this.setFlag(FLAGS.C, temp >= 0);
        this.setFlag(FLAGS.Z, (temp & 0xFF) === 0);
        this.setFlag(FLAGS.N, (temp & 0x80) !== 0);
        return 0;
    },
    
    // CPX - Compare X Register
    CPX: function(addrData) {
        const data = this.fetchOperand(addrData.addr);
        const temp = this.x - data;
        this.setFlag(FLAGS.C, temp >= 0);
        this.setFlag(FLAGS.Z, (temp & 0xFF) === 0);
        this.setFlag(FLAGS.N, (temp & 0x80) !== 0);
        return 0;
    },
    
    // CPY - Compare Y Register
    CPY: function(addrData) {
        const data = this.fetchOperand(addrData.addr);
        const temp = this.y - data;
        this.setFlag(FLAGS.C, temp >= 0);
        this.setFlag(FLAGS.Z, (temp & 0xFF) === 0);
        this.setFlag(FLAGS.N, (temp & 0x80) !== 0);
        return 0;
    },
    
    // DEC - Decrement Memory
    DEC: function(addrData) {
        let data = this.fetchOperand(addrData.addr);
        data = (data - 1) & 0xFF;
        this.bus.write(addrData.addr, data);
        this.setFlag(FLAGS.Z, data === 0);
        this.setFlag(FLAGS.N, (data & 0x80) !== 0);
        return 0;
    },
    
    // DEX - Decrement X Register
    DEX: function(addrData) {
        this.x = (this.x - 1) & 0xFF;
        this.setFlag(FLAGS.Z, this.x === 0);
        this.setFlag(FLAGS.N, (this.x & 0x80) !== 0);
        return 0;
    },
    
    // DEY - Decrement Y Register
    DEY: function(addrData) {
        this.y = (this.y - 1) & 0xFF;
        this.setFlag(FLAGS.Z, this.y === 0);
        this.setFlag(FLAGS.N, (this.y & 0x80) !== 0);
        return 0;
    },
    
    // EOR - Exclusive OR
    EOR: function(addrData) {
        this.a ^= this.fetchOperand(addrData.addr);
        this.setFlag(FLAGS.Z, this.a === 0);
        this.setFlag(FLAGS.N, (this.a & 0x80) !== 0);
        return 0;
    },
    
    // INC - Increment Memory
    INC: function(addrData) {
        let data = this.fetchOperand(addrData.addr);
        data = (data + 1) & 0xFF;
        this.bus.write(addrData.addr, data);
        this.setFlag(FLAGS.Z, data === 0);
        this.setFlag(FLAGS.N, (data & 0x80) !== 0);
        return 0;
    },
    
    // INX - Increment X Register
    INX: function(addrData) {
        this.x = (this.x + 1) & 0xFF;
        this.setFlag(FLAGS.Z, this.x === 0);
        this.setFlag(FLAGS.N, (this.x & 0x80) !== 0);
        return 0;
    },
    
    // INY - Increment Y Register
    INY: function(addrData) {
        this.y = (this.y + 1) & 0xFF;
        this.setFlag(FLAGS.Z, this.y === 0);
        this.setFlag(FLAGS.N, (this.y & 0x80) !== 0);
        return 0;
    },
    
    // JMP - Jump
    JMP: function(addrData) {
        this.pc = addrData.addr;
        return 0;
    },
    
    // JSR - Jump to Subroutine
    JSR: function(addrData) {
        this.pc--;
        this.push(this.pc >> 8 & 0xFF);
        this.push(this.pc & 0xFF);
        this.pc = addrData.addr;
        return 0;
    },
    
    // LDA - Load Accumulator
    LDA: function(addrData) {
        this.a = this.fetchOperand(addrData.addr);
        this.setFlag(FLAGS.Z, this.a === 0);
        this.setFlag(FLAGS.N, (this.a & 0x80) !== 0);
        return 0;
    },
    
    // LDX - Load X Register
    LDX: function(addrData) {
        console.log('LDX opcode called');
        this.x = this.fetchOperand(addrData.addr);
        this.setFlag(FLAGS.Z, this.x === 0);
        this.setFlag(FLAGS.N, (this.x & 0x80) !== 0);
        return 0;
    },
    
    // LDY - Load Y Register
    LDY: function(addrData) {
        this.y = this.fetchOperand(addrData.addr);
        this.setFlag(FLAGS.Z, this.y === 0);
        this.setFlag(FLAGS.N, (this.y & 0x80) !== 0);
        return 0;
    },
    
    // LSR - Logical Shift Right
    LSR: function(addrData) {
        let data;
        if (addrData.addr === 0 && this.isAccumulatorMode()) {
            // Accumulator mode
            this.setFlag(FLAGS.C, (this.a & 0x01) !== 0);
            this.a = this.a >> 1;
            data = this.a;
        } else {
            // Memory mode
            data = this.fetchOperand(addrData.addr);
            this.setFlag(FLAGS.C, (data & 0x01) !== 0);
            data = data >> 1;
            this.bus.write(addrData.addr, data);
        }
        this.setFlag(FLAGS.Z, data === 0);
        this.setFlag(FLAGS.N, false);
        return 0;
    },
    
    // NOP - No Operation
    NOP: function(addrData) {
        return 0;
    },
    
    // ORA - Logical Inclusive OR
    ORA: function(addrData) {
        this.a |= this.fetchOperand(addrData.addr);
        this.setFlag(FLAGS.Z, this.a === 0);
        this.setFlag(FLAGS.N, (this.a & 0x80) !== 0);
        return 0;
    },
    
    // PHA - Push Accumulator
    PHA: function(addrData) {
        this.push(this.a);
        return 0;
    },
    
    // PHP - Push Processor Status
    PHP: function(addrData) {
        this.push(this.status | FLAGS.B);
        return 0;
    },
    
    // PLA - Pull Accumulator
    PLA: function(addrData) {
        this.a = this.pull();
        this.setFlag(FLAGS.Z, this.a === 0);
        this.setFlag(FLAGS.N, (this.a & 0x80) !== 0);
        return 0;
    },
    
    // PLP - Pull Processor Status
    PLP: function(addrData) {
        this.status = this.pull();
        this.setFlag(FLAGS.U, true);
        return 0;
    },
    
    // ROL - Rotate Left
    ROL: function(addrData) {
        let data;
        const carry = this.getFlag(FLAGS.C);
        
        if (addrData.addr === 0 && this.isAccumulatorMode()) {
            // Accumulator mode
            this.setFlag(FLAGS.C, (this.a & 0x80) !== 0);
            this.a = ((this.a << 1) | carry) & 0xFF;
            data = this.a;
        } else {
            // Memory mode
            data = this.fetchOperand(addrData.addr);
            this.setFlag(FLAGS.C, (data & 0x80) !== 0);
            data = ((data << 1) | carry) & 0xFF;
            this.bus.write(addrData.addr, data);
        }
        this.setFlag(FLAGS.Z, data === 0);
        this.setFlag(FLAGS.N, (data & 0x80) !== 0);
        return 0;
    },
    
    // ROR - Rotate Right
    ROR: function(addrData) {
        let data;
        const carry = this.getFlag(FLAGS.C) << 7;
        
        if (addrData.addr === 0 && this.isAccumulatorMode()) {
            // Accumulator mode
            this.setFlag(FLAGS.C, (this.a & 0x01) !== 0);
            this.a = (this.a >> 1) | carry;
            data = this.a;
        } else {
            // Memory mode
            data = this.fetchOperand(addrData.addr);
            this.setFlag(FLAGS.C, (data & 0x01) !== 0);
            data = (data >> 1) | carry;
            this.bus.write(addrData.addr, data);
        }
        this.setFlag(FLAGS.Z, data === 0);
        this.setFlag(FLAGS.N, (data & 0x80) !== 0);
        return 0;
    },
    
    // RTI - Return from Interrupt
    RTI: function(addrData) {
        this.status = this.pull();
        this.setFlag(FLAGS.U, true);
        this.pc = this.pull() | (this.pull() << 8);
        return 0;
    },
    
    // RTS - Return from Subroutine
    RTS: function(addrData) {
        this.pc = (this.pull() | (this.pull() << 8)) + 1;
        return 0;
    },
    
    // SBC - Subtract with Carry
    SBC: function(addrData) {
        const fetched = this.fetchOperand(addrData.addr) ^ 0xFF;
        const temp = this.a + fetched + this.getFlag(FLAGS.C);
        this.setFlag(FLAGS.C, temp > 0xFF);
        this.setFlag(FLAGS.Z, (temp & 0xFF) === 0);
        this.setFlag(FLAGS.V, ((~(this.a ^ fetched) & (this.a ^ temp)) & 0x80) !== 0);
        this.setFlag(FLAGS.N, (temp & 0x80) !== 0);
        this.a = temp & 0xFF;
        return 0;
    },
    
    // SEC - Set Carry
    SEC: function(addrData) {
        this.setFlag(FLAGS.C, true);
        return 0;
    },
    
    // SED - Set Decimal
    SED: function(addrData) {
        this.setFlag(FLAGS.D, true);
        return 0;
    },
    
    // SEI - Set Interrupt Disable
    SEI: function(addrData) {
        this.setFlag(FLAGS.I, true);
        return 0;
    },
    
    // STA - Store Accumulator
    STA: function(addrData) {
        this.bus.write(addrData.addr, this.a);
        return 0;
    },
    
    // STX - Store X Register
    STX: function(addrData) {
        this.bus.write(addrData.addr, this.x);
        return 0;
    },
    
    // STY - Store Y Register
    STY: function(addrData) {
        this.bus.write(addrData.addr, this.y);
        return 0;
    },
    
    // TAX - Transfer Accumulator to X
    TAX: function(addrData) {
        this.x = this.a;
        this.setFlag(FLAGS.Z, this.x === 0);
        this.setFlag(FLAGS.N, (this.x & 0x80) !== 0);
        return 0;
    },
    
    // TAY - Transfer Accumulator to Y
    TAY: function(addrData) {
        this.y = this.a;
        this.setFlag(FLAGS.Z, this.y === 0);
        this.setFlag(FLAGS.N, (this.y & 0x80) !== 0);
        return 0;
    },
    
    // TSX - Transfer Stack Pointer to X
    TSX: function(addrData) {
        this.x = this.stkp;
        this.setFlag(FLAGS.Z, this.x === 0);
        this.setFlag(FLAGS.N, (this.x & 0x80) !== 0);
        return 0;
    },
    
    // TXA - Transfer X to Accumulator
    TXA: function(addrData) {
        this.a = this.x;
        this.setFlag(FLAGS.Z, this.a === 0);
        this.setFlag(FLAGS.N, (this.a & 0x80) !== 0);
        return 0;
    },
    
    // TXS - Transfer X to Stack Pointer
    TXS: function(addrData) {
        this.stkp = this.x;
        return 0;
    },
    
    // TYA - Transfer Y to Accumulator
    TYA: function(addrData) {
        this.a = this.y;
        this.setFlag(FLAGS.Z, this.a === 0);
        this.setFlag(FLAGS.N, (this.a & 0x80) !== 0);
        return 0;
    }
};