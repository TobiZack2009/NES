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
            this.status = this.pull();
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
            
            // Initialize address latch
            this.addrLatch = 0;
            this.fineX = 0;
            
            // PPU Memory
            this.vram = new Uint8Array(0x800);      // 2KB VRAM
            this.oam = new Uint8Array(0x100);       // 256 bytes Object Attribute Memory
            this.palette = new Uint8Array(0x20);    // 32 bytes palette memory
            
            // PPU Registers
            this.control = 0x00;
            this.mask = 0x00;
            this.status = 0x00;
            this.oamAddr = 0x00;
            this.scrollX = 0x00;
            this.scrollY = 0x00;
            this.addr = 0x0000;
            this.dataBuffer = 0x00;
            
            // PPU Timing
            this.cycle = 0;         // 0-340
            this.scanline = -1;     // -1 (pre-render), 0-239 (visible), 240 (post-render), 241-260 (vblank)
            this.frame = 0;
            
            // VRAM Address Registers (Loopy)
            this.vramAddr = 0x0000;
            this.tramAddr = 0x0000;
            
            // Rendering State
            this.bgNextTileId = 0;
            this.bgNextTileAttr = 0;
            this.bgNextTileLsb = 0;
            this.bgNextTileMsb = 0;
            
            this.bgShifterPatternLo = 0;
            this.bgShifterPatternHi = 0;
            this.bgShifterAttribLo = 0;
            this.bgShifterAttribHi = 0;
            
            // Frame buffer
            this.screen = new Uint8Array(256 * 240 * 4); // RGBA
            
            // NMI flag
            this.nmi = false;
            
            // Sprites
            this.spriteScanline = [];
            this.spriteZeroHit = false;
            this.spriteOverflow = false;
            
            // Sprite shifters for rendering
            this.spritePatterns = [];
            this.spritePositions = [];
            this.spritePriorities = [];
            this.spritePalettes = [];
            
            this.cartridge = null;
        }
        
        connectCartridge(cartridge) {
            this.cartridge = cartridge;
        }
        
    reset() {
            this.control = 0x00;
            this.mask = 0x00;
            this.status = 0x00;
            this.oamAddr = 0x00;
            this.scrollX = 0x00;
            this.scrollY = 0x00;
            this.addr = 0x0000;
            this.dataBuffer = 0x00;
            
            this.cycle = 0;
            this.scanline = -1;
            this.frame = 0;
            
            this.vramAddr = 0x0000;
            this.tramAddr = 0x0000;
            
            this.bgNextTileId = 0;
            this.bgNextTileAttr = 0;
            this.bgNextTileLsb = 0;
            this.bgNextTileMsb = 0;
            
            this.bgShifterPatternLo = 0;
            this.bgShifterPatternHi = 0;
            this.bgShifterAttribLo = 0;
            this.bgShifterAttribHi = 0;
            
            this.nmi = false;
            this.spriteZeroHit = false;
            this.spriteOverflow = false;
            
            // Clear OAM
            this.oam.fill(0);
            
            // Clear palette with default values
            for (let i = 0; i < 32; i++) {
                this.palette[i] = i % 4 === 0 ? 0x0F : (i - 1) % 4 + 1;
            }
            
            // Clear screen buffer
            this.screen.fill(0);
            
            // Clear sprite rendering data
            this.spritePatterns = [];
            this.spritePositions = [];
            this.spritePriorities = [];
            this.spritePalettes = [];
        }
        
        clock() {
            // Increment PPU cycle
            this.cycle++;
            
            if (this.cycle >= 341) {
                this.cycle = 0;
                this.scanline++;
                
                if (this.scanline >= 261) {
                    this.scanline = -1;
                    this.frame++;
                    
                    // Clear screen buffer at end of frame for clean start
                    this.screen.fill(0);
                }
            }
            
            // Determine current phase
            const isPreRender = this.scanline === -1;
            const isVisible = this.scanline >= 0 && this.scanline < 240;
            const isPostRender = this.scanline === 240;
            const isVBlank = this.scanline >= 241 && this.scanline < 261;
            
            // Handle VBlank
            if (isPostRender) ; else if (isVBlank) {
                if (this.scanline === 241 && this.cycle === 1) {
                    this.status |= 0x80; // Set VBlank flag
                    if (this.control & 0x80) {
                        this.nmi = true;
                    }
                }
            } else if (isPreRender) {
                if (this.cycle === 1) {
                    this.status &= ~0x80; // Clear VBlank flag
                    this.status &= ~0x40; // Clear sprite overflow
                    this.status &= ~0x20; // Clear sprite zero hit
                    this.nmi = false;
                    
                    // Clear screen buffer at start of pre-render scanline
                    this.screen.fill(0);
                }
                
                // Perform same operations as visible scanlines
                if (this.cycle >= 280 && this.cycle <= 304) {
                    this.transferAddress();
                }
                
                if (this.cycle >= 1 && this.cycle < 257) {
                    this.backgroundRendering();
                } else if (this.cycle >= 321 && this.cycle < 337) {
                    this.backgroundRendering();
                }
            } else if (isVisible) {
                // Visible scanlines
                if (this.cycle >= 1 && this.cycle < 257) {
                    this.backgroundRendering();
                    this.spriteEvaluation();
                    this.pixelRendering();
                } else if (this.cycle >= 321 && this.cycle < 337) {
                    this.backgroundRendering();
                }
                
                if (this.cycle === 256) {
                    this.incrementScrollY();
                }
                
                if (this.cycle === 257) {
                    this.transferX();
                    this.loadSpritesForNextLine();
                }
                
                // Load sprite patterns during cycles 1-256 (visible area)
                if (this.cycle >= 1 && this.cycle <= 256 && this.cycle % 8 === 0) {
                    // Load sprite patterns every 8 cycles
                    this.loadSpritePatterns();
                }
            }
        }
        
        backgroundRendering() {
            if (this.mask & 0x08) { // Background enabled
                if (this.cycle <= 256 || (this.cycle >= 321 && this.cycle <= 336)) {
                    switch (this.cycle % 8) {
                        case 1:
                            this.fetchNametableByte();
                            break;
                        case 3:
                            this.fetchAttributeTableByte();
                            break;
                        case 5:
                            this.fetchTileBitmapLow();
                            break;
                        case 7:
                            this.fetchTileBitmapHigh();
                            break;
                        case 0:
                            this.storeTileData();
                            break;
                    }
                }
            }
        }
        
        spriteEvaluation() {
            if (this.cycle >= 257 && this.cycle <= 320) {
                // Sprite evaluation happens during this range
                if (this.cycle === 257) {
                    this.evaluateSprites();
                }
            }
        }
        
        pixelRendering() {
            if (this.cycle >= 1 && this.cycle <= 256) {
                const x = this.cycle - 1;
                const y = this.scanline;
                
                // Initialize with background color if nothing is enabled
                let pixelColor = { palette: 0, value: 0 };
                
                // Get background pixel
                if (this.mask & 0x08) {
                    const bgPixel = this.getBackgroundPixel(x);
                    
                    // Get sprite pixel
                    let spritePixel = { palette: 0, value: 0, priority: 0 };
                    if (this.mask & 0x10) {
                        spritePixel = this.getSpritePixel(x);
                    }
                    
                    // Compose final pixel
                    if ((this.mask & 0x10) && (this.mask & 0x08)) { // Both sprites and background enabled
                        if (spritePixel.palette !== 0 && spritePixel.priority !== 0) {
                            // Sprite in front
                            pixelColor = spritePixel;
                        } else if (bgPixel.palette !== 0) {
                            // Background visible
                            pixelColor = bgPixel;
                        } else if (spritePixel.palette !== 0) {
                            // Sprite behind background, but background is transparent
                            pixelColor = spritePixel;
                        }
                    } else if (this.mask & 0x10) { // Sprites only
                        pixelColor = spritePixel.palette !== 0 ? spritePixel : { palette: 0, value: 0 };
                    } else if (this.mask & 0x08) { // Background only
                        pixelColor = bgPixel.palette !== 0 ? bgPixel : { palette: 0, value: 0 };
                    }
                    
                    // Apply left-side clipping if enabled
                    if (x < 8) {
                        if ((this.mask & 0x02) === 0 && pixelColor.palette >= 4) {
                            // Sprite clipping enabled and this is a sprite pixel
                            pixelColor = { palette: 0, value: 0 };
                        }
                        if ((this.mask & 0x08) === 0) {
                            // Background clipping enabled
                            pixelColor = { palette: 0, value: 0 };
                        }
                    }
                }
                
                // Write to screen buffer
                const colorIndex = this.getColorFromPalette(pixelColor.palette, pixelColor.value);
                const pixelIndex = (y * 256 + x) * 4;
                const color = this.getNESColor(colorIndex);
                
                this.screen[pixelIndex] = color.r;
                this.screen[pixelIndex + 1] = color.g;
                this.screen[pixelIndex + 2] = color.b;
                this.screen[pixelIndex + 3] = 255;
            }
        }
        
        getBackgroundPixel(x) {
            if ((this.mask & 0x08) === 0) {
                return { palette: 0, value: 0 };
            }
            
            // Extract pattern from shifters
            const bitMsb = (this.bgShifterPatternHi >> (15 - (x + this.fineX) % 8)) & 1;
            const bitLsb = (this.bgShifterPatternLo >> (15 - (x + this.fineX) % 8)) & 1;
            const patternValue = (bitMsb << 1) | bitLsb;
            
            if (patternValue === 0) {
                return { palette: 0, value: 0 };
            }
            
            // Extract palette from attribute shifters
            const attribMsb = (this.bgShifterAttribHi >> (7 - (x + this.fineX) % 8)) & 1;
            const attribLsb = (this.bgShifterAttribLo >> (7 - (x + this.fineX) % 8)) & 1;
            const paletteIndex = (attribMsb << 1) | attribLsb;
            
            return { palette: paletteIndex + 1, value: patternValue };
        }
        
        getSpritePixel(x) {
            if ((this.mask & 0x10) === 0) {
                return { palette: 0, value: 0, priority: 0 };
            }
            
            // Check sprites in reverse order (for proper priority)
            for (let i = this.spriteScanline.length - 1; i >= 0; i--) {
                const spriteX = this.spritePositions[i];
                if (x >= spriteX && x < spriteX + 8) {
                    const offsetX = x - spriteX;
                    const patternValue = this.spritePatterns[i][offsetX];
                    
                    if (patternValue !== 0) {
                        // Check for sprite zero hit (only for sprite 0)
                        if (i === 0 && !this.spriteZeroHit && 
                            this.cycle >= 1 && this.cycle <= 256 &&
                            x < 255 && // Not at x=255 (sprite 0 hit doesn't trigger there)
                            this.getBackgroundPixel(x).palette !== 0 &&
                            !(x < 8 && (this.mask & 0x04) === 0)) { // Not in clipped left column
                            this.spriteZeroHit = true;
                            this.status |= 0x40;
                        }
                        
                        return {
                            palette: this.spritePalettes[i],
                            value: patternValue,
                            priority: this.spritePriorities[i]
                        };
                    }
                }
            }
            
            return { palette: 0, value: 0, priority: 0 };
        }
        
        getSpritePatternBit(sprite, offsetX) {
            const spriteHeight = (this.control & 0x20) ? 16 : 8;
            let tileIndex = sprite.id;
            let row = this.scanline - sprite.y;
            
            // Ensure row is within bounds
            if (row < 0 || row >= spriteHeight) {
                return 0;
            }
            
            // Handle vertical flip
            if (sprite.vFlip) {
                row = spriteHeight - 1 - row;
            }
            
            // Handle 8x16 sprites
            let patternTableAddr;
            if (spriteHeight === 16) {
                // For 8x16 sprites, bit 0 of tile ID selects pattern table
                patternTableAddr = (tileIndex & 0x01) * 0x1000;
                tileIndex = (tileIndex & 0xFE); // Clear bit 0, keep only tile number
                
                // Select which 8x8 tile to use from the 16x16 sprite
                if (row >= 8) {
                    tileIndex += 1; // Use second tile
                    row -= 8;
                }
            } else {
                // 8x8 sprites use pattern table from PPUCTRL bit 3
                patternTableAddr = ((this.control >> 3) & 0x01) * 0x1000;
            }
            
            // Calculate pattern address
            const patternAddr = patternTableAddr + tileIndex * 16 + row;
            
            // Read the two pattern bytes
            const patternLow = this.ppuRead(patternAddr);
            const patternHigh = this.ppuRead(patternAddr + 8);
            
            // Calculate bit position (handle horizontal flip)
            let bitPos = offsetX;
            if (sprite.hFlip) {
                bitPos = 7 - offsetX;
            }
            
            // Extract the 2-bit pattern value
            const bitLow = (patternLow >> (7 - bitPos)) & 1;
            const bitHigh = (patternHigh >> (7 - bitPos)) & 1;
            
            return (bitHigh << 1) | bitLow;
        }
        
        fetchNametableByte() {
            const addr = 0x2000 | (this.vramAddr & 0x0FFF);
            this.bgNextTileId = this.ppuRead(addr);
        }
        
        fetchAttributeTableByte() {
            const addr = 0x23C0 | 
                        (this.vramAddr & 0x0C00) | 
                        ((this.vramAddr >> 4) & 0x38) | 
                        ((this.vramAddr >> 2) & 0x07);
            this.bgNextTileAttr = this.ppuRead(addr);
        }
        
        fetchTileBitmapLow() {
            const fineY = (this.vramAddr >> 12) & 0x03;
            const tileAddr = 0x1000 * ((this.control >> 4) & 0x01) | 
                            (this.bgNextTileId << 4) | fineY;
            this.bgNextTileLsb = this.ppuRead(tileAddr);
        }
        
        fetchTileBitmapHigh() {
            const fineY = (this.vramAddr >> 12) & 0x03;
            const tileAddr = 0x1000 * ((this.control >> 4) & 0x01) | 
                            (this.bgNextTileId << 4) | fineY;
            this.bgNextTileMsb = this.ppuRead(tileAddr + 8);
        }
        
        storeTileData() {
            this.bgShifterPatternLo = (this.bgShifterPatternLo << 8) | this.bgNextTileLsb;
            this.bgShifterPatternHi = (this.bgShifterPatternHi << 8) | this.bgNextTileMsb;
            
            // Get attribute bits for this tile position
            const attribShift = ((this.vramAddr >> 4) & 0x04) | (this.vramAddr & 0x02);
            const attribLatchLo = (this.bgNextTileAttr >> attribShift) & 0x01;
            const attribLatchHi = (this.bgNextTileAttr >> (attribShift + 1)) & 0x01;
            
            this.bgShifterAttribLo = (this.bgShifterAttribLo << 8) | (attribLatchLo ? 0xFF : 0x00);
            this.bgShifterAttribHi = (this.bgShifterAttribHi << 8) | (attribLatchHi ? 0xFF : 0x00);
            
            this.incrementScrollX();
        }
        
        incrementScrollX() {
            if ((this.mask & 0x18) !== 0) { // Background or sprites enabled
                if ((this.vramAddr & 0x001F) === 0x001F) {
                    this.vramAddr &= ~0x001F; // Clear coarse X
                    this.vramAddr ^= 0x0400;  // Switch horizontal nametable
                } else {
                    this.vramAddr += 1;
                }
            }
        }
        
        incrementScrollY() {
            if ((this.mask & 0x18) !== 0) { // Background or sprites enabled
                if ((this.vramAddr & 0x7000) !== 0x7000) {
                    this.vramAddr += 0x1000;
                } else {
                    this.vramAddr &= ~0x7000;
                    
                    if ((this.vramAddr & 0x03E0) === 0x03A0) {
                        this.vramAddr &= ~0x03E0;
                        this.vramAddr ^= 0x0800;
                    } else if ((this.vramAddr & 0x03E0) === 0x03E0) {
                        this.vramAddr &= ~0x03E0;
                    } else {
                        this.vramAddr += 0x0020;
                    }
                }
            }
        }
        
        transferAddress() {
            if ((this.mask & 0x18) !== 0) { // Background or sprites enabled
                this.vramAddr = (this.vramAddr & ~0x7BE0) | (this.tramAddr & 0x7BE0);
            }
        }
        
        transferX() {
            if ((this.mask & 0x18) !== 0) { // Background or sprites enabled
                this.vramAddr = (this.vramAddr & ~0x041F) | (this.tramAddr & 0x041F);
            }
        }
        
        evaluateSprites() {
            // Reset sprite scanline - evaluate for NEXT scanline
            this.spriteScanline = [];
            let spriteCount = 0;
            
            const spriteHeight = (this.control & 0x20) ? 16 : 8;
            
            // Scan OAM for sprites on this scanline
            for (let i = 0; i < 64 && spriteCount < 8; i++) {
                const spriteY = this.oam[i * 4];
                
                if (this.scanline >= spriteY && this.scanline < spriteY + spriteHeight) {
                    const sprite = {
                        y: spriteY,
                        id: this.oam[i * 4 + 1],
                        attr: this.oam[i * 4 + 2],
                        x: this.oam[i * 4 + 3],
                        palette: (this.oam[i * 4 + 2] & 0x03) + 4, // Sprite palettes are 4-7
                        priority: (this.oam[i * 4 + 2] & 0x20) ? 1 : 0,
                        hFlip: (this.oam[i * 4 + 2] & 0x40) ? 1 : 0,
                        vFlip: (this.oam[i * 4 + 2] & 0x80) ? 1 : 0
                    };
                    
                    this.spriteScanline.push(sprite);
                    spriteCount++;
                }
            }
            
            // Check for sprite overflow
            if (spriteCount >= 8) {
                this.spriteOverflow = true;
                this.status |= 0x20;
            }
        }
        
        loadSpritesForNextLine() {
            // Clear sprite rendering data
            this.spritePatterns = [];
            this.spritePositions = [];
            this.spritePriorities = [];
            this.spritePalettes = [];
            
            // Load sprite pattern data for current scanline
            (this.control & 0x20) ? 16 : 8;
            
            for (let i = 0; i < this.spriteScanline.length; i++) {
                const sprite = this.spriteScanline[i];
                
                // Skip if sprite won't be visible
                if (sprite.x >= 256) continue;
                
                // Get pattern data for entire sprite row
                const patternData = [];
                for (let x = 0; x < 8; x++) {
                    patternData.push(this.getSpritePatternBit(sprite, x));
                }
                
                // Apply horizontal flip if needed
                if (sprite.hFlip) {
                    patternData.reverse();
                }
                
                this.spritePatterns.push(patternData);
                this.spritePositions.push(sprite.x);
                this.spritePriorities.push(sprite.priority);
                this.spritePalettes.push(sprite.palette);
            }
        }
        
        loadSpritePatterns() {
            // This function would load sprite patterns into shifters during rendering
            // For now, we'll calculate patterns on-demand in getSpritePixel
        }
        
        getColorFromPalette(palette, index) {
            if (palette === 0 && index === 0) {
                return 0x0F; // Universal background color
            }
            const addr = 0x3F00 + (palette * 4 + index);
            return this.ppuRead(addr) & 0x3F;
        }
        
        getNESColor(colorIndex) {
            // NES palette
            const palette = [
                {r: 84,  g: 84,  b: 84},   // 0x00
                {r: 0,   g: 30,  b: 116},  // 0x01
                {r: 8,   g: 16,  b: 144},  // 0x02
                {r: 48,  g: 0,   b: 136},  // 0x03
                {r: 68,  g: 0,   b: 100},  // 0x04
                {r: 92,  g: 0,   b: 48},   // 0x05
                {r: 84,  g: 4,   b: 0},    // 0x06
                {r: 60,  g: 24,  b: 0},    // 0x07
                {r: 32,  g: 42,  b: 0},    // 0x08
                {r: 8,   g: 58,  b: 0},    // 0x09
                {r: 0,   g: 64,  b: 0},    // 0x0A
                {r: 0,   g: 60,  b: 0},    // 0x0B
                {r: 0,   g: 50,  b: 60},   // 0x0C
                {r: 0,   g: 0,   b: 0},    // 0x0D
                {r: 0,   g: 0,   b: 0},    // 0x0E
                {r: 0,   g: 0,   b: 0},    // 0x0F
                {r: 152, g: 0,   b: 0},    // 0x10
                {r: 8,   g: 76,  b: 196},  // 0x11
                {r: 48,  g: 50,  b: 236},  // 0x12
                {r: 92,  g: 30,  b: 228},  // 0x13
                {r: 136, g: 20,  b: 176},  // 0x14
                {r: 160, g: 20,  b: 100},  // 0x15
                {r: 152, g: 34,  b: 32},   // 0x16
                {r: 120, g: 60,  b: 0},    // 0x17
                {r: 84,  g: 90,  b: 0},    // 0x18
                {r: 40,  g: 114, b: 0},    // 0x19
                {r: 8,   g: 124, b: 0},    // 0x1A
                {r: 0,   g: 118, b: 40},   // 0x1B
                {r: 0,   g: 102, b: 80},   // 0x1C
                {r: 0,   g: 0,   b: 0},    // 0x1D
                {r: 0,   g: 0,   b: 0},    // 0x1E
                {r: 0,   g: 0,   b: 0},    // 0x1F
                {r: 236, g: 0,   b: 0},    // 0x20
                {r: 76,  g: 0,   b: 0},    // 0x21
                {r: 168, g: 0,   b: 32},   // 0x22
                {r: 228, g: 0,   b: 80},   // 0x23
                {r: 236, g: 58,  b: 92},   // 0x24
                {r: 172, g: 54,  b: 0},    // 0x25
                {r: 236, g: 88,  b: 0},    // 0x26
                {r: 200, g: 120, b: 0},    // 0x27
                {r: 152, g: 120, b: 0},    // 0x28
                {r: 108, g: 152, b: 0},    // 0x29
                {r: 44,  g: 180, b: 48},   // 0x2A
                {r: 0,   g: 168, b: 68},   // 0x2B
                {r: 0,   g: 140, b: 152},  // 0x2C
                {r: 0,   g: 0,   b: 0},    // 0x2D
                {r: 0,   g: 0,   b: 0},    // 0x2E
                {r: 0,   g: 0,   b: 0},    // 0x2F
                {r: 236, g: 224, b: 208},  // 0x30
                {r: 236, g: 160, b: 120},  // 0x31
                {r: 236, g: 196, b: 168},  // 0x32
                {r: 236, g: 200, b: 176},  // 0x33
                {r: 236, g: 180, b: 168},  // 0x34
                {r: 228, g: 156, b: 160},  // 0x35
                {r: 204, g: 148, b: 156},  // 0x36
                {r: 180, g: 140, b: 136},  // 0x37
                {r: 196, g: 176, b: 168},  // 0x38
                {r: 188, g: 172, b: 160},  // 0x39
                {r: 172, g: 164, b: 152},  // 0x3A
                {r: 152, g: 148, b: 136},  // 0x3B
                {r: 132, g: 132, b: 120},  // 0x3C
                {r: 0,   g: 0,   b: 0},    // 0x3D
                {r: 0,   g: 0,   b: 0},    // 0x3E
                {r: 0,   g: 0,   b: 0},    // 0x3F
            ];
            
            return palette[Math.min(colorIndex, 63)];
        }
        
        // PPU Register Interface
        readRegister(addr) {
            addr &= 0x07;
            
            switch (addr) {
                case 0x00: // PPUCTRL
                    return 0; // Write-only
                    
                case 0x01: // PPUMASK
                    return 0; // Write-only
                    
                case 0x02: // PPUSTATUS
                    const result = this.status;
                    this.status &= ~0x80; // Clear VBlank on read
                    this.dataBuffer = this.ppuRead(this.vramAddr);
                    this.tramAddr = (this.tramAddr & ~0x7BE0) | (this.vramAddr & 0x7BE0);
                    return result;
                    
                case 0x03: // OAMADDR
                    return 0; // Write-only
                    
                case 0x04: // OAMDATA
                    return this.oam[this.oamAddr];
                    
                case 0x05: // PPUSCROLL
                    return 0; // Write-only
                    
                case 0x06: // PPUADDR
                    return 0; // Write-only
                    
                case 0x07: // PPUDATA
                    let data = this.dataBuffer;
                    this.dataBuffer = this.ppuRead(this.vramAddr);
                    
                    if (this.vramAddr >= 0x3F00) {
                        // Palette reads are immediate - don't use buffered data
                        data = this.dataBuffer;
                    }
                    
                    this.vramAddr += (this.control & 0x04) ? 32 : 1;
                    return data;
                    
                default:
                    return 0;
            }
        }
        
        writeRegister(addr, data) {
            addr &= 0x07;
            data &= 0xFF;
            
            switch (addr) {
                case 0x00: // PPUCTRL
                    this.control = data;
                    this.tramAddr = (this.tramAddr & ~0xC00) | ((data & 0x03) << 10);
                    break;
                    
                case 0x01: // PPUMASK
                    this.mask = data;
                    break;
                    
                case 0x02: // PPUSTATUS
                    // Read-only
                    break;
                    
                case 0x03: // OAMADDR
                    this.oamAddr = data;
                    break;
                    
                case 0x04: // OAMDATA
                    this.oam[this.oamAddr] = data;
                    this.oamAddr = (this.oamAddr + 1) & 0xFF;
                    break;
                    
                case 0x05: // PPUSCROLL
                    if (this.addrLatch === 0) {
                        this.scrollX = data;
                        this.tramAddr = (this.tramAddr & ~0x001F) | (data >> 3);
                        this.fineX = data & 0x07;
                        this.addrLatch = 1;
                    } else {
                        this.scrollY = data;
                        this.tramAddr = (this.tramAddr & ~0x73E0) | ((data >> 3) << 5) | ((data & 0x07) << 12);
                        this.addrLatch = 0;
                    }
                    break;
                    
                case 0x06: // PPUADDR
                    if (this.addrLatch === 0) {
                        this.tramAddr = (this.tramAddr & 0x00FF) | ((data & 0x3F) << 8);
                        this.addrLatch = 1;
                    } else {
                        this.tramAddr = (this.tramAddr & 0x7F00) | data;
                        this.vramAddr = this.tramAddr;
                        this.addrLatch = 0;
                    }
                    break;
                    
                case 0x07: // PPUDATA
                    this.ppuWrite(this.vramAddr, data);
                    this.vramAddr += (this.control & 0x04) ? 32 : 1;
                    break;
            }
        }
        
        // OAM DMA
        oamDMA(page) {
            const sourceAddr = page * 0x100;
            
            for (let i = 0; i < 256; i++) {
                this.oam[i] = this.bus.cpuRead(sourceAddr + i);
            }
            
            this.oamAddr = 0; // Reset OAM address after DMA
        }
        
        // PPU Memory Access
        ppuRead(addr) {
            addr &= 0x3FFF;
            
            if (addr >= 0x0000 && addr <= 0x1FFF) {
                // Pattern tables
                return this.cartridge?.ppuRead(addr) || 0x00;
            } else if (addr >= 0x2000 && addr <= 0x2FFF) {
                // Nametables
                const mirroredAddr = addr & 0x0FFF;
                const nametable = mirroredAddr >> 10;
                const index = mirroredAddr & 0x03FF;
                
                const mirror = this.cartridge?.getMirror();
                
                if (mirror === 'horizontal') {
                    if (nametable === 0 || nametable === 1) {
                        return this.vram[index];
                    } else {
                        return this.vram[0x0400 + index];
                    }
                } else if (mirror === 'vertical') {
                    if (nametable === 0 || nametable === 2) {
                        return this.vram[index];
                    } else {
                        return this.vram[0x0400 + index];
                    }
                } else if (mirror === 'four-screen') {
                    // Four-screen mirroring would need additional VRAM
                    return this.vram[index % 0x0800];
                }
            } else if (addr >= 0x3000 && addr <= 0x3EFF) {
                // Mirrors of $2000-$2EFF
                return this.ppuRead(addr - 0x1000);
            } else if (addr >= 0x3F00 && addr <= 0x3F1F) {
                // Palette RAM
                const paletteAddr = addr & 0x1F;
                if ((paletteAddr & 0x03) === 0) {
                    return this.palette[0];
                }
                return this.palette[paletteAddr];
            } else if (addr >= 0x3F20 && addr <= 0x3FFF) {
                // Mirrors of $3F00-$3F1F
                return this.palette[addr & 0x1F];
            }
            
            return 0x00;
        }
        
        ppuWrite(addr, data) {
            addr &= 0x3FFF;
            data &= 0xFF;
            
            if (addr >= 0x0000 && addr <= 0x1FFF) {
                // Pattern tables
                this.cartridge?.ppuWrite(addr, data);
            } else if (addr >= 0x2000 && addr <= 0x2FFF) {
                // Nametables
                const mirroredAddr = addr & 0x0FFF;
                const nametable = mirroredAddr >> 10;
                const index = mirroredAddr & 0x03FF;
                
                const mirror = this.cartridge?.getMirror();
                
                if (mirror === 'horizontal') {
                    if (nametable === 0 || nametable === 1) {
                        this.vram[index] = data;
                    } else {
                        this.vram[0x0400 + index] = data;
                    }
                } else if (mirror === 'vertical') {
                    if (nametable === 0 || nametable === 2) {
                        this.vram[index] = data;
                    } else {
                        this.vram[0x0400 + index] = data;
                    }
                } else if (mirror === 'four-screen') {
                    this.vram[index % 0x0800] = data;
                }
            } else if (addr >= 0x3000 && addr <= 0x3EFF) {
                // Mirrors of $2000-$2EFF
                this.ppuWrite(addr - 0x1000, data);
            } else if (addr >= 0x3F00 && addr <= 0x3F1F) {
                // Palette RAM
                const paletteAddr = addr & 0x1F;
                if ((paletteAddr & 0x03) === 0) {
                    this.palette[0] = data & 0x3F;
                }
                this.palette[paletteAddr] = data & 0x3F;
            } else if (addr >= 0x3F20 && addr <= 0x3FFF) {
                // Mirrors of $3F00-$3F1F
                this.palette[addr & 0x1F] = data & 0x3F;
            }
        }
        

        
        // Get current screen data for rendering
        getScreen() {
            return this.screen;
        }
        
        // Check if NMI should be triggered
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

    // Utility function to load a ROM file
    async function loadROM(file) {
        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);
        return Cartridge.fromINES(data);
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
            /** @type {Bus} System bus connecting all components */
            this.bus = new Bus();
            
            /** @type {CPU} CPU processor */
            this.cpu = new CPU(this.bus);
            
            /** @type {PPU|null} Picture Processing Unit (created when cartridge loaded) */
            this.ppu = null;
            
            /** @type {Cartridge|null} Currently loaded cartridge */
            this.cartridge = null;
            
            // Connect components
            this.bus.connectCPU(this.cpu);
        }
        
        /**
         * Reset the entire NES system
         */
        reset() {
            this.bus.reset();
        }
        
        /**
         * Execute one system clock cycle
         */
        clock() {
            this.bus.clock();
        }
        
        /**
         * Execute one CPU instruction (may span multiple clock cycles)
         */
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

    class TestFramework {
        constructor() {
            this.tests = [];
            this.results = [];
        }
        
        addTest(name, testFunction) {
            this.tests.push({ name, testFunction });
        }
        
        async runTests() {
            this.results = [];
            
            for (const test of this.tests) {
                try {
                    console.log(`Running test: ${test.name}`);
                    const startTime = performance.now();
                    
                    await test.testFunction();
                    
                    const endTime = performance.now();
                    const duration = endTime - startTime;
                    
                    this.results.push({
                        name: test.name,
                        status: 'passed',
                        duration,
                        message: 'Test passed'
                    });
                    
                    console.log(`✓ ${test.name} (${duration.toFixed(2)}ms)`);
                } catch (error) {
                    console.error(`✗ ${test.name}: ${error.message}`);
                    this.results.push({
                        name: test.name,
                        status: 'failed',
                        duration: 0,
                        message: error.message
                    });
                }
            }
            
            return this.results;
        }
        
        generateReport() {
            const passed = this.results.filter(r => r.status === 'passed').length;
            const failed = this.results.filter(r => r.status === 'failed').length;
            const total = this.results.length;
            
            let report = `Test Results:\n`;
            report += `Total: ${total}, Passed: ${passed}, Failed: ${failed}\n\n`;
            
            for (const result of this.results) {
                const status = result.status === 'passed' ? '✓' : '✗';
                report += `${status} ${result.name} (${result.duration.toFixed(2)}ms)\n`;
                if (result.status === 'failed') {
                    report += `  Error: ${result.message}\n`;
                }
            }
            
            return report;
        }
    }

    class MovieSystem {
        constructor() {
            this.frames = [];
            this.currentFrame = 0;
            this.recording = false;
            this.playing = false;
        }
        
        startRecording() {
            this.frames = [];
            this.currentFrame = 0;
            this.recording = true;
            console.log('Started recording movie');
        }
        
        stopRecording() {
            this.recording = false;
            console.log(`Stopped recording. Captured ${this.frames.length} frames`);
        }
        
        recordFrame(controller1State, controller2State = 0) {
            if (this.recording) {
                this.frames.push({
                    frame: this.frames.length,
                    controller1: controller1State,
                    controller2: controller2State
                });
            }
        }
        
        startPlayback() {
            this.currentFrame = 0;
            this.playing = true;
            console.log(`Started playback of ${this.frames.length} frames`);
        }
        
        stopPlayback() {
            this.playing = false;
            console.log('Stopped playback');
        }
        
        getNextFrame() {
            if (!this.playing || this.currentFrame >= this.frames.length) {
                return null;
            }
            
            const frame = this.frames[this.currentFrame];
            this.currentFrame++;
            
            if (this.currentFrame >= this.frames.length) {
                this.playing = false;
                console.log('Playback completed');
            }
            
            return frame;
        }
        
        saveMovie() {
            const movieData = JSON.stringify(this.frames);
            const blob = new Blob([movieData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `nes-movie-${Date.now()}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
        }
        
        loadMovie(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        this.frames = JSON.parse(e.target.result);
                        this.currentFrame = 0;
                        console.log(`Loaded movie with ${this.frames.length} frames`);
                        resolve();
                    } catch (error) {
                        reject(new Error('Failed to parse movie file'));
                    }
                };
                reader.readAsText(file);
            });
        }
    }

    class CRC32 {
        static compute(data) {
            const table = CRC32.generateTable();
            let crc = 0xFFFFFFFF;
            
            for (let i = 0; i < data.length; i++) {
                crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
            }
            
            return (crc ^ 0xFFFFFFFF) >>> 0;
        }
        
        static generateTable() {
            const table = new Array(256);
            
            for (let i = 0; i < 256; i++) {
                let c = i;
                for (let j = 0; j < 8; j++) {
                    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
                }
                table[i] = c;
            }
            
            return table;
        }
    }

    class RegressionTestSuite {
        constructor() {
            this.goldenHashes = new Map();
            this.testResults = [];
        }
        
        loadGoldenHashes(manifest) {
            this.goldenHashes.clear();
            for (const [romName, hash] of Object.entries(manifest)) {
                this.goldenHashes.set(romName, hash);
            }
        }
        
        async runRegressionTest(nes, romPath, targetFrame = 3600) {
            console.log(`Running regression test for ${romPath}`);
            
            try {
                // Load ROM
                const response = await fetch(romPath);
                const buffer = await response.arrayBuffer();
                const data = new Uint8Array(buffer);
                const cartridge = await nes.loadCartridge(data);
                
                // Fast-forward to target frame
                const startTime = performance.now();
                
                while (nes.ppu.frame < targetFrame) {
                    // Run multiple cycles per iteration for faster execution
                    for (let i = 0; i < 1000; i++) {
                        nes.step();
                    }
                }
                
                const endTime = performance.now();
                const duration = endTime - startTime;
                
                // Generate hash of frame buffer
                const screenData = nes.ppu.getScreen();
                const hash = CRC32.compute(screenData);
                
                // Compare with golden hash
                const expectedHash = this.goldenHashes.get(romPath);
                const passed = expectedHash === undefined || hash === expectedHash;
                
                const result = {
                    romPath,
                    frame: nes.ppu.frame,
                    hash: hash.toString(16).padStart(8, '0'),
                    expectedHash: expectedHash ? expectedHash.toString(16).padStart(8, '0') : 'unknown',
                    passed,
                    duration,
                    message: passed ? 'Regression test passed' : `Hash mismatch: expected ${expectedHash}, got ${hash}`
                };
                
                this.testResults.push(result);
                
                console.log(`${passed ? '✓' : '✗'} ${romPath}: ${result.message} (${duration.toFixed(2)}ms)`);
                
                return result;
            } catch (error) {
                const result = {
                    romPath,
                    frame: 0,
                    hash: 'error',
                    expectedHash: 'error',
                    passed: false,
                    duration: 0,
                    message: `Test failed: ${error.message}`
                };
                
                this.testResults.push(result);
                console.error(`✗ ${romPath}: ${error.message}`);
                
                return result;
            }
        }
        
        generateReport() {
            const passed = this.testResults.filter(r => r.passed).length;
            const failed = this.testResults.filter(r => !r.passed).length;
            const total = this.testResults.length;
            
            let report = `Regression Test Results:\n`;
            report += `Total: ${total}, Passed: ${passed}, Failed: ${failed}\n\n`;
            
            for (const result of this.testResults) {
                const status = result.passed ? '✓' : '✗';
                report += `${status} ${result.romPath}\n`;
                report += `  Frame: ${result.frame}, Hash: ${result.hash}`;
                if (!result.passed) {
                    report += `, Expected: ${result.expectedHash}\n`;
                    report += `  ${result.message}`;
                }
                report += `\n`;
            }
            
            return report;
        }
        
        updateGoldenHash(romPath, hash) {
            this.goldenHashes.set(romPath, hash);
            console.log(`Updated golden hash for ${romPath}: ${hash.toString(16).padStart(8, '0')}`);
        }
        
        saveGoldenManifest() {
            const manifest = {};
            for (const [romPath, hash] of this.goldenHashes) {
                manifest[romPath] = hash;
            }
            
            const manifestData = JSON.stringify(manifest, null, 2);
            const blob = new Blob([manifestData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'golden-hashes.json';
            a.click();
            
            URL.revokeObjectURL(url);
        }
    }

    /**
     * NES Test Log Parser
     * Parses nestest.log format for CPU state comparison
     */

    class CPUState {
        constructor(line) {
            this.parse(line);
        }

        parse(line) {
            // Example line (from actual nestest.log):
            // C000  4C F5 C5  JMP $C5F5                       A:00 X:00 Y:00 P:24 SP:FD PPU:  0, 21 CYC:7
            
            // Remove leading/trailing whitespace
            line = line.trim();
            
            // This is the actual format - no line number, just address, instruction, and state
            this.lineNumber = null; // Will be set by index in array
            const rest = line;

            // Extract address
            const addressMatch = rest.match(/^([0-9A-Fa-f]{4})\s+/);
            if (!addressMatch) {
                throw new Error(`Cannot parse address from: ${rest}`);
            }
            this.address = parseInt(addressMatch[1], 16);

            // Extract instruction bytes and mnemonic
            const instrMatch = rest.match(/[0-9A-Fa-f]{4}\s+([0-9A-Fa-f\s]+?)\s+(\*?[A-Z]{3})/);
            if (!instrMatch) {
                throw new Error(`Cannot parse instruction from: ${rest}`);
            }
            
            this.instructionBytes = instrMatch[1].trim().split(/\s+/).map(b => parseInt(b, 16));
            this.mnemonic = instrMatch[2];

            // Extract operand (everything between mnemonic and "A:")
            const operandMatch = rest.match(/\*?[A-Z]{3}\s+(.+?)\s+A:/);
            this.operand = operandMatch ? operandMatch[1].trim() : '';

            // Extract register states
            const registerMatch = rest.match(/A:([0-9A-Fa-f]{2})\s+X:([0-9A-Fa-f]{2})\s+Y:([0-9A-Fa-f]{2})\s+P:([0-9A-Fa-f]{2})\s+SP:([0-9A-Fa-f]{2})/);
            if (!registerMatch) {
                throw new Error(`Cannot parse registers from: ${rest}`);
            }

            this.A = parseInt(registerMatch[1], 16);
            this.X = parseInt(registerMatch[2], 16);
            this.Y = parseInt(registerMatch[3], 16);
            this.P = parseInt(registerMatch[4], 16);
            this.SP = parseInt(registerMatch[5], 16);

            // Extract PPU state
            const ppuMatch = rest.match(/PPU:\s*(\d+),\s*(\d+)/);
            if (ppuMatch) {
                this.ppuScanline = parseInt(ppuMatch[1], 10);
                this.ppuCycle = parseInt(ppuMatch[2], 10);
            } else {
                this.ppuScanline = null;
                this.ppuCycle = null;
            }

            // Extract cycle count
            const cycleMatch = rest.match(/CYC:(\d+)/);
            this.cycles = cycleMatch ? parseInt(cycleMatch[1], 10) : null;
        }

        getProcessorFlags() {
            return {
                carry: !!(this.P & 0x01),
                zero: !!(this.P & 0x02),
                interruptDisable: !!(this.P & 0x04),
                decimal: !!(this.P & 0x08),
                breakFlag: !!(this.P & 0x10),
                unused: !!(this.P & 0x20),
                overflow: !!(this.P & 0x40),
                negative: !!(this.P & 0x80)
            };
        }

        toString() {
            const flags = this.getProcessorFlags();
            const flagStr = `${flags.carry ? 'C' : 'c'}${flags.zero ? 'Z' : 'z'}${flags.interruptDisable ? 'I' : 'i'}${flags.decimal ? 'D' : 'd'}${flags.overflow ? 'V' : 'v'}${flags.negative ? 'N' : 'n'}`;
            const pad = (str, length, char) => str.padStart ? str.padStart(length, char) : char.repeat(Math.max(0, length - str.length)) + str;
            const lineNum = this.lineNumber ? `${this.lineNumber}: ` : '';
            return `${lineNum}${this.mnemonic} ${this.operand} | A:${pad(this.A.toString(16).toUpperCase(), 2, '0')} X:${pad(this.X.toString(16).toUpperCase(), 2, '0')} Y:${pad(this.Y.toString(16).toUpperCase(), 2, '0')} P:${flagStr} SP:${pad(this.SP.toString(16).toUpperCase(), 2, '0')}`;
        }
    }

    class LogParser {
        constructor() {
            this.states = [];
            this.loaded = false;
        }

        async load(logText) {
            const lines = logText.split('\n').filter(line => line.trim() && line.trim() !== '');
            this.states = [];

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                try {
                    const state = new CPUState(line);
                    state.lineNumber = i + 1; // Set line number manually
                    this.states.push(state);
                } catch (error) {
                    console.warn(`Failed to parse line ${i + 1}: ${line}`, error);
                }
            }

            this.loaded = true;
            console.log(`Loaded ${this.states.length} CPU states from log`);
        }

        getState(lineNumber) {
            if (!this.loaded) {
                throw new Error('Log not loaded yet');
            }
            return this.states.find(state => state.lineNumber === lineNumber);
        }

        getStateByAddress(address) {
            if (!this.loaded) {
                throw new Error('Log not loaded yet');
            }
            return this.states.find(state => state.address === address);
        }

        compare(emulatorCPU, lineNumber) {
            const expectedState = this.getState(lineNumber);
            if (!expectedState) {
                throw new Error(`No expected state found for line ${lineNumber}`);
            }

            const differences = [];

            // Compare registers
            if (emulatorCPU.a !== expectedState.A) {
                differences.push({
                    type: 'register',
                    name: 'A',
                    expected: expectedState.A,
                    actual: emulatorCPU.a
                });
            }

            if (emulatorCPU.x !== expectedState.X) {
                differences.push({
                    type: 'register',
                    name: 'X',
                    expected: expectedState.X,
                    actual: emulatorCPU.x
                });
            }

            if (emulatorCPU.y !== expectedState.Y) {
                differences.push({
                    type: 'register',
                    name: 'Y',
                    expected: expectedState.Y,
                    actual: emulatorCPU.y
                });
            }

            if (emulatorCPU.stkp !== expectedState.SP) {
                differences.push({
                    type: 'register',
                    name: 'SP',
                    expected: expectedState.SP,
                    actual: emulatorCPU.stkp
                });
            }

            // Compare flags (ensure unused bit is set for fair comparison)
            const cpuStatus = emulatorCPU.status | 0x20; // Set unused bit
            const expectedStatus = expectedState.P | 0x20; // Ensure expected also has unused bit
            if (cpuStatus !== expectedStatus) {
                const expectedFlags = {
                    carry: !!(expectedState.P & 0x01),
                    zero: !!(expectedState.P & 0x02),
                    interruptDisable: !!(expectedState.P & 0x04),
                    decimal: !!(expectedState.P & 0x08),
                    breakFlag: !!(expectedState.P & 0x10),
                    unused: !!(expectedState.P & 0x20),
                    overflow: !!(expectedState.P & 0x40),
                    negative: !!(expectedState.P & 0x80)
                };
                
                const actualFlags = {
                    carry: !!(emulatorCPU.status & 0x01),
                    zero: !!(emulatorCPU.status & 0x02),
                    interruptDisable: !!(emulatorCPU.status & 0x04),
                    decimal: !!(emulatorCPU.status & 0x08),
                    breakFlag: !!(emulatorCPU.status & 0x10),
                    unused: !!(emulatorCPU.status & 0x20),
                    overflow: !!(emulatorCPU.status & 0x40),
                    negative: !!(emulatorCPU.status & 0x80)
                };

                ['carry', 'zero', 'interruptDisable', 'decimal', 'breakFlag', 'unused', 'overflow', 'negative'].forEach(flag => {
                    if (expectedFlags[flag] !== actualFlags[flag]) {
                        differences.push({
                            type: 'flag',
                            name: flag,
                            expected: expectedFlags[flag],
                            actual: actualFlags[flag]
                        });
                    }
                });
            }

            return {
                expected: expectedState,
                actual: emulatorCPU,
                differences: differences,
                matches: differences.length === 0
            };
        }

        // Find the closest expected state for a given PC address
        findNearestState(pc) {
            if (!this.loaded) {
                throw new Error('Log not loaded yet');
            }

            // First try exact match
            const exact = this.states.find(state => state.address === pc);
            if (exact) {
                return exact;
            }

            // Find closest address
            return this.states.reduce((nearest, state) => {
                const currentDistance = Math.abs(state.address - pc);
                const nearestDistance = Math.abs(nearest.address - pc);
                return currentDistance < nearestDistance ? state : nearest;
            });
        }
    }

    // Singleton instance for the app
    const logParser = new LogParser();

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
    function disassemble(bus, startAddr, count = 20) {
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

    // Global instances
    exports.nes = void 0;
    exports.testFramework = void 0;
    exports.movieSystem = void 0;
    exports.regressionSuite = void 0;

    // Initialize the emulator when the page loads
    window.addEventListener('DOMContentLoaded', () => {
        exports.nes = new NES();
        
        // Initialize testing systems
        exports.testFramework = new TestFramework();
        exports.movieSystem = new MovieSystem();
        exports.regressionSuite = new RegressionTestSuite();
        
        // Setup tests
        setupTests();
        
        // Setup UI
        setupUI();
        
        // Make instances globally accessible
        window.nes = exports.nes;
        window.testFramework = exports.testFramework;
        window.movieSystem = exports.movieSystem;
        window.regressionSuite = exports.regressionSuite;
        
        console.log('NES Emulator with Testing Framework initialized');
    });

    function setupTests() {
        // CPU instruction tests
        exports.testFramework.addTest('CPU - LDA Immediate', () => {
            exports.nes.reset();
            exports.nes.cpu.a = 0x00;
            exports.nes.bus.write(0x8000, 0xA9); // LDA #$42
            exports.nes.bus.write(0x8001, 0x42);
            exports.nes.cpu.pc = 0x8000;
            
            exports.nes.step(); // Execute LDA
            
            if (exports.nes.cpu.a !== 0x42) {
                throw new Error(`Expected A = $42, got $${exports.nes.cpu.a.toString(16)}`);
            }
        });
        
        exports.testFramework.addTest('CPU - TAX Transfer', () => {
            exports.nes.reset();
            exports.nes.cpu.a = 0x73;
            exports.nes.cpu.x = 0x00;
            exports.nes.bus.write(0x8000, 0xAA); // TAX
            exports.nes.cpu.pc = 0x8000;
            
            exports.nes.step(); // Execute TAX
            
            if (exports.nes.cpu.x !== 0x73) {
                throw new Error(`Expected X = $73, got $${exports.nes.cpu.x.toString(16)}`);
            }
        });
        
        exports.testFramework.addTest('CPU - Zero Page Addressing', () => {
            exports.nes.reset();
            exports.nes.bus.write(0x0050, 0x37); // Set value at zero page address
            exports.nes.bus.write(0x8000, 0xA5); // LDA $50
            exports.nes.bus.write(0x8001, 0x50);
            exports.nes.cpu.pc = 0x8000;
            
            exports.nes.step(); // Execute LDA
            
            if (exports.nes.cpu.a !== 0x37) {
                throw new Error(`Expected A = $37, got $${exports.nes.cpu.a.toString(16)}`);
            }
        });
        
        exports.testFramework.addTest('PPU - Register Reset', () => {
            exports.nes.reset();
            
            if (!exports.nes.ppu) {
                throw new Error('PPU not initialized');
            }
            
            // Check default PPU status
            if (exports.nes.ppu.status !== 0x00) {
                throw new Error(`Expected PPU status = $00, got $${exports.nes.ppu.status.toString(16)}`);
            }
        });
        
        exports.testFramework.addTest('PPU - Palette Memory', () => {
            exports.nes.reset();
            
            // Write to palette memory
            exports.nes.ppu.ppuWrite(0x3F00, 0x1F);
            const value = exports.nes.ppu.ppuRead(0x3F00);
            
            if (value !== 0x1F) {
                throw new Error(`Expected palette value = $1F, got $${value.toString(16)}`);
            }
        });
        
        exports.testFramework.addTest('Bus - Memory Mapping', () => {
            exports.nes.reset();
            
            // Test RAM access
            exports.nes.bus.write(0x0000, 0x42);
            const ramValue = exports.nes.bus.read(0x0000);
            
            if (ramValue !== 0x42) {
                throw new Error(`Expected RAM value = $42, got $${ramValue.toString(16)}`);
            }
            
            // Test RAM mirroring
            const mirrorValue = exports.nes.bus.read(0x0800);
            if (mirrorValue !== 0x42) {
                throw new Error(`Expected RAM mirror value = $42, got $${mirrorValue.toString(16)}`);
            }
        });
        
        exports.testFramework.addTest('CRC32 - Basic Check', () => {
            const data = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"
            const hash = CRC32.compute(data);
            
            // Known CRC32 for "Hello"
            const expectedHash = 0x0BF4FE626;
            if (hash !== expectedHash) {
                throw new Error(`Expected CRC32 = ${expectedHash.toString(16)}, got ${hash.toString(16)}`);
            }
        });
    }

    function setupUI() {
        setupROMLoader();
        setupControls();
        setupDebug();
        setupTestingUI();
        setupCollapsibleSections();
    }

    function setupROMLoader() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.nes';
        fileInput.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 1000;';
        
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    console.log('Loading ROM:', file.name);
                    const cartridge = await loadROM(file);
                    exports.nes.loadCartridge(cartridge);
                    console.log('ROM loaded successfully!');
                    console.log('PRG Banks:', cartridge.prgBanks);
                    console.log('CHR Banks:', cartridge.chrBanks);
                    console.log('Mapper:', cartridge.mapperID);
                    
                    updateStatus(`ROM loaded: ${file.name}`);
                    updateDebug();
                    updateDisassembly();
                    
                    // Clear instruction log
                    document.getElementById('instruction-log-output').textContent = '';
                } catch (error) {
                    console.error('Failed to load ROM:', error);
                    updateStatus(`Error: ${error.message}`);
                }
            }
        });
        
        document.body.appendChild(fileInput);
    }

    function setupControls() {
        const resetBtn = document.getElementById('resetBtn');
        const stepBtn = document.getElementById('stepBtn');
        const runBtn = document.getElementById('runBtn');
        const stopBtn = document.getElementById('stopBtn');
        const testBtn = document.getElementById('testBtn');
        
        // Setup keyboard input
        setupKeyboardInput();
        
        let isRunning = false;
        let animationId = null;
        
        resetBtn.addEventListener('click', () => {
            exports.nes.reset();
            updateDebug();
            updateDisassembly();
            updateScreen();
            updateStatus('Reset');
        });
        
        stepBtn.addEventListener('click', () => {
            exports.nes.step();
            updateDebug();
            updateDisassembly();
            logInstruction();
            updateScreen();
        });
        
        runBtn.addEventListener('click', () => {
            if (!isRunning) {
                isRunning = true;
                updateStatus('Running');
                
                function run() {
                    if (isRunning) {
                        // Execute several CPU cycles per frame
                        for (let i = 0; i < 1000; i++) {
                            exports.nes.step();
                        }
                        updateDebug();
                        updateDisassembly();
                        updateScreen();
                        animationId = requestAnimationFrame(run);
                    }
                }
                run();
            }
        });
        
        stopBtn.addEventListener('click', () => {
            isRunning = false;
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
            updateStatus('Stopped');
        });
        
        testBtn.addEventListener('click', async () => {
            await runNestestTest();
        });
    }

    function setupDebug() {
        updateDebug();
        updateDisassembly();
        
        // Set up screen update interval
        setInterval(() => {
            if (document.hidden === false && !document.getElementById('stopBtn').disabled) {
                updateScreen();
            }
        }, 16); // ~60 FPS
    }

    function setupTestingUI() {
        const testingContainer = document.createElement('div');
        testingContainer.style.cssText = 'margin-top: 20px; padding: 10px; background: #111; border: 1px solid #333; font-size: 12px;';
        
        const runTestsBtn = document.createElement('button');
        runTestsBtn.textContent = 'Run All Tests';
        runTestsBtn.style.cssText = 'margin: 5px; padding: 5px 10px; background: #333; color: #fff; border: none; cursor: pointer; font-family: monospace;';
        
        const movieRecordBtn = document.createElement('button');
        movieRecordBtn.textContent = 'Start Recording';
        movieRecordBtn.style.cssText = 'margin: 5px; padding: 5px 10px; background: #333; color: #fff; border: none; cursor: pointer; font-family: monospace;';
        
        const testOutput = document.createElement('div');
        testOutput.id = 'testOutput';
        testOutput.style.cssText = 'margin-top: 10px; white-space: pre-wrap; max-height: 200px; overflow-y: auto;';
        
        runTestsBtn.addEventListener('click', async () => {
            testOutput.textContent = 'Running tests...\n';
            
            await exports.testFramework.runTests();
            const report = exports.testFramework.generateReport();
            testOutput.textContent = report;
        });
        
        let recording = false;
        movieRecordBtn.addEventListener('click', () => {
            if (!recording) {
                exports.movieSystem.startRecording();
                movieRecordBtn.textContent = 'Stop Recording';
                recording = true;
                updateStatus('Recording movie');
            } else {
                exports.movieSystem.stopRecording();
                movieRecordBtn.textContent = 'Start Recording';
                recording = false;
                updateStatus('Stopped recording');
                
                if (exports.movieSystem.frames.length > 0) {
                    exports.movieSystem.saveMovie();
                }
            }
        });
        
        testingContainer.appendChild(document.createTextNode('Testing Framework: '));
        testingContainer.appendChild(runTestsBtn);
        testingContainer.appendChild(movieRecordBtn);
        testingContainer.appendChild(testOutput);
        
        document.body.appendChild(testingContainer);
        
        // Add movie load input
        const movieInput = document.createElement('input');
        movieInput.type = 'file';
        movieInput.accept = '.json';
        movieInput.style.cssText = 'margin: 5px; padding: 5px; background: #333; color: #fff; border: none; font-family: monospace;';
        
        movieInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    await exports.movieSystem.loadMovie(file);
                    updateStatus(`Loaded movie: ${file.name}`);
                } catch (error) {
                    updateStatus(`Error loading movie: ${error.message}`);
                }
            }
        });
        
        testingContainer.appendChild(document.createTextNode(' Load Movie: '));
        testingContainer.appendChild(movieInput);
    }

    function updateDebug() {
        const debugEl = document.getElementById('debug');
        if (!debugEl) return; // Debug section may be collapsed
        
        const state = exports.nes.dumpCPUState();
        const ppuStatus = exports.nes.ppu ? {
            cycle: exports.nes.ppu.cycle,
            scanline: exports.nes.ppu.scanline,
            frame: exports.nes.ppu.frame,
            control: exports.nes.ppu.control.toString(16).padStart(2, '0'),
            mask: exports.nes.ppu.mask.toString(16).padStart(2, '0'),
            status: exports.nes.ppu.status.toString(16).padStart(2, '0'),
        } : { cycle: '-', scanline: '-', frame: '-', control: '-', mask: '-', status: '-' };
        
        debugEl.textContent = `CPU State:
A: $${state.a}  X: $${state.x}  Y: $${state.y}  SP: $${state.stkp}
PC: $${state.pc}
Status: ${state.status} (N V - B D I Z C)

PPU State:
Cycle: ${ppuStatus.cycle}  Scanline: ${ppuStatus.scanline}  Frame: ${ppuStatus.frame}
CTRL: $${ppuStatus.control}  MASK: $${ppuStatus.mask}  STATUS: $${ppuStatus.status}`;
    }

    function updateDisassembly() {
        const disassemblyEl = document.getElementById('disassembly-output');
        if (!disassemblyEl || !exports.nes.cartridge) {
            if (disassemblyEl) disassemblyEl.textContent = 'Load a ROM to see disassembly';
            return;
        }
        
        // Disassemble around current PC
        const currentPC = exports.nes.cpu.pc;
        const startAddr = Math.max(0x8000, currentPC - 0x20); // Start a bit before current PC
        const disassembly = disassemble(exports.nes.bus, startAddr, 30);
        
        disassemblyEl.textContent = disassembly;
        
        // Highlight current instruction
        const lines = disassemblyEl.textContent.split('\n');
        const highlightedLines = lines.map((line, index) => {
            const lineAddr = parseInt(line.substring(0, 4), 16);
            if (lineAddr === currentPC) {
                return `>>> ${line}`;
            }
            return `    ${line}`;
        });
        
        disassemblyEl.textContent = highlightedLines.join('\n');
    }

    function logInstruction() {
        const logEl = document.getElementById('instruction-log-output');
        if (!logEl || !exports.nes.cartridge) return;
        
        const instruction = disassembleInstruction(exports.nes.bus, exports.nes.cpu.pc);
        const state = exports.nes.cpu.getState();
        
        const logEntry = `$${instruction.addr.toString(16).padStart(4, '0').toUpperCase()}:  ${instruction.bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')}  ${instruction.mnemonic} ${instruction.operand}  |  A:$${state.A.toString(16).padStart(2, '0').toUpperCase()} X:$${state.X.toString(16).padStart(2, '0').toUpperCase()} Y:$${state.Y.toString(16).padStart(2, '0').toUpperCase()} P:$${state.P.toString(16).padStart(2, '0').toUpperCase()} SP:$${state.SP.toString(16).padStart(2, '0').toUpperCase()}`;
        
        let currentLog = logEl.textContent;
        if (!currentLog) currentLog = '';
        
        // Keep only last 50 instructions
        const logLines = currentLog.split('\n').filter(line => line.trim());
        logLines.push(logEntry);
        if (logLines.length > 50) {
            logLines.shift(); // Remove oldest line
        }
        
        logEl.textContent = logLines.join('\n');
        logEl.scrollTop = logEl.scrollHeight;
    }

    function updateScreen() {
        if (!exports.nes.ppu) return;
        
        // Only update when a complete frame is ready (during vblank)
        if (exports.nes.ppu.scanline < 241) {
            return; // Still in visible rendering phase
        }
        
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(256, 240);
        
        const screenData = exports.nes.ppu.getScreen();
        imageData.data.set(screenData);
        
        ctx.putImageData(imageData, 0, 0);
    }

    function setupKeyboardInput() {
        document.addEventListener('keydown', (e) => {
            if (!exports.nes.bus.controller1) return;
            
            switch(e.code) {
                case 'KeyX': case 'ButtonX':
                    exports.nes.bus.controller1.setButtonState('A', true);
                    break;
                case 'KeyZ': case 'ButtonZ':
                    exports.nes.bus.controller1.setButtonState('B', true);
                    break;
                case 'Enter': case 'NumpadEnter':
                    exports.nes.bus.controller1.setButtonState('START', true);
                    break;
                case 'ShiftLeft': case 'ShiftRight':
                    exports.nes.bus.controller1.setButtonState('SELECT', true);
                    break;
                case 'ArrowUp': case 'KeyW':
                    exports.nes.bus.controller1.setButtonState('UP', true);
                    break;
                case 'ArrowDown': case 'KeyS':
                    exports.nes.bus.controller1.setButtonState('DOWN', true);
                    break;
                case 'ArrowLeft': case 'KeyA':
                    exports.nes.bus.controller1.setButtonState('LEFT', true);
                    break;
                case 'ArrowRight': case 'KeyD':
                    exports.nes.bus.controller1.setButtonState('RIGHT', true);
                    break;
            }
            e.preventDefault();
        });
        
        document.addEventListener('keyup', (e) => {
            if (!exports.nes.bus.controller1) return;
            
            switch(e.code) {
                case 'KeyX': case 'ButtonX':
                    exports.nes.bus.controller1.setButtonState('A', false);
                    break;
                case 'KeyZ': case 'ButtonZ':
                    exports.nes.bus.controller1.setButtonState('B', false);
                    break;
                case 'Enter': case 'NumpadEnter':
                    exports.nes.bus.controller1.setButtonState('START', false);
                    break;
                case 'ShiftLeft': case 'ShiftRight':
                    exports.nes.bus.controller1.setButtonState('SELECT', false);
                    break;
                case 'ArrowUp': case 'KeyW':
                    exports.nes.bus.controller1.setButtonState('UP', false);
                    break;
                case 'ArrowDown': case 'KeyS':
                    exports.nes.bus.controller1.setButtonState('DOWN', false);
                    break;
                case 'ArrowLeft': case 'KeyA':
                    exports.nes.bus.controller1.setButtonState('LEFT', false);
                    break;
                case 'ArrowRight': case 'KeyD':
                    exports.nes.bus.controller1.setButtonState('RIGHT', false);
                    break;
            }
            e.preventDefault();
        });
    }

    function updateStatus(message) {
        const statusEl = document.getElementById('status');
        statusEl.textContent = message;
        console.log('Status:', message);
    }

    async function runNestestTest() {
        updateStatus('Loading nestest.nes and test data...');
        
        try {
            // Load the test log
            const logResponse = await fetch('tests/nestest.log');
            const logText = await logResponse.text();
            await logParser.load(logText);
            
            // Load the test ROM
            const romResponse = await fetch('tests/nestest.nes');
            const romData = await romResponse.arrayBuffer();
            const romFile = new File([romData], 'nestest.nes', { type: 'application/x-nes' });
            
            const cartridge = await loadROM(romFile);
            exports.nes.loadCartridge(cartridge);
            
            // Reset and set PC to $C000 (start of nestest)
            exports.nes.reset();
            exports.nes.cpu.pc = 0xC000;
            
            updateStatus('Running nestest comparison...');
            const testResultsEl = document.getElementById('testResults');
            testResultsEl.style.display = 'block';
            testResultsEl.innerHTML = '<div class="test-info">Starting nestest comparison...</div>';
            
            // Run step-by-step comparison
            let totalTests = 0;
            let passedTests = 0;
            let failedTests = 0;
            let outputHTML = '';
            
            // Limit to first 500 lines for initial testing
            const maxLines = Math.min(500, logParser.states.length);
            
            for (let i = 1; i <= maxLines; i++) {
                const expectedState = logParser.getState(i);
                if (!expectedState) continue;
                
                // Get current state before stepping
                const currentState = exports.nes.cpu.getState();
                
                // Step to next instruction
                exports.nes.step();
                
                // Compare states
                const comparison = logParser.compare(exports.nes.cpu, i);
                totalTests++;
                
                if (comparison.matches) {
                    passedTests++;
                    outputHTML += `<div class="test-match">Line ${i}: ✓ ${expectedState.mnemonic} ${expectedState.operand}</div>`;
                } else {
                    failedTests++;
                    outputHTML += `<div class="test-mismatch">Line ${i}: ✗ ${expectedState.mnemonic} ${expectedState.operand}</div>`;
                    
                    // Show details of the mismatch
                    comparison.differences.forEach(diff => {
                        if (diff.type === 'register') {
                            const pad = (str, length, char) => str.padStart ? str.padStart(length, char) : char.repeat(Math.max(0, length - str.length)) + str;
                            outputHTML += `<div class="test-mismatch">    ${diff.name}: expected ${pad(diff.expected.toString(16).toUpperCase(), 2, '0')}, got ${pad(diff.actual.toString(16).toUpperCase(), 2, '0')}</div>`;
                        } else if (diff.type === 'flag') {
                            outputHTML += `<div class="test-mismatch">    flag ${diff.name}: expected ${diff.expected}, got ${diff.actual}</div>`;
                        }
                    });
                    
                    outputHTML += `<div class="test-mismatch">    Expected: ${expectedState.toString()}</div>`;
                    const pad = (str, length, char) => str.padStart ? str.padStart(length, char) : char.repeat(Math.max(0, length - str.length)) + str;
                    outputHTML += `<div class="test-mismatch">    Actual: A:${pad(exports.nes.cpu.a.toString(16).toUpperCase(), 2, '0')} X:${pad(exports.nes.cpu.x.toString(16).toUpperCase(), 2, '0')} Y:${pad(exports.nes.cpu.y.toString(16).toUpperCase(), 2, '0')} P:${pad(exports.nes.cpu.status.toString(16).toUpperCase(), 2, '0')} SP:${pad(exports.nes.cpu.stkp.toString(16).toUpperCase(), 2, '0')}</div>`;
                }
                
                // Update UI periodically
                if (i % 50 === 0) {
                    testResultsEl.innerHTML = `
                    <div class="test-info">Progress: ${i}/${maxLines} lines tested</div>
                    <div class="test-info">Passed: ${passedTests}, Failed: ${failedTests}</div>
                    <div style="max-height: 200px; overflow-y: auto;">
                        ${outputHTML}
                    </div>
                `;
                    updateDebug();
                    await new Promise(resolve => setTimeout(resolve, 1)); // Allow UI update
                }
                
                // Stop early if too many failures
                if (failedTests > 100) {
                    outputHTML += `<div class="test-mismatch">Stopped early due to too many failures</div>`;
                    break;
                }
            }
            
            // Final results
            testResultsEl.innerHTML = `
            <div class="test-info">Test Results:</div>
            <div class="test-info">Total: ${totalTests}, Passed: ${passedTests}, Failed: ${failedTests}</div>
            <div class="${failedTests === 0 ? 'test-match' : 'test-mismatch'}">
                ${failedTests === 0 ? '✓ All tests passed!' : `✗ ${failedTests} tests failed`}
            </div>
            <div style="max-height: 200px; overflow-y: auto; margin-top: 10px;">
                ${outputHTML}
            </div>
        `;
            
            updateStatus(`Test completed: ${passedTests}/${totalTests} passed`);
            
        } catch (error) {
            console.error('Test failed:', error);
            updateStatus(`Test failed: ${error.message}`);
            document.getElementById('testResults').innerHTML = `<div class="test-mismatch">Test failed: ${error.message}</div>`;
        }
    }

    function setupCollapsibleSections() {
        const collapsibles = document.querySelectorAll('.collapsible');
        
        collapsibles.forEach(button => {
            button.addEventListener('click', function() {
                this.classList.toggle('collapsed');
                const content = this.nextElementSibling;
                content.classList.toggle('collapsed');
            });
        });
        
        // Set initial states (debug expanded, others collapsed)
        document.getElementById('disassembly-toggle').classList.add('collapsed');
        document.getElementById('disassembly-content').classList.add('collapsed');
        document.getElementById('instruction-log-toggle').classList.add('collapsed');
        document.getElementById('instruction-log-content').classList.add('collapsed');
    }

    // Export for module usage
    const controller=new Controller();

    exports.controller = controller;

    return exports;

})({});
//# sourceMappingURL=nes-emu.js.map
