import { NES } from './src/nes.js';
import { loadROM } from './src/cartridge.js';
import { readFileSync } from 'fs';
import { File } from 'buffer';

async function debugFlags() {
    console.log('🔍 Debugging flag setting...');
    
    const nes = new NES();
    const romData = readFileSync('./tests/nestest.nes');
    const romFile = new File([romData], 'nestest.nes');
    const cartridge = await loadROM(romFile);
    nes.loadCartridge(cartridge);
    
    // Set up initial state like nestest
    nes.cpu.pc = 0xC5F5; // LDX #$00 instruction
    nes.cpu.a = 0x00;
    nes.cpu.x = 0x01; // Start with non-zero X
    nes.cpu.y = 0x00;
    nes.cpu.stkp = 0xFD;
    nes.cpu.status = 0x24; // Binary: 00100100
    
    console.log(`Before LDX #$00:`);
    console.log(`  X = $${nes.cpu.x.toString(16).padStart(2, '0').toUpperCase()}`);
    console.log(`  Status = $${nes.cpu.status.toString(16).padStart(2, '0').toUpperCase()} (${nes.cpu.status.toString(2).padStart(8, '0')})`);
    console.log(`  Zero flag = ${nes.cpu.getFlag(0x02)}`);
    
    // Execute LDX #$00
    nes.step();
    
    console.log(`After LDX #$00:`);
    console.log(`  X = $${nes.cpu.x.toString(16).padStart(2, '0').toUpperCase()}`);
    console.log(`  Status = $${nes.cpu.status.toString(16).padStart(2, '0').toUpperCase()} (${nes.cpu.status.toString(2).padStart(8, '0')})`);
    console.log(`  Zero flag = ${nes.cpu.getFlag(0x02)}`);
    console.log(`  Expected zero flag = 1 (true)`);
}

debugFlags().catch(console.error);