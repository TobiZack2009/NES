/**
 * Test utility functions for NES emulator testing
 */

/**
 * Convert hex string to integer
 */
export function hexToInt(hex) {
    if (typeof hex === 'string') {
        return parseInt(hex, 16);
    }
    return hex;
}

/**
 * Convert integer to hex string
 */
export function intToHex(num) {
    return '0x' + num.toString(16).toUpperCase();
}

/**
 * Create a simple test ROM buffer for testing
 */
export function createTestROM() {
    const header = new Uint8Array(16);
    
    // NES header format
    header[0] = 0x4E; // 'N'
    header[1] = 0x45; // 'E'  
    header[2] = 0x53; // 'S'
    header[3] = 0x1A; // EOF (0x1A)
    

    
    header[4] = 1; // 16KB PRG ROM
    header[5] = 1; // 8KB CHR ROM
    
    header[6] = 0; // Mapper 0, horizontal mirroring
    header[7] = 0; // No special flags
    
    // Clear remaining header bytes
    for (let i = 8; i < 16; i++) {
        header[i] = 0;
    }
    
    // Create simple PRG ROM (reset vector at $FFFC points to $8000)
    const prgRom = new Uint8Array(0x4000);
    prgRom[0] = 0xA9; // LDA #$42
    prgRom[1] = 0x42; // Immediate value
    prgRom[2] = 0x4C; // JMP to self
    prgRom[3] = 0x00; // Low byte
    prgRom[4] = 0x80; // High byte
    
    // Set reset vector (at $FFFC-$FFFD in CPU address space)
    // With 16KB PRG ROM, this maps to $C000-$FFFF range
    prgRom[0x3FFC] = 0x00; // Low byte of reset vector (points to $8000)
    prgRom[0x3FFD] = 0x80; // High byte of reset vector
    
    // Create simple CHR ROM
    const chrRom = new Uint8Array(0x2000);
    
    // Combine header and ROM data
    const rom = new Uint8Array(header.length + prgRom.length + chrRom.length);
    rom.set(header);
    rom.set(prgRom, header.length);
    rom.set(chrRom, header.length + prgRom.length);
    
    return rom;
}

/**
 * Helper to wait for a number of cycles
 */
export function waitForCycles(cpu, cycles) {
    let elapsed = 0;
    while (elapsed < cycles) {
        const cpuCycles = cpu.step();
        elapsed += cpuCycles;
    }
    return elapsed;
}