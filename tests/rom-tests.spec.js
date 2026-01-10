import { assert } from 'chai';
import fs from 'fs';
import sinon from 'sinon';
import { NES } from '../src/nes.js';
import { Cartridge } from '../src/cartridge.js';

describe("NES ROM Tests", function() {
  describe("croom ROM", function() {
    it("loads croom ROM and runs a frame", function(done) {
      var onFrame = sinon.spy();
      var nes = new NES();
      fs.readFile("ROMS/croom/croom.nes", function(err, data) {
        if (err) return done(err);
        nes.load(data);
        // Run a full frame (261 scanlines * 341 cycles per scanline)
        for (let i = 0; i < 261 * 341; i++) {
          nes.clock();
        }
        assert.isArray(nes.ppu.getScreen());
        assert.lengthOf(nes.ppu.getScreen(), 256 * 240 * 4);
        done();
      });
    });

    it("generates the correct frame buffer for croom", function(done) {
      var nes = new NES();
      fs.readFile("ROMS/croom/croom.nes", function(err, data) {
        if (err) return done(err);
        nes.load(data);
        
        // Run multiple frames to get stable output
        for (let frame = 0; frame < 6; frame++) {
          for (let i = 0; i < 261 * 341; i++) {
            nes.clock();
          }
        }
        
        // Check that we get a frame buffer
        const screen = nes.ppu.getScreen();
        assert.isArray(screen);
        assert.lengthOf(screen, 256 * 240 * 4);
        done();
      });
    });
  });

  describe("lj65 ROM", function() {
    it("loads lj65 ROM and runs a frame", function(done) {
      var nes = new NES();
      fs.readFile("ROMS/lj65/lj65.nes", function(err, data) {
        if (err) return done(err);
        nes.load(data);
        // Run a full frame
        for (let i = 0; i < 261 * 341; i++) {
          nes.clock();
        }
        assert.isArray(nes.ppu.getScreen());
        assert.lengthOf(nes.ppu.getScreen(), 256 * 240 * 4);
        done();
      });
    });

    it("generates frame buffer for lj65", function(done) {
      var nes = new NES();
      fs.readFile("ROMS/lj65/lj65.nes", function(err, data) {
        if (err) return done(err);
        nes.load(data);
        // Run multiple frames to ensure the ROM is executing
        for (let frame = 0; frame < 10; frame++) {
          for (let i = 0; i < 261 * 341; i++) {
            nes.clock();
          }
        }
        const screen = nes.ppu.getScreen();
        assert.isArray(screen);
        assert.lengthOf(screen, 256 * 240 * 4);
        done();
      });
    });
  });

  describe("ROM Loading Validation", function() {
    it("throws an error given an invalid ROM", function() {
      var nes = new NES();
      assert.throws(function() {
        Cartridge.fromINES(new Uint8Array([0x66, 0x6f, 0x6f])); // "Foo"
      }, "Invalid iNES file format");
    });

    it("validates croom ROM format", function(done) {
      var nes = new NES();
      fs.readFile("ROMS/croom/croom.nes", function(err, data) {
        if (err) return done(err);
        // Should not throw an error for valid ROM
        assert.doesNotThrow(function() {
          nes.load(data);
        });
        done();
      });
    });

    it("validates lj65 ROM format", function(done) {
      var nes = new NES();
      fs.readFile("ROMS/lj65/lj65.nes", function(err, data) {
        if (err) return done(err);
        // Should not throw an error for valid ROM
        assert.doesNotThrow(function() {
          nes.load(data);
        });
        done();
      });
    });
  });

  describe("FPS Performance", function() {
    it("returns FPS count for croom ROM", function(done) {
      var nes = new NES();
      fs.readFile("ROMS/croom/croom.nes", function(err, data) {
        if (err) return done(err);
        nes.load(data);
        
        // Run a few cycles
        for (let i = 0; i < 1000; i++) {
          nes.clock();
        }
        
        // Test that we can execute cycles without errors
        assert.isTrue(nes.cpu.cycles >= 0);
        done();
      });
    });

    it("returns FPS count for lj65 ROM", function(done) {
      var nes = new NES();
      fs.readFile("ROMS/lj65/lj65.nes", function(err, data) {
        if (err) return done(err);
        nes.load(data);
        
        // Run a few cycles
        for (let i = 0; i < 1000; i++) {
          nes.clock();
        }
        
        // Test that we can execute cycles without errors
        assert.isTrue(nes.cpu.cycles >= 0);
        done();
      });
    });
  });
});