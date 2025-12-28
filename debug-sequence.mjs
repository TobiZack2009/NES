import { NES } from './src/nes.js';
import { loadROM } from './src/cartridge.js';
import { logParser } from './src/test/logParser.js';
import { readFileSync } from 'fs';
import { File } from 'buffer';

async function debugTestSequence() {
    console.log('🔍 Debugging test sequence as it should run...');
    
    // Load test data
    const logText = readFileSync('./tests/nestest.log', 'utf8');
    await logParser.load(logText);
    
    const nes = new NES();
    const romData = readFileSync('./tests/nestest.nes');
    const romFile = new File([romData], 'nestest.nes');
    const cartridge = await loadROM(romFile);
    nes.loadCartridge(cartridge);
    
    // Start at C000 like nestest
    nes.cpu.pc = 0xC000;
    nes.cpu.status = 0x24; // Initial status
    
    console.log(`Starting continuous execution...`);
    
    // Run through the first few instructions
    for (let i = 0; i < 10; i++) {
        const pc = nes.cpu.pc;
        const opcode = nes.bus.read(pc);
        const instruction = nes.cpu.lookup[opcode];
        
        console.log(`Step ${i}: PC=$${pc.toString(16).padStart(4, '0').toUpperCase()} Opcode=$${opcode.toString(16).padStart(2, '0').toUpperCase()} ${instruction ? instruction.name : '???'}`);
        
        // Before state
        const stateBefore = nes.cpu.getState();
        
        // Step CPU until instruction completes
        do {
            nes.step();
        } while (nes.cpu.cycles > 0);
        
        // After state
        const stateAfter = nes.cpu.getState();
        
        // Compare with expected log
        const expectedState = logParser.getStateByAddress(pc);
        if (expectedState) {
            const nextExpectedState = logParser.getStateByAddress(nes.cpu.pc);
            if (nextExpectedState) {
                const matches = (stateAfter.P | 0x20) === (nextExpectedState.P | 0x20);
                console.log(`  Expected at $${nes.cpu.pc.toString(16).padStart(4, '0').toUpperCase()}: P=$${nextExpectedState.P.toString(16).padStart(2, '0').toUpperCase()}, Got: P=$${stateAfter.P.toString(16).padStart(2, '0').toUpperCase()}, Match: ${matches ? 'YES' : 'NO'}`);
                
                if (!matches) {
                    console.log(`  Details: Expected zero=${!!(nextExpectedState.P & 0x02)}, got zero=${!!(stateAfter.P & 0x02)}`);
                }
            }
        }
        
        // Stop if we get stuck
        if (i > 2 && pc === nes.cpu.pc) {
            console.log(`  🚨 CPU STUCK at $${pc.toString(16).padStart(4, '0').toUpperCase()}`);
            console.log(`  Previous PC was: $${pc.toString(16).padStart(4, '0').toUpperCase()}`);
            console.log(`  Current PC is: $${nes.cpu.pc.toString(16).padStart(4, '0').toUpperCase()}`);
            console.log(`  These should be different!`);
            break;
        }
    }
}

debugTestSequence().catch(console.error);