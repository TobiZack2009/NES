import { NES } from './src/nes.js';
import { loadROM } from './src/cartridge.js';
import { logParser } from './src/test/logParser.js';
import { readFileSync } from 'fs';
import { File } from 'buffer';

async function debugGetState() {
    console.log('🔍 Debugging getState()...');
    
    // Load test data
    const logText = readFileSync('./tests/nestest.log', 'utf8');
    await logParser.load(logText);
    
    const nes = new NES();
    const romData = readFileSync('./tests/nestest.nes');
    const romFile = new File([romData], 'nestest.nes');
    const cartridge = await loadROM(romFile);
    nes.loadCartridge(cartridge);
    
    // Get state for line 2 (before LDX instruction)
    const expectedStateBefore = logParser.getState(2);
    console.log(`Expected state (line 2):`);
    console.log(`  PC: $${expectedStateBefore.address.toString(16).padStart(4, '0').toUpperCase()}`);
    console.log(`  A: $${expectedStateBefore.A.toString(16).padStart(2, '0').toUpperCase()}`);
    console.log(`  X: $${expectedStateBefore.X.toString(16).padStart(2, '0').toUpperCase()}`);
    console.log(`  P: $${expectedStateBefore.P.toString(16).padStart(2, '0').toUpperCase()}`);
    
    // Set CPU to this state
    nes.cpu.setState(expectedStateBefore);
    
    // Check what getState() returns
    const cpuState = nes.cpu.getState();
    console.log(`\nCPU getState() returns:`);
    console.log(`  A: ${cpuState.A} (expected: ${expectedStateBefore.A})`);
    console.log(`  X: ${cpuState.X} (expected: ${expectedStateBefore.X})`);
    console.log(`  Y: ${cpuState.Y} (expected: ${expectedStateBefore.Y})`);
    console.log(`  SP: ${cpuState.SP} (expected: ${expectedStateBefore.SP})`);
    console.log(`  P: ${cpuState.P} (expected: ${expectedStateBefore.P})`);
    console.log(`  PC: ${cpuState.PC} (expected: ${expectedStateBefore.address})`);
    
    // Step the CPU
    nes.step();
    
    // Get state after
    const stateAfter = nes.cpu.getState();
    const expectedStateAfter = logParser.getState(3);
    
    console.log(`\nAfter step:`);
    console.log(`  CPU P: ${stateAfter.P} (binary: ${stateAfter.P.toString(2).padStart(8, '0')})`);
    console.log(`  Expected P: ${expectedStateAfter.P} (binary: ${expectedStateAfter.P.toString(2).padStart(8, '0')})`);
    
    // Manual flag comparison
    const cpuZero = !!(stateAfter.P & 0x02);
    const expectedZero = !!(expectedStateAfter.P & 0x02);
    console.log(`  CPU zero flag: ${cpuZero}`);
    console.log(`  Expected zero flag: ${expectedZero}`);
    
    // Test logParser comparison
    const comparison = logParser.compare(nes.cpu, 3);
    console.log(`\nLogParser comparison: ${comparison.matches ? 'PASS' : 'FAIL'}`);
    if (!comparison.matches) {
        comparison.differences.forEach(diff => {
            console.log(`  ${diff.type} ${diff.name}: expected ${diff.expected}, got ${diff.actual}`);
        });
    }
}

debugGetState().catch(console.error);