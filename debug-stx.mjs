import { NES } from './src/nes.js';
import { loadROM } from './src/cartridge.js';
import { readFileSync } from 'fs';
import { File } from 'buffer';

async function debugSTX() {
    console.log('🔍 Debugging STX instruction...');
    
    const nes = new NES();
    const romData = readFileSync('./tests/nestest.nes');
    const romFile = new File([romData], 'nestest.nes');
    const cartridge = await loadROM(romFile);
    nes.loadCartridge(cartridge);
    
    // Set up STX $00 instruction at $C5F7
    nes.cpu.pc = 0xC5F7;
    nes.cpu.x = 0x00;
    nes.cpu.status = 0x26;
    
    console.log(`Before STX:`);
    console.log(`  PC: $${nes.cpu.pc.toString(16).padStart(4, '0').toUpperCase()}`);
    
    // Check instruction bytes
    const opcode = nes.bus.read(0xC5F7);
    const operand = nes.bus.read(0xC5F8);
    console.log(`  Instruction: $${opcode.toString(16).padStart(2, '0').toUpperCase()} $${operand.toString(16).padStart(2, '0').toUpperCase()} (STX $${
operand.toString(16).padStart(2, '0').toUpperCase()})`);
    
    // Use full CPU step() to go through clock()
    nes.step();
    
    console.log(`  PC after full step: $${nes.cpu.pc.toString(16).padStart(4, '0').toUpperCase()}`);
    
    // Check what should happen in next step
    const nextOpcode = nes.bus.read(nes.cpu.pc);
    const nextInstruction = nes.cpu.lookup[nextOpcode];
    console.log(`  Next instruction: $${nextOpcode.toString(16).padStart(2, '0').toUpperCase()} (${nextInstruction ? nextInstruction.name : '???'})`);
}

debugSTX().catch(console.error);