var NESEmulator = (function (exports) {
    'use strict';

    class Controller {
        constructor() {
            this.buttons = {
                A: false,
                B: false,
                SELECT: false,
                START: false,
                UP: false,
                DOWN: false,
                LEFT: false,
                RIGHT: false,
            };
            this.strobe = 0;
            this.index = 0;
        }

        read() {
            if (this.index > 7) {
                return 1;
            }

            const value = this.getButtonState(this.index);
            if (this.strobe === 0) {
                this.index++;
            }
            return value;
        }

        write(data) {
            this.strobe = data & 1;
            if (this.strobe === 1) {
                this.index = 0;
            }
        }

        getButtonState(index) {
            switch (index) {
                case 0: return this.buttons.A ? 1 : 0;
                case 1: return this.buttons.B ? 1 : 0;
                case 2: return this.buttons.SELECT ? 1 : 0;
                case 3: return this.buttons.START ? 1 : 0;
                case 4: return this.buttons.UP ? 1 : 0;
                case 5: return this.buttons.DOWN ? 1 : 0;
                case 6: return this.buttons.LEFT ? 1 : 0;
                case 7: return this.buttons.RIGHT ? 1 : 0;
                default: return 0;
            }
        }

        setButtonState(button, value) {
            this.buttons[button] = value;
        }
    }

    /**
     * NES System Bus - connects all components and handles memory mapping
     * Routes read/write operations to appropriate hardware components
     */
    class Bus {
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

    // Define FLAGS locally to avoid circular dependency
    const FLAGS$1 = {
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
    const opcodes = {
        
        // ADC - Add with Carry
        ADC: function(addrData) {
            const fetched = this.fetchOperand(addrData.addr);
            const temp = this.a + fetched + this.getFlag(FLAGS$1.C);
            this.setFlag(FLAGS$1.C, temp > 0xFF);
            this.setFlag(FLAGS$1.Z, (temp & 0xFF) === 0);
            this.setFlag(FLAGS$1.V, ((~(this.a ^ fetched) & (this.a ^ temp)) & 0x80) !== 0);
            this.setFlag(FLAGS$1.N, (temp & 0x80) !== 0);
            this.a = temp & 0xFF;
            return 0;
        },
        
        // AND - Logical AND
        AND: function(addrData) {
            this.a &= this.fetchOperand(addrData.addr);
            this.setFlag(FLAGS$1.Z, this.a === 0);
            this.setFlag(FLAGS$1.N, (this.a & 0x80) !== 0);
            return 0;
        },
        
        // ASL - Arithmetic Shift Left
        ASL: function(addrData) {
            let data;
            if (addrData.addr === 0 && this.isAccumulatorMode()) {
                // Accumulator mode
                this.setFlag(FLAGS$1.C, (this.a & 0x80) !== 0);
                this.a = (this.a << 1) & 0xFF;
                data = this.a;
            } else {
                // Memory mode
                data = this.fetchOperand(addrData.addr);
                this.setFlag(FLAGS$1.C, (data & 0x80) !== 0);
                data = (data << 1) & 0xFF;
                this.bus.write(addrData.addr, data);
            }
            this.setFlag(FLAGS$1.Z, data === 0);
            this.setFlag(FLAGS$1.N, (data & 0x80) !== 0);
            return 0;
        },
        
        // BCC - Branch if Carry Clear
        BCC: function(addrData) {
            if (this.getFlag(FLAGS$1.C) === 0) {
                this.cycles++;
                if (addrData.pageCrossed) this.cycles++;
                this.pc = addrData.addr;
            }
            return 0;
        },
        
        // BCS - Branch if Carry Set
        BCS: function(addrData) {
            if (this.getFlag(FLAGS$1.C) === 1) {
                this.cycles++;
                if (addrData.pageCrossed) this.cycles++;
                this.pc = addrData.addr;
            }
            return 0;
        },
        
        // BEQ - Branch if Equal
        BEQ: function(addrData) {
            if (this.getFlag(FLAGS$1.Z) === 1) {
                this.cycles++;
                if (addrData.pageCrossed) this.cycles++;
                this.pc = addrData.addr;
            }
            return 0;
        },
        
        // BIT - Bit Test
        BIT: function(addrData) {
            const data = this.fetchOperand(addrData.addr);
            this.setFlag(FLAGS$1.Z, (data & this.a) === 0);
            this.setFlag(FLAGS$1.V, (data & 0x40) !== 0);
            this.setFlag(FLAGS$1.N, (data & 0x80) !== 0);
            return 0;
        },
        
        // BMI - Branch if Minus
        BMI: function(addrData) {
            if (this.getFlag(FLAGS$1.N) === 1) {
                this.cycles++;
                if (addrData.pageCrossed) this.cycles++;
                this.pc = addrData.addr;
            }
            return 0;
        },
        
        // BNE - Branch if Not Equal
        BNE: function(addrData) {
            if (this.getFlag(FLAGS$1.Z) === 0) {
                this.cycles++;
                if (addrData.pageCrossed) this.cycles++;
                this.pc = addrData.addr;
            }
            return 0;
        },
        
        // BPL - Branch if Positive
        BPL: function(addrData) {
            if (this.getFlag(FLAGS$1.N) === 0) {
                this.cycles++;
                if (addrData.pageCrossed) this.cycles++;
                this.pc = addrData.addr;
            }
            return 0;
        },
        
        // BRK - Break
        BRK: function(addrData) {
            this.pc++;
            this.setFlag(FLAGS$1.I, true);
            this.push((this.pc >> 8) & 0xFF);
            this.push(this.pc & 0xFF);
            this.setFlag(FLAGS$1.B, true);
            this.push(this.status);
            this.setFlag(FLAGS$1.B, false);
            this.pc = this.bus.read(0xFFFE) | (this.bus.read(0xFFFF) << 8);
            return 0;
        },
        
        // BVC - Branch if Overflow Clear
        BVC: function(addrData) {
            if (this.getFlag(FLAGS$1.V) === 0) {
                this.cycles++;
                if (addrData.pageCrossed) this.cycles++;
                this.pc = addrData.addr;
            }
            return 0;
        },
        
        // BVS - Branch if Overflow Set
        BVS: function(addrData) {
            if (this.getFlag(FLAGS$1.V) === 1) {
                this.cycles++;
                if (addrData.pageCrossed) this.cycles++;
                this.pc = addrData.addr;
            }
            return 0;
        },
        
        // CLC - Clear Carry
        CLC: function(addrData) {
            this.setFlag(FLAGS$1.C, false);
            return 0;
        },
        
        // CLD - Clear Decimal
        CLD: function(addrData) {
            this.setFlag(FLAGS$1.D, false);
            return 0;
        },
        
        // CLI - Clear Interrupt Disable
        CLI: function(addrData) {
            this.setFlag(FLAGS$1.I, false);
            return 0;
        },
        
        // CLV - Clear Overflow
        CLV: function(addrData) {
            this.setFlag(FLAGS$1.V, false);
            return 0;
        },
        
        // CMP - Compare
        CMP: function(addrData) {
            const data = this.fetchOperand(addrData.addr);
            const temp = this.a - data;
            this.setFlag(FLAGS$1.C, temp >= 0);
            this.setFlag(FLAGS$1.Z, (temp & 0xFF) === 0);
            this.setFlag(FLAGS$1.N, (temp & 0x80) !== 0);
            return 0;
        },
        
        // CPX - Compare X Register
        CPX: function(addrData) {
            const data = this.fetchOperand(addrData.addr);
            const temp = this.x - data;
            this.setFlag(FLAGS$1.C, temp >= 0);
            this.setFlag(FLAGS$1.Z, (temp & 0xFF) === 0);
            this.setFlag(FLAGS$1.N, (temp & 0x80) !== 0);
            return 0;
        },
        
        // CPY - Compare Y Register
        CPY: function(addrData) {
            const data = this.fetchOperand(addrData.addr);
            const temp = this.y - data;
            this.setFlag(FLAGS$1.C, temp >= 0);
            this.setFlag(FLAGS$1.Z, (temp & 0xFF) === 0);
            this.setFlag(FLAGS$1.N, (temp & 0x80) !== 0);
            return 0;
        },
        
        // DEC - Decrement Memory
        DEC: function(addrData) {
            let data = this.fetchOperand(addrData.addr);
            data = (data - 1) & 0xFF;
            this.bus.write(addrData.addr, data);
            this.setFlag(FLAGS$1.Z, data === 0);
            this.setFlag(FLAGS$1.N, (data & 0x80) !== 0);
            return 0;
        },
        
        // DEX - Decrement X Register
        DEX: function(addrData) {
            this.x = (this.x - 1) & 0xFF;
            this.setFlag(FLAGS$1.Z, this.x === 0);
            this.setFlag(FLAGS$1.N, (this.x & 0x80) !== 0);
            return 0;
        },
        
        // DEY - Decrement Y Register
        DEY: function(addrData) {
            this.y = (this.y - 1) & 0xFF;
            this.setFlag(FLAGS$1.Z, this.y === 0);
            this.setFlag(FLAGS$1.N, (this.y & 0x80) !== 0);
            return 0;
        },
        
        // EOR - Exclusive OR
        EOR: function(addrData) {
            this.a ^= this.fetchOperand(addrData.addr);
            this.setFlag(FLAGS$1.Z, this.a === 0);
            this.setFlag(FLAGS$1.N, (this.a & 0x80) !== 0);
            return 0;
        },
        
        // INC - Increment Memory
        INC: function(addrData) {
            let data = this.fetchOperand(addrData.addr);
            data = (data + 1) & 0xFF;
            this.bus.write(addrData.addr, data);
            this.setFlag(FLAGS$1.Z, data === 0);
            this.setFlag(FLAGS$1.N, (data & 0x80) !== 0);
            return 0;
        },
        
        // INX - Increment X Register
        INX: function(addrData) {
            this.x = (this.x + 1) & 0xFF;
            this.setFlag(FLAGS$1.Z, this.x === 0);
            this.setFlag(FLAGS$1.N, (this.x & 0x80) !== 0);
            return 0;
        },
        
        // INY - Increment Y Register
        INY: function(addrData) {
            this.y = (this.y + 1) & 0xFF;
            this.setFlag(FLAGS$1.Z, this.y === 0);
            this.setFlag(FLAGS$1.N, (this.y & 0x80) !== 0);
            return 0;
        },
        
        // JMP - Jump
        JMP: function(addrData) {
            this.pc = addrData.addr;
            return 0;
        },
        
        // JSR - Jump to Subroutine
        JSR: function(addrData) {
            // Push return address (PC-1, since PC is already at target+3 after addressing mode)
            const returnAddr = this.pc - 1;
            this.push(returnAddr >> 8 & 0xFF);
            this.push(returnAddr & 0xFF);
            this.pc = addrData.addr;
            return 0;
        },
        
        // LDA - Load Accumulator
        LDA: function(addrData) {
            this.a = this.fetchOperand(addrData.addr);
            this.setFlag(FLAGS$1.Z, this.a === 0);
            this.setFlag(FLAGS$1.N, (this.a & 0x80) !== 0);
            return 0;
        },
        
        // LDX - Load X Register
        LDX: function(addrData) {
            this.x = this.fetchOperand(addrData.addr);
            this.setFlag(FLAGS$1.Z, this.x === 0);
            this.setFlag(FLAGS$1.N, (this.x & 0x80) !== 0);
            return 0;
        },
        
        // LDY - Load Y Register
        LDY: function(addrData) {
            this.y = this.fetchOperand(addrData.addr);
            this.setFlag(FLAGS$1.Z, this.y === 0);
            this.setFlag(FLAGS$1.N, (this.y & 0x80) !== 0);
            return 0;
        },
        
        // LSR - Logical Shift Right
        LSR: function(addrData) {
            let data;
            if (addrData.addr === 0 && this.isAccumulatorMode()) {
                // Accumulator mode
                this.setFlag(FLAGS$1.C, (this.a & 0x01) !== 0);
                this.a = this.a >> 1;
                data = this.a;
            } else {
                // Memory mode
                data = this.fetchOperand(addrData.addr);
                this.setFlag(FLAGS$1.C, (data & 0x01) !== 0);
                data = data >> 1;
                this.bus.write(addrData.addr, data);
            }
            this.setFlag(FLAGS$1.Z, data === 0);
            this.setFlag(FLAGS$1.N, false);
            return 0;
        },
        
        // NOP - No Operation
        NOP: function(addrData) {
            return 0;
        },
        
        // ORA - Logical Inclusive OR
        ORA: function(addrData) {
            this.a |= this.fetchOperand(addrData.addr);
            this.setFlag(FLAGS$1.Z, this.a === 0);
            this.setFlag(FLAGS$1.N, (this.a & 0x80) !== 0);
            return 0;
        },
        
        // PHA - Push Accumulator
        PHA: function(addrData) {
            this.push(this.a);
            return 0;
        },
        
        // PHP - Push Processor Status
        PHP: function(addrData) {
            this.push(this.status | FLAGS$1.B);
            return 0;
        },
        
        // PLA - Pull Accumulator
        PLA: function(addrData) {
            this.a = this.pull();
            this.setFlag(FLAGS$1.Z, this.a === 0);
            this.setFlag(FLAGS$1.N, (this.a & 0x80) !== 0);
            return 0;
        },
        
        // PLP - Pull Processor Status
        PLP: function(addrData) {
            this.status = this.pull() & ~FLAGS$1.B;
            this.setFlag(FLAGS$1.U, true);
            return 0;
        },
        
        // ROL - Rotate Left
        ROL: function(addrData) {
            let data;
            const carry = this.getFlag(FLAGS$1.C);
            
            if (addrData.addr === 0 && this.isAccumulatorMode()) {
                // Accumulator mode
                this.setFlag(FLAGS$1.C, (this.a & 0x80) !== 0);
                this.a = ((this.a << 1) | carry) & 0xFF;
                data = this.a;
            } else {
                // Memory mode
                data = this.fetchOperand(addrData.addr);
                this.setFlag(FLAGS$1.C, (data & 0x80) !== 0);
                data = ((data << 1) | carry) & 0xFF;
                this.bus.write(addrData.addr, data);
            }
            this.setFlag(FLAGS$1.Z, data === 0);
            this.setFlag(FLAGS$1.N, (data & 0x80) !== 0);
            return 0;
        },
        
        // ROR - Rotate Right
        ROR: function(addrData) {
            let data;
            const carry = this.getFlag(FLAGS$1.C) << 7;
            
            if (addrData.addr === 0 && this.isAccumulatorMode()) {
                // Accumulator mode
                this.setFlag(FLAGS$1.C, (this.a & 0x01) !== 0);
                this.a = (this.a >> 1) | carry;
                data = this.a;
            } else {
                // Memory mode
                data = this.fetchOperand(addrData.addr);
                this.setFlag(FLAGS$1.C, (data & 0x01) !== 0);
                data = (data >> 1) | carry;
                this.bus.write(addrData.addr, data);
            }
            this.setFlag(FLAGS$1.Z, data === 0);
            this.setFlag(FLAGS$1.N, (data & 0x80) !== 0);
            return 0;
        },
        
        // RTI - Return from Interrupt
        RTI: function(addrData) {
            this.status = this.pull();
            this.setFlag(FLAGS$1.U, true);
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
            const temp = this.a + fetched + this.getFlag(FLAGS$1.C);
            this.setFlag(FLAGS$1.C, temp > 0xFF);
            this.setFlag(FLAGS$1.Z, (temp & 0xFF) === 0);
            this.setFlag(FLAGS$1.V, ((~(this.a ^ fetched) & (this.a ^ temp)) & 0x80) !== 0);
            this.setFlag(FLAGS$1.N, (temp & 0x80) !== 0);
            this.a = temp & 0xFF;
            return 0;
        },
        
        // SEC - Set Carry
        SEC: function(addrData) {
            this.setFlag(FLAGS$1.C, true);
            return 0;
        },
        
        // SED - Set Decimal
        SED: function(addrData) {
            this.setFlag(FLAGS$1.D, true);
            return 0;
        },
        
        // SEI - Set Interrupt Disable
        SEI: function(addrData) {
            this.setFlag(FLAGS$1.I, true);
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
            this.setFlag(FLAGS$1.Z, this.x === 0);
            this.setFlag(FLAGS$1.N, (this.x & 0x80) !== 0);
            return 0;
        },
        
        // TAY - Transfer Accumulator to Y
        TAY: function(addrData) {
            this.y = this.a;
            this.setFlag(FLAGS$1.Z, this.y === 0);
            this.setFlag(FLAGS$1.N, (this.y & 0x80) !== 0);
            return 0;
        },
        
        // TSX - Transfer Stack Pointer to X
        TSX: function(addrData) {
            this.x = this.stkp;
            this.setFlag(FLAGS$1.Z, this.x === 0);
            this.setFlag(FLAGS$1.N, (this.x & 0x80) !== 0);
            return 0;
        },
        
        // TXA - Transfer X to Accumulator
        TXA: function(addrData) {
            this.a = this.x;
            this.setFlag(FLAGS$1.Z, this.a === 0);
            this.setFlag(FLAGS$1.N, (this.a & 0x80) !== 0);
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
            this.setFlag(FLAGS$1.Z, this.a === 0);
            this.setFlag(FLAGS$1.N, (this.a & 0x80) !== 0);
            return 0;
        }
    };

    /**
     * NES CPU processor flags bit definitions
     * @readonly
     * @enum {number}
     */
    const FLAGS = {
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
    class CPU {
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
        
        // Instruction tracing
        enableTrace() {
            this.traceEnabled = true;
            this.trace = [];
        }
        
        disableTrace() {
            this.traceEnabled = false;
        }
        
        getTrace() {
            return this.trace.slice(); // Return copy of trace
        }
        
        clearTrace() {
            this.trace = [];
        }
        
        addTraceEntry(opcode, addrData, cycles) {
            if (!this.traceEnabled) return;
            
            const entry = {
                pc: this.pc - (this.lookup[opcode].name === 'JSR' ? 2 : 1), // Adjust PC for JSR
                opcode: opcode,
                name: this.lookup[opcode].name,
                addr: addrData.addr,
                addrMode: this.lookup[opcode].addrMode.name,
                a: this.a.toString(16).padStart(2, '0').toUpperCase(),
                x: this.x.toString(16).padStart(2, '0').toUpperCase(),
                y: this.y.toString(16).padStart(2, '0').toUpperCase(),
                sp: this.stkp.toString(16).padStart(2, '0').toUpperCase(),
                status: this.status.toString(16).padStart(2, '0').toUpperCase(),
                cycles: cycles,
                ppu: this.bus.ppu ? {
                    scanline: this.bus.ppu.scanline,
                    cycle: this.bus.ppu.cycle
                } : null
            };
            
            this.trace.push(entry);
            
            // Limit trace size to prevent memory issues
            if (this.trace.length > 10000) {
                this.trace = this.trace.slice(-5000);
            }
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

    class PPU {
        constructor(bus) {
            this.bus = bus;
            this.addrLatch = 0;
            this.fineX = 0;
            
            this.vram = new Uint8Array(2048);
            this.oam = new Uint8Array(256);
            this.secondaryOAM = new Uint8Array(32); // Secondary OAM for sprite evaluation
            this.palette = new Uint8Array(32);
            
            this.control = 0x00;
            this.mask = 0x00;
            this.status = 0x00;
            this.oamAddr = 0x00;
            this.scrollX = 0x00; // Not directly used, kept for debug view
            this.scrollY = 0x00; // Not directly used, kept for debug view
            this.addr = 0x0000; // current VRAM address (v)
            this.tempAddr = 0x0000; // temporary VRAM address (t)
            this.dataBuffer = 0x00;
            
            // PPU open bus latch (PPUGenLatch)
            this.openBus = 0x00;
            
            // PPU type detection (for different behaviors)
            this.ppuType = '2C02'; // Default to NTSC 2C02
            this.ppuRevision = 'G'; // Default to 2C02G (has OAMADDR bug)
            
            this.cycle = 0;
            this.scanline = -1; // -1 (pre-render), 0-239 (visible), 240 (post-render), 241-260 (vblank)
            this.frame = 0;
            this.oddFrame = false; // For frame timing variations
            
            this.bgNextTileId = 0;
            this.bgNextTileAttr = 0;
            this.bgNextTileLsb = 0;
            this.bgNextTileMsb = 0;
            
            this.bgShifterPatternLo = 0;
            this.bgShifterPatternHi = 0;
            this.bgShifterAttribLo = 0;
            this.bgShifterAttribHi = 0;
            
            this.screen = new Uint8Array(256 * 240 * 4);
            this.screenBackbuffer = new Uint8Array(256 * 240 * 4); // Double buffer
            this.frameReady = false; // Flag to indicate when frame is ready to render
            
            // Cache for palette colors to avoid repeated calculations
            this.colorCache = new Array(512); // 8 palettes * 64 colors
            
            this.nmi = false;
            this.spriteZeroHit = false;
            this.spriteOverflow = false;
            this.spriteZeroPossible = false; // Internal flag for sprite 0 hit detection
            this.spriteZeroHitNextLine = false; // Internal flag for next line sprite 0
            
            this.spriteScanline = [];
            this.spritePatterns = new Uint8Array(8 * 10); // 8 sprites, extended pattern data
            this.spritePositions = new Uint8Array(8);
            this.spritePriorities = new Uint8Array(8);
            this.spritePalettes = new Uint8Array(8);
            
            // Sprite evaluation state
            this.spriteEvaluationCycle = 0;
            this.spriteEvaluationIndex = 0;
            this.foundSprites = 0;
            this.spriteOverflowIndex = -1;

            this.cartridge = null;
            
            // Power-up state timing
            this.powerUpCycles = 0;
            this.canWriteRegisters = false;
        }
        
        connectCartridge(cartridge) {
            this.cartridge = cartridge;
        }
        
        reset() {
            this.addrLatch = 0;
            this.fineX = 0;
            this.control = 0x00;
            this.mask = 0x00;
            this.status = 0x00;
            this.oamAddr = 0x00;
            this.scrollX = 0x00;
            this.scrollY = 0x00;
            this.addr = 0x0000;
            this.tempAddr = 0x0000;
            this.dataBuffer = 0x00;
            this.openBus = 0x00;
            
            this.cycle = 0;
            this.scanline = -1;
            this.frame = 0;
            this.oddFrame = false;
            
            this.bgNextTileId = 0;
            this.bgNextTileAttr = 0;
            this.bgNextTileLsb = 0;
            this.bgNextTileMsb = 0;
            
            this.bgShifterPatternLo = 0;
            this.bgShifterPatternHi = 0;
            this.bgShifterAttribLo = 0;
            this.bgShifterAttribHi = 0;
            
            this.screen.fill(0);
            this.nmi = false;
            this.spriteZeroHit = false;
            this.spriteOverflow = false;
            this.spriteZeroPossible = false;
            this.spriteZeroHitNextLine = false;
            this.oam.fill(0);
            this.secondaryOAM.fill(0);
            this.vram.fill(0);
            this.palette.fill(0);
            this.screen.fill(0);
            this.screenBackbuffer.fill(0);
            this.frameReady = false;
            this.colorCache.length = 0; // Clear color cache
            
            // Sprite evaluation state
            this.spriteEvaluationCycle = 0;
            this.spriteEvaluationIndex = 0;
            this.foundSprites = 0;
            this.spriteOverflowIndex = -1;
            
            // Power-up state
            this.powerUpCycles = 0;
            this.canWriteRegisters = false;
            
            // Default palette values (for visual debugging until real palette is loaded)
            for (let i = 0; i < 32; i++) {
                if (i % 4 === 0) {
                    this.palette[i] = 0x0F;
                } else {
                    this.palette[i] = (i - 1) % 4 + 1;
                }
            }
        }
        
        // PPU Internal Helper Functions
        // These functions implement "Loopy" PPU scroll/address update logic

        incrementScrollX() {
            if (!((this.mask >> 3) & 1 || (this.mask >> 4) & 1)) return; // No rendering

            if ((this.addr & 0x001F) === 31) { // if coarse X is 31
                this.addr &= ~0x001F;          // coarse X = 0
                this.addr ^= 0x0400;           // switch horizontal nametable
            } else {
                this.addr++;                   // increment coarse X
            }
        }
        
        incrementScrollY() {
            if (!((this.mask >> 3) & 1 || (this.mask >> 4) & 1)) return; // No rendering

            if (((this.addr >> 12) & 7) < 7) { // if fine Y < 7
                this.addr += 0x1000;           // increment fine Y
            } else {
                this.addr &= ~0x7000;          // fine Y = 0
                let y = (this.addr & 0x03E0) >> 5; // let y = coarse Y
                if (y === 29) {                 // if coarse Y is 29
                    y = 0;                      // coarse Y = 0
                    this.addr ^= 0x0800;        // switch vertical nametable
                } else if (y === 31) {          // if coarse Y is 31
                    y = 0;                      // coarse Y = 0, nametable not switched
                } else {
                    y++;                        // increment coarse Y
                }
                this.addr = (this.addr & ~0x03E0) | (y << 5); // put coarse Y back into v
            }
        }
        
        transferX() {
            if (!((this.mask >> 3) & 1 || (this.mask >> 4) & 1)) return; // No rendering
            this.addr = (this.addr & 0xFFE0) | (this.tempAddr & 0x001F); // Transfer coarse X
            this.addr = (this.addr & 0xF3FF) | (this.tempAddr & 0x0400); // Transfer nametable X
        }

        transferY() {
            if (!((this.mask >> 3) & 1 || (this.mask >> 4) & 1)) return; // No rendering
            this.addr = (this.addr & 0x8C1F) | (this.tempAddr & 0x7BE0); // Transfer fine Y and coarse Y and nametable Y
        }
        
        loadBackgroundShifters() {
            this.bgShifterPatternLo = (this.bgShifterPatternLo & 0xFF00) | this.bgNextTileLsb;
            this.bgShifterPatternHi = (this.bgShifterPatternHi & 0xFF00) | this.bgNextTileMsb;
            this.bgShifterAttribLo = (this.bgShifterAttribLo & 0xFF00) | ((this.bgNextTileAttr & 1) ? 0xFF : 0x00);
            this.bgShifterAttribHi = (this.bgShifterAttribHi & 0xFF00) | ((this.bgNextTileAttr & 2) ? 0xFF : 0x00);
        }

        // Main clock function, called by Bus
        clock() {
            // Update power-up state
            if (!this.canWriteRegisters) {
                this.powerUpCycles++;
                // Allow register writes after ~29658 NTSC cycles (pre-render scanline)
                if (this.powerUpCycles >= 29658) {
                    this.canWriteRegisters = true;
                }
            }
            
            const renderingEnabled = (this.mask & 0x18) > 0;
            const isVisibleScanline = this.scanline >= 0 && this.scanline < 240;
            const isPreRenderScanline = this.scanline === -1;
            this.scanline >= 241 && this.scanline <= 260;
            
            // Background rendering logic
            if (renderingEnabled) {
                if (isVisibleScanline || isPreRenderScanline) {
                    // Background Tile fetches (cycles 1-256 and 321-336)
                    if ((this.cycle >= 1 && this.cycle <= 256) || (this.cycle >= 321 && this.cycle <= 336)) {
                        // Shift background registers every cycle
                        this.bgShifterPatternLo <<= 1;
                        this.bgShifterPatternHi <<= 1;
                        this.bgShifterAttribLo <<= 1;
                        this.bgShifterAttribHi <<= 1;

                        // Every 8 cycles, fetch new background tile information
                        switch ((this.cycle - 1) % 8) {
                            case 0: // Load background shifters and fetch nametable byte
                                this.loadBackgroundShifters();
                                this.fetchNametableByte();
                                break;
                            case 2: // Fetch attribute table byte
                                this.fetchAttributeTableByte();
                                break;
                            case 4: // Fetch low background tile byte
                                this.fetchTileBitmapLow();
                                break;
                            case 6: // Fetch high background tile byte
                                this.fetchTileBitmapHigh();
                                break;
                            case 7: // Increment horizontal scroll (coarse X)
                                this.incrementScrollX();
                                break;
                        }
                    }
                    
                    // 34th background fetch (cycle 337) - never used for rendering but some mappers rely on it
                    if (this.cycle === 337) {
                        this.fetchNametableByte(); // Fetch nametable byte that won't be used
                    }
                    
                    // At cycle 256, increment vertical scroll (coarse Y)
                    if (this.cycle === 256) {
                        this.incrementScrollY();
                    }

                    // At cycle 257, transfer horizontal scroll bits from tempAddr to addr
                    if (this.cycle === 257) {
                        this.transferX();
                    }

                    // In pre-render scanline, cycles 280-304, transfer vertical scroll bits from tempAddr to addr
                    if (isPreRenderScanline && this.cycle >= 280 && this.cycle <= 304) {
                        this.transferY();
                    }
                    
                    // Sprite evaluation (cycles 257-320)
                    if (this.cycle >= 257 && this.cycle <= 320) {
                        this.evaluateSpritesStep();
                    }
                    
                    // Sprite pattern fetching (cycles 257-320 for sprites, 1-64 for next line)
                    if (this.mask & 0x10) { // Only if sprites enabled
                        if (this.cycle >= 257 && this.cycle <= 320) {
                            this.fetchSpritePatternsStep();
                        } else if (this.cycle >= 1 && this.cycle <= 64) {
                            this.fetchSpritePatternsStep();
                        }
                    }
                }
            }

            // Pixel rendering
            if (isVisibleScanline && this.cycle >= 1 && this.cycle <= 256) {
                this.pixelRendering();
            }
            
            // NMI and PPUSTATUS flags
            if (this.scanline === 241 && this.cycle === 1) { // Start of VBlank
                this.status |= 0x80; // Set VBlank flag
                if (this.control & 0x80) { // NMI enabled
                    this.nmi = true;
                }
            }

            if (isPreRenderScanline && this.cycle === 1) { // Start of pre-render scanline
                this.status &= ~0x80; // Clear VBlank flag
                this.status &= ~0x40; // Clear Sprite 0 Hit flag
                this.status &= ~0x20; // Clear Sprite Overflow flag
                this.nmi = false;
                this.spriteZeroPossible = false; // Reset sprite 0 hit flag
                this.spriteZeroHitNextLine = false;
                // Clear backbuffer, not front buffer to prevent flashing
                this.screenBackbuffer.fill(0); 
                this.frameReady = false;
                
                // Skip dot on odd frames (if rendering enabled and background/sprites enabled)
                if (renderingEnabled && this.oddFrame) {
                    this.cycle = 1;
                }
            }
            
            // OAMADDR reset during sprite tile loading (cycles 257-320)
            if (renderingEnabled && (this.cycle >= 257 && this.cycle <= 320)) {
                this.oamAddr = 0;
            }

            // Increment cycle, scanline, frame
            this.cycle++;
            if (this.cycle >= 341) {
                this.cycle = 0;
                this.scanline++;
                if (this.scanline >= 261) {
                    this.scanline = -1; // Wrap around to pre-render scanline
                    this.frame++;
                    this.oddFrame = !this.oddFrame; // Toggle odd frame
                    this.frameReady = true; // Mark frame as ready for rendering
                }
            }
        }
        
        pixelRendering() {
            const x = this.cycle - 1;
            const y = this.scanline;
            
            // Skip rendering for x = 0 (first cycle is for fetches)
            if (x === 0) return;
            
            // Early exit if both background and sprites are disabled
            if (!(this.mask & 0x18)) return;
            
            // Check left-side clipping
            const leftClippingEnabled = !(this.mask & 0x02) || !(this.mask & 0x04);
            if (x < 8 && leftClippingEnabled) {
                // Background and sprites are clipped in leftmost 8 pixels
                // Render backdrop color
                const colorIndex = this.getColorFromPalette(0, 0);
                const pixelIndex = (y * 256 + x) * 4;
                const color = this.getNESColor(colorIndex);
                this.screenBackbuffer[pixelIndex] = color.r;
                this.screenBackbuffer[pixelIndex + 1] = color.g;
                this.screenBackbuffer[pixelIndex + 2] = color.b;
                this.screenBackbuffer[pixelIndex + 3] = 255;
                return;
            }
            
            let bgPixel = 0;
            let bgPalette = 0;
            let bgOpaque = false;

            // Background rendering
            if (this.mask & 0x08) { // Background rendering enabled
                const fineXShift = 15 - this.fineX; // Selects fineX bit from 16-bit shifter

                const p0 = (this.bgShifterPatternLo >> fineXShift) & 1;
                const p1 = (this.bgShifterPatternHi >> fineXShift) & 1;
                bgPixel = (p1 << 1) | p0;

                const a0 = (this.bgShifterAttribLo >> fineXShift) & 1;
                const a1 = (this.bgShifterAttribHi >> fineXShift) & 1;
                bgPalette = (a1 << 1) | a0;
                
                bgOpaque = bgPixel !== 0;
            }

            // Sprite rendering
            let spritePixel = 0;
            let spritePalette = 0;
            let spritePriority = 0;
            let spriteOpaque = false;
            let spriteFound = false;
            let spriteZeroHit = false;

            if (this.mask & 0x10) { // Sprite rendering enabled
                // Find first non-transparent sprite pixel at this x position
                for (let i = 0; i < this.spriteScanline.length; i++) {
                    const spriteData = this.getSpritePixel(i, x);
                    
                    if (spriteData.pixel !== 0) { // Non-transparent sprite pixel
                        spritePixel = spriteData.pixel;
                        spritePalette = spriteData.palette;
                        spritePriority = spriteData.priority;
                        spriteOpaque = true;
                        spriteFound = true;
                        
                        // Check for sprite 0 hit with proper edge cases
                        if (this.spriteZeroPossible && spriteData.oamIndex === 0 && bgOpaque && x > 0 && x < 255) {
                            // Don't trigger if background or sprites are disabled in this area
                            if (!((this.mask & 0x08) === 0 || (this.mask & 0x10) === 0)) {
                                spriteZeroHit = true;
                            }
                        }
                        break; // Only check first sprite (priority handled below)
                    }
                }
            }

            // Sprite 0 hit detection
            if (spriteZeroHit && !(this.status & 0x40)) { // Only set once per frame
                this.status |= 0x40; // Set sprite 0 hit flag
            }

            // Final pixel composition
            let finalPixel = 0;
            let finalPalette = 0;

            if (!spriteFound) {
                // No sprite pixel at this position
                finalPixel = bgPixel;
                finalPalette = bgPalette;
            } else if (!bgOpaque) {
                // Background is transparent, show sprite
                finalPixel = spritePixel;
                finalPalette = spritePalette;
            } else if (spriteOpaque && spritePriority === 0) {
                // Sprite has priority over background
                finalPixel = spritePixel;
                finalPalette = spritePalette;
            } else {
                // Background has priority or sprite is transparent
                finalPixel = bgPixel;
                finalPalette = bgPalette;
            }

            const colorIndex = this.getColorFromPalette(finalPalette, finalPixel);
            const pixelIndex = (y * 256 + x) * 4;
            const color = this.getNESColor(colorIndex);
            
            // Write to backbuffer instead of front buffer
            this.screenBackbuffer[pixelIndex] = color.r;
            this.screenBackbuffer[pixelIndex + 1] = color.g;
            this.screenBackbuffer[pixelIndex + 2] = color.b;
            this.screenBackbuffer[pixelIndex + 3] = 255;
        }
        
        fetchNametableByte() {
            // v = AAAA AAAA AAAA AAAA
            //     |||| |||| |||| ||||
            //     NTY NTY NTY NTY Y Y
            // Address = 0x2000 | (v & 0x0FFF)
            this.bgNextTileId = this.ppuRead(0x2000 | (this.addr & 0x0FFF));
        }
        
        fetchAttributeTableByte() {
            // v = AAAA AAAA AAAA AAAA
            //     |||| |||| |||| ||||
            //     NTY NTY NTY NTY Y Y
            // Address = 0x23C0 | (v_nametable_y << 3) | (v_nametable_x << 1)
            const addrOffset = 0x23C0 | (this.addr & 0x0C00) | ((this.addr >> 4) & 0x38) | ((this.addr >> 2) & 0x07);
            this.bgNextTileAttr = this.ppuRead(addrOffset);
            
            // Select relevant 2-bit attribute palette based on coarse X/Y
            if ((this.addr >> 5) & 1) this.bgNextTileAttr >>= 4; // Use bits 4-7 for lower half of 16x16 block
            if ((this.addr >> 1) & 1) this.bgNextTileAttr >>= 2; // Use bits 2-3 or 6-7 for right half of 16x16 block
            this.bgNextTileAttr &= 0x03; // Mask to get 2 bits
        }
        
        fetchTileBitmapLow() {
            const fineY = (this.addr >> 12) & 7; // Fine Y from v
            const patternTable = (this.control & 0x10) << 8; // Pattern table selection from PPUCTRL bit 4
            this.bgNextTileLsb = this.ppuRead(patternTable + (this.bgNextTileId << 4) + fineY);
        }
        
        fetchTileBitmapHigh() {
            const fineY = (this.addr >> 12) & 7; // Fine Y from v
            const patternTable = (this.control & 0x10) << 8; // Pattern table selection from PPUCTRL bit 4
            this.bgNextTileMsb = this.ppuRead(patternTable + (this.bgNextTileId << 4) + fineY + 8);
        }
        
        // Step-by-step sprite evaluation (cycles 257-320)
        evaluateSpritesStep() {
            const cycleOffset = this.cycle - 257;
            const spriteHeight = (this.control & 0x20) ? 16 : 8;
            
            if (cycleOffset === 0) {
                // Initialize sprite evaluation
                this.secondaryOAM.fill(0xFF); // Clear secondary OAM
                this.spriteEvaluationIndex = 0;
                this.foundSprites = 0;
                this.spriteOverflowIndex = -1;
                this.spriteScanline = [];
                this.spriteZeroPossible = false;
            } else if (cycleOffset < 64) {
                // Primary OAM search (cycles 1-64)
                if (this.spriteEvaluationIndex < 64) {
                    const oamEntryY = this.oam[this.spriteEvaluationIndex * 4];
                    
                    // Check if sprite is on next scanline
                    if (this.scanline + 1 >= oamEntryY && this.scanline + 1 < oamEntryY + spriteHeight) {
                        if (this.foundSprites < 8) {
                            // Copy to secondary OAM
                            const secondaryIndex = this.foundSprites * 4;
                            this.secondaryOAM[secondaryIndex] = oamEntryY;
                            this.secondaryOAM[secondaryIndex + 1] = this.oam[this.spriteEvaluationIndex * 4 + 1];
                            this.secondaryOAM[secondaryIndex + 2] = this.oam[this.spriteEvaluationIndex * 4 + 2];
                            this.secondaryOAM[secondaryIndex + 3] = this.oam[this.spriteEvaluationIndex * 4 + 3];
                            
                            // Add to sprite scanline for rendering
                            const sprite = {
                                y: oamEntryY,
                                id: this.oam[this.spriteEvaluationIndex * 4 + 1],
                                attr: this.oam[this.spriteEvaluationIndex * 4 + 2],
                                x: this.oam[this.spriteEvaluationIndex * 4 + 3],
                                palette: (this.oam[this.spriteEvaluationIndex * 4 + 2] & 0x03) + 4,
                                priority: (this.oam[this.spriteEvaluationIndex * 4 + 2] & 0x20) ? 1 : 0,
                                hFlip: (this.oam[this.spriteEvaluationIndex * 4 + 2] & 0x40) ? 1 : 0,
                                vFlip: (this.oam[this.spriteEvaluationIndex * 4 + 2] & 0x80) ? 1 : 0,
                                oamIndex: this.spriteEvaluationIndex
                            };
                            
                            this.spriteScanline.push(sprite);
                            
                            if (this.spriteEvaluationIndex === 0) {
                                this.spriteZeroPossible = true;
                                this.spriteZeroHitNextLine = true;
                            }
                            
                            this.foundSprites++;
                        } else if (this.spriteOverflowIndex === -1) {
                            // Found 9th sprite - set overflow flag
                            this.spriteOverflowIndex = this.spriteEvaluationIndex;
                            this.status |= 0x20; // Set sprite overflow flag
                        }
                    }
                    
                    this.spriteEvaluationIndex++;
                }
            } else if (cycleOffset >= 64) {
                // Copy secondary OAM back to primary OAM (cycles 65-320)
                // This is where OAMADDR gets set to 9th sprite index
                if (this.spriteOverflowIndex >= 0) {
                    this.oamAddr = this.spriteOverflowIndex;
                }
            }
        }
        
        // Step-by-step sprite pattern fetching
        fetchSpritePatternsStep() {
            const cycleOffset = this.cycle - 257;
            if (cycleOffset >= 0 && cycleOffset < this.spriteScanline.length * 2) {
                const spriteIndex = Math.floor(cycleOffset / 2);
                const isHighByte = cycleOffset % 2 === 1;
                
                if (spriteIndex < this.spriteScanline.length) {
                    const sprite = this.spriteScanline[spriteIndex];
                    const spriteHeight = (this.control & 0x20) ? 16 : 8;
                    const patternTable = (this.control & 0x08) ? 0x1000 : 0x0000;
                    
                    // Calculate which tile line to fetch from sprite
                    let tileY = this.scanline - sprite.y;
                    if (sprite.vFlip) {
                        tileY = spriteHeight - 1 - tileY;
                    }
                    
                    let patternAddr;
                    if (spriteHeight === 16) {
                        const table = sprite.id & 1 ? 0x1000 : 0x0000;
                        const tileIndex = (sprite.id & 0xFE) | (tileY >= 8 ? 1 : 0);
                        patternAddr = table + (tileIndex << 4) + ((tileY & 7) << 1);
                    } else {
                        patternAddr = patternTable + (sprite.id << 4) + ((tileY & 7) << 1);
                    }
                    
                    if (!isHighByte) {
                        // Fetch low byte
                        this.spritePatterns[spriteIndex * 2] = this.ppuRead(patternAddr);
                    } else {
                        // Fetch high byte
                        this.spritePatterns[spriteIndex * 2 + 1] = this.ppuRead(patternAddr + 1);
                    }
                    
                    // Store additional sprite info
                    this.spritePositions[spriteIndex] = sprite.x;
                    this.spritePriorities[spriteIndex] = sprite.priority;
                    this.spritePalettes[spriteIndex] = sprite.palette;
                    this.spritePatterns[spriteIndex * 2 + 8] = sprite.hFlip;
                    this.spritePatterns[spriteIndex * 2 + 9] = sprite.oamIndex;
                }
            }
        }
        
        getSpritePixel(spriteIndex, x) {
            const spriteX = this.spritePositions[spriteIndex];
            if (x < spriteX || x >= spriteX + 8) {
                return { pixel: 0, palette: 0, priority: 0 }; // No pixel at this x position
            }
            
            const relativeX = x - spriteX;
            const hFlip = this.spritePatterns[spriteIndex * 2 + 8];
            const bitPosition = hFlip ? relativeX : (7 - relativeX);
            
            const patternLow = this.spritePatterns[spriteIndex * 2];
            const patternHigh = this.spritePatterns[spriteIndex * 2 + 1];
            
            const bit0 = (patternLow >> bitPosition) & 1;
            const bit1 = (patternHigh >> bitPosition) & 1;
            const pixel = (bit1 << 1) | bit0;
            
            // Pixel 0 is transparent for sprites
            if (pixel === 0) {
                return { pixel: 0, palette: 0, priority: 0 };
            }
            
            return {
                pixel: pixel,
                palette: this.spritePalettes[spriteIndex],
                priority: this.spritePriorities[spriteIndex],
                oamIndex: this.spritePatterns[spriteIndex * 2 + 9]
            };
        }
        
        getColorFromPalette(palette, index) {
            let addr = 0x3F00 + (palette << 2) + index;
            return this.ppuRead(addr);
        }
        
        getNESColor(colorIndex) {
            if (this.mask & 0x01) { // Greyscale mode
                colorIndex &= 0x30;
            }
            
            // Check cache first
            const cacheIndex = (this.mask & 0xE0) | colorIndex; // Include emphasis in cache key
            if (this.colorCache[cacheIndex]) {
                return this.colorCache[cacheIndex];
            }
            
            const palette = [
                {r: 84,  g: 84,  b: 84},   {r: 0,   g: 30,  b: 116},  {r: 8,   g: 16,  b: 144},  {r: 48,  g: 0,   b: 136},
                {r: 68,  g: 0,   b: 100},  {r: 92,  g: 0,   b: 48},   {r: 84,  g: 4,   b: 0},    {r: 60,  g: 24,  b: 0},
                {r: 32,  g: 42,  b: 0},    {r: 8,   g: 58,  b: 0},    {r: 0,   g: 64,  b: 0},    {r: 0,   g: 60,  b: 0},
                {r: 0,   g: 50,  b: 60},   {r: 0,   g: 0,   b: 0},    {r: 0,   g: 0,   b: 0},    {r: 0,   g: 0,   b: 0},
                {r: 152, g: 152, b: 152},  {r: 8,   g: 76,  b: 196},  {r: 48,  g: 50,  b: 236},  {r: 92,  g: 30,  b: 228},
                {r: 136, g: 20,  b: 176},  {r: 160,  g: 20,  b: 100},  {r: 152,  g: 34,  b: 32},   {r: 120,  g: 60,  b: 0},
                {r: 84,  g: 90,  b: 0},    {r: 40,  g: 114, b: 0},    {r: 8,   g: 124, b: 0},    {r: 0,   g: 118, b: 40},
                {r: 0,   g: 102, b: 120},  {r: 0,   g: 0,   b: 0},    {r: 0,   g: 0,   b: 0},    {r: 0,   g: 0,   b: 0},
                {r: 236, g: 236, b: 236},  {r: 76,  g: 154, b: 236},  {r: 120, g: 124, b: 236},  {r: 176,  g: 98,  b: 236},
                {r: 228, g: 84,  b: 236},  {r: 236,  g: 88,  b: 180},  {r: 236,  g: 120, b: 120},  {r: 212,  g: 136, b: 32},
                {r: 160, g: 170, b: 0},    {r: 116, g: 196, b: 0},    {r: 76,  g: 208, b: 32},   {r: 56,  g: 204, b: 108},
                {r: 56,  g: 180, b: 204},  {r: 60,  g: 60,  b: 60},    {r: 0,   g: 0,   b: 0},    {r: 0,   g: 0,   b: 0},
                {r: 236, g: 236, b: 236},  {r: 168, g: 204, b: 236},  {r: 188, g: 188, b: 236},  {r: 212, g: 178, b: 236},
                {r: 236, g: 174, b: 236},  {r: 236, g: 174, b: 212},  {r: 236, g: 180, b: 176},  {r: 228, g: 196, b: 144},
                {r: 204, g: 210, b: 120},  {r: 180, g: 222, b: 120},  {r: 168, g: 226, b: 144},  {r: 152, g: 226, b: 180},
                {r: 160, g: 214, b: 228},  {r: 160, g: 160, b: 160},  {r: 0,   g: 0,   b: 0},    {r: 0,   g: 0,   b: 0},
            ];
            
            let color = palette[Math.min(colorIndex, 63)];
            color = {r: color.r, g: color.g, b: color.b};

            // Apply color emphasis with different behavior for RGB vs composite PPUs
            const emphasis = this.mask >> 5;
            if (this.ppuType === 'RGB') {
                // RGB PPUs maximize brightness of emphasized channels
                if (emphasis & 1) { color.g = 255; }
                if (emphasis & 2) { color.r = 255; }
                if (emphasis & 4) { color.b = 255; }
            } else {
                // Composite PPUs darken non-emphasized channels
                if (emphasis & 1) { color.g *= 0.75; color.b *= 0.75; }
                if (emphasis & 2) { color.r *= 0.75; color.b *= 0.75; }
                if (emphasis & 4) { color.r *= 0.75; color.g *= 0.75; }
            }

            const result = { r: Math.floor(color.r), g: Math.floor(color.g), b: Math.floor(color.b) };
            
            // Cache the result
            this.colorCache[cacheIndex] = result;
            return result;
        }
        
        // PPU Register Interface
        readRegister(addr) {
            addr &= 0x07; // PPU registers are mirrored every 8 bytes
            let result = 0;
            
            switch (addr) {
                case 0x00: // PPUCTRL is write-only, returns open bus
                    result = this.openBus & 0x1F;
                    break;
                case 0x01: // PPUMASK is write-only, returns open bus
                    result = this.openBus & 0x1F;
                    break;
                case 0x02: // PPUSTATUS
                    result = (this.status & 0xE0) | (this.openBus & 0x1F); // Return flags and open bus
                    this.status &= ~0x80; // Clear VBlank flag on read
                    this.addrLatch = 0;   // Reset address latch for $2005/$2006 writes
                    this.openBus = result; // Update open bus
                    return result;
                case 0x03: // OAMADDR is write-only, returns open bus
                    result = this.openBus & 0x1F;
                    break;
                case 0x04: // OAMDATA
                    result = this.oam[this.oamAddr];
                    // OAMDATA reads during rendering expose internal OAM accesses
                    if ((this.mask & 0x18) && this.scanline >= 0 && this.scanline < 240) {
                        // Return whatever is being accessed internally during sprite evaluation
                        if (this.cycle >= 257 && this.cycle <= 320) {
                            const evalCycle = this.cycle - 257;
                            if (evalCycle < 64 && this.spriteEvaluationIndex < 64) {
                                result = this.oam[this.spriteEvaluationIndex * 4 + (evalCycle % 4)];
                            }
                        }
                    }
                    this.openBus = result; // Update open bus
                    return result;
                case 0x05: // PPUSCROLL is write-only, returns open bus
                    result = this.openBus & 0x1F;
                    break;
                case 0x06: // PPUADDR is write-only, returns open bus
                    result = this.openBus & 0x1F;
                    break;
                case 0x07: // PPUDATA
                    result = this.dataBuffer; // Return buffered value
                    this.dataBuffer = this.ppuRead(this.addr); // Read VRAM, buffer for next read
                    
                    // Palette reads are immediate (no buffering)
                    if (this.addr >= 0x3F00) {
                        result = this.dataBuffer;
                        // Apply greyscale mode to palette reads
                        if (this.mask & 0x01) {
                            result &= 0x30;
                        }
                        // Add PPU open bus bits for some PPU revisions
                        if (this.ppuRevision === 'G' || this.ppuRevision === 'H') {
                            result |= (this.openBus & 0xC0);
                        }
                    }
                    
                    this.addr += (this.control & 0x04) ? 32 : 1; // Increment VRAM address based on PPUCTRL
                    this.openBus = result; // Update open bus
                    return result;
                default: // Fallback for any other mirrored register
                    result = this.openBus & 0x1F;
                    break;
            }
            
            this.openBus = result; // Update open bus for all reads
            return result;
        }
        
        writeRegister(addr, data) {
            // Update open bus latch
            this.openBus = data & 0xFF;
            addr &= 0x07;
            
            // Check if writes are allowed (power-up state)
            if (!this.canWriteRegisters && (addr === 0x00 || addr === 0x01 || addr === 0x05 || addr === 0x06)) {
                // Ignore writes to these registers during power-up
                return;
            }
            
            switch (addr) {
                case 0x00: // PPUCTRL
                    this.control = data;
                    // Update nametable select bits (bits 0-1) and fine Y (bits 12-14) in tempAddr
                    this.tempAddr = (this.tempAddr & 0xF3FF) | ((data & 0x03) << 10); // Nametable X/Y
                    this.tempAddr = (this.tempAddr & 0x8FFF) | ((data & 0x80) << 5); // Fine Y (bit 7 -> bit 15)
                    
                    // Check for race condition at dot 257
                    if (this.scanline >= 0 && this.scanline < 240 && this.cycle === 257) {
                        // Bit 0 race condition can cause nametable glitches
                        // This is a simplified version - full implementation would need CPU-PPU alignment
                        this.cartridge?.getMirror() || 'horizontal';
                    }
                    break;
                case 0x01: // PPUMASK
                    this.mask = data;
                    this.colorCache.length = 0; // Clear color cache
                    break;
                case 0x03: // OAMADDR
                    this.oamAddr = data;
                    
                    // OAMADDR corruption bug on 2C02G
                    if (this.ppuRevision === 'G') {
                        // Copy sprites 8 and 9 (address $20) to the target address
                        // This is a simplified version of corruption
                        if (data < 0xF8) { // Only corrupt if not at end of OAM
                            for (let i = 0; i < 8; i++) {
                                this.oam[(data & 0xF8) + i] = this.oam[0x20 + i];
                            }
                        }
                    }
                    break;
                case 0x04: // OAMDATA
                    // OAMDATA writes during rendering are ignored (but increment still happens)
                    if (!((this.mask & 0x18) && this.scanline >= 0 && this.scanline < 240)) {
                        this.oam[this.oamAddr] = data;
                    }
                    this.oamAddr = (this.oamAddr + 1) & 0xFF; // Increment with wrap-around
                    break;
                case 0x05: // PPUSCROLL
                    if (this.addrLatch === 0) { // First write (X scroll)
                        this.fineX = data & 0x07; // Fine X scroll
                        this.tempAddr = (this.tempAddr & 0xFFE0) | (data >> 3); // Coarse X scroll
                        this.scrollX = data; // For debug display
                        this.addrLatch = 1;
                    } else { // Second write (Y scroll)
                        this.tempAddr = (this.tempAddr & 0x8C1F) | ((data & 0xF8) << 2) | ((data & 0x07) << 12); // Coarse Y and fine Y
                        this.scrollY = data; // For debug display
                        this.addrLatch = 0;
                    }
                    break;
                case 0x06: // PPUADDR
                    if (this.addrLatch === 0) { // First write (high byte)
                        this.tempAddr = (this.tempAddr & 0x00FF) | ((data & 0x3F) << 8); // PPU address high byte
                        // Bit 14 is forced to 0 in internal t register
                        this.tempAddr &= ~0x4000;
                        this.addrLatch = 1;
                    } else { // Second write (low byte)
                        this.tempAddr = (this.tempAddr & 0xFF00) | data; // PPU address low byte
                        this.addr = this.tempAddr; // Transfer to current VRAM address
                        this.addrLatch = 0;
                        
                        // Palette corruption workaround
                        if ((this.addr & 0x3F00) === 0x3F00) ;
                    }
                    break;
                case 0x07: // PPUDATA
                    this.ppuWrite(this.addr, data);
                    this.addr += (this.control & 0x04) ? 32 : 1; // Increment VRAM address based on PPUCTRL
                    break;
            }
        }
        
        // OAM DMA (triggered by CPU writing to $4014)
        oamDMA(page) {
            const sourceAddr = page << 8; // Source page in CPU memory ($XX00)
            
            // OAM DMA takes 513 or 514 CPU cycles
            // The CPU is suspended during this transfer
            
            // Check for OAMADDR corruption during DMA
            if (this.ppuRevision === 'G' && this.oamAddr !== 0) {
                // On 2C02G, non-zero OAMAddr can cause corruption during DMA
                // For simplicity, we'll just reset OAMAddr to 0 as most games expect
                this.oamAddr = 0;
            }
            
            // Perform the DMA transfer
            for (let i = 0; i < 256; i++) {
                this.oam[i] = this.bus.read(sourceAddr + i);
            }
            
            // OAMADDR is set to 0 after DMA (as per hardware behavior)
            this.oamAddr = 0;
        }
        
        // Set PPU type for different behaviors
        setPPUType(type, revision) {
            this.ppuType = type;
            this.ppuRevision = revision;
        }
        
        // Check for PAL-specific behavior
        isPAL() {
            return this.ppuType === '2C07';
        }
        
        // PAL forced refresh (happens 24 scanlines after NMI)
        palForcedRefresh() {
            if (this.isPAL() && this.scanline >= 265 && this.scanline <= 310) {
                // PAL PPU forces OAM refresh during these scanlines
                // Increment OAMADDR every 2 pixels (except at pixel 0)
                if (this.cycle % 2 === 0 && this.cycle !== 0) {
                    this.oamAddr = (this.oamAddr + 1) & 0xFF;
                }
            }
        }
        
        // PPU Memory Access (Nametables, Pattern Tables, Palettes)
        ppuRead(addr) {
            addr &= 0x3FFF; // Mask to 14-bit PPU address space
            
            if (addr < 0x2000) return this.cartridge?.ppuRead(addr) || 0; // Pattern Tables (CHR ROM/RAM)
            
            if (addr < 0x3F00) { // Nametables
                addr &= 0x0FFF; // Mask to 12-bit nametable address
                const mirror = this.cartridge?.getMirror() || 'horizontal'; // Get mirroring type from cartridge
                
                if (mirror === 'vertical') {
                    if (addr >= 0x0800) addr &= ~0x0800; // Mirror $2800/$2C00 to $2000/$2400
                } else if (mirror === 'horizontal') {
                    if (addr >= 0x0400 && addr < 0x0800) addr &= ~0x0400; // Mirror $2400 to $2000
                    if (addr >= 0x0C00) addr &= ~0x0400; // Mirror $2C00 to $2800
                } else if (mirror === 'single-screen') {
                    // Single-screen mirroring - all nametables point to same VRAM
                    addr &= 0x03FF;
                } else if (mirror === 'four-screen') {
                    // Four-screen VRAM - use cartridge-provided VRAM
                    // For now, fall back to horizontal mirroring
                    if (addr >= 0x0400 && addr < 0x0800) addr &= ~0x0400;
                    if (addr >= 0x0C00) addr &= ~0x0400;
                }
                return this.vram[addr & 0x07FF]; // Read from VRAM (2KB)
            }
            
            // Palettes
            addr &= 0x1F; // Mask to 5-bit palette address
            if ((addr & 0x3) === 0) addr &= ~0x10; // Mirror $3F10/$3F14/$3F18/$3F1C to $3F00
            
            // Palette reading behavior varies by PPU revision
            let result = this.palette[addr];
            
            // Some PPU revisions support reading palette RAM with immediate return
            if (this.ppuRevision === 'G' || this.ppuRevision === 'H') ; else {
                // Earlier revisions might not support palette reads
                // Return buffered value instead
                result = this.dataBuffer;
            }
            
            return result;
        }
        
        ppuWrite(addr, data) {
            addr &= 0x3FFF; // Mask to 14-bit PPU address space
            
            if (addr < 0x2000) { 
                this.cartridge?.ppuWrite(addr, data); 
                return; 
            } // Pattern Tables
            
            if (addr < 0x3F00) { // Nametables
                addr &= 0x0FFF;
                const mirror = this.cartridge?.getMirror() || 'horizontal';
                
                if (mirror === 'vertical') {
                    if (addr >= 0x0800) addr &= ~0x0800;
                } else if (mirror === 'horizontal') {
                    if (addr >= 0x0400 && addr < 0x0800) addr &= ~0x0400;
                    if (addr >= 0x0C00) addr &= ~0x0400;
                } else if (mirror === 'single-screen') {
                    addr &= 0x03FF;
                } else if (mirror === 'four-screen') {
                    // Four-screen VRAM - would need cartridge-provided VRAM
                    if (addr >= 0x0400 && addr < 0x0800) addr &= ~0x0400;
                    if (addr >= 0x0C00) addr &= ~0x0400;
                }
                
                this.vram[addr & 0x07FF] = data;
                return;
            }
            
            // Palettes
            addr &= 0x1F;
            if ((addr & 0x3) === 0) addr &= ~0x10; // Mirror $3F10/$3F14/$3F18/$3F1C to $3F00
            
            // Palette corruption protection
            // When writing to palette memory, some games use a workaround
            // to prevent corruption by writing to $3F00 multiple times
            this.palette[addr] = data;
            
            // Shared palette entries (background and sprite palettes share entry 0)
            if ((addr & 0x13) === 0x00) {
                // $3F00, $3F10, $3F04, $3F14, $3F08, $3F18, $3F0C, $3F1C all share the same storage
                this.palette[addr ^ 0x10] = data; // Mirror to the other palette
            }
        }
        
        getPalette() {
            return this.palette;
        }
        
        getScreen() { return this.screen; }
        getScreenBuffer() { 
            // Swap buffers when frame is complete and return completed frame
            if (this.frameReady) {
                const temp = this.screen;
                this.screen = this.screenBackbuffer;
                this.screenBackbuffer = temp;
                this.frameReady = false;
            }
            return this.screen; 
        }
        
        checkNMI() {
            if (this.nmi) {
                this.nmi = false;
                return true;
            }
            return false;
        }
    }

    class Cartridge {
        constructor() {
            this.mapperID = 0;
            this.prgBanks = 0;
            this.chrBanks = 0;
            this.prgROM = null;
            this.chrROM = null;
            this.prgRAM = new Uint8Array(0x2000);
            this.mirror = 'horizontal';
            
            // Mapper specific properties
            this.mapper = null;
        }
        
        static fromINES(data) {
            const cartridge = new Cartridge();
            
            // Verify iNES header
            if (data.length < 16 || 
                String.fromCharCode(data[0], data[1], data[2], data[3]) !== 'NES\x1A') {
                throw new Error('Invalid iNES file format');
            }
            
            // Parse header
            cartridge.prgBanks = data[4];
            cartridge.chrBanks = data[5];
            
            const flags6 = data[6];
            const flags7 = data[7];
            
            // Extract mapper ID
            cartridge.mapperID = ((flags7 >> 4) << 4) | (flags6 >> 4);
            
            // Determine mirroring
            if (flags6 & 0x01) {
                cartridge.mirror = 'vertical';
            } else {
                cartridge.mirror = 'horizontal';
            }
            
            // 4-screen mirroring (rare)
            if (flags6 & 0x08) {
                cartridge.mirror = 'four-screen';
            }
            
            // Trainer (512 bytes)
            let trainerOffset = 16;
            if (flags6 & 0x04) {
                trainerOffset += 512;
            }
            
            // Calculate ROM sizes
            const prgSize = cartridge.prgBanks * 0x4000; // 16KB per bank
            const chrSize = cartridge.chrBanks * 0x2000; // 8KB per bank
            
            // Extract PRG ROM
            cartridge.prgROM = new Uint8Array(data.buffer, trainerOffset, prgSize);
            
            // Extract CHR ROM or allocate CHR RAM
            const chrOffset = trainerOffset + prgSize;
            if (cartridge.chrBanks > 0) {
                cartridge.chrROM = new Uint8Array(data.buffer, chrOffset, chrSize);
            } else {
                cartridge.chrROM = new Uint8Array(0x2000); // 8KB CHR RAM
            }
            
            // Initialize mapper
            cartridge.initMapper();
            
            return cartridge;
        }
        
        initMapper() {
            // For now, implement basic mapper 0 (NROM)
            // Future mappers would be implemented as separate classes
            this.mapper = new Mapper0(this.prgBanks, this.chrBanks, this);
        }
        
        cpuRead(addr) {
            return this.mapper?.cpuRead(addr) || 0x00;
        }
        
        cpuWrite(addr, data) {
            this.mapper?.cpuWrite(addr, data);
        }
        
        ppuRead(addr) {
            return this.mapper?.ppuRead(addr) || 0x00;
        }
        
        ppuWrite(addr, data) {
            this.mapper?.ppuWrite(addr, data);
        }
        
        getMirror() {
            return this.mirror;
        }
    }

    // Base Mapper class
    class Mapper {
        constructor(prgBanks, chrBanks, cartridge) {
            this.prgBanks = prgBanks;
            this.chrBanks = chrBanks;
            this.cartridge = cartridge;
        }
        
        cpuRead(addr) { return 0x00; }
        cpuWrite(addr, data) {}
        ppuRead(addr) { return 0x00; }
        ppuWrite(addr, data) {}
    }

    // Mapper 0 - NROM (no bank switching)
    class Mapper0 extends Mapper {
        constructor(prgBanks, chrBanks, cartridge) {
            super(prgBanks, chrBanks, cartridge);
        }
        
        cpuRead(addr) {
            if (addr >= 0x8000 && addr <= 0xFFFF) {
                if (this.prgBanks === 1) {
                    // 16KB PRG ROM, mirror at $C000
                    return this.cartridge.prgROM[addr & 0x3FFF];
                } else {
                    // 32KB PRG ROM
                    return this.cartridge.prgROM[addr & 0x7FFF];
                }
            }
            return 0x00;
        }
        
        cpuWrite(addr, data) {
            if (addr >= 0x6000 && addr <= 0x7FFF) {
                // PRG RAM
                this.cartridge.prgRAM[addr & 0x1FFF] = data;
            }
            // PRG ROM is read-only
        }
        
        ppuRead(addr) {
            if (addr >= 0x0000 && addr <= 0x1FFF) {
                return this.cartridge.chrROM[addr];
            }
            return 0x00;
        }
        
        ppuWrite(addr, data) {
            if (addr >= 0x0000 && addr <= 0x1FFF) {
                if (this.chrBanks === 0) {
                    // CHR RAM
                    this.cartridge.chrROM[addr] = data;
                }
                // CHR ROM is read-only
            }
        }
    }

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
    function disassembleInstruction(bus, addr) {
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

    /**
     * Main NES emulator class
     * Coordinates all hardware components and provides the main emulation interface
     */
    class NES {
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

    const nes = new NES();
    const controller = new Controller();

    // Connect controller to the bus
    nes.bus.connectController(controller);

    // Make instances globally accessible for debugging, and export them for module usage
    window.nes = nes;

    exports.FLAGS = FLAGS;
    exports.controller = controller;
    exports.nes = nes;

    return exports;

})({});
//# sourceMappingURL=nes-emu.js.map
