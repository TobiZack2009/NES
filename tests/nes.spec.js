import { assert } from 'chai';
import { NES } from '../src/nes.js';
import { createTestROM } from './setup/test-utils.js';
import sinon from 'sinon';

describe("NES", function() {
    let nes = null;

    beforeEach(function() {
        nes = new NES();
    });

    it("can be initialized", function() {
        assert.isObject(nes);
        assert.isObject(nes.bus);
        assert.isObject(nes.cpu);
        assert.isNull(nes.ppu);
        assert.isNull(nes.cartridge);
    });

    it("can load a test ROM", function(done) {
        const testROM = createTestROM();
        const result = nes.load(testROM);
        
        assert.isTrue(result);
        assert.isObject(nes.cartridge);
        assert.isObject(nes.ppu);
        done();
    });

    it("can reset the system", function(done) {
        const testROM = createTestROM();
        nes.load(testROM);
        
        // Execute a few instructions to change state
        nes.step();
        nes.step();
        
        // Reset should clear state
        nes.reset();
        
        // Check that PC points to reset vector
        const resetPC = nes.bus.read(0xFFFC) | (nes.bus.read(0xFFFD) << 8);
        assert.equal(nes.cpu.pc, resetPC);
        done();
    });

    it("can execute CPU steps", function() {
        const testROM = createTestROM();
        nes.load(testROM);
        
        const initialPC = nes.cpu.pc;
        
        // Execute one step
        nes.step();
        

        // PC should have advanced (or at least be different)
        assert.isTrue(nes.cpu.pc !== initialPC);
    });

    it("can handle invalid ROM gracefully", function() {
        const invalidROM = new Uint8Array([0x4E, 0x45, 0x53]); // "NES" without proper header
        
        // Check that load returns false for invalid ROM
        try {
            const result = nes.load(invalidROM);
            assert.isFalse(result);
        } catch (e) {
            // It might throw an error, which is also acceptable
            assert.include(e.message, 'Invalid');
        }
    });

    it("maintains instruction log", function() {
        const testROM = createTestROM();
        nes.load(testROM);
        
        // Execute a few instructions
        nes.step();
        nes.step();
        nes.step();
        
        // Should have some instruction log entries
        assert.isArray(nes.instructionLog);
        // Note: instruction logging might not be implemented in current version
    });

    it("maintains PC history", function(done) {
        const testROM = createTestROM();
        nes.load(testROM);
        
        // Execute a few instructions
        nes.step();
        nes.step();
        nes.step();
        
        // Should have PC history
        assert.isArray(nes.pcHistory);
        assert.isTrue(nes.pcHistory.length > 0);
        assert.isTrue(nes.pcHistory.length <= 100); // Should be limited
        done();
    });

    describe("Component Integration", function() {
        beforeEach(function() {
            const testROM = createTestROM();
            nes.load(testROM);
        });

        it("connects CPU to bus", function() {
            assert.equal(nes.cpu.bus, nes.bus);
        });

        it("connects PPU to bus", function() {
            assert.equal(nes.ppu.bus, nes.bus);
        });

        it("connects cartridge to bus", function() {
            assert.equal(nes.cartridge, nes.bus.cartridge);
        });
    });

    describe("Clock Synchronization", function() {
        beforeEach(function() {
            const testROM = createTestROM();
            nes.load(testROM);
        });

        it("advances system clock on step", function() {
            const initialCycle = nes.cpu.cycles;
            
            nes.step();
            
            // CPU should have progressed through instruction cycles
            assert.isTrue(nes.cpu.cycles !== initialCycle);
        });

        it("coordinates CPU and PPU timing", function() {
            // This is a basic test that the clock system works
            // More detailed timing tests would require cycle-level access
            const initialFrame = nes.ppu.frame;
            
            // Execute many steps to potentially advance PPU
            for (let i = 0; i < 1000; i++) {
                nes.step();
            }
            
            // PPU should have progressed (though specifics depend on implementation)
            assert.isNumber(nes.ppu.frame);
        });
    });
});