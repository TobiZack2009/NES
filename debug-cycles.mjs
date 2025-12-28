import { NES } from './src/nes.js';
import { loadROM } from './src/cartridge.js';
import { readFileSync } from 'fs';
import { File } from 'buffer';

async function debugCycles() {
    console.log('🔍 Debugging CPU cycles...');
    
    const nes = new NES();
    const romData = readFileSync('./tests/nestest.nes');
    const romFile = new File([romData], 'nestest.nes');
    const cartridge = await loadROM(romFile);
    nes.loadCartridge(cartridge);
    
    // Set up STX instruction
    nes.cpu.pc = 0xC5F7;
    nes.cpu.cycles = 0; // Ensure cycles is 0
    
    console.log(`Before clock(): cycles=${nes.cpu.cycles}, pc=$${nes.cpu.pc.toString(16).padStart(4, '0').toUpperCase()}`);
    
    // Execute one clock cycle
    nes.bus.clock();
    
    console.log(`After clock(): cycles=${nes.cpu.cycles}, pc=$${nes.cpu.pc.toString(16).padStart(4, '0').toUpperCase()}`);
    
    // Keep calling clock() to see when instruction completes
    for (let i = 0; i < 10; i++) {
        console.log(`Clock ${i}: cycles=${nes.cpu.cycles}, pc=$${nes.cpu.pc.toString(16).padStart(4, '0').toUpperCase()}`);
        nes.bus.clock();
        if (nes.cpu.cycles === 0) {
            console.log(`  -> Instruction completed`);
            break;
        }
    }
    
    // Try step() method
    console.log(`\nTrying step() method...`);
    nes.cpu.pc = 0xC5F7;
    nes.cpu.cycles = 0;
    nes.step();
    console.log(`After step(): cycles=${nes.cpu.cycles}, pc=$${nes.cpu.pc.toString(16).padStart(4, '0').toUpperCase()}`);
}

debugCycles().catch(console.error);