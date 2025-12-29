#!/usr/bin/env node

/**
 * Comprehensive CPU Test - finds and analyzes failures
 */

import { NES } from '../../src/nes.js';
import { loadROM } from '../../src/cartridge.js';
import { logParser } from '../../src/test/logParser.js';
import { readFileSync } from 'fs';
import { File } from 'buffer';

async function main() {
    console.log('🔍 Comprehensive CPU Test Analysis...\n');
    
    // Load nestest.log
    const logText = readFileSync('../nestest.log', 'utf8');
    await logParser.load(logText);
    console.log(`✅ Loaded ${logParser.states.length} CPU states from nestest.log\n`);
    
    // Load nestest.nes ROM
    const romData = readFileSync('../nestest.nes');
    const romFile = new File([romData], 'nestest.nes', { type: 'application/x-nes' });
    const cartridge = await loadROM(romFile);
    
    const nes = new NES();
    nes.loadCartridge(cartridge);
    
    // Reset and set PC to $C000 (start of automated test)
    nes.reset();
    nes.cpu.pc = 0xC000;
    
    const failures = [];
    const maxTests = 50; // Test first 50 instructions for now
    
    console.log('Running tests...\n');
    
    for (let i = 1; i <= maxTests; i++) {
        const expectedState = logParser.getState(i);
        if (!expectedState) {
            console.log(`⚠️  No expected state for line ${i}`);
            break;
        }
        
        // Set CPU to expected state BEFORE instruction execution
        nes.cpu.setState(expectedState);
        
        // Execute one instruction with proper cycle handling
        do {
            nes.step();
        } while (nes.cpu.cycles > 0);
        
        // Compare with expected next state
        const comparison = logParser.compare(nes.cpu, i + 1);
        
        if (!comparison.matches) {
            failures.push({
                line: i,
                instruction: `${expectedState.mnemonic} ${expectedState.operand}`,
                expected: expectedState,
                actual: nes.cpu,
                differences: comparison.differences
            });
        }
        
        // Show progress
        if (i % 10 === 0) {
            console.log(`Tested ${i} instructions, ${failures.length} failures so far`);
        }
    }
    
    console.log(`\n📊 Test Results:`);
    console.log(`Total instructions tested: ${Math.min(maxTests, logParser.states.length - 1)}`);
    console.log(`Failures found: ${failures.length}`);
    console.log(`Success rate: ${((maxTests - failures.length) / maxTests * 100).toFixed(1)}%\n`);
    
    if (failures.length > 0) {
        console.log('🔧 Detailed Failure Analysis (first 20 failures):');
        console.log('=' .repeat(80));
        
        failures.slice(0, 20).forEach((failure, index) => {
            console.log(`\n${index + 1}. Line ${failure.line}: ${failure.instruction}`);
            console.log(`   Address: $${failure.expected.address.toString(16).toUpperCase().padStart(4, '0')}`);
            
            console.log(`   Expected: A=$${failure.expected.A.toString(16).toUpperCase().padStart(2, '0')} ` +
                       `X=$${failure.expected.X.toString(16).toUpperCase().padStart(2, '0')} ` +
                       `Y=$${failure.expected.Y.toString(16).toUpperCase().padStart(2, '0')} ` +
                       `P=$${failure.expected.P.toString(16).toUpperCase().padStart(2, '0')} ` +
                       `SP=$${failure.expected.SP.toString(16).toUpperCase().padStart(2, '0')}`);
            
            console.log(`   Actual:   A=$${failure.actual.a.toString(16).toUpperCase().padStart(2, '0')} ` +
                       `X=$${failure.actual.x.toString(16).toUpperCase().padStart(2, '0')} ` +
                       `Y=$${failure.actual.y.toString(16).toUpperCase().padStart(2, '0')} ` +
                       `P=$${failure.actual.status.toString(16).toUpperCase().padStart(2, '0')} ` +
                       `SP=$${failure.actual.stkp.toString(16).toUpperCase().padStart(2, '0')}`);
            
            console.log(`   Differences:`);
            failure.differences.forEach(diff => {
                if (diff.type === 'register') {
                    console.log(`     Register ${diff.name}: expected $${diff.expected.toString(16).toUpperCase().padStart(2, '0')}, got $${diff.actual.toString(16).toUpperCase().padStart(2, '0')}`);
                } else if (diff.type === 'flag') {
                    console.log(`     Flag ${diff.name}: expected ${diff.expected}, got ${diff.actual}`);
                }
            });
        });
        
        // Analyze failure patterns
        console.log(`\n📈 Failure Pattern Analysis:`);
        const instructionsByType = {};
        failures.forEach(failure => {
            const mnemonic = failure.expected.mnemonic;
            if (!instructionsByType[mnemonic]) {
                instructionsByType[mnemonic] = 0;
            }
            instructionsByType[mnemonic]++;
        });
        
        Object.entries(instructionsByType).forEach(([mnemonic, count]) => {
            console.log(`   ${mnemonic}: ${count} failures`);
        });
        
        // Show failing flags pattern
        const flagFailures = failures.flatMap(f => f.differences.filter(d => d.type === 'flag').map(d => d.name));
        if (flagFailures.length > 0) {
            console.log(`\n🚩 Common flag failures:`);
            const flagCounts = {};
            flagFailures.forEach(flag => {
                flagCounts[flag] = (flagCounts[flag] || 0) + 1;
            });
            Object.entries(flagCounts).forEach(([flag, count]) => {
                console.log(`   ${flag}: ${count} times`);
            });
        }
    }
    
    return failures;
}

main().catch(console.error);
