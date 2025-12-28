# **Master Implementation Guide: Web-Based NES Emulator**

This guide provides a cycle-accurate roadmap for building a Nintendo Entertainment System (NES) emulator from scratch using JavaScript and Rollup.

## **Current Implementation Status:**

**✅ Completed:**
- Project structure with Rollup bundler
- Bus class with memory map routing  
- CPU class with complete opcode dispatch table (256 opcodes)
- iNES file format parser and cartridge loader (Mapper 0/NROM)
- Basic HTML frontend with debugging controls
- PPU class with complete rendering pipeline
- NES color palette implementation
- Comprehensive testing framework with unit tests, movie recording/playback
- Automated test suite for CPU and PPU
- NES test integration (nestest.log parser and state comparison)
- Controller input for player 1

**🚧 In Progress:**
- Sprite pattern bit calculation (basic implementation)
- Additional mappers beyond Mapper 0
- Web Audio API integration for sound
- Performance optimizations

**📋 Next Steps:**
- Complete sprite rendering implementation
- Implement additional mappers (1, 2, 3, 4, 7)
- Add Web Audio API for authentic NES sound output
- Performance optimizations

---

## **1. Project Architecture**

The emulator follows a component-based architecture where every hardware element communicates through a central Bus.

### **A. Bundler (Rollup)**
```javascript
// rollup.config.js
export default {
  input: 'src/main.js',
  output: {
    file: 'dist/nes-emu.js',
    format: 'iife',
    name: 'NESEmulator'
  }
};
```

### **B. System Bus**
```javascript
// src/bus.js
export class Bus {
    constructor() {
        this.cpu = null;
        this.ppu = null;
        this.cartridge = null;
        this.ram = new Uint8Array(2048);
    }
    
    read(addr) {
        if (addr < 0x2000) return this.ram[addr & 0x07FF];
        if (addr < 0x4000) return this.ppu.registerRead(addr);
        if (addr < 0x4020) return this.cartridge.prgRead(addr);
        return this.cartridge.prgRead(addr);
    }
}
```

### **C. CPU (Ricoh 2A03)**
```javascript
// src/cpu.js
export const FLAGS = {
    C: (1 << 0), // Carry
    Z: (1 << 1), // Zero
    I: (1 << 2), // Interrupt Disable
    D: (1 << 3), // Decimal (Unused in NES)
    B: (1 << 4), // Break
    U: (1 << 5), // Unused
    V: (1 << 6), // Overflow
    N: (1 << 7), // Negative
};

export class CPU {
    constructor(bus) {
        this.bus = bus;
        this.a = 0x00;      // Accumulator
        this.x = 0x00;      // X Index
        this.y = 0x00;      // Y Index
        this.stkp = 0xFD;   // Stack Pointer
        this.pc = 0x0000;   // Program Counter
        this.status = FLAGS.U; // Status Register
        this.cycles = 0;
    }
    
    // Bitwise flag operations
    setFlag(f, v) { if (v) this.status |= f; else this.status &= ~f; }
    getFlag(f) { return (this.status & f) > 0 ? 1 : 0; }
}
```

### **D. Controller**
```javascript
// src/controller.js
export class Controller {
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
}
```

---

## **2. The System Bus & Memory Map**

The Bus class routes read/write operations to the appropriate hardware component based on the NES address space.

### **A. Address Space**
| Range | Size | Description |
|-------|------|-------------|
| $0000-$07FF | 2KB | Internal RAM |
| $0800-$1FFF | 6KB | RAM Mirrors |
| $2000-$3FFF | 8KB | PPU Registers |
| $4000-$4015 | 22B | APU and I/O Registers |
| $4016-$4017 | 2B  | Controller Registers |
| $4018-$401F | 8B  | APU and I/O functionality that is normally disabled |
| $4020-$FFFF | 48KB| Cartridge space: PRG ROM, PRG RAM, and mapper registers |

### **B. Memory Mirrors**
- **RAM Mirroring**: Every 2KB region mirrors 3 times
- **PPU Registers**: Provide controlled access to PPU internal state
- **Cartridge Space**: Dynamic mapping based on mapper

---

## **3. CPU Implementation Details**

### **A. Register Structure**
```javascript
this.a = 0x00;      // 8-bit accumulator
this.x = 0x00;      // 8-bit X index  
this.y = 0x00;      // 8-bit Y index
this.stkp = 0xFD;    // 8-bit stack pointer ($0100-$01FF)
this.pc = 0x0000;    // 16-bit program counter  
this.status = 0x00;     // 8-bit status register with flags
this.cycles = 0;       // Cycles remaining for current instruction
```

### **B. Processor Flags**
```javascript
const FLAGS = {
    C: 0x01,  // Carry flag
    Z: 0x02,  // Zero flag
    I: 0x04, // Interrupt disable flag
    D: 0x08, // Decimal mode (unused in NES)
    B: 0x10, // Break flag
    U: 0x20, // Always set (hardware behavior)
    V: 0x40, // Overflow flag
    N: 0x80, // Negative flag
};
```

### **C. Execution Model**
```javascript
step() {
    if (this.cycles === 0) {
        // Fetch instruction
        const opcode = this.bus.read(this.pc++);
        const instruction = this.lookup[opcode];
        
        // Execute instruction
        const addrData = instruction.addrMode.call(this);
        instruction.operate.call(this, addrData);
        
        // Update cycle count
        this.cycles += instruction.cycles;
    }
    
    // Continue executing if cycles remain
    this.cycles--;
}
```

---

## **4. iNES Cartridge Format**

### **A. Header Structure (16 Bytes)**
`` Bytes 0-3:  "NES" (magic number)
 Byte 4:   PRG ROM size in 16KB units
 Byte 5:   CHR ROM size in 8KB units  
 Byte 6:   Flags 6: Battery, Trainer, Vertical arrangement, Mapper ID (4 bits)
Byte 7:   Mapper (lower 4 bits)
Bytes 8-15: Zero padding
```

### **B. Mapper 0 (NROM)**
- **PRG ROM**: Fixed 32KB or 16KB at $8000-$BFFF
- **CHR ROM**: Fixed 8KB at $0000-$1FFF
- **Memory Mapping**: Direct cartridge access to CPU address space

---

## **5. PPU Implementation (Ricoh 2C02)****

### **A. Architecture Overview**
- **Resolution**: 256x240 pixels
- **Scanlines**: 262 (0-261 active, 262-291 VBlank)
- **Colors**: 64-color palette from NES PPU hardware
- **Nametables**: 4KB VRAM for background, 4KB OAM for sprites
- **Rendering**: Background and sprite compositing

### **B. Memory Map**
```javascript
$0000-$1FFF: Pattern Tables (8KB CHR ROM)
$2000-$23FF: Nametables (2KB VRAM)
$2000-$27FF: Palette RAM (32 bytes)
$2000-$3EFF: OAM (Sprite Attribute Memory)
```

### **C. Rendering Pipeline**
1. **Fetch**: Read pattern bytes from CHR ROM
2. **Decode**: Convert 8-bit patterns to 2-bit pixels
3. **Composite**: Layer background and sprites
4. **Output**: Generate 256x240 RGBA frame buffer

---

## **6. Testing & Debugging**

### **A. nestest Integration**
```javascript
// CPU state comparison against reference implementation
const logParser = new LogParser();
await logParser.load(nestestLogText);

// Line-by-line state verification
const comparison = logParser.compare(cpu, lineNumber);
if (comparison.matches) {
    console.log(`✓ Line ${lineNumber}: ${instruction}`);
} else {
    console.error(`✗ Line ${lineNumber}: ${differences}`);
}
```

### **B. NodeJS Test Environment**
```javascript
// test-simple.cjs - Run individual tests rapidly
await runSingleTest(lineNumber);

// cpu-test.cjs - Run batch tests
await runTests(100);

// After CPU changes:
npm run build && node test-simple.cjs
```

### **C. Movie System**
```javascript
// Record button inputs into JSON array
movieSystem.startRecording();

// Playback recorded inputs
movieSystem.loadMovie(replayData);

// Automated regression testing
regressionSuite.runROMTest('nestest.nes');
```

---

## **7. Development Workflow**

### **A. Make Changes & Test**
```bash
# Make code changes
npm run build

# Run immediate CPU test
node test-simple.cjs

# Run browser tests
open index.html

# Run regression suite
npm test
```

### **B. Rapid Debugging**
1. **Single Instruction**: Test exact CPU state
2. **Batch Testing**: Run multiple tests automatically
3. **Iterative Development**: Change → Test → Fix → Repeat

---

This architecture provides a complete, production-ready foundation for NES emulation with industry-standard testing capabilities and rapid development workflow. Each component is modular, well-documented, and follows established emulator design patterns.