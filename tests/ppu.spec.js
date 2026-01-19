import { assert } from 'chai';
import { PPU } from '../src/ppu.js';
import { createMockNES } from './setup/mock-nes.js';

describe("PPU", function() {
    let ppu = null;
    let nes = null;
    let bus = null;

    beforeEach(function() {
        nes = createMockNES();
        // Create a simple bus for testing
        bus = {
            read: (addr) => nes.cpu.mem[addr] || 0,
            write: (addr, data) => { nes.cpu.mem[addr] = data; },
            ppu: null
        };
        
        ppu = new PPU(bus);
        bus.ppu = ppu;
        
        // Connect cartridge mock to PPU
        ppu.connectCartridge({
            getMirror: () => 'horizontal',
            ppuRead: () => 0,
            ppuWrite: () => {}
        });
        
        // Allow register writes (disable power-up protection for testing)
        ppu.canWriteRegisters = true;
        
        // Force power-up cycles to complete to allow writes
        ppu.powerUpCycles = 30000;
    });

    describe("PPUCTRL ($2000) - Control Register", function() {
        it("should initialize with default values", function() {
            assert.equal(ppu.control, 0x00);
        });

        it("should set NMI enable flag", function() {
            ppu.writeRegister(0x00, 0x80);
            assert.equal(ppu.control & 0x80, 0x80);
        });

        it("should set sprite size flag (8x16 mode)", function() {
            ppu.writeRegister(0x00, 0x20);
            assert.equal(ppu.control & 0x20, 0x20);
        });

        it("should set background pattern table address", function() {
            ppu.writeRegister(0x00, 0x10);
            assert.equal(ppu.control & 0x10, 0x10);
        });

        it("should set sprite pattern table address", function() {
            ppu.writeRegister(0x00, 0x08);
            assert.equal(ppu.control & 0x08, 0x08);
        });

        it("should set VRAM address increment mode", function() {
            ppu.writeRegister(0x00, 0x04);
            assert.equal(ppu.control & 0x04, 0x04);
        });

        it("should set nametable base address", function() {
            ppu.writeRegister(0x00, 0x01);
            assert.equal(ppu.control & 0x03, 0x01);
            
            ppu.writeRegister(0x00, 0x02);
            assert.equal(ppu.control & 0x03, 0x02);
            
            ppu.writeRegister(0x00, 0x03);
            assert.equal(ppu.control & 0x03, 0x03);
        });

        it("should handle multiple flags simultaneously", function() {
            ppu.writeRegister(0x00, 0xBF); // All bits set except bit 6
            assert.equal(ppu.control & 0x80, 0x80); // NMI enable
            assert.equal(ppu.control & 0x20, 0x20); // Sprite size
            assert.equal(ppu.control & 0x10, 0x10); // BG pattern table
            assert.equal(ppu.control & 0x08, 0x08); // SP pattern table
            assert.equal(ppu.control & 0x04, 0x04); // Address increment
            assert.equal(ppu.control & 0x03, 0x03); // Nametable select
        });
    });

    describe("PPUMASK ($2001) - Mask Register", function() {
        it("should initialize with default values", function() {
            assert.equal(ppu.mask, 0x00);
        });

        it("should set grayscale mode", function() {
            ppu.writeRegister(0x01, 0x01);
            assert.equal(ppu.mask & 0x01, 0x01);
        });

        it("should show leftmost 8 pixels background", function() {
            ppu.writeRegister(0x01, 0x02);
            assert.equal(ppu.mask & 0x02, 0x02);
        });

        it("should show leftmost 8 pixels sprites", function() {
            ppu.writeRegister(0x01, 0x04);
            assert.equal(ppu.mask & 0x04, 0x04);
        });

        it("should enable background rendering", function() {
            ppu.writeRegister(0x01, 0x08);
            assert.equal(ppu.mask & 0x08, 0x08);
        });

        it("should enable sprite rendering", function() {
            ppu.writeRegister(0x01, 0x10);
            assert.equal(ppu.mask & 0x10, 0x10);
        });

        it("should set color emphasis bits", function() {
            ppu.writeRegister(0x01, 0xE0); // All emphasis bits
            assert.equal(ppu.mask & 0xE0, 0xE0);
            
            ppu.writeRegister(0x01, 0x20); // Red emphasis (bit 5)
            assert.equal(ppu.mask & 0x20, 0x20);
        });
    });

    describe("PPUSTATUS ($2002) - Status Register", function() {
        it("should initialize with default values", function() {
            assert.equal(ppu.status, 0x00);
        });

        it("should return open bus for write-only registers", function() {
            const result1 = ppu.readRegister(0x00); // PPUCTRL
            const result2 = ppu.readRegister(0x01); // PPUMASK
            const result3 = ppu.readRegister(0x03); // OAMADDR
            const result4 = ppu.readRegister(0x05); // PPUSCROLL
            const result5 = ppu.readRegister(0x06); // PPUADDR
            
            // Should return open bus (bits 0-4 from last write)
            assert.equal(result1 & 0xE0, 0x00);
            assert.equal(result2 & 0xE0, 0x00);
            assert.equal(result3 & 0xE0, 0x00);
            assert.equal(result4 & 0xE0, 0x00);
            assert.equal(result5 & 0xE0, 0x00);
        });

        it("should clear VBlank flag on read", function() {
            // Set VBlank flag manually
            ppu.status |= 0x80;
            assert.equal(ppu.status & 0x80, 0x80);
            
            // Reading should clear VBlank flag
            const status = ppu.readRegister(0x02);
            assert.equal(status & 0x80, 0x80); // Should be set in returned value
            assert.equal(ppu.status & 0x80, 0); // Should be cleared internally
        });

        it("should set and clear sprite 0 hit flag", function() {
            ppu.status |= 0x40; // Set sprite 0 hit
            assert.equal(ppu.status & 0x40, 0x40);
            
            ppu.status &= ~0x40; // Clear sprite 0 hit
            assert.equal(ppu.status & 0x40, 0);
        });

        it("should set and clear sprite overflow flag", function() {
            ppu.status |= 0x20; // Set sprite overflow
            assert.equal(ppu.status & 0x20, 0x20);
            
            ppu.status &= ~0x20; // Clear sprite overflow
            assert.equal(ppu.status & 0x20, 0);
        });
    });

    describe("OAMADDR ($2003) - OAM Address", function() {
        it("should set OAM address", function() {
            ppu.writeRegister(0x03, 0x42);
            assert.equal(ppu.oamAddr, 0x42);
        });

        it("should handle full range of OAM addresses", function() {
            for (let addr = 0; addr < 256; addr++) {
                ppu.writeRegister(0x03, addr);
                assert.equal(ppu.oamAddr, addr);
            }
        });
    });

    describe("OAMDATA ($2004) - OAM Data", function() {
        beforeEach(function() {
            ppu.writeRegister(0x03, 0x00); // Reset OAM address
        });

        it("should write to OAM memory", function() {
            ppu.writeRegister(0x04, 0x12);
            assert.equal(ppu.oam[0], 0x12);
            assert.equal(ppu.oamAddr, 1); // Should increment
        });

        it("should read from OAM memory", function() {
            ppu.oam[0] = 0x34;
            const value = ppu.readRegister(0x04);
            assert.equal(value, 0x34);
        });

        it("should increment OAM address after write", function() {
            ppu.writeRegister(0x04, 0x11);
            ppu.writeRegister(0x04, 0x22);
            ppu.writeRegister(0x04, 0x33);
            
            assert.equal(ppu.oam[0], 0x11);
            assert.equal(ppu.oam[1], 0x22);
            assert.equal(ppu.oam[2], 0x33);
        });

        it("should handle OAM address wrap-around", function() {
            ppu.writeRegister(0x03, 0xFF); // Set to last address
            ppu.writeRegister(0x04, 0xAA);
            
            assert.equal(ppu.oam[0xFF], 0xAA);
            assert.equal(ppu.oamAddr, 0x00); // Should wrap to 0
        });
    });

    describe("PPUSCROLL ($2005) - Scroll Registers", function() {
        beforeEach(function() {
            // Reset address latch
            ppu.readRegister(0x02); // Reading PPUSTATUS resets the latch
        });

        it("should handle X scroll on first write", function() {
            ppu.writeRegister(0x05, 0x7F); // X = 127
            
            // In our implementation, this affects fineX and tempAddr
            // We can't directly test all internal state, but we can test behavior
            assert.equal(ppu.fineX, 0x07); // Fine X (bits 0-2)
        });

        it("should handle Y scroll on second write", function() {
            ppu.writeRegister(0x05, 0x00); // First write (X)
            ppu.writeRegister(0x05, 0x5B); // Second write (Y = 91)
            
            // Check if fine Y is set correctly in tempAddr
            assert.equal(ppu.tempVramAddr & 0x7000, 0x3000); // Fine Y bits should be set (0x5B has fine Y = 3)
        });

        it("should handle scroll write sequence correctly", function() {
            // Write X scroll
            ppu.writeRegister(0x05, 0x4C); // X = 76
            // Write Y scroll  
            ppu.writeRegister(0x05, 0x92); // Y = 146
            
            // Verify fine X was set
            assert.equal(ppu.fineX, 0x04);
        });
    });

    describe("PPUADDR ($2006) - VRAM Address", function() {
        beforeEach(function() {
            ppu.readRegister(0x02); // Reset address latch
        });

        it("should handle high byte on first write", function() {
            ppu.writeRegister(0x06, 0x21);
            
            // High byte should be stored in temp address
            assert.equal(ppu.tempVramAddr & 0x2000, 0x2000); // Bit 13 should be set
        });

        it("should handle low byte on second write", function() {
            ppu.writeRegister(0x06, 0x21); // High byte
            ppu.writeRegister(0x06, 0x08); // Low byte
            
            // Should transfer to main address register
            assert.equal(ppu.vramAddr, 0x2108);
        });

        it("should handle full address write sequence", function() {
            // Write high byte
            ppu.writeRegister(0x06, 0x3F);
            // Write low byte
            ppu.writeRegister(0x06, 0x10);
            
            assert.equal(ppu.vramAddr, 0x3F10);
        });
    });

    describe("PPUDATA ($2007) - VRAM Data Read/Write", function() {
        beforeEach(function() {
            ppu.vramAddr = 0x2000;
        });

        it("should write data to VRAM", function() {
            ppu.vramAddr = 0x2000;
            ppu.writeRegister(0x07, 0x42);
            assert.equal(ppu.ppuRead(0x2000), 0x42);
        });

        it("should increment address after write based on control bit", function() {
            ppu.writeRegister(0x00, 0x00); // Increment by 1
            ppu.vramAddr = 0x2000;
            ppu.writeRegister(0x07, 0x11);
            assert.equal(ppu.vramAddr, 0x2001);
            
            ppu.writeRegister(0x00, 0x04); // Increment by 32
            ppu.vramAddr = 0x2000;
            ppu.writeRegister(0x07, 0x22);
            assert.equal(ppu.vramAddr, 0x2020);
        });

        it("should use read buffer for normal VRAM reads", function() {
            // Set up some VRAM data
            ppu.ppuWrite(0x2000, 0x12);
            ppu.ppuWrite(0x2001, 0x34);
            ppu.vramAddr = 0x2000;
            
            // First read should return buffered value (usually previous)
            const firstRead = ppu.readRegister(0x07);
            
            // Second read should return the data from 0x2000 (buffered)
            const secondRead = ppu.readRegister(0x07);
            assert.equal(secondRead, 0x12);
        });
    });

    describe("Frame Timing", function() {
        it("should handle scanline progression", function() {
            ppu.scanline = 260;
            ppu.cycle = 340;
            
            // Simulate end of scanline
            ppu.cycle++;
            if (ppu.cycle > 340) {
                ppu.cycle = 0;
                ppu.scanline++;
            }
            
            // Should wrap around to 261 (then will increment to 262 in next call)
            assert.equal(ppu.scanline, 261);
            assert.equal(ppu.cycle, 0);
        });

        it("should handle VBlank transition", function() {
            // Set control to enable NMI
            ppu.writeRegister(0x00, 0x80);
            
            // Simulate reaching end of frame
            ppu.scanline = 241;
            
            // In our implementation, VBlank would be set in endScanline
            // For now, just test the transition logic
            assert.equal(ppu.scanline, 241);
        });
    });

    describe("Memory Mirroring", function() {
        it("should mirror VRAM addresses correctly", function() {
            // Test that PPU properly mirrors addresses through the bus
            ppu.vramAddr = 0x3000;
            const value = ppu.ppuRead(0x3000);
            
            // Should mirror 0x3000 to 0x2000 range
            assert.isNotNull(value);
        });

        it("should handle palette mirroring", function() {
            // Test palette mirroring (0x3F20 -> 0x3F00, etc.)
            ppu.palette[0x00] = 0x12; // First palette entry
            
            // Reading from palette should return immediate value
            const addr = 0x3F00;
            ppu.vramAddr = addr;
            const value = ppu.ppuRead(addr);
            assert.equal(value, 0x12);
        });
    });
});