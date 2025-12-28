import { NES } from './src/nes.js';
import { loadROM } from './src/cartridge.js';
import { readFileSync } from 'fs';
import { File } from 'buffer';

async function debugMemoryAroundSTX() {
    console.log('🔍 Debugging memory around STX...');
    
    const nes = new NES();
    const romData = readFileSync('./tests/nestest.nes');
    const romFile = new File([romData], 'nestest.nes');
    const cartridge = await loadROM(romFile);
    nes.loadCartridge(cartridge);
    
    // Check memory around C5F7
    console.log(`Memory around $C5F7:`);
    for (let i = -2; i <= 4; i++) {
        const addr = 0xC5F7 + i;
        const byte = nes.bus.read(addr);
        console.log(`  $${addr.toString(16).padStart(4, '0').toUpperCase()}: $${byte.toString(16).padStart(2, '0').toUpperCase()}`);
    }
    
    // Check nestest log for STX instruction
    const logText = readFileSync('./tests/nestest.log', 'utf8');
    const lines = logText.split('\n');
    const stxLine = lines.find(line => line.includes('C5F7') && line.includes('STX'));
    if (stxLine) {
        console.log(`\nNestest log: ${stxLine.trim()}`);
    }
    
    // Debug the actual STX execution
    nes.cpu.pc = 0xC5F7;
    const opcode = nes.bus.read(nes.cpu.pc++);
    console.log(`\nRead opcode: $${opcode.toString(16).padStart(2, '0').toUpperCase()}`);
    console.log(`PC after opcode read: $${nes.cpu.pc.toString(16).padStart(4, '0').toUpperCase()}`);
    
    const operand = nes.bus.read(nes.cpu.pc++);
    console.log(`Read operand: $${operand.toString(16).padStart(2, '0').toUpperCase()}`);
    console.log(`PC after operand read: $${nes.cpu.pc.toString(16).padStart(4, '0').toUpperCase()}`);
    
    // Try ZPG addressing manually
    nes.cpu.pc = 0xC5F8; // Reset to after opcode
    const addr = nes.bus.read(nes.cpu.pc++);
    console.log(`Manual ZPG addressing result: $${addr.toString(16).padStart(2, '0').toUpperCase()}`);
}

debugMemoryAroundSTX().catch(console.error);