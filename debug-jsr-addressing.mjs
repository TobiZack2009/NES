import { NES } from './src/nes.js';
import { loadROM } from './src/cartridge.js';
import { readFileSync } from 'fs';
import { File } from 'buffer';

async function debugJSRAddressing() {
    console.log('🔍 Debugging JSR addressing mode...');
    
    const nes = new NES();
    const romData = readFileSync('./tests/nestest.nes');
    const romFile = new File([romData], 'nestest.nes');
    const cartridge = await loadROM(romFile);
    nes.loadCartridge(cartridge);
    
    // Set up JSR instruction
    nes.cpu.pc = 0xC5FD;
    
    // Manually debug addressing mode
    console.log(`Before addressing mode: PC = $${nes.cpu.pc.toString(16).padStart(4, '0').toUpperCase()}`);
    
    // Execute ABS addressing mode manually
    const lo = nes.bus.read(nes.cpu.pc++);
    const hi = nes.bus.read(nes.cpu.pc++);
    const addr = (hi << 8) | lo;
    
    console.log(`After addressing mode: PC = $${nes.cpu.pc.toString(16).padStart(4, '0').toUpperCase()}`);
    console.log(`Read bytes: $${lo.toString(16).padStart(2, '0').toUpperCase()} $${hi.toString(16).padStart(2, '0').toUpperCase()}`);
    console.log(`Target address: $${addr.toString(16).padStart(4, '0').toUpperCase()}`);
    
    // Reset and step through CPU
    nes.cpu.pc = 0xC5FD;
    console.log(`\nStepping CPU...`);
    const opcode = nes.bus.read(nes.cpu.pc++);
    const instruction = nes.cpu.lookup[opcode];
    console.log(`Instruction: ${instruction.name}`);
    
    const addrData = instruction.addrMode.call(nes.cpu);
    console.log(`Addressing mode result: $${addrData.addr.toString(16).padStart(4, '0').toUpperCase()}`);
    console.log(`PC after addressing: $${nes.cpu.pc.toString(16).padStart(4, '0').toUpperCase()}`);
    
    // Execute JSR operation
    instruction.operate.call(nes.cpu, addrData);
    console.log(`PC after JSR: $${nes.cpu.pc.toString(16).padStart(4, '0').toUpperCase()}`);
}

debugJSRAddressing().catch(console.error);