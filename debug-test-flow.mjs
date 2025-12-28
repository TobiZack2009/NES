import { NES } from './src/nes.js';
import { loadROM } from './src/cartridge.js';
import { logParser } from './src/test/logParser.js';
import { readFileSync } from 'fs';
import { File } from 'buffer';

async function debugTestFlow() {
    console.log('🔍 Debugging test flow...');
    
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
    console.log(`Expected state before LDX (line 2):`);
    console.log(`  PC: $${expectedStateBefore.address.toString(16).padStart(4, '0').toUpperCase()}`);
    console.log(`  A: $${expectedStateBefore.A.toString(16).padStart(2, '0').toUpperCase()}`);
    console.log(`  X: $${expectedStateBefore.X.toString(16).padStart(2, '0').toUpperCase()}`);
    console.log(`  P: $${expectedStateBefore.P.toString(16).padStart(2, '0').toUpperCase()} (${expectedStateBefore.P.toString(2).padStart(8, '0')})`);
    console.log(`  Zero flag: ${!!(expectedStateBefore.P & 0x02)}`);
    
    // Set CPU to this state
    nes.cpu.setState(expectedStateBefore);
    
    console.log(`\nCPU state after setState:`);
    console.log(`  PC: $${nes.cpu.pc.toString(16).padStart(4, '0').toUpperCase()}`);
    console.log(`  A: $${nes.cpu.a.toString(16).padStart(2, '0').toUpperCase()}`);
    console.log(`  X: $${nes.cpu.x.toString(16).padStart(2, '0').toUpperCase()}`);
    console.log(`  P: $${nes.cpu.status.toString(16).padStart(2, '0').toUpperCase()} (${nes.cpu.status.toString(2).padStart(8, '0')})`);
    console.log(`  Zero flag: ${nes.cpu.getFlag(0x02)}`);
    
    // Step the CPU
    console.log(`\nStepping CPU...`);
    nes.step();
    
    console.log(`\nCPU state after step:`);
    console.log(`  PC: $${nes.cpu.pc.toString(16).padStart(4, '0').toUpperCase()}`);
    console.log(`  A: $${nes.cpu.a.toString(16).padStart(2, '0').toUpperCase()}`);
    console.log(`  X: $${nes.cpu.x.toString(16).padStart(2, '0').toUpperCase()}`);
    console.log(`  P: $${nes.cpu.status.toString(16).padStart(2, '0').toUpperCase()} (${nes.cpu.status.toString(2).padStart(8, '0')})`);
    console.log(`  Zero flag: ${nes.cpu.getFlag(0x02)}`);
    
    // Compare with expected state after (line 3)
    const expectedStateAfter = logParser.getState(3);
    console.log(`\nExpected state after LDX (line 3):`);
    console.log(`  PC: $${expectedStateAfter.address.toString(16).padStart(4, '0').toUpperCase()}`);
    console.log(`  A: $${expectedStateAfter.A.toString(16).padStart(2, '0').toUpperCase()}`);
    console.log(`  X: $${expectedStateAfter.X.toString(16).padStart(2, '0').toUpperCase()}`);
    console.log(`  P: $${expectedStateAfter.P.toString(16).padStart(2, '0').toUpperCase()} (${expectedStateAfter.P.toString(2).padStart(8, '0')})`);
    console.log(`  Zero flag: ${!!(expectedStateAfter.P & 0x02)}`);
    
    // Check comparison
    const comparison = logParser.compare(nes.cpu, 3);
    console.log(`\nComparison result: ${comparison.matches ? 'PASS' : 'FAIL'}`);
    if (!comparison.matches) {
        comparison.differences.forEach(diff => {
            console.log(`  ${diff.type} ${diff.name}: expected ${diff.expected}, got ${diff.actual}`);
        });
    }
}

debugTestFlow().catch(console.error);