import { NES } from './src/nes.js';
import { loadROM } from './src/cartridge.js';
import { readFileSync } from 'fs';
import { File } from 'buffer';

async function debugSEC() {
    console.log('🔍 Debugging SEC instruction...');
    
    const nes = new NES();
    const romData = readFileSync('./tests/nestest.nes');
    const romFile = new File([romData], 'nestest.nes');
    const cartridge = await loadROM(romFile);
    nes.loadCartridge(cartridge);
    
    // Set PC to SEC instruction address
    nes.cpu.pc = 0xC72E; // SEC instruction
    nes.cpu.status = 0x24; // Clear carry flag
    
    console.log(`Before SEC:`);
    console.log(`  PC: $${nes.cpu.pc.toString(16).padStart(4, '0').toUpperCase()}`);
    console.log(`  Status: $${nes.cpu.status.toString(16).padStart(2, '0')} (${nes.cpu.status.toString(2).padStart(8, '0')})`);
    console.log(`  Carry flag: ${!!(nes.cpu.status & 0x01)}`);
    
    // Read the opcode
    const opcode = nes.bus.read(nes.cpu.pc++);
    console.log(`  Opcode: $${opcode.toString(16).padStart(2, '0').toUpperCase()} (SEC)`);
    
    // Step CPU
    nes.step();
    
    console.log(`After SEC:`);
    console.log(`  PC: $${nes.cpu.pc.toString(16).padStart(4, '0').toUpperCase()}`);
    console.log(`  Status: $${nes.cpu.status.toString(16).padStart(2, '0')} (${nes.cpu.status.toString(2).padStart(8, '0')})`);
    console.log(`  Carry flag: ${!!(nes.cpu.status & 0x01)}`);
    console.log(`  Expected carry flag: true`);
}

debugSEC().catch(console.error);