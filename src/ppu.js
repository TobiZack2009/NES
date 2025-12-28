export class PPU {
    constructor(bus) {
        this.bus = bus;
        
        // Initialize address latch
        this.addrLatch = 0;
        this.fineX = 0;
        
        // PPU Memory
        this.vram = new Uint8Array(0x800);      // 2KB VRAM
        this.oam = new Uint8Array(0x100);       // 256 bytes Object Attribute Memory
        this.palette = new Uint8Array(0x20);    // 32 bytes palette memory
        
        // PPU Registers
        this.control = 0x00;
        this.mask = 0x00;
        this.status = 0x00;
        this.oamAddr = 0x00;
        this.scrollX = 0x00;
        this.scrollY = 0x00;
        this.addr = 0x0000;
        this.dataBuffer = 0x00;
        
        // PPU Timing
        this.cycle = 0;         // 0-340
        this.scanline = -1;     // -1 (pre-render), 0-239 (visible), 240 (post-render), 241-260 (vblank)
        this.frame = 0;
        
        // VRAM Address Registers (Loopy)
        this.vramAddr = 0x0000;
        this.tramAddr = 0x0000;
        
        // Rendering State
        this.bgNextTileId = 0;
        this.bgNextTileAttr = 0;
        this.bgNextTileLsb = 0;
        this.bgNextTileMsb = 0;
        
        this.bgShifterPatternLo = 0;
        this.bgShifterPatternHi = 0;
        this.bgShifterAttribLo = 0;
        this.bgShifterAttribHi = 0;
        
        // Frame buffer
        this.screen = new Uint8Array(256 * 240 * 4); // RGBA
        
        // NMI flag
        this.nmi = false;
        
        // Sprites
        this.spriteScanline = [];
        this.spriteZeroHit = false;
        this.spriteOverflow = false;
        
        this.cartridge = null;
    }
    
    connectCartridge(cartridge) {
        this.cartridge = cartridge;
    }
    
    reset() {
        this.control = 0x00;
        this.mask = 0x00;
        this.status = 0x00;
        this.oamAddr = 0x00;
        this.scrollX = 0x00;
        this.scrollY = 0x00;
        this.addr = 0x0000;
        this.dataBuffer = 0x00;
        
        this.cycle = 0;
        this.scanline = -1;
        this.frame = 0;
        
        this.vramAddr = 0x0000;
        this.tramAddr = 0x0000;
        
        this.bgNextTileId = 0;
        this.bgNextTileAttr = 0;
        this.bgNextTileLsb = 0;
        this.bgNextTileMsb = 0;
        
        this.bgShifterPatternLo = 0;
        this.bgShifterPatternHi = 0;
        this.bgShifterAttribLo = 0;
        this.bgShifterAttribHi = 0;
        
        this.nmi = false;
        this.spriteZeroHit = false;
        this.spriteOverflow = false;
        
        // Clear OAM
        this.oam.fill(0);
        
        // Clear palette with default values
        for (let i = 0; i < 32; i++) {
            this.palette[i] = i % 4 === 0 ? 0x0F : (i - 1) % 4 + 1;
        }
    }
    
    clock() {
        // Increment PPU cycle
        this.cycle++;
        
        if (this.cycle >= 341) {
            this.cycle = 0;
            this.scanline++;
            
            if (this.scanline >= 261) {
                this.scanline = -1;
                this.frame++;
            }
        }
        
        // Determine current phase
        const isPreRender = this.scanline === -1;
        const isVisible = this.scanline >= 0 && this.scanline < 240;
        const isPostRender = this.scanline === 240;
        const isVBlank = this.scanline >= 241 && this.scanline < 261;
        
        // Handle VBlank
        if (isPostRender) {
            // Do nothing in post-render scanline
        } else if (isVBlank) {
            if (this.scanline === 241 && this.cycle === 1) {
                this.status |= 0x80; // Set VBlank flag
                if (this.control & 0x80) {
                    this.nmi = true;
                }
            }
        } else if (isPreRender) {
            if (this.cycle === 1) {
                this.status &= ~0x80; // Clear VBlank flag
                this.status &= ~0x40; // Clear sprite overflow
                this.status &= ~0x20; // Clear sprite zero hit
                this.nmi = false;
            }
            
            // Perform same operations as visible scanlines
            if (this.cycle >= 280 && this.cycle <= 304) {
                this.transferAddress();
            }
            
            if (this.cycle >= 1 && this.cycle < 257) {
                this.backgroundRendering();
            } else if (this.cycle >= 321 && this.cycle < 337) {
                this.backgroundRendering();
            }
        } else if (isVisible) {
            // Visible scanlines
            if (this.cycle >= 1 && this.cycle < 257) {
                this.backgroundRendering();
                this.spriteEvaluation();
                this.pixelRendering();
            } else if (this.cycle >= 321 && this.cycle < 337) {
                this.backgroundRendering();
            }
            
            if (this.cycle === 256) {
                this.incrementScrollY();
            }
            
            if (this.cycle === 257) {
                this.transferX();
                this.loadSpritesForNextLine();
            }
        }
    }
    
    backgroundRendering() {
        if (this.mask & 0x08) { // Background enabled
            if (this.cycle <= 256 || (this.cycle >= 321 && this.cycle <= 336)) {
                switch (this.cycle % 8) {
                    case 1:
                        this.fetchNametableByte();
                        break;
                    case 3:
                        this.fetchAttributeTableByte();
                        break;
                    case 5:
                        this.fetchTileBitmapLow();
                        break;
                    case 7:
                        this.fetchTileBitmapHigh();
                        break;
                    case 0:
                        this.storeTileData();
                        break;
                }
            }
        }
    }
    
    spriteEvaluation() {
        if (this.cycle === 257) {
            this.evaluateSprites();
        }
    }
    
    pixelRendering() {
        if (this.cycle >= 1 && this.cycle <= 256) {
            const x = this.cycle - 1;
            const y = this.scanline;
            
            // Get background pixel
            const bgPixel = this.getBackgroundPixel(x);
            
            // Get sprite pixel
            const spritePixel = this.getSpritePixel(x);
            
            // Determine final pixel color
            let pixelColor;
            
            if (this.mask & 0x10) { // Sprites enabled
                if (spritePixel.palette !== 0 && spritePixel.priority !== 0) {
                    pixelColor = spritePixel;
                } else if (bgPixel.palette !== 0) {
                    pixelColor = bgPixel;
                } else if (spritePixel.palette !== 0) {
                    pixelColor = spritePixel;
                } else {
                    pixelColor = { palette: 0, value: 0 };
                }
            } else if (this.mask & 0x08) { // Background only
                pixelColor = bgPixel.palette !== 0 ? bgPixel : { palette: 0, value: 0 };
            } else {
                pixelColor = { palette: 0, value: 0 };
            }
            
            // Write to screen buffer
            const colorIndex = this.getColorFromPalette(pixelColor.palette, pixelColor.value);
            const pixelIndex = (y * 256 + x) * 4;
            const color = this.getNESColor(colorIndex);
            
            this.screen[pixelIndex] = color.r;
            this.screen[pixelIndex + 1] = color.g;
            this.screen[pixelIndex + 2] = color.b;
            this.screen[pixelIndex + 3] = 255;
        }
    }
    
    getBackgroundPixel(x) {
        if ((this.mask & 0x08) === 0) {
            return { palette: 0, value: 0 };
        }
        
        // Extract pattern from shifters
        const bitMsb = (this.bgShifterPatternHi >> (15 - x % 8)) & 1;
        const bitLsb = (this.bgShifterPatternLo >> (15 - x % 8)) & 1;
        const patternValue = (bitMsb << 1) | bitLsb;
        
        if (patternValue === 0) {
            return { palette: 0, value: 0 };
        }
        
        // Extract palette from attribute shifters
        const attribMsb = (this.bgShifterAttribHi >> (7 - x % 8)) & 1;
        const attribLsb = (this.bgShifterAttribLo >> (7 - x % 8)) & 1;
        const paletteIndex = (attribMsb << 1) | attribLsb;
        
        return { palette: paletteIndex + 1, value: patternValue };
    }
    
    getSpritePixel(x) {
        if ((this.mask & 0x10) === 0) {
            return { palette: 0, value: 0, priority: 0 };
        }
        
        for (let i = 0; i < this.spriteScanline.length; i++) {
            const sprite = this.spriteScanline[i];
            if (x >= sprite.x && x < sprite.x + 8) {
                const patternValue = this.getSpritePatternBit(sprite, x - sprite.x);
                
                if (patternValue !== 0) {
                    // Check for sprite zero hit
                    if (i === 0 && this.getBackgroundPixel(x).palette !== 0 && this.cycle !== 256) {
                        this.spriteZeroHit = true;
                        this.status |= 0x40;
                    }
                    
                    return {
                        palette: sprite.palette,
                        value: patternValue,
                        priority: sprite.priority
                    };
                }
            }
        }
        
        return { palette: 0, value: 0, priority: 0 };
    }
    
    getSpritePatternBit(sprite, offsetX) {
        // This is a simplified version - needs proper implementation
        return 0;
    }
    
    fetchNametableByte() {
        const addr = 0x2000 | (this.vramAddr & 0x0FFF);
        this.bgNextTileId = this.ppuRead(addr);
    }
    
    fetchAttributeTableByte() {
        const addr = 0x23C0 | 
                    (this.vramAddr & 0x0C00) | 
                    ((this.vramAddr >> 4) & 0x38) | 
                    ((this.vramAddr >> 2) & 0x07);
        this.bgNextTileAttr = this.ppuRead(addr);
    }
    
    fetchTileBitmapLow() {
        const fineY = (this.vramAddr >> 12) & 0x03;
        const tileAddr = 0x1000 * ((this.control >> 4) & 0x01) | 
                        (this.bgNextTileId << 4) | fineY;
        this.bgNextTileLsb = this.ppuRead(tileAddr);
    }
    
    fetchTileBitmapHigh() {
        const fineY = (this.vramAddr >> 12) & 0x03;
        const tileAddr = 0x1000 * ((this.control >> 4) & 0x01) | 
                        (this.bgNextTileId << 4) | fineY;
        this.bgNextTileMsb = this.ppuRead(tileAddr + 8);
    }
    
    storeTileData() {
        this.bgShifterPatternLo = (this.bgShifterPatternLo << 8) | this.bgNextTileLsb;
        this.bgShifterPatternHi = (this.bgShifterPatternHi << 8) | this.bgNextTileMsb;
        this.bgShifterAttribLo = (this.bgShifterAttribLo << 8) | ((this.bgNextTileAttr & 0x01) ? 0xFF : 0x00);
        this.bgShifterAttribHi = (this.bgShifterAttribHi << 8) | ((this.bgNextTileAttr & 0x02) ? 0xFF : 0x00);
        this.bgShifterAttribLo = (this.bgShifterAttribLo << 8) | ((this.bgNextTileAttr & 0x04) ? 0xFF : 0x00);
        this.bgShifterAttribHi = (this.bgShifterAttribHi << 8) | ((this.bgNextTileAttr & 0x08) ? 0xFF : 0x00);
        
        this.incrementScrollX();
    }
    
    incrementScrollX() {
        if ((this.mask & 0x18) !== 0) { // Background or sprites enabled
            if ((this.vramAddr & 0x001F) === 0x001F) {
                this.vramAddr &= ~0x001F; // Clear coarse X
                this.vramAddr ^= 0x0400;  // Switch horizontal nametable
            } else {
                this.vramAddr += 1;
            }
        }
    }
    
    incrementScrollY() {
        if ((this.mask & 0x18) !== 0) { // Background or sprites enabled
            if ((this.vramAddr & 0x7000) !== 0x7000) {
                this.vramAddr += 0x1000;
            } else {
                this.vramAddr &= ~0x7000;
                
                if ((this.vramAddr & 0x03E0) === 0x03A0) {
                    this.vramAddr &= ~0x03E0;
                    this.vramAddr ^= 0x0800;
                } else if ((this.vramAddr & 0x03E0) === 0x03E0) {
                    this.vramAddr &= ~0x03E0;
                } else {
                    this.vramAddr += 0x0020;
                }
            }
        }
    }
    
    transferAddress() {
        if ((this.mask & 0x18) !== 0) { // Background or sprites enabled
            this.vramAddr = (this.vramAddr & ~0x7BE0) | (this.tramAddr & 0x7BE0);
        }
    }
    
    transferX() {
        if ((this.mask & 0x18) !== 0) { // Background or sprites enabled
            this.vramAddr = (this.vramAddr & ~0x041F) | (this.tramAddr & 0x041F);
        }
    }
    
    evaluateSprites() {
        // Reset sprite scanline
        this.spriteScanline = [];
        let spriteCount = 0;
        
        const spriteHeight = (this.control & 0x20) ? 16 : 8;
        
        // Scan OAM for sprites on this scanline
        for (let i = 0; i < 64 && spriteCount < 8; i++) {
            const spriteY = this.oam[i * 4];
            
            if (this.scanline >= spriteY && this.scanline < spriteY + spriteHeight) {
                const sprite = {
                    y: spriteY,
                    id: this.oam[i * 4 + 1],
                    attr: this.oam[i * 4 + 2],
                    x: this.oam[i * 4 + 3],
                    palette: (this.oam[i * 4 + 2] & 0x03) + 4,
                    priority: (this.oam[i * 4 + 2] & 0x20) ? 1 : 0,
                    hFlip: (this.oam[i * 4 + 2] & 0x40) ? 1 : 0,
                    vFlip: (this.oam[i * 4 + 2] & 0x80) ? 1 : 0
                };
                
                this.spriteScanline.push(sprite);
                spriteCount++;
            }
        }
        
        // Check for sprite overflow
        if (spriteCount >= 8) {
            this.spriteOverflow = true;
            this.status |= 0x20;
        }
    }
    
    loadSpritesForNextLine() {
        // Prepare sprites for next scanline
        // This would load sprite pattern data into shifters
    }
    
    getColorFromPalette(palette, index) {
        if (palette === 0 && index === 0) {
            return 0x0F; // Universal background color
        }
        const addr = 0x3F00 + (palette * 4 + index);
        return this.ppuRead(addr) & 0x3F;
    }
    
    getNESColor(colorIndex) {
        // NES palette
        const palette = [
            {r: 84,  g: 84,  b: 84},   // 0x00
            {r: 0,   g: 30,  b: 116},  // 0x01
            {r: 8,   g: 16,  b: 144},  // 0x02
            {r: 48,  g: 0,   b: 136},  // 0x03
            {r: 68,  g: 0,   b: 100},  // 0x04
            {r: 92,  g: 0,   b: 48},   // 0x05
            {r: 84,  g: 4,   b: 0},    // 0x06
            {r: 60,  g: 24,  b: 0},    // 0x07
            {r: 32,  g: 42,  b: 0},    // 0x08
            {r: 8,   g: 58,  b: 0},    // 0x09
            {r: 0,   g: 64,  b: 0},    // 0x0A
            {r: 0,   g: 60,  b: 0},    // 0x0B
            {r: 0,   g: 50,  b: 60},   // 0x0C
            {r: 0,   g: 0,   b: 0},    // 0x0D
            {r: 0,   g: 0,   b: 0},    // 0x0E
            {r: 0,   g: 0,   b: 0},    // 0x0F
            {r: 152, g: 0,   b: 0},    // 0x10
            {r: 8,   g: 76,  b: 196},  // 0x11
            {r: 48,  g: 50,  b: 236},  // 0x12
            {r: 92,  g: 30,  b: 228},  // 0x13
            {r: 136, g: 20,  b: 176},  // 0x14
            {r: 160, g: 20,  b: 100},  // 0x15
            {r: 152, g: 34,  b: 32},   // 0x16
            {r: 120, g: 60,  b: 0},    // 0x17
            {r: 84,  g: 90,  b: 0},    // 0x18
            {r: 40,  g: 114, b: 0},    // 0x19
            {r: 8,   g: 124, b: 0},    // 0x1A
            {r: 0,   g: 118, b: 40},   // 0x1B
            {r: 0,   g: 102, b: 80},   // 0x1C
            {r: 0,   g: 0,   b: 0},    // 0x1D
            {r: 0,   g: 0,   b: 0},    // 0x1E
            {r: 0,   g: 0,   b: 0},    // 0x1F
            {r: 236, g: 0,   b: 0},    // 0x20
            {r: 76,  g: 0,   b: 0},    // 0x21
            {r: 168, g: 0,   b: 32},   // 0x22
            {r: 228, g: 0,   b: 80},   // 0x23
            {r: 236, g: 58,  b: 92},   // 0x24
            {r: 172, g: 54,  b: 0},    // 0x25
            {r: 236, g: 88,  b: 0},    // 0x26
            {r: 200, g: 120, b: 0},    // 0x27
            {r: 152, g: 120, b: 0},    // 0x28
            {r: 108, g: 152, b: 0},    // 0x29
            {r: 44,  g: 180, b: 48},   // 0x2A
            {r: 0,   g: 168, b: 68},   // 0x2B
            {r: 0,   g: 140, b: 152},  // 0x2C
            {r: 0,   g: 0,   b: 0},    // 0x2D
            {r: 0,   g: 0,   b: 0},    // 0x2E
            {r: 0,   g: 0,   b: 0},    // 0x2F
            {r: 236, g: 224, b: 208},  // 0x30
            {r: 236, g: 160, b: 120},  // 0x31
            {r: 236, g: 196, b: 168},  // 0x32
            {r: 236, g: 200, b: 176},  // 0x33
            {r: 236, g: 180, b: 168},  // 0x34
            {r: 228, g: 156, b: 160},  // 0x35
            {r: 204, g: 148, b: 156},  // 0x36
            {r: 180, g: 140, b: 136},  // 0x37
            {r: 196, g: 176, b: 168},  // 0x38
            {r: 188, g: 172, b: 160},  // 0x39
            {r: 172, g: 164, b: 152},  // 0x3A
            {r: 152, g: 148, b: 136},  // 0x3B
            {r: 132, g: 132, b: 120},  // 0x3C
            {r: 0,   g: 0,   b: 0},    // 0x3D
            {r: 0,   g: 0,   b: 0},    // 0x3E
            {r: 0,   g: 0,   b: 0},    // 0x3F
        ];
        
        return palette[Math.min(colorIndex, 63)];
    }
    
    // PPU Register Interface
    readRegister(addr) {
        addr &= 0x07;
        
        switch (addr) {
            case 0x00: // PPUCTRL
                return 0; // Write-only
                
            case 0x01: // PPUMASK
                return 0; // Write-only
                
            case 0x02: // PPUSTATUS
                const result = this.status;
                this.status &= ~0x80; // Clear VBlank on read
                this.dataBuffer = this.ppuRead(this.vramAddr);
                this.tramAddr = (this.tramAddr & ~0x7BE0) | (this.vramAddr & 0x7BE0);
                return result;
                
            case 0x03: // OAMADDR
                return 0; // Write-only
                
            case 0x04: // OAMDATA
                return this.oam[this.oamAddr];
                
            case 0x05: // PPUSCROLL
                return 0; // Write-only
                
            case 0x06: // PPUADDR
                return 0; // Write-only
                
            case 0x07: // PPUDATA
                const data = this.dataBuffer;
                this.dataBuffer = this.ppuRead(this.vramAddr);
                
                if (this.vramAddr >= 0x3F00) {
                    // Palette reads are immediate
                    data = this.dataBuffer;
                }
                
                this.vramAddr += (this.control & 0x04) ? 32 : 1;
                return data;
                
            default:
                return 0;
        }
    }
    
    writeRegister(addr, data) {
        addr &= 0x07;
        data &= 0xFF;
        
        switch (addr) {
            case 0x00: // PPUCTRL
                this.control = data;
                this.tramAddr = (this.tramAddr & ~0xC00) | ((data & 0x03) << 10);
                break;
                
            case 0x01: // PPUMASK
                this.mask = data;
                break;
                
            case 0x02: // PPUSTATUS
                // Read-only
                break;
                
            case 0x03: // OAMADDR
                this.oamAddr = data;
                break;
                
            case 0x04: // OAMDATA
                this.oam[this.oamAddr] = data;
                this.oamAddr = (this.oamAddr + 1) & 0xFF;
                break;
                
            case 0x05: // PPUSCROLL
                if (this.addrLatch === 0) {
                    this.scrollX = data;
                    this.tramAddr = (this.tramAddr & ~0x001F) | (data >> 3);
                    this.fineX = data & 0x07;
                    this.addrLatch = 1;
                } else {
                    this.scrollY = data;
                    this.tramAddr = (this.tramAddr & ~0x73E0) | ((data >> 3) << 5) | ((data & 0x07) << 12);
                    this.addrLatch = 0;
                }
                break;
                
            case 0x06: // PPUADDR
                if (this.addrLatch === 0) {
                    this.tramAddr = (this.tramAddr & 0x00FF) | ((data & 0x3F) << 8);
                    this.addrLatch = 1;
                } else {
                    this.tramAddr = (this.tramAddr & 0x7F00) | data;
                    this.vramAddr = this.tramAddr;
                    this.addrLatch = 0;
                }
                break;
                
            case 0x07: // PPUDATA
                this.ppuWrite(this.vramAddr, data);
                this.vramAddr += (this.control & 0x04) ? 32 : 1;
                break;
        }
    }
    
    // PPU Memory Access
    ppuRead(addr) {
        addr &= 0x3FFF;
        
        if (addr >= 0x0000 && addr <= 0x1FFF) {
            // Pattern tables
            return this.cartridge?.ppuRead(addr) || 0x00;
        } else if (addr >= 0x2000 && addr <= 0x2FFF) {
            // Nametables
            const mirroredAddr = addr & 0x0FFF;
            const nametable = mirroredAddr >> 10;
            const index = mirroredAddr & 0x03FF;
            
            const mirror = this.cartridge?.getMirror();
            
            if (mirror === 'horizontal') {
                if (nametable === 0 || nametable === 1) {
                    return this.vram[index];
                } else {
                    return this.vram[0x0400 + index];
                }
            } else if (mirror === 'vertical') {
                if (nametable === 0 || nametable === 2) {
                    return this.vram[index];
                } else {
                    return this.vram[0x0400 + index];
                }
            } else if (mirror === 'four-screen') {
                // Four-screen mirroring requires additional RAM
                return this.vram[index % 0x0800];
            }
        } else if (addr >= 0x3000 && addr <= 0x3EFF) {
            // Mirrors of $2000-$2EFF
            return this.ppuRead(addr - 0x1000);
        } else if (addr >= 0x3F00 && addr <= 0x3F1F) {
            // Palette RAM
            const paletteAddr = addr & 0x1F;
            if ((paletteAddr & 0x03) === 0) {
                return this.palette[0];
            }
            return this.palette[paletteAddr];
        } else if (addr >= 0x3F20 && addr <= 0x3FFF) {
            // Mirrors of $3F00-$3F1F
            return this.palette[addr & 0x1F];
        }
        
        return 0x00;
    }
    
    ppuWrite(addr, data) {
        addr &= 0x3FFF;
        data &= 0xFF;
        
        if (addr >= 0x0000 && addr <= 0x1FFF) {
            // Pattern tables
            this.cartridge?.ppuWrite(addr, data);
        } else if (addr >= 0x2000 && addr <= 0x2FFF) {
            // Nametables
            const mirroredAddr = addr & 0x0FFF;
            const nametable = mirroredAddr >> 10;
            const index = mirroredAddr & 0x03FF;
            
            const mirror = this.cartridge?.getMirror();
            
            if (mirror === 'horizontal') {
                if (nametable === 0 || nametable === 1) {
                    this.vram[index] = data;
                } else {
                    this.vram[0x0400 + index] = data;
                }
            } else if (mirror === 'vertical') {
                if (nametable === 0 || nametable === 2) {
                    this.vram[index] = data;
                } else {
                    this.vram[0x0400 + index] = data;
                }
            } else if (mirror === 'four-screen') {
                this.vram[index % 0x0800] = data;
            }
        } else if (addr >= 0x3000 && addr <= 0x3EFF) {
            // Mirrors of $2000-$2EFF
            this.ppuWrite(addr - 0x1000, data);
        } else if (addr >= 0x3F00 && addr <= 0x3F1F) {
            // Palette RAM
            const paletteAddr = addr & 0x1F;
            if ((paletteAddr & 0x03) === 0) {
                this.palette[0] = data & 0x3F;
            }
            this.palette[paletteAddr] = data & 0x3F;
        } else if (addr >= 0x3F20 && addr <= 0x3FFF) {
            // Mirrors of $3F00-$3F1F
            this.palette[addr & 0x1F] = data & 0x3F;
        }
    }
    

    
    // Get current screen data for rendering
    getScreen() {
        return this.screen;
    }
    
    // Check if NMI should be triggered
    checkNMI() {
        if (this.nmi) {
            this.nmi = false;
            return true;
        }
        return false;
    }
}