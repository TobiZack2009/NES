import { NES } from './nes.js';
import { TestFramework, MovieSystem, RegressionTestSuite, CRC32 } from './testing.js';
import { loadROM } from './cartridge.js';
import { logParser } from './test/logParser.js';
import { Controller } from './controller.js';
import { disassemble, disassembleInstruction } from './disassembler.js';

// Global instances
let nes;
let testFramework;
let movieSystem;
let regressionSuite;

// Initialize the emulator when the page loads
window.addEventListener('DOMContentLoaded', () => {
    nes = new NES();
    
    // Initialize testing systems
    testFramework = new TestFramework();
    movieSystem = new MovieSystem();
    regressionSuite = new RegressionTestSuite();
    
    // Setup tests
    setupTests();
    
    // Setup UI
    setupUI();
    
    // Make instances globally accessible
    window.nes = nes;
    window.testFramework = testFramework;
    window.movieSystem = movieSystem;
    window.regressionSuite = regressionSuite;
    
    console.log('NES Emulator with Testing Framework initialized');
});

function setupTests() {
    // CPU instruction tests
    testFramework.addTest('CPU - LDA Immediate', () => {
        nes.reset();
        nes.cpu.a = 0x00;
        nes.bus.write(0x8000, 0xA9); // LDA #$42
        nes.bus.write(0x8001, 0x42);
        nes.cpu.pc = 0x8000;
        
        nes.step(); // Execute LDA
        
        if (nes.cpu.a !== 0x42) {
            throw new Error(`Expected A = $42, got $${nes.cpu.a.toString(16)}`);
        }
    });
    
    testFramework.addTest('CPU - TAX Transfer', () => {
        nes.reset();
        nes.cpu.a = 0x73;
        nes.cpu.x = 0x00;
        nes.bus.write(0x8000, 0xAA); // TAX
        nes.cpu.pc = 0x8000;
        
        nes.step(); // Execute TAX
        
        if (nes.cpu.x !== 0x73) {
            throw new Error(`Expected X = $73, got $${nes.cpu.x.toString(16)}`);
        }
    });
    
    testFramework.addTest('CPU - Zero Page Addressing', () => {
        nes.reset();
        nes.bus.write(0x0050, 0x37); // Set value at zero page address
        nes.bus.write(0x8000, 0xA5); // LDA $50
        nes.bus.write(0x8001, 0x50);
        nes.cpu.pc = 0x8000;
        
        nes.step(); // Execute LDA
        
        if (nes.cpu.a !== 0x37) {
            throw new Error(`Expected A = $37, got $${nes.cpu.a.toString(16)}`);
        }
    });
    
    testFramework.addTest('PPU - Register Reset', () => {
        nes.reset();
        
        if (!nes.ppu) {
            throw new Error('PPU not initialized');
        }
        
        // Check default PPU status
        if (nes.ppu.status !== 0x00) {
            throw new Error(`Expected PPU status = $00, got $${nes.ppu.status.toString(16)}`);
        }
    });
    
    testFramework.addTest('PPU - Palette Memory', () => {
        nes.reset();
        
        // Write to palette memory
        nes.ppu.ppuWrite(0x3F00, 0x1F);
        const value = nes.ppu.ppuRead(0x3F00);
        
        if (value !== 0x1F) {
            throw new Error(`Expected palette value = $1F, got $${value.toString(16)}`);
        }
    });
    
    testFramework.addTest('Bus - Memory Mapping', () => {
        nes.reset();
        
        // Test RAM access
        nes.bus.write(0x0000, 0x42);
        const ramValue = nes.bus.read(0x0000);
        
        if (ramValue !== 0x42) {
            throw new Error(`Expected RAM value = $42, got $${ramValue.toString(16)}`);
        }
        
        // Test RAM mirroring
        const mirrorValue = nes.bus.read(0x0800);
        if (mirrorValue !== 0x42) {
            throw new Error(`Expected RAM mirror value = $42, got $${mirrorValue.toString(16)}`);
        }
    });
    
    testFramework.addTest('CRC32 - Basic Check', () => {
        const data = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"
        const hash = CRC32.compute(data);
        
        // Known CRC32 for "Hello"
        const expectedHash = 0x0BF4FE626;
        if (hash !== expectedHash) {
            throw new Error(`Expected CRC32 = ${expectedHash.toString(16)}, got ${hash.toString(16)}`);
        }
    });
}

function setupUI() {
    setupROMLoader();
    setupControls();
    setupDebug();
    setupTestingUI();
    setupCollapsibleSections();
}

function setupROMLoader() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.nes';
    fileInput.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 1000;';
    
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                console.log('Loading ROM:', file.name);
                const cartridge = await loadROM(file);
                nes.loadCartridge(cartridge);
                console.log('ROM loaded successfully!');
                console.log('PRG Banks:', cartridge.prgBanks);
                console.log('CHR Banks:', cartridge.chrBanks);
                console.log('Mapper:', cartridge.mapperID);
                
                updateStatus(`ROM loaded: ${file.name}`);
                updateDebug();
                updateDisassembly();
                
                // Clear instruction log
                document.getElementById('instruction-log-output').textContent = '';
            } catch (error) {
                console.error('Failed to load ROM:', error);
                updateStatus(`Error: ${error.message}`);
            }
        }
    });
    
    document.body.appendChild(fileInput);
}

function setupControls() {
    const resetBtn = document.getElementById('resetBtn');
    const stepBtn = document.getElementById('stepBtn');
    const runBtn = document.getElementById('runBtn');
    const stopBtn = document.getElementById('stopBtn');
    const testBtn = document.getElementById('testBtn');
    
    // Setup keyboard input
    setupKeyboardInput();
    
    let isRunning = false;
    let animationId = null;
    
    resetBtn.addEventListener('click', () => {
        nes.reset();
        updateDebug();
        updateDisassembly();
        updateScreen();
        updateStatus('Reset');
    });
    
    stepBtn.addEventListener('click', () => {
        nes.step();
        updateDebug();
        updateDisassembly();
        logInstruction();
        updateScreen();
    });
    
    runBtn.addEventListener('click', () => {
        if (!isRunning) {
            isRunning = true;
            updateStatus('Running');
            
            function run() {
                if (isRunning) {
                    // Execute several CPU cycles per frame
                    for (let i = 0; i < 1000; i++) {
                        nes.step();
                    }
                    updateDebug();
                    updateDisassembly();
                    updateScreen();
                    animationId = requestAnimationFrame(run);
                }
            }
            run();
        }
    });
    
    stopBtn.addEventListener('click', () => {
        isRunning = false;
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        updateStatus('Stopped');
    });
    
    testBtn.addEventListener('click', async () => {
        await runNestestTest();
    });
}

function setupDebug() {
    updateDebug();
    updateDisassembly();
    
    // Set up screen update interval
    setInterval(() => {
        if (document.hidden === false && !document.getElementById('stopBtn').disabled) {
            updateScreen();
        }
    }, 16); // ~60 FPS
}

function setupTestingUI() {
    const testingContainer = document.createElement('div');
    testingContainer.style.cssText = 'margin-top: 20px; padding: 10px; background: #111; border: 1px solid #333; font-size: 12px;';
    
    const runTestsBtn = document.createElement('button');
    runTestsBtn.textContent = 'Run All Tests';
    runTestsBtn.style.cssText = 'margin: 5px; padding: 5px 10px; background: #333; color: #fff; border: none; cursor: pointer; font-family: monospace;';
    
    const movieRecordBtn = document.createElement('button');
    movieRecordBtn.textContent = 'Start Recording';
    movieRecordBtn.style.cssText = 'margin: 5px; padding: 5px 10px; background: #333; color: #fff; border: none; cursor: pointer; font-family: monospace;';
    
    const testOutput = document.createElement('div');
    testOutput.id = 'testOutput';
    testOutput.style.cssText = 'margin-top: 10px; white-space: pre-wrap; max-height: 200px; overflow-y: auto;';
    
    runTestsBtn.addEventListener('click', async () => {
        testOutput.textContent = 'Running tests...\n';
        
        await testFramework.runTests();
        const report = testFramework.generateReport();
        testOutput.textContent = report;
    });
    
    let recording = false;
    movieRecordBtn.addEventListener('click', () => {
        if (!recording) {
            movieSystem.startRecording();
            movieRecordBtn.textContent = 'Stop Recording';
            recording = true;
            updateStatus('Recording movie');
        } else {
            movieSystem.stopRecording();
            movieRecordBtn.textContent = 'Start Recording';
            recording = false;
            updateStatus('Stopped recording');
            
            if (movieSystem.frames.length > 0) {
                movieSystem.saveMovie();
            }
        }
    });
    
    testingContainer.appendChild(document.createTextNode('Testing Framework: '));
    testingContainer.appendChild(runTestsBtn);
    testingContainer.appendChild(movieRecordBtn);
    testingContainer.appendChild(testOutput);
    
    document.body.appendChild(testingContainer);
    
    // Add movie load input
    const movieInput = document.createElement('input');
    movieInput.type = 'file';
    movieInput.accept = '.json';
    movieInput.style.cssText = 'margin: 5px; padding: 5px; background: #333; color: #fff; border: none; font-family: monospace;';
    
    movieInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                await movieSystem.loadMovie(file);
                updateStatus(`Loaded movie: ${file.name}`);
            } catch (error) {
                updateStatus(`Error loading movie: ${error.message}`);
            }
        }
    });
    
    testingContainer.appendChild(document.createTextNode(' Load Movie: '));
    testingContainer.appendChild(movieInput);
}

function updateDebug() {
    const debugEl = document.getElementById('debug');
    if (!debugEl) return; // Debug section may be collapsed
    
    const state = nes.dumpCPUState();
    const ppuStatus = nes.ppu ? {
        cycle: nes.ppu.cycle,
        scanline: nes.ppu.scanline,
        frame: nes.ppu.frame,
        control: nes.ppu.control.toString(16).padStart(2, '0'),
        mask: nes.ppu.mask.toString(16).padStart(2, '0'),
        status: nes.ppu.status.toString(16).padStart(2, '0'),
    } : { cycle: '-', scanline: '-', frame: '-', control: '-', mask: '-', status: '-' };
    
    debugEl.textContent = `CPU State:
A: $${state.a}  X: $${state.x}  Y: $${state.y}  SP: $${state.stkp}
PC: $${state.pc}
Status: ${state.status} (N V - B D I Z C)

PPU State:
Cycle: ${ppuStatus.cycle}  Scanline: ${ppuStatus.scanline}  Frame: ${ppuStatus.frame}
CTRL: $${ppuStatus.control}  MASK: $${ppuStatus.mask}  STATUS: $${ppuStatus.status}`;
}

function updateDisassembly() {
    const disassemblyEl = document.getElementById('disassembly-output');
    if (!disassemblyEl || !nes.cartridge) {
        if (disassemblyEl) disassemblyEl.textContent = 'Load a ROM to see disassembly';
        return;
    }
    
    // Disassemble around current PC
    const currentPC = nes.cpu.pc;
    const startAddr = Math.max(0x8000, currentPC - 0x20); // Start a bit before current PC
    const disassembly = disassemble(nes.bus, startAddr, 30);
    
    disassemblyEl.textContent = disassembly;
    
    // Highlight current instruction
    const lines = disassemblyEl.textContent.split('\n');
    const highlightedLines = lines.map((line, index) => {
        const lineAddr = parseInt(line.substring(0, 4), 16);
        if (lineAddr === currentPC) {
            return `>>> ${line}`;
        }
        return `    ${line}`;
    });
    
    disassemblyEl.textContent = highlightedLines.join('\n');
}

function logInstruction() {
    const logEl = document.getElementById('instruction-log-output');
    if (!logEl || !nes.cartridge) return;
    
    const instruction = disassembleInstruction(nes.bus, nes.cpu.pc);
    const state = nes.cpu.getState();
    
    const logEntry = `$${instruction.addr.toString(16).padStart(4, '0').toUpperCase()}:  ${instruction.bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')}  ${instruction.mnemonic} ${instruction.operand}  |  A:$${state.A.toString(16).padStart(2, '0').toUpperCase()} X:$${state.X.toString(16).padStart(2, '0').toUpperCase()} Y:$${state.Y.toString(16).padStart(2, '0').toUpperCase()} P:$${state.P.toString(16).padStart(2, '0').toUpperCase()} SP:$${state.SP.toString(16).padStart(2, '0').toUpperCase()}`;
    
    let currentLog = logEl.textContent;
    if (!currentLog) currentLog = '';
    
    // Keep only last 50 instructions
    const logLines = currentLog.split('\n').filter(line => line.trim());
    logLines.push(logEntry);
    if (logLines.length > 50) {
        logLines.shift(); // Remove oldest line
    }
    
    logEl.textContent = logLines.join('\n');
    logEl.scrollTop = logEl.scrollHeight;
}

function updateScreen() {
    if (!nes.ppu) return;
    
    // Only update when a complete frame is ready (during vblank)
    if (nes.ppu.scanline < 241) {
        return; // Still in visible rendering phase
    }
    
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(256, 240);
    
    const screenData = nes.ppu.getScreen();
    imageData.data.set(screenData);
    
    ctx.putImageData(imageData, 0, 0);
}

function setupKeyboardInput() {
    document.addEventListener('keydown', (e) => {
        if (!nes.bus.controller1) return;
        
        switch(e.code) {
            case 'KeyX': case 'ButtonX':
                nes.bus.controller1.setButtonState('A', true);
                break;
            case 'KeyZ': case 'ButtonZ':
                nes.bus.controller1.setButtonState('B', true);
                break;
            case 'Enter': case 'NumpadEnter':
                nes.bus.controller1.setButtonState('START', true);
                break;
            case 'ShiftLeft': case 'ShiftRight':
                nes.bus.controller1.setButtonState('SELECT', true);
                break;
            case 'ArrowUp': case 'KeyW':
                nes.bus.controller1.setButtonState('UP', true);
                break;
            case 'ArrowDown': case 'KeyS':
                nes.bus.controller1.setButtonState('DOWN', true);
                break;
            case 'ArrowLeft': case 'KeyA':
                nes.bus.controller1.setButtonState('LEFT', true);
                break;
            case 'ArrowRight': case 'KeyD':
                nes.bus.controller1.setButtonState('RIGHT', true);
                break;
        }
        e.preventDefault();
    });
    
    document.addEventListener('keyup', (e) => {
        if (!nes.bus.controller1) return;
        
        switch(e.code) {
            case 'KeyX': case 'ButtonX':
                nes.bus.controller1.setButtonState('A', false);
                break;
            case 'KeyZ': case 'ButtonZ':
                nes.bus.controller1.setButtonState('B', false);
                break;
            case 'Enter': case 'NumpadEnter':
                nes.bus.controller1.setButtonState('START', false);
                break;
            case 'ShiftLeft': case 'ShiftRight':
                nes.bus.controller1.setButtonState('SELECT', false);
                break;
            case 'ArrowUp': case 'KeyW':
                nes.bus.controller1.setButtonState('UP', false);
                break;
            case 'ArrowDown': case 'KeyS':
                nes.bus.controller1.setButtonState('DOWN', false);
                break;
            case 'ArrowLeft': case 'KeyA':
                nes.bus.controller1.setButtonState('LEFT', false);
                break;
            case 'ArrowRight': case 'KeyD':
                nes.bus.controller1.setButtonState('RIGHT', false);
                break;
        }
        e.preventDefault();
    });
}

function updateStatus(message) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    console.log('Status:', message);
}

async function runNestestTest() {
    updateStatus('Loading nestest.nes and test data...');
    
    try {
        // Load the test log
        const logResponse = await fetch('tests/nestest.log');
        const logText = await logResponse.text();
        await logParser.load(logText);
        
        // Load the test ROM
        const romResponse = await fetch('tests/nestest.nes');
        const romData = await romResponse.arrayBuffer();
        const romFile = new File([romData], 'nestest.nes', { type: 'application/x-nes' });
        
        const cartridge = await loadROM(romFile);
        nes.loadCartridge(cartridge);
        
        // Reset and set PC to $C000 (start of nestest)
        nes.reset();
        nes.cpu.pc = 0xC000;
        
        updateStatus('Running nestest comparison...');
        const testResultsEl = document.getElementById('testResults');
        testResultsEl.style.display = 'block';
        testResultsEl.innerHTML = '<div class="test-info">Starting nestest comparison...</div>';
        
        // Run step-by-step comparison
        let totalTests = 0;
        let passedTests = 0;
        let failedTests = 0;
        let outputHTML = '';
        
        // Limit to first 500 lines for initial testing
        const maxLines = Math.min(500, logParser.states.length);
        
        for (let i = 1; i <= maxLines; i++) {
            const expectedState = logParser.getState(i);
            if (!expectedState) continue;
            
            // Get current state before stepping
            const currentState = nes.cpu.getState();
            
            // Step to next instruction
            nes.step();
            
            // Compare states
            const comparison = logParser.compare(nes.cpu, i);
            totalTests++;
            
            if (comparison.matches) {
                passedTests++;
                outputHTML += `<div class="test-match">Line ${i}: ✓ ${expectedState.mnemonic} ${expectedState.operand}</div>`;
            } else {
                failedTests++;
                outputHTML += `<div class="test-mismatch">Line ${i}: ✗ ${expectedState.mnemonic} ${expectedState.operand}</div>`;
                
                // Show details of the mismatch
                comparison.differences.forEach(diff => {
                    if (diff.type === 'register') {
                        const pad = (str, length, char) => str.padStart ? str.padStart(length, char) : char.repeat(Math.max(0, length - str.length)) + str;
                        outputHTML += `<div class="test-mismatch">    ${diff.name}: expected ${pad(diff.expected.toString(16).toUpperCase(), 2, '0')}, got ${pad(diff.actual.toString(16).toUpperCase(), 2, '0')}</div>`;
                    } else if (diff.type === 'flag') {
                        outputHTML += `<div class="test-mismatch">    flag ${diff.name}: expected ${diff.expected}, got ${diff.actual}</div>`;
                    }
                });
                
                outputHTML += `<div class="test-mismatch">    Expected: ${expectedState.toString()}</div>`;
                const pad = (str, length, char) => str.padStart ? str.padStart(length, char) : char.repeat(Math.max(0, length - str.length)) + str;
                outputHTML += `<div class="test-mismatch">    Actual: A:${pad(nes.cpu.a.toString(16).toUpperCase(), 2, '0')} X:${pad(nes.cpu.x.toString(16).toUpperCase(), 2, '0')} Y:${pad(nes.cpu.y.toString(16).toUpperCase(), 2, '0')} P:${pad(nes.cpu.status.toString(16).toUpperCase(), 2, '0')} SP:${pad(nes.cpu.stkp.toString(16).toUpperCase(), 2, '0')}</div>`;
            }
            
            // Update UI periodically
            if (i % 50 === 0) {
                testResultsEl.innerHTML = `
                    <div class="test-info">Progress: ${i}/${maxLines} lines tested</div>
                    <div class="test-info">Passed: ${passedTests}, Failed: ${failedTests}</div>
                    <div style="max-height: 200px; overflow-y: auto;">
                        ${outputHTML}
                    </div>
                `;
                updateDebug();
                await new Promise(resolve => setTimeout(resolve, 1)); // Allow UI update
            }
            
            // Stop early if too many failures
            if (failedTests > 100) {
                outputHTML += `<div class="test-mismatch">Stopped early due to too many failures</div>`;
                break;
            }
        }
        
        // Final results
        testResultsEl.innerHTML = `
            <div class="test-info">Test Results:</div>
            <div class="test-info">Total: ${totalTests}, Passed: ${passedTests}, Failed: ${failedTests}</div>
            <div class="${failedTests === 0 ? 'test-match' : 'test-mismatch'}">
                ${failedTests === 0 ? '✓ All tests passed!' : `✗ ${failedTests} tests failed`}
            </div>
            <div style="max-height: 200px; overflow-y: auto; margin-top: 10px;">
                ${outputHTML}
            </div>
        `;
        
        updateStatus(`Test completed: ${passedTests}/${totalTests} passed`);
        
    } catch (error) {
        console.error('Test failed:', error);
        updateStatus(`Test failed: ${error.message}`);
        document.getElementById('testResults').innerHTML = `<div class="test-mismatch">Test failed: ${error.message}</div>`;
    }
}

function setupCollapsibleSections() {
    const collapsibles = document.querySelectorAll('.collapsible');
    
    collapsibles.forEach(button => {
        button.addEventListener('click', function() {
            this.classList.toggle('collapsed');
            const content = this.nextElementSibling;
            content.classList.toggle('collapsed');
        });
    });
    
    // Set initial states (debug expanded, others collapsed)
    document.getElementById('disassembly-toggle').classList.add('collapsed');
    document.getElementById('disassembly-content').classList.add('collapsed');
    document.getElementById('instruction-log-toggle').classList.add('collapsed');
    document.getElementById('instruction-log-content').classList.add('collapsed');
}

// Export for module usage
export const controller=new Controller();
export { nes, testFramework, movieSystem, regressionSuite };