#!/usr/bin/env node

/**
 * Simple test runner for debugging
 */

import { NES } from '../../src/nes.js';
import { loadROM } from '../../src/cartridge.js';
import { logParser } from '../../src/test/logParser.js';
import { readFileSync } from 'fs';
import { File } from 'buffer';

async function main() {
    console.log('🧪 Quick CPU Test...');
    
    // Load nestest.log
    const logText = readFileSync('nestest.log', 'utf8');
    await logParser.load(logText);
    console.log(`✅ Loaded ${logParser.states.length} CPU states`);
    
    // Load nestest.nes ROM
    const romData = readFileSync('nestest.nes');
    const romFile = new File([romData], 'nestest.nes', { type: 'application/x-nes' });
    const cartridge = await loadROM(romFile);
    
    const nes = new NES();
    nes.loadCartridge(cartridge);
    
    // Reset and set PC to $C000
    nes.reset();
    nes.cpu.pc = 0xC000;
    
    // Run first 10 instructions
    for (let i = 1; i <= 10; i++) {
        const expectedState = logParser.getState(i);
        if (!expectedState) continue;
        
        nes.cpu.setState(expectedState);
        
        // Execute with proper cycle handling
        do {
            nes.step();
        } while (nes.cpu.cycles > 0);
        
        const comparison = logParser.compare(nes.cpu, i + 1);
        console.log(`${comparison.matches ? '✓' : '✗'} Line ${i}: ${expectedState.mnemonic} ${expectedState.operand}`);
    }
}

main().catch(console.error);