const { NES } = require('./src/nes.js');
const { loadROM } = require('./src/cartridge.js');  
const { logParser } = require('./src/test/logParser.js');
const { readFileSync } = require('fs');

// Simple test runner that stops at first failure
async function runSingleTest(lineNumber) {
    const expectedState = logParser.getState(lineNumber);
    if (!expectedState) {
        console.error(`❌ No expected state for line ${lineNumber}`);
        return;
    }
    
    console.log(`\n🔍 Testing Line ${lineNumber}: ${expectedState.mnemonic} ${expectedState.operand}`);
    console.log(`   Address: $${expectedState.address.toString(16).toUpperCase().padStart(4, '0')}`);
    
    // Show current state
    const nes = new NES();
    const romData = readFileSync('./tests/nestest.nes');
    const romFile = new File([romData], 'nestest.nes', { type: 'application/x-nes' });
    const cartridge = await loadROM(romFile);
    nes.loadCartridge(cartridge);
    nes.cpu.pc = expectedState.address; // Set to exact address
    
    const stateBefore = nes.cpu.getState();
    console.log(`   Before: A=$${stateBefore.a.toString(16).padStart(2, '0').toUpperCase()} X=$${stateBefore.x.toString(16).padStart(2, '0').toUpperCase()} Y=$${stateBefore.y.toString(16).padStart(2, '0').toUpperCase()} SP=$${stateBefore.stkp.toString(16).padStart(2, '0').toUpperCase()} P=$${stateBefore.status.toString(16).padStart(2, '0').toUpperCase()}`);
    
    // Step CPU
    nes.step();
    
    // Show new state
    const stateAfter = nes.cpu.getState();
    console.log(`   After:  A=$${stateAfter.a.toString(16).padStart(2, '0').toUpperCase()} X=$${stateAfter.x.toString(16).padStart(2, '0').toUpperCase()} Y=$${stateAfter.y.toString(16).padStart(2, '0').toUpperCase()} SP=$${stateAfter.stkp.toString(16).padStart(2, '0').toUpperCase()} P=$${stateAfter.status.toString(16).padStart(2, '0').toUpperCase()}`);
    console.log(`   Expected: A=$${expectedState.A.toString(16).padStart(2, '0').toUpperCase()} X=$${expectedState.X.toString(16).padStart(2, '0').toUpperCase()} Y=$${expectedState.Y.toString(16).padStart(2, '0').toUpperCase()} SP=$${expectedState.SP.toString(16).padStart(2, '0').toUpperCase()} P=$${expectedState.P.toString(16).padStart(2, '0').toUpperCase()}`);
    
    // Compare
    const comparison = logParser.compare(nes.cpu, lineNumber);
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
    for (let i = 1; i <= 3; i++) {
        console.log(`\n=== Test ${i} ===`);
        await runSingleTest(i);
    }
}

if (require.main === module) {
    main().catch(console.error);
}