import { NES } from './src/nes.js';
import { loadROM } from './src/cartridge.js';
import { readFileSync } from 'fs';
import { File } from 'buffer';

async function debugJSR() {
    console.log('🔍 Debugging JSR instruction...');
    
    const nes = new NES();
    const romData = readFileSync('./tests/nestest.nes');
    const romFile = new File([romData], 'nestest.nes');
    const cartridge = await loadROM(romFile);
    nes.loadCartridge(cartridge);
    
    // Set up JSR instruction: JSR $C72D
    nes.cpu.pc = 0xC5FD; // JSR instruction
    nes.cpu.stkp = 0xFD; // Start with typical stack pointer
    nes.cpu.status = 0x24;
    
    console.log(`Before JSR:`);
    console.log(`  PC: $${nes.cpu.pc.toString(16).padStart(4, '0').toUpperCase()}`);
    console.log(`  SP: $${nes.cpu.stkp.toString(16).padStart(2, '0').toUpperCase()}`);
    
    // Check JSR instruction bytes
    const jsrOpcode = nes.bus.read(0xC5FD);
    const addrLo = nes.bus.read(0xC5FE);
    const addrHi = nes.bus.read(0xC5FF);
    const targetAddr = (addrHi << 8) | addrLo;
    console.log(`  JSR instruction: $${jsrOpcode.toString(16)} $${addrLo.toString(16)} $${addrHi.toString(16)} -> $${targetAddr.toString(16).padStart(4, '0').toUpperCase()}`);
    
    // Execute JSR
    nes.step();
    
    console.log(`\nAfter JSR:`);
    console.log(`  PC: $${nes.cpu.pc.toString(16).padStart(4, '0').toUpperCase()}`);
    console.log(`  SP: $${nes.cpu.stkp.toString(16).padStart(2, '0').toUpperCase()}`);
    console.log(`  Expected PC: $C72D`);
    console.log(`  Expected SP: $FB`);
    
    // Check stack contents
    console.log(`\nStack contents:`);
    for (let i = 0; i < 4; i++) {
        const addr = 0x0100 + 0xFD - i;
        const val = nes.bus.read(addr);
        console.log(`  $${addr.toString(16).padStart(4, '0').toUpperCase()}: $${val.toString(16).padStart(2, '0').toUpperCase()}`);
    }
    
    // Check what JSR implementation does
    console.log(`\nDebugging JSR implementation...`);
    nes.cpu.pc = 0xC5FD;
    nes.cpu.stkp = 0xFD;
    
    const opcode = nes.bus.read(nes.cpu.pc++);
    console.log(`Opcode: $${opcode.toString(16)}`);
    
    // Manually step through JSR logic
    console.log(`PC before decrement: $${nes.cpu.pc.toString(16)}`);
    nes.cpu.pc--; // JSR does pc--
    console.log(`PC after decrement: $${nes.cpu.pc.toString(16)}`);
    
    console.log(`Pushing high byte: $${(nes.cpu.pc >> 8 & 0xFF).toString(16)}`);
    nes.cpu.push(nes.cpu.pc >> 8 & 0xFF);
    console.log(`SP after high push: $${nes.cpu.stkp.toString(16)}`);
    
    console.log(`Pushing low byte: $${(nes.cpu.pc & 0xFF).toString(16)}`);
    nes.cpu.push(nes.cpu.pc & 0xFF);
    console.log(`SP after low push: $${nes.cpu.stkp.toString(16)}`);
    
    // Read target address
    const lo = nes.bus.read(nes.cpu.pc++);
    const hi = nes.bus.read(nes.cpu.pc++);
    const addr = (hi << 8) | lo;
    console.log(`Target address: $${addr.toString(16).padStart(4, '0').toUpperCase()}`);
    
    nes.cpu.pc = addr;
    console.log(`Final PC: $${nes.cpu.pc.toString(16).padStart(4, '0').toUpperCase()}`);
}

debugJSR().catch(console.error);