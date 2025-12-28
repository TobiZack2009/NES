import { NES } from './src/nes.js';
import { loadROM } from './src/cartridge.js';
import { readFileSync } from 'fs';
import { File } from 'buffer';

async function debugMemory() {
    console.log('🔍 Debugging memory at SEC instruction...');
    
    const nes = new NES();
    const romData = readFileSync('./tests/nestest.nes');
    const romFile = new File([romData], 'nestest.nes');
    const cartridge = await loadROM(romFile);
    nes.loadCartridge(cartridge);
    
    // Check what's at the SEC instruction address
    const addr = 0xC72E;
    const opcode = nes.bus.read(addr);
    console.log(`At address $${addr.toString(16).padStart(4, '0').toUpperCase()}: $${opcode.toString(16).padStart(2, '0').toUpperCase()}`);
    
    // Let's also check around that area
    for (let i = addr - 4; i <= addr + 4; i++) {
        const byte = nes.bus.read(i);
        console.log(`$${i.toString(16).padStart(4, '0').toUpperCase()}: $${byte.toString(16).padStart(2, '0').toUpperCase()}`);
    }
    
    // Let's manually step through from earlier to see where we end up
    console.log(`\nStepping from JSR...`);
    nes.cpu.pc = 0xC5FD; // JSR instruction
    for (let i = 0; i < 5; i++) {
        const opcode = nes.bus.read(nes.cpu.pc);
        const instruction = nes.cpu.lookup[opcode];
        console.log(`Step ${i}: PC=$${nes.cpu.pc.toString(16).padStart(4, '0').toUpperCase()} Opcode=$${opcode.toString(16).padStart(2, '0').toUpperCase()} ${instruction ? instruction.name : '???'}`);
        nes.step();
    }
}

debugMemory().catch(console.error);