/**
 * @fileoverview A more accurate PPU implementation for the NES emulator.
 * This implementation is based on the detailed PPU documentation from the NESdev wiki
 * and other technical references to achieve higher accuracy in rendering and timing.
 * @author Your Name
 */

/**
 * NES Picture Processing Unit (PPU)
 * This class emulates the Ricoh 2C02 PPU found in the NES.
 */
export class PPU {
    /**
     * @param {import('./bus.js').Bus} bus The system bus to communicate with other components.
     */
    constructor(bus) {
        /** @type {import('./bus.js').Bus} */
        this.bus = bus;

        // --- PPU Internal Memory ---

        /**
         * PPU VRAM (Video RAM). 2KB internal RAM for nametables.
         * @type {Uint8Array}
         */
        this.vram = new Uint8Array(2048);

        /**
         * Primary Object Attribute Memory (OAM). 256 bytes for sprite attributes.
         * @type {Uint8Array}
         */
        this.oam = new Uint8Array(256);

        /**
         * Secondary OAM. 32 bytes for sprites on the current scanline.
         * @type {Uint8Array}
         */
        this.secondaryOAM = new Uint8Array(32);

        /**
         * Palette RAM. 32 bytes for background and sprite palettes.
         * @type {Uint8Array}
         */
        this.palette = new Uint8Array(32);

        // --- PPU Registers ---

        /**
         * PPU Control Register ($2000). Write-only.
         * @type {number}
         */
        this.control = 0x00;

        /**
         * PPU Mask Register ($2001). Write-only.
         * @type {number}
         */
        this.mask = 0x00;

        /**
         * PPU Status Register ($2002). Read-only.
         * @type {number}
         */
        this.status = 0x00;

        /**
         * OAM Address Register ($2003). Write-only.
         * @type {number}
         */
        this.oamAddr = 0x00;

        /**
         * Internal VRAM Address Register (v). 15 bits.
         * @type {number}
         */
        this.vramAddr = 0x0000;

        /**
         * Temporary VRAM Address Register (t). 15 bits.
         * @type {number}
         */
        this.tempVramAddr = 0x0000;

        /**
         * Fine X Scroll Register (x). 3 bits.
         * @type {number}
         */
        this.fineX = 0x00;

        /**
         * First/Second Write Toggle (w). 1 bit.
         * @type {number}
         */
        this.writeToggle = 0;

        /**
         * PPU Data Read Buffer ($2007).
         * @type {number}
         */
        this.dataBuffer = 0x00;
        
        /**
         * PPU open bus latch value.
         * @type {number}
         */
        this.openBus = 0x00;
        
        // --- Timing ---

        /**
         * Current cycle within a scanline (0-340).
         * @type {number}
         */
        this.cycle = 0;

        /**
         * Current scanline (-1 to 260).
         * @type {number}
         */
        this.scanline = -1;

        /**
         * Current frame count.
         * @type {number}
         */
        this.frame = 0;

        /**
         * Odd/Even frame flag.
         * @type {boolean}
         */
        this.oddFrame = false;
        
        // --- Rendering State ---
        
        /**
         * The screen buffer (256x240 pixels, RGBA).
         * @type {Uint8Array}
         */
        this.screen = new Uint8Array(256 * 240 * 4);
        
        /**
         * Flag to indicate a frame is ready to be drawn.
         * @type {boolean}
         */
        this.frameReady = false;

        /**
         * NMI (Non-Maskable Interrupt) output flag.
         * @type {boolean}
         */
        this.nmi = false;
        
        // --- Background Rendering ---

        /** @type {number} */
        this.bgNextTileId = 0;
        /** @type {number} */
        this.bgNextTileAttr = 0;
        /** @type {number} */
        this.bgNextTileLsb = 0;
        /** @type {number} */
        this.bgNextTileMsb = 0;

        /** @type {number} */
        this.bgShifterPatternLo = 0;
        /** @type {number} */
        this.bgShifterPatternHi = 0;
        /** @type {number} */
        this.bgShifterAttribLo = 0;
        /** @type {number} */
        this.bgShifterAttribHi = 0;
        
        // --- Sprite Rendering ---

        this.spriteScanline = new Array(8).fill(0).map(() => ({
            y: 0xFF,
            id: 0xFF,
            attr: 0xFF,
            x: 0xFF,
            patternLo: 0,
            patternHi: 0,
            isSpriteZero: false,
        }));
        this.spriteCount = 0;
        this.spriteShifterPatternLo = new Uint8Array(8);
        this.spriteShifterPatternHi = new Uint8Array(8);
        
        /** @type {boolean} */
        this.spriteZeroHitPossible = false;
        /** @type {boolean} */
        this.spriteZeroBeingRendered = false;

        /** @type {import('./cartridge.js').Cartridge | null} */
        this.cartridge = null;

        // Power-up state
        this.powerUpCycles = 0;
        this.canWriteRegisters = false;

        this.reset();
    }
    
    /**
     * Connect a cartridge to the PPU.
     * @param {import('./cartridge.js').Cartridge} cartridge
     */
    connectCartridge(cartridge) {
        this.cartridge = cartridge;
    }
    
    /**
     * Reset the PPU to its power-up state.
     */
    reset() {
        this.control = 0x00;
        this.mask = 0x00;
        this.status = 0x00;
        this.oamAddr = 0x00;
        this.vramAddr = 0x0000;
        this.tempVramAddr = 0x0000;
        this.fineX = 0x00;
        this.writeToggle = 0;
        this.dataBuffer = 0x00;
        this.openBus = 0x00;
        
        this.cycle = 0;
        this.scanline = -1;
        this.frame = 0;
        this.oddFrame = false;
        
        this.nmi = false;
        
        this.vram.fill(0);
        this.oam.fill(0);
        this.palette.fill(0);
        this.secondaryOAM.fill(0xFF);
        this.screen.fill(0);

        this.frameReady = false;

        // Power-up state
        this.powerUpCycles = 0;
        this.canWriteRegisters = false;
    }
    
    /**
     * Read from a PPU register.
     * @param {number} addr The address to read from ($2000-$2007).
     * @returns {number} The value read from the register.
     */
    readRegister(addr) {
        addr &= 0x07;
        let data = this.openBus;

        switch(addr) {
            case 0x00: // PPUCTRL - Write-only
            case 0x01: // PPUMASK - Write-only
            case 0x03: // OAMADDR - Write-only
            case 0x05: // PPUSCROLL - Write-only
            case 0x06: // PPUADDR - Write-only
                break;
            case 0x02: // PPUSTATUS
                data = (this.status & 0xE0) | (this.openBus & 0x1F);
                this.status &= ~0x80; // Clear VBlank flag
                this.writeToggle = 0;   // Reset write toggle
                break;
            case 0x04: // OAMDATA
                data = this.oam[this.oamAddr];
                break;
            case 0x07: // PPUDATA
                data = this.dataBuffer;
                this.dataBuffer = this.ppuRead(this.vramAddr);

                if (this.vramAddr >= 0x3F00) {
                    // Palette reads are not buffered. The read buffer is filled with the mirrored nametable data "underneath" the palette data.
                    data = this.dataBuffer;
                }

                this.vramAddr = (this.vramAddr + ((this.control & 0x04) ? 32 : 1)) & 0x7FFF;
                break;
        }

        this.openBus = data;
        return data;
    }
    
    /**
     * Write to a PPU register.
     * @param {number} addr The address to write to ($2000-$2007).
     * @param {number} data The value to write.
     */
    writeRegister(addr, data) {
        this.openBus = data;
        addr &= 0x07;

        switch(addr) {
            case 0x00: // PPUCTRL
                this.control = data;
                // t: ...GH.. ........ <- d: ......GH
                this.tempVramAddr = (this.tempVramAddr & 0xF3FF) | ((data & 0x03) << 10);
                break;
            case 0x01: // PPUMASK
                this.mask = data;
                break;
            case 0x02: // PPUSTATUS - Read-only
                break;
            case 0x03: // OAMADDR
                this.oamAddr = data;
                break;
            case 0x04: // OAMDATA
                this.oam[this.oamAddr] = data;
                this.oamAddr = (this.oamAddr + 1) & 0xFF;
                break;
            case 0x05: // PPUSCROLL
                if (this.writeToggle === 0) {
                    // First write (X scroll)
                    // t: ....... ...ABCDE <- d: ABCDE...
                    this.tempVramAddr = (this.tempVramAddr & 0xFFE0) | (data >> 3);
                    // x: FGH <- d: .....FGH
                    this.fineX = data & 0x07;
                    this.writeToggle = 1;
                } else {
                    // Second write (Y scroll)
                    // t: FGH.. ... ..... <- d: .....FGH
                    this.tempVramAddr = (this.tempVramAddr & 0x8FFF) | ((data & 0x07) << 12);
                    // t: ...AB CDE..... <- d: ABCDE...
                    this.tempVramAddr = (this.tempVramAddr & 0xFC1F) | ((data & 0xF8) << 2);
                    this.writeToggle = 0;
                }
                break;
            case 0x06: // PPUADDR
                if (this.writeToggle === 0) {
                    // First write (high byte)
                    // t: .CDE FG...... <- d: ..CDEFGH
                    // t: Z...... ........ <- 0 (bit 14 cleared)
                    this.tempVramAddr = (this.tempVramAddr & 0x00FF) | ((data & 0x3F) << 8);
                    this.writeToggle = 1;
                } else {
                    // Second write (low byte)
                    // t: ....... ABCDEFGH <- d: ABCDEFGH
                    this.tempVramAddr = (this.tempVramAddr & 0xFF00) | data;
                    // v: <...all bits...> <- t: <...all bits...>
                    this.vramAddr = this.tempVramAddr;
                    this.writeToggle = 0;
                }
                break;
            case 0x07: // PPUDATA
                this.ppuWrite(this.vramAddr, data);
                this.vramAddr = (this.vramAddr + ((this.control & 0x04) ? 32 : 1)) & 0x7FFF;
                break;
        }
    }
    
    /**
     * Read from PPU-mapped memory.
     * @param {number} addr The address to read from.
     * @returns {number} The value read.
     */
    ppuRead(addr) {
        addr &= 0x3FFF;

        if (this.cartridge && this.cartridge.ppuRead(addr)) {
            return this.cartridge.ppuRead(addr);
        } else if (addr >= 0x0000 && addr <= 0x1FFF) {
            // This should be handled by cartridge, but as a fallback:
            return 0;
        } else if (addr >= 0x2000 && addr <= 0x3EFF) {
            addr &= 0x0FFF;
            const mirror = this.cartridge?.getMirror() || 'horizontal';
            if (mirror === 'vertical') {
                if (addr >= 0x0800) return this.vram[addr - 0x800];
            } else if (mirror === 'horizontal') {
                if (addr >= 0x0400 && addr < 0x0800) return this.vram[addr - 0x400];
                if (addr >= 0x0C00) return this.vram[addr - 0x400];
            } else if (mirror === 'single-screen-lo') {
                 return this.vram[addr & 0x03FF];
            } else if (mirror === 'single-screen-hi') {
                 return this.vram[1024 + (addr & 0x03FF)];
            }
            return this.vram[addr];
        } else if (addr >= 0x3F00 && addr <= 0x3FFF) {
            addr &= 0x001F;
            if (addr === 0x0010) addr = 0x0000;
            if (addr === 0x0014) addr = 0x0004;
            if (addr === 0x0018) addr = 0x0008;
            if (addr === 0x001C) addr = 0x000C;
            return this.palette[addr] & ((this.mask & 0x01) ? 0x30 : 0x3F);
        }
        return 0;
    }

    /**
     * Write to PPU-mapped memory.
     * @param {number} addr The address to write to.
     * @param {number} data The value to write.
     */
    ppuWrite(addr, data) {
        addr &= 0x3FFF;

        if (this.cartridge && this.cartridge.ppuWrite(addr, data)) {
            return;
        } else if (addr >= 0x0000 && addr <= 0x1FFF) {
            // Cartridge should handle this
        } else if (addr >= 0x2000 && addr <= 0x3EFF) {
            addr &= 0x0FFF;
            const mirror = this.cartridge?.getMirror() || 'horizontal';
            if (mirror === 'vertical') {
                if (addr >= 0x0800) this.vram[addr - 0x800] = data;
                else this.vram[addr] = data;
            } else if (mirror === 'horizontal') {
                if (addr >= 0x0400 && addr < 0x0800) this.vram[addr-0x400] = data;
                else if (addr >= 0x0C00) this.vram[addr-0x400] = data;
                else this.vram[addr] = data;
            } else if (mirror === 'single-screen-lo') {
                 this.vram[addr & 0x03FF] = data;
            } else if (mirror === 'single-screen-hi') {
                 this.vram[1024 + (addr & 0x03FF)] = data;
            } else {
                 this.vram[addr] = data;
            }
        } else if (addr >= 0x3F00 && addr <= 0x3FFF) {
            addr &= 0x001F;
            if (addr === 0x0010) addr = 0x0000;
            if (addr === 0x0014) addr = 0x0004;
            if (addr === 0x0018) addr = 0x0008;
            if (addr === 0x001C) addr = 0x000C;
            this.palette[addr] = data;
        }
    }
    
    /**
     * Perform one PPU clock cycle.
     */
    clock() {
        const renderingEnabled = (this.mask & 0x08) || (this.mask & 0x10);
        const isVisibleScanline = this.scanline >= 0 && this.scanline < 240;
        const isPreRenderScanline = this.scanline === -1;
        const isVBlankScanline = this.scanline === 241;

        if (renderingEnabled) {
            if (this.oddFrame && isPreRenderScanline && this.cycle === 339) {
                this.cycle = 0;
                this.scanline++;
                return;
            }
        }

        if (isPreRenderScanline && this.cycle === 1) {
            this.status &= ~0xE0; // Clear V, S, O flags
        }

        if (isVBlankScanline && this.cycle === 1) {
            this.status |= 0x80; // Set VBlank
            if (this.control & 0x80) {
                this.nmi = true;
            }
        }
        
        if (renderingEnabled) {
            if (isVisibleScanline || isPreRenderScanline) {
                // Background rendering
                if ((this.cycle >= 2 && this.cycle <= 257) || (this.cycle >= 322 && this.cycle <= 337)) {
                    if (this.mask & 0x08) {
                        this.bgShifterPatternLo <<= 1;
                        this.bgShifterPatternHi <<= 1;
                        this.bgShifterAttribLo <<= 1;
                        this.bgShifterAttribHi <<= 1;
                    }
                    if (this.mask & 0x10 && this.cycle >=1 && this.cycle < 258) {
                        for (let i = 0; i < this.spriteCount; i++) {
                            if (this.spriteScanline[i].x > 0) {
                                this.spriteScanline[i].x--;
                            } else {
                                this.spriteShifterPatternLo[i] <<= 1;
                                this.spriteShifterPatternHi[i] <<= 1;
                            }
                        }
                    }

                    switch ((this.cycle - 1) % 8) {
                        case 0:
                            this.bgShifterPatternLo = (this.bgShifterPatternLo & 0xFF00) | this.bgNextTileLsb;
                            this.bgShifterPatternHi = (this.bgShifterPatternHi & 0xFF00) | this.bgNextTileMsb;
                            this.bgShifterAttribLo = (this.bgShifterAttribLo & 0xFF00) | ((this.bgNextTileAttr & 0x01) ? 0xFF : 0x00);
                            this.bgShifterAttribHi = (this.bgShifterAttribHi & 0xFF00) | ((this.bgNextTileAttr & 0x02) ? 0xFF : 0x00);
                            this.bgNextTileId = this.ppuRead(0x2000 | (this.vramAddr & 0x0FFF));
                            break;
                        case 2:
                            this.bgNextTileAttr = this.ppuRead(0x23C0 | (this.vramAddr & 0x0C00) | ((this.vramAddr >> 4) & 0x38) | ((this.vramAddr >> 2) & 0x07));
                            if ((this.vramAddr & 0x0040) > 0) this.bgNextTileAttr >>= 4;
                            if ((this.vramAddr & 0x0002) > 0) this.bgNextTileAttr >>= 2;
                            this.bgNextTileAttr &= 0x03;
                            break;
                        case 4:
                            this.bgNextTileLsb = this.ppuRead(((this.control & 0x10) ? 0x1000 : 0x0000) + (this.bgNextTileId << 4) + ((this.vramAddr >> 12) & 0x07));
                            break;
                        case 6:
                            this.bgNextTileMsb = this.ppuRead(((this.control & 0x10) ? 0x1000 : 0x0000) + (this.bgNextTileId << 4) + ((this.vramAddr >> 12) & 0x07) + 8);
                            break;
                        case 7:
                            if ((this.vramAddr & 0x001F) === 31) {
                                this.vramAddr &= ~0x001F;
                                this.vramAddr ^= 0x0400;
                            } else {
                                this.vramAddr++;
                            }
                            break;
                    }
                }
                
                if (this.cycle === 256) {
                    if ((this.vramAddr & 0x7000) !== 0x7000) {
                        this.vramAddr += 0x1000;
                    } else {
                        this.vramAddr &= ~0x7000;
                        let y = (this.vramAddr & 0x03E0) >> 5;
                        if (y === 29) {
                            y = 0; this.vramAddr ^= 0x0800;
                        } else if (y === 31) {
                            y = 0;
                        } else {
                            y++;
                        }
                        this.vramAddr = (this.vramAddr & ~0x03E0) | (y << 5);
                    }
                }
                
                if (this.cycle === 257) {
                    this.vramAddr = (this.vramAddr & ~0x041F) | (this.tempVramAddr & 0x041F);
                }
                
                if (isPreRenderScanline && this.cycle >= 280 && this.cycle <= 304) {
                    this.vramAddr = (this.vramAddr & ~0x7BE0) | (this.tempVramAddr & 0x7BE0);
                }

                // Sprite evaluation
                if (this.cycle === 257 && isVisibleScanline) {
                    this.evaluateSprites();
                }

                // Sprite fetches
                if (this.cycle === 340 && isVisibleScanline) {
                    const spriteHeight = (this.control & 0x20) ? 16 : 8;
                    for(let i = 0; i < this.spriteCount; i++) {
                        let spritePatternAddrLo, spritePatternAddrHi;
                        const sprite = this.spriteScanline[i];
                        
                        if (!(this.control & 0x20)) { // 8x8
                            const patternTable = (this.control & 0x08) << 9;
                            let row = this.scanline - sprite.y;
                            if (sprite.attr & 0x80) row = 7 - row;
                            spritePatternAddrLo = patternTable + (sprite.id << 4) + row;
                        } else { // 8x16
                            const patternTable = (sprite.id & 0x01) << 12;
                            let row = this.scanline - sprite.y;
                            if(sprite.attr & 0x80) row = 15 - row;
                            const tileId = (sprite.id & 0xFE) + (row > 7 ? 1 : 0);
                            spritePatternAddrLo = patternTable + (tileId << 4) + (row & 7);
                        }
                        
                        spritePatternAddrHi = spritePatternAddrLo + 8;
                        sprite.patternLo = this.ppuRead(spritePatternAddrLo);
                        sprite.patternHi = this.ppuRead(spritePatternAddrHi);
                    }
                }
            }
        }
        
        if (isVisibleScanline && this.cycle >= 1 && this.cycle <= 256) {
            let bg_pixel = 0, bg_palette = 0;
            if (this.mask & 0x08) {
                const bit_mux = 0x8000 >> this.fineX;
                bg_pixel = ( ((this.bgShifterPatternHi & bit_mux) > 0) << 1) | ((this.bgShifterPatternLo & bit_mux) > 0);
                bg_palette = ( ((this.bgShifterAttribHi & bit_mux) > 0) << 1) | ((this.bgShifterAttribLo & bit_mux) > 0);
            }

            let sp_pixel = 0, sp_palette = 0, sp_priority = 0;
            if (this.mask & 0x10) {
                this.spriteZeroBeingRendered = false;
                for (let i = 0; i < this.spriteCount; i++) {
                    if (this.spriteScanline[i].x === 0) {
                        const fg_pixel_lo = (this.spriteScanline[i].patternLo & 0x80) > 0;
                        const fg_pixel_hi = (this.spriteScanline[i].patternHi & 0x80) > 0;
                        sp_pixel = (fg_pixel_hi << 1) | fg_pixel_lo;

                        if (sp_pixel !== 0) {
                            sp_palette = (this.spriteScanline[i].attr & 0x03) + 0x04;
                            sp_priority = (this.spriteScanline[i].attr & 0x20) === 0;
                            if (this.spriteScanline[i].isSpriteZero) this.spriteZeroBeingRendered = true;
                            break;
                        }
                    }
                }
            }

            let final_pixel = 0, final_palette = 0;
            if (bg_pixel === 0 && sp_pixel > 0) {
                final_pixel = sp_pixel; final_palette = sp_palette;
            } else if (bg_pixel > 0 && sp_pixel === 0) {
                final_pixel = bg_pixel; final_palette = bg_palette;
            } else if (bg_pixel > 0 && sp_pixel > 0) {
                if (sp_priority) {
                    final_pixel = sp_pixel; final_palette = sp_palette;
                } else {
                    final_pixel = bg_pixel; final_palette = bg_palette;
                }
                if (this.spriteZeroHitPossible && this.spriteZeroBeingRendered && (this.mask & 0x18) === 0x18) {
                    if (this.cycle > 9 && this.cycle < 256) {
                        this.status |= 0x40;
                    }
                }
            }

            const x = this.cycle - 1, y = this.scanline;
            const offset = (y * 256 + x) * 4;
            const color_idx = this.ppuRead(0x3F00 + (final_palette << 2) + final_pixel);
            const color = PALETTE[color_idx];
            
            this.screen[offset] = color[0];
            this.screen[offset + 1] = color[1];
            this.screen[offset + 2] = color[2];
            this.screen[offset + 3] = 255;
        }

        this.cycle++;
        if (this.cycle > 340) {
            this.cycle = 0;
            this.scanline++;
            if (this.scanline > 260) {
                this.scanline = -1;
                this.frame++;
                this.oddFrame = !this.oddFrame;
                this.frameReady = true;
            }
        }
    }
    
    /**
     * Sprite evaluation for the next scanline.
     */
    evaluateSprites() {
        this.secondaryOAM.fill(0xFF);
        this.spriteCount = 0;
        this.spriteZeroHitPossible = false;
        const spriteHeight = (this.control & 0x20) ? 16 : 8;

        for (let i = 0; i < 64; i++) {
            const y = this.oam[i * 4];
            const row = this.scanline - y;

            if (row >= 0 && row < spriteHeight) {
                if (this.spriteCount < 8) {
                    if (i === 0) this.spriteZeroHitPossible = true;
                    this.secondaryOAM[this.spriteCount * 4 + 0] = y;
                    this.secondaryOAM[this.spriteCount * 4 + 1] = this.oam[i * 4 + 1];
                    this.secondaryOAM[this.spriteCount * 4 + 2] = this.oam[i * 4 + 2];
                    this.secondaryOAM[this.spriteCount * 4 + 3] = this.oam[i * 4 + 3];
                }
                this.spriteCount++;
            }
        }
        
        if (this.spriteCount > 8) {
            this.spriteCount = 8;
            this.status |= 0x20; // Set sprite overflow
        }
    }
    
    /**
     * Check if NMI should be triggered.
     * @returns {boolean}
     */
    checkNMI() {
        if (this.nmi) {
            this.nmi = false;
            return true;
        }
        return false;
    }

    /**
     * Get the screen buffer.
     * @returns {Uint8Array}
     */
    getScreen() {
        return this.screen;
    }
    
    getScreenBuffer() {
        return this.screen;
    }

    /**
     * Returns an RGB color object for a given NES color index.
     * @param {number} index - The NES color index (0-63).
     * @returns {{r: number, g: number, b: number}} - The RGB color.
     */
    getNESColor(index) {
        const color = PALETTE[index & 0x3F];
        return { r: color[0], g: color[1], b: color[2] };
    }

    /**
     * Returns a color index from the palette RAM.
     * @param {number} palette - The palette number (0-7).
     * @param {number} pixel - The pixel index (0-3).
     * @returns {number} The color index.
     */
    getColorFromPalette(palette, pixel) {
        return this.ppuRead(0x3F00 + (palette << 2) + pixel);
    }

    /**
     * OAM DMA Transfer
     * @param {number} page The high byte of the CPU memory page to copy from.
     */
    oamDMA(page) {
        const startAddr = page << 8;
        for (let i = 0; i < 256; i++) {
            this.oam[(this.oamAddr + i) & 0xFF] = this.bus.read(startAddr + i);
        }
    }
}

/**
 * NES System Palette (NTSC)
 * @type {Array<[number, number, number]>}
 */
export const PALETTE = [
    [84, 84, 84], [0, 30, 116], [8, 16, 144], [48, 0, 136], [68, 0, 100], [92, 0, 48], [84, 4, 0], [60, 24, 0], [32, 42, 0], [8, 58, 0], [0, 64, 0], [0, 60, 0], [0, 50, 60], [0, 0, 0], [0, 0, 0], [0, 0, 0],
    [152, 152, 152], [8, 76, 196], [48, 50, 236], [92, 30, 228], [136, 20, 176], [160, 20, 100], [152, 34, 32], [120, 60, 0], [84, 90, 0], [40, 114, 0], [8, 124, 0], [0, 118, 40], [0, 102, 120], [0, 0, 0], [0, 0, 0], [0, 0, 0],
    [236, 236, 236], [76, 154, 236], [120, 124, 236], [176, 98, 236], [228, 84, 236], [236, 88, 180], [236, 120, 120], [212, 136, 32], [160, 170, 0], [116, 196, 0], [76, 208, 32], [56, 204, 108], [56, 180, 204], [60, 60, 60], [0, 0, 0], [0, 0, 0],
    [236, 236, 236], [168, 204, 236], [188, 188, 236], [212, 178, 236], [236, 174, 236], [236, 174, 212], [236, 180, 176], [228, 196, 144], [204, 210, 120], [180, 222, 120], [168, 226, 144], [152, 226, 180], [160, 214, 228], [160, 160, 160], [0, 0, 0], [0, 0, 0],
];
