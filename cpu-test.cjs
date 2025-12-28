/**
 * CPU Test Runner - NodeJS Environment
 * Runs nestest comparison tests directly in NodeJS for rapid iteration
 */

const { NES } = require('./src/nes.js');
const { loadROM } = require('./src/cartridge.js');  
const { logParser } = require('./src/test/logParser.js');
const { readFileSync } = require('fs');

class CPUTestRunner {
    constructor() {
        this.nes = null;
        this.logParser = logParser;
        this.testResults = [];
    }

    async initialize() {
        console.log('🔧 Initializing CPU Test Environment...');
        
        // Create NES instance
        this.nes = new NES();
        
        // Load nestest.log
        const logText = readFileSync('./tests/nestest.log', 'utf8');
        await this.logParser.load(logText);
        console.log(`✅ Loaded ${this.logParser.states.length} CPU states from nestest.log`);
        
        // Load nestest.nes ROM
        const romData = readFileSync('./tests/nestest.nes');
        const romFile = new File([romData], 'nestest.nes', { type: 'application/x-nes' });
        const cartridge = await loadROM(romFile);
        this.nes.loadCartridge(cartridge);
        
        // Set PC to C000 (start of nestest)
        this.nes.cpu.pc = 0xC000;
        console.log('✅ Loaded nestest.nes ROM and set PC to $C000');
    }

    async runTests(maxTests = 100) {
        console.log(`\n🧪 Running ${maxTests} CPU tests...`);
        this.testResults = [];
        
        let passed = 0;
        let failed = 0;
        
        for (let i = 1; i <= Math.min(maxTests, this.logParser.states.length); i++) {
            const expectedState = this.logParser.getState(i);
            if (!expectedState) {
                console.warn(`⚠️  No expected state for line ${i}`);
                continue;
            }
            
            // Set CPU to expected state BEFORE stepping
            this.nes.cpu.setState(expectedState);
            
            // Step CPU one instruction (handle multiple cycles)
            do {
                this.nes.step();
            } while (this.nes.cpu.cycles > 0);
            
            // Get state AFTER stepping  
            const stateAfter = this.nes.cpu.getState();
            
            // Compare with expected from the next line
            const comparison = this.logParser.compare(this.nes.cpu, i + 1);
            
            const result = {
                lineNumber: i,
                instruction: expectedState.mnemonic + ' ' + expectedState.operand,
                address: '$' + expectedState.address.toString(16).toUpperCase().padStart(4, '0'),
                matches: comparison.matches,
                expected: {
                    A: expectedState.A,
                    X: expectedState.X, 
                    Y: expectedState.Y,
                    SP: expectedState.SP,
                    P: expectedState.P.toString(16).toUpperCase().padStart(2, '0')
                },
                actual: {
                    A: stateAfter.A,
                    X: stateAfter.X,
                    Y: stateAfter.Y, 
                    SP: stateAfter.SP,
                    P: stateAfter.P.toString(16).toUpperCase().padStart(2, '0')
                },
                differences: comparison.differences
            };
            
            this.testResults.push(result);
            
            if (comparison.matches) {
                passed++;
                process.stdout.write('✓');
            } else {
                failed++;
                process.stdout.write('✗');
                // Show first few failures in detail
                if (failed <= 5) {
                    console.log(`\n❌ Line ${i}: ${result.instruction} at ${result.address}`);
                    result.differences.forEach(diff => {
                        if (diff.type === 'register') {
                            console.log(`   ${diff.name}: expected $${diff.expected.toString(16).padStart(2, '0').toUpperCase()}, got $${diff.actual.toString(16).padStart(2, '0').toUpperCase()}`);
                        } else if (diff.type === 'flag') {
                            console.log(`   flag ${diff.name}: expected ${diff.expected}, got ${diff.actual}`);
                        }
                    });
                    console.log(`   Expected P: $${result.expected.P}, Actual P: $${result.actual.P}`);
                }
            }
            
            // Add newline every 10 tests for readability
            if (i % 10 === 0) {
                console.log(`\n  Progress: ${i}/${maxTests} - Passed: ${passed}, Failed: ${failed}`);
            }
        }
        
        console.log(`\n🏁 Test Results: Total: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`);
        return this.testResults;
    }

    async runSingleTest(lineNumber) {
        const expectedState = this.logParser.getState(lineNumber);
        if (!expectedState) {
            console.error(`❌ No expected state for line ${lineNumber}`);
            return;
        }
        
        console.log(`\n🔍 Running single test - Line ${lineNumber}: ${expectedState.mnemonic} ${expectedState.operand}`);
        console.log(`   Address: $${expectedState.address.toString(16).toUpperCase().padStart(4, '0')}`);
        
        // Show current state
        const stateBefore = this.nes.cpu.getState();
        console.log(`   Before: A=$${stateBefore.A.toString(16).padStart(2, '0').toUpperCase()} X=$${stateBefore.X.toString(16).padStart(2, '0').toUpperCase()} Y=$${stateBefore.Y.toString(16).padStart(2, '0').toUpperCase()} SP=$${stateBefore.SP.toString(16).padStart(2, '0').toUpperCase()} P=$${stateBefore.P.toString(16).padStart(2, '0').toUpperCase()}`);
        
        // Step the CPU
        this.nes.step();
        
        // Show new state
        const stateAfter = this.nes.cpu.getState();
        console.log(`   After:  A=$${stateAfter.A.toString(16).padStart(2, '0').toUpperCase()} X=$${stateAfter.X.toString(16).padStart(2, '0').toUpperCase()} Y=$${stateAfter.Y.toString(16).padStart(2, '0').toUpperCase()} SP=$${stateAfter.SP.toString(16).padStart(2, '0').toUpperCase()} P=$${stateAfter.P.toString(16).padStart(2, '0').toUpperCase()}`);
        console.log(`   Expected: A=$${expectedState.A.toString(16).padStart(2, '0').toUpperCase()} X=$${expectedState.X.toString(16).padStart(2, '0').toUpperCase()} Y=$${expectedState.Y.toString(16).padStart(2, '0').toUpperCase()} SP=$${expectedState.SP.toString(16).padStart(2, '0').toUpperCase()} P=$${expectedState.P.toString(16).padStart(2, '0').toUpperCase()}`);
        
        // Compare
        const comparison = this.logParser.compare(this.nes.cpu, lineNumber + 1);
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

    analyzeFailures(results = this.testResults) {
        const failures = results.filter(r => !r.matches);
        console.log(`\n🔍 Analyzing ${failures.length} failures...`);
        
        // Group by type of difference
        const flagIssues = [];
        const registerIssues = [];
        
        failures.forEach(failure => {
            failure.differences.forEach(diff => {
                if (diff.type === 'flag') {
                    flagIssues.push({
                        line: failure.lineNumber,
                        flag: diff.name,
                        expected: diff.expected,
                        actual: diff.actual,
                        instruction: failure.instruction
                    });
                } else if (diff.type === 'register') {
                    registerIssues.push({
                        line: failure.lineNumber,
                        register: diff.name,
                        expected: diff.expected,
                        actual: diff.actual,
                        instruction: failure.instruction
                    });
                }
            });
        });
        
        // Show flag issues summary
        if (flagIssues.length > 0) {
            console.log('\n🚩 Flag Issues:');
            const flagCounts = {};
            flagIssues.forEach(issue => {
                const key = `${issue.flag} (expected: ${issue.expected} got: ${issue.actual})`;
                flagCounts[key] = (flagCounts[key] || 0) + 1;
            });
            
            Object.entries(flagCounts).forEach(([issue, count]) => {
                console.log(`   ${issue}: ${count} occurrences`);
            });
            
            console.log('\nFirst few flag issues:');
            flagIssues.slice(0, 5).forEach(issue => {
                console.log(`   Line ${issue.line}: ${issue.instruction} - ${issue.flag} (expected ${issue.expected}, got ${issue.actual})`);
            });
        }
        
        // Show register issues summary  
        if (registerIssues.length > 0) {
            console.log('\n🚩 Register Issues:');
            const regCounts = {};
            registerIssues.forEach(issue => {
                const key = `${issue.register} (expected: $${issue.expected.toString(16)} got: $${issue.actual.toString(16)})`;
                regCounts[key] = (regCounts[key] || 0) + 1;
            });
            
            Object.entries(regCounts).forEach(([issue, count]) => {
                console.log(`   ${issue}: ${count} occurrences`);
            });
        }
    }

    reset() {
        if (this.nes) {
            this.nes.reset();
            this.nes.cpu.pc = 0xC000; // Reset to nestest start
            console.log('🔄 Reset CPU to $C000');
        }
    }
}

// Command line interface
async function main() {
    const runner = new CPUTestRunner();
    await runner.initialize();
    
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
        case 'run':
            const maxTests = parseInt(args[1]) || 100;
            await runner.runTests(maxTests);
            runner.analyzeFailures();
            break;
            
        case 'single':
            const lineNumber = parseInt(args[1]) || 1;
            await runner.runSingleTest(lineNumber);
            break;
            
        case 'reset':
            runner.reset();
            break;
            
        default:
            console.log(`
🎮 CPU Test Runner - Usage:
   node cpu-test.js run [num_tests]     - Run N tests (default: 100)
   node cpu-test.js single [line]     - Run single test line
   node cpu-test.js reset              - Reset CPU to $C000
   
Examples:
   node cpu-test.js run 50     # Run first 50 tests
   node cpu-test.js single 1     # Run test for line 1
   node cpu-test.js reset        # Reset CPU
            `);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

// CPUTestRunner class defined above