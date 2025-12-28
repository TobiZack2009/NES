import { NES } from './src/nes.js';
import { loadROM } from './src/cartridge.js';
import { logParser } from './src/test/logParser.js';
import { readFileSync } from 'fs';
import { File } from 'buffer';

async function debugDirectComparison() {
    console.log('🔍 Debugging direct logParser comparison...');
    
    // Load test data
    const logText = readFileSync('./tests/nestest.log', 'utf8');
    await logParser.load(logText);
    
    const nes = new NES();
    const romData = readFileSync('./tests/nestest.nes');
    const romFile = new File([romData], 'nestest.nes');
    const cartridge = await loadROM(romFile);
    nes.loadCartridge(cartridge);
    
    // Test line 2 -> 3 (LDX instruction)
    const expectedStateBefore = logParser.getState(2);
    nes.cpu.setState(expectedStateBefore);
    nes.step(); // Execute LDX
    
    console.log(`After LDX #$00:`);
    console.log(`  CPU status: $${nes.cpu.status.toString(16).padStart(2, '0')} (${nes.cpu.status.toString(2).padStart(8, '0')})`);
    console.log(`  Zero flag: ${!!(nes.cpu.status & 0x02)}`);
    
    // Get expected state after
    const expectedStateAfter = logParser.getState(3);
    console.log(`  Expected P: $${expectedStateAfter.P.toString(16).padStart(2, '0')} (${expectedStateAfter.P.toString(2).padStart(8, '0')})`);
    console.log(`  Expected zero: ${!!(expectedStateAfter.P & 0x02)}`);
    
    // Manual comparison
    const cpuStatus = nes.cpu.status | 0x20;
    const expectedStatus = expectedStateAfter.P | 0x20;
    console.log(`\nManual comparison:`);
    console.log(`  CPU status with unused bit: $${cpuStatus.toString(16).padStart(2, '0')}`);
    console.log(`  Expected with unused bit: $${expectedStatus.toString(16).padStart(2, '0')}`);
    console.log(`  Match: ${cpuStatus === expectedStatus}`);
    
    // Use logParser comparison
    const comparison = logParser.compare(nes.cpu, 3);
    console.log(`\nLogParser compare result: ${comparison.matches}`);
    if (!comparison.matches) {
        comparison.differences.forEach(diff => {
            console.log(`  ${diff.type} ${diff.name}: expected ${diff.expected}, got ${diff.actual}`);
        });
    }
    
    // Test SEC instruction
    console.log(`\n=== Testing SEC ===`);
    const secStateBefore = logParser.getState(7);
    nes.cpu.setState(secStateBefore);
    nes.step(); // Execute SEC
    
    console.log(`After SEC:`);
    console.log(`  CPU status: $${nes.cpu.status.toString(16).padStart(2, '0')} (${nes.cpu.status.toString(2).padStart(8, '0')})`);
    console.log(`  Carry flag: ${!!(nes.cpu.status & 0x01)}`);
    
    const secStateAfter = logParser.getState(8);
    console.log(`  Expected P: $${secStateAfter.P.toString(16).padStart(2, '0')} (${secStateAfter.P.toString(2).padStart(8, '0')})`);
    console.log(`  Expected carry: ${!!(secStateAfter.P & 0x01)}`);
    
    const secComparison = logParser.compare(nes.cpu, 8);
    console.log(`\nSEC comparison result: ${secComparison.matches}`);
    if (!secComparison.matches) {
        secComparison.differences.forEach(diff => {
            console.log(`  ${diff.type} ${diff.name}: expected ${diff.expected}, got ${diff.actual}`);
        });
    }
}

debugDirectComparison().catch(console.error);