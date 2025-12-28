import { NES } from './src/nes.js';
import { loadROM } from './src/cartridge.js';
import { readFileSync } from 'fs';
import { File } from 'buffer';

async function debugJSRBytes() {
    console.log('🔍 Debugging JSR bytes...');
    
    const nes = new NES();
    const romData = readFileSync('./tests/nestest.nes');
    const romFile = new File([romData], 'nestest.nes');
    const cartridge = await loadROM(romFile);
    nes.loadCartridge(cartridge);
    
    // Check JSR instruction bytes
    console.log(`JSR instruction bytes at $C5FD:`);
    for (let i = 0; i < 3; i++) {
        const addr = 0xC5FD + i;
        const byte = nes.bus.read(addr);
        console.log(`  $${addr.toString(16).padStart(4, '0').toUpperCase()}: $${byte.toString(16).padStart(2, '0').toUpperCase()}`);
    }
    
    // Let me check what the nestest log says
    const logText = readFileSync('./tests/nestest.log', 'utf8');
    const lines = logText.split('\n');
    
    // Find line with C5FD
    const c5fdLine = lines.find(line => line.includes('C5FD'));
    if (c5fdLine) {
        console.log(`\nNestest log line: ${c5fdLine.trim()}`);
    }
    
    // Check if JSR is working properly now
    nes.cpu.pc = 0xC5FD;
    nes.cpu.stkp = 0xFD;
    
    console.log(`\nBefore JSR: PC=$${nes.cpu.pc.toString(16).padStart(4, '0').toUpperCase()} SP=$${nes.cpu.stkp.toString(16).padStart(2, '0').toUpperCase()}`);
    nes.step();
    console.log(`After JSR: PC=$${nes.cpu.pc.toString(16).padStart(4, '0').toUpperCase()} SP=$${nes.cpu.stkp.toString(16).padStart(2, '0').toUpperCase()}`);
    
    // Step a few more times to see if we reach SEC
    for (let i = 0; i < 5; i++) {
        const pc = nes.cpu.pc;
        const opcode = nes.bus.read(pc);
        const instruction = nes.cpu.lookup[opcode];
        console.log(`Step ${i+1}: PC=$${pc.toString(16).padStart(4, '0').toUpperCase()} Opcode=$${opcode.toString(16).padStart(2, '0').toUpperCase()} ${instruction ? instruction.name : '???'}`);
        nes.step();
    }
}

debugJSRBytes().catch(console.error);