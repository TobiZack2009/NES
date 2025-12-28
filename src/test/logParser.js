/**
 * NES Test Log Parser
 * Parses nestest.log format for CPU state comparison
 */

export class CPUState {
    constructor(line) {
        this.parse(line);
    }

    parse(line) {
        // Example line (from actual nestest.log):
        // C000  4C F5 C5  JMP $C5F5                       A:00 X:00 Y:00 P:24 SP:FD PPU:  0, 21 CYC:7
        
        // Remove leading/trailing whitespace
        line = line.trim();
        
        // This is the actual format - no line number, just address, instruction, and state
        this.lineNumber = null; // Will be set by index in array
        const rest = line;

        // Extract address
        const addressMatch = rest.match(/^([0-9A-Fa-f]{4})\s+/);
        if (!addressMatch) {
            throw new Error(`Cannot parse address from: ${rest}`);
        }
        this.address = parseInt(addressMatch[1], 16);

        // Extract instruction bytes and mnemonic
        const instrMatch = rest.match(/[0-9A-Fa-f]{4}\s+([0-9A-Fa-f\s]+?)\s+(\*?[A-Z]{3})/);
        if (!instrMatch) {
            throw new Error(`Cannot parse instruction from: ${rest}`);
        }
        
        this.instructionBytes = instrMatch[1].trim().split(/\s+/).map(b => parseInt(b, 16));
        this.mnemonic = instrMatch[2];

        // Extract operand (everything between mnemonic and "A:")
        const operandMatch = rest.match(/\*?[A-Z]{3}\s+(.+?)\s+A:/);
        this.operand = operandMatch ? operandMatch[1].trim() : '';

        // Extract register states
        const registerMatch = rest.match(/A:([0-9A-Fa-f]{2})\s+X:([0-9A-Fa-f]{2})\s+Y:([0-9A-Fa-f]{2})\s+P:([0-9A-Fa-f]{2})\s+SP:([0-9A-Fa-f]{2})/);
        if (!registerMatch) {
            throw new Error(`Cannot parse registers from: ${rest}`);
        }

        this.A = parseInt(registerMatch[1], 16);
        this.X = parseInt(registerMatch[2], 16);
        this.Y = parseInt(registerMatch[3], 16);
        this.P = parseInt(registerMatch[4], 16);
        this.SP = parseInt(registerMatch[5], 16);

        // Extract PPU state
        const ppuMatch = rest.match(/PPU:\s*(\d+),\s*(\d+)/);
        if (ppuMatch) {
            this.ppuScanline = parseInt(ppuMatch[1], 10);
            this.ppuCycle = parseInt(ppuMatch[2], 10);
        } else {
            this.ppuScanline = null;
            this.ppuCycle = null;
        }

        // Extract cycle count
        const cycleMatch = rest.match(/CYC:(\d+)/);
        this.cycles = cycleMatch ? parseInt(cycleMatch[1], 10) : null;
    }

    getProcessorFlags() {
        return {
            carry: !!(this.P & 0x01),
            zero: !!(this.P & 0x02),
            interruptDisable: !!(this.P & 0x04),
            decimal: !!(this.P & 0x08),
            breakFlag: !!(this.P & 0x10),
            unused: !!(this.P & 0x20),
            overflow: !!(this.P & 0x40),
            negative: !!(this.P & 0x80)
        };
    }

    toString() {
        const flags = this.getProcessorFlags();
        const flagStr = `${flags.carry ? 'C' : 'c'}${flags.zero ? 'Z' : 'z'}${flags.interruptDisable ? 'I' : 'i'}${flags.decimal ? 'D' : 'd'}${flags.overflow ? 'V' : 'v'}${flags.negative ? 'N' : 'n'}`;
        const pad = (str, length, char) => str.padStart ? str.padStart(length, char) : char.repeat(Math.max(0, length - str.length)) + str;
        const lineNum = this.lineNumber ? `${this.lineNumber}: ` : '';
        return `${lineNum}${this.mnemonic} ${this.operand} | A:${pad(this.A.toString(16).toUpperCase(), 2, '0')} X:${pad(this.X.toString(16).toUpperCase(), 2, '0')} Y:${pad(this.Y.toString(16).toUpperCase(), 2, '0')} P:${flagStr} SP:${pad(this.SP.toString(16).toUpperCase(), 2, '0')}`;
    }
}

export class LogParser {
    constructor() {
        this.states = [];
        this.loaded = false;
    }

    async load(logText) {
        const lines = logText.split('\n').filter(line => line.trim() && line.trim() !== '');
        this.states = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            try {
                const state = new CPUState(line);
                state.lineNumber = i + 1; // Set line number manually
                this.states.push(state);
            } catch (error) {
                console.warn(`Failed to parse line ${i + 1}: ${line}`, error);
            }
        }

        this.loaded = true;
        console.log(`Loaded ${this.states.length} CPU states from log`);
    }

    getState(lineNumber) {
        if (!this.loaded) {
            throw new Error('Log not loaded yet');
        }
        return this.states.find(state => state.lineNumber === lineNumber);
    }

    getStateByAddress(address) {
        if (!this.loaded) {
            throw new Error('Log not loaded yet');
        }
        return this.states.find(state => state.address === address);
    }

    compare(emulatorCPU, lineNumber) {
        const expectedState = this.getState(lineNumber);
        if (!expectedState) {
            throw new Error(`No expected state found for line ${lineNumber}`);
        }

        const differences = [];

        // Compare registers
        if (emulatorCPU.a !== expectedState.A) {
            differences.push({
                type: 'register',
                name: 'A',
                expected: expectedState.A,
                actual: emulatorCPU.a
            });
        }

        if (emulatorCPU.x !== expectedState.X) {
            differences.push({
                type: 'register',
                name: 'X',
                expected: expectedState.X,
                actual: emulatorCPU.x
            });
        }

        if (emulatorCPU.y !== expectedState.Y) {
            differences.push({
                type: 'register',
                name: 'Y',
                expected: expectedState.Y,
                actual: emulatorCPU.y
            });
        }

        if (emulatorCPU.stkp !== expectedState.SP) {
            differences.push({
                type: 'register',
                name: 'SP',
                expected: expectedState.SP,
                actual: emulatorCPU.stkp
            });
        }

        // Compare flags (ensure unused bit is set for fair comparison)
        const cpuStatus = emulatorCPU.status | 0x20; // Set unused bit
        const expectedStatus = expectedState.P | 0x20; // Ensure expected also has unused bit
        if (cpuStatus !== expectedStatus) {
            const expectedFlags = {
                carry: !!(expectedState.P & 0x01),
                zero: !!(expectedState.P & 0x02),
                interruptDisable: !!(expectedState.P & 0x04),
                decimal: !!(expectedState.P & 0x08),
                breakFlag: !!(expectedState.P & 0x10),
                unused: !!(expectedState.P & 0x20),
                overflow: !!(expectedState.P & 0x40),
                negative: !!(expectedState.P & 0x80)
            };
            
            const actualFlags = {
                carry: !!(emulatorCPU.status & 0x01),
                zero: !!(emulatorCPU.status & 0x02),
                interruptDisable: !!(emulatorCPU.status & 0x04),
                decimal: !!(emulatorCPU.status & 0x08),
                breakFlag: !!(emulatorCPU.status & 0x10),
                unused: !!(emulatorCPU.status & 0x20),
                overflow: !!(emulatorCPU.status & 0x40),
                negative: !!(emulatorCPU.status & 0x80)
            };

            ['carry', 'zero', 'interruptDisable', 'decimal', 'breakFlag', 'unused', 'overflow', 'negative'].forEach(flag => {
                if (expectedFlags[flag] !== actualFlags[flag]) {
                    differences.push({
                        type: 'flag',
                        name: flag,
                        expected: expectedFlags[flag],
                        actual: actualFlags[flag]
                    });
                }
            });
        }

        return {
            expected: expectedState,
            actual: emulatorCPU,
            differences: differences,
            matches: differences.length === 0
        };
    }

    // Find the closest expected state for a given PC address
    findNearestState(pc) {
        if (!this.loaded) {
            throw new Error('Log not loaded yet');
        }

        // First try exact match
        const exact = this.states.find(state => state.address === pc);
        if (exact) {
            return exact;
        }

        // Find closest address
        return this.states.reduce((nearest, state) => {
            const currentDistance = Math.abs(state.address - pc);
            const nearestDistance = Math.abs(nearest.address - pc);
            return currentDistance < nearestDistance ? state : nearest;
        });
    }
}

// Singleton instance for the app
export const logParser = new LogParser();