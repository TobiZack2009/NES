import { NES } from './src/nes.js';
import { loadROM } from './src/cartridge.js';
import { logParser } from './src/test/logParser.js';
import { readFileSync } from 'fs';
import { File } from 'buffer';

// Simple test runner that stops at first failure
async function runSingleTest(lineNumber) {
    const expectedStateBefore = logParser.getState(lineNumber);
    if (!expectedStateBefore) {
        console.error(`❌ No expected state for line ${lineNumber}`);
        return;
    }
    
    const expectedStateAfter = logParser.getState(lineNumber + 1);
    if (!expectedStateAfter) {
        console.error(`❌ No expected state for line ${lineNumber + 1}`);
        return;
    }

    console.log(`\n🔍 Testing Line ${lineNumber}: ${expectedStateBefore.mnemonic} ${expectedStateBefore.operand}`);
    console.log(`   Address: $${expectedStateBefore.address.toString(16).toUpperCase().padStart(4, '0')}`);
    
    // Show current state
    const nes = new NES();
    const romData = readFileSync('./tests/nestest.nes');
    const romFile = new File([romData], 'nestest.nes');
    const cartridge = await loadROM(romFile);
    nes.loadCartridge(cartridge);
    nes.cpu.setState(expectedStateBefore);
    
    const stateBefore = nes.cpu.getState();
    console.log(`   Before: A=$${stateBefore.A.toString(16).padStart(2, '0').toUpperCase()} X=$${stateBefore.X.toString(16).padStart(2, '0').toUpperCase()} Y=$${stateBefore.Y.toString(16).padStart(2, '0').toUpperCase()} SP=$${stateBefore.SP.toString(16).padStart(2, '0').toUpperCase()} P=$${stateBefore.P.toString(16).padStart(2, '0').toUpperCase()}`);
    
    // Step CPU
    nes.step();
    
    // Show new state
    const stateAfter = nes.cpu.getState();
    console.log(`   After:  A=$${stateAfter.A.toString(16).padStart(2, '0').toUpperCase()} X=$${stateAfter.X.toString(16).padStart(2, '0').toUpperCase()} Y=$${stateAfter.Y.toString(16).padStart(2, '0').toUpperCase()} SP=$${stateAfter.SP.toString(16).padStart(2, '0').toUpperCase()} P=$${stateAfter.P.toString(16).padStart(2, '0').toUpperCase()}`);
    console.log(`   Expected: A=$${expectedStateAfter.A.toString(16).padStart(2, '0').toUpperCase()} X=$${expectedStateAfter.X.toString(16).padStart(2, '0').toUpperCase()} Y=$${expectedStateAfter.Y.toString(16).padStart(2, '0').toUpperCase()} SP=$${expectedStateAfter.SP.toString(16).padStart(2, '0').toUpperCase()} P=$${expectedStateAfter.P.toString(16).padStart(2, '0').toUpperCase()}`);
    
    // Compare
    const comparison = logParser.compare(nes.cpu, lineNumber + 1);
    if (comparison.matches) {
        console.log('   ✅ PASS');
    } else {
        console.log('   ❌ FAIL');
        comparison.differences.forEach(diff => {
            if (diff.type === 'register') {
                console.log(`      ${diff.name}: expected $${diff.expected.toString(16).padStart(2, '0').toUpperCase()}, got $${diff.actual.toString(16).padStart(2, '0').toUpperCase()}`);
            } else if (diff.type === 'flag') {
                console.log(`      flag ${diff.name}: expected ${diff.expected}, got ${diff.actual}`);
            }
        });
    }
    
    return comparison;
}

async function main() {
    console.log('🧪 Loading test data...');
    
    // Load nestest.log
    const logText = readFileSync('./tests/nestest.log', 'utf8');
    await logParser.load(logText);
    console.log(`✅ Loaded ${logParser.states.length} CPU states`);
    
    // Test first few instructions
    console.log('\n🎯 Running individual tests...');
    
    // Test first 3 instructions
    for (let i = 1; i <= 9000; i++) {
        console.log(`\n=== Test ${i} ===`);
        const result = await runSingleTest(i);
        if (!result.matches) {
            break;
        }
    }
}

main().catch(console.error);