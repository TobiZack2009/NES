export class PPU {
    constructor(bus) {
        this.bus = bus;
        this.addrLatch = 0;
        this.fineX = 0;
        
        this.vram = new Uint8Array(2048);
        this.oam = new Uint8Array(256);
        this.secondaryOAM = new Uint8Array(32); // Secondary OAM for sprite evaluation
        this.palette = new Uint8Array(32);
        
        this.control = 0x00;
        this.mask = 0x00;
        this.status = 0x00;
        this.oamAddr = 0x00;
        this.scrollX = 0x00; // Not directly used, kept for debug view
        this.scrollY = 0x00; // Not directly used, kept for debug view
        this.addr = 0x0000; // current VRAM address (v)
        this.tempAddr = 0x0000; // temporary VRAM address (t)
        this.dataBuffer = 0x00;
        
        // PPU open bus latch (PPUGenLatch)
        this.openBus = 0x00;
        
        // PPU type detection (for different behaviors)
        this.ppuType = '2C02'; // Default to NTSC 2C02
        this.ppuRevision = 'G'; // Default to 2C02G (has OAMADDR bug)
        
        this.cycle = 0;
        this.scanline = -1; // -1 (pre-render), 0-239 (visible), 240 (post-render), 241-260 (vblank)
        this.frame = 0;
        this.oddFrame = false; // For frame timing variations
        
        this.bgNextTileId = 0;
        this.bgNextTileAttr = 0;
        this.bgNextTileLsb = 0;
        this.bgNextTileMsb = 0;
        
        this.bgShifterPatternLo = 0;
        this.bgShifterPatternHi = 0;
        this.bgShifterAttribLo = 0;
        this.bgShifterAttribHi = 0;
        
        this.screen = new Uint8Array(256 * 240 * 4);
        this.screenBackbuffer = new Uint8Array(256 * 240 * 4); // Double buffer
        this.frameReady = false; // Flag to indicate when frame is ready to render
        
        // Cache for palette colors to avoid repeated calculations
        this.colorCache = new Array(512); // 8 palettes * 64 colors
        
        this.nmi = false;
        this.spriteZeroHit = false;
        this.spriteOverflow = false;
        this.spriteZeroPossible = false; // Internal flag for sprite 0 hit detection
        this.spriteZeroHitNextLine = false; // Internal flag for next line sprite 0
        
        this.spriteScanline = [];
        this.spritePatterns = new Uint8Array(8 * 10); // 8 sprites, extended pattern data
        this.spritePositions = new Uint8Array(8);
        this.spritePriorities = new Uint8Array(8);
        this.spritePalettes = new Uint8Array(8);
        
        // Sprite evaluation state
        this.spriteEvaluationCycle = 0;
        this.spriteEvaluationIndex = 0;
        this.foundSprites = 0;
        this.spriteOverflowIndex = -1;

        this.cartridge = null;
        
        // Power-up state timing
        this.powerUpCycles = 0;
        this.canWriteRegisters = false;
    }
    
    connectCartridge(cartridge) {
        this.cartridge = cartridge;
    }
    
reset() {
        this.addrLatch = 0;
        this.fineX = 0;
        this.control = 0x00;
        this.mask = 0x00;
        this.status = 0x00;
        this.oamAddr = 0x00;
        this.scrollX = 0x00;
        this.scrollY = 0x00;
        this.addr = 0x0000;
        this.tempAddr = 0x0000;
        this.dataBuffer = 0x00;
        this.openBus = 0x00;
        
        this.cycle = 0;
        this.scanline = -1;
        this.frame = 0;
        this.oddFrame = false;
        
        this.bgNextTileId = 0;
        this.bgNextTileAttr = 0;
        this.bgNextTileLsb = 0;
        this.bgNextTileMsb = 0;
        
        this.bgShifterPatternLo = 0;
        this.bgShifterPatternHi = 0;
        this.bgShifterAttribLo = 0;
        this.bgShifterAttribHi = 0;
        
        this.screen.fill(0);
        this.nmi = false;
        this.spriteZeroHit = false;
        this.spriteOverflow = false;
        this.spriteZeroPossible = false;
        this.spriteZeroHitNextLine = false;
        this.oam.fill(0);
        this.secondaryOAM.fill(0);
        this.vram.fill(0);
        this.palette.fill(0);
        this.screen.fill(0);
        this.screenBackbuffer.fill(0);
        this.frameReady = false;
        this.colorCache.length = 0; // Clear color cache
        
        // Sprite evaluation state
        this.spriteEvaluationCycle = 0;
        this.spriteEvaluationIndex = 0;
        this.foundSprites = 0;
        this.spriteOverflowIndex = -1;
        
        // Power-up state
        this.powerUpCycles = 0;
        this.canWriteRegisters = false;
        
        // Default palette values (for visual debugging until real palette is loaded)
        for (let i = 0; i < 32; i++) {
            if (i % 4 === 0) {
                this.palette[i] = 0x0F;
            } else {
                this.palette[i] = (i - 1) % 4 + 1;
            }
        }
    }
    
    // PPU Internal Helper Functions
    // These functions implement the "Loopy" PPU scroll/address update logic

    incrementScrollX() {
        if (!((this.mask >> 3) & 1 || (this.mask >> 4) & 1)) return; // No rendering

        if ((this.addr & 0x001F) === 31) { // if coarse X is 31
            this.addr &= ~0x001F;          // coarse X = 0
            this.addr ^= 0x0400;           // switch horizontal nametable
        } else {
            this.addr++;                   // increment coarse X
        }
    }
    
    incrementScrollY() {
        if (!((this.mask >> 3) & 1 || (this.mask >> 4) & 1)) return; // No rendering

        if (((this.addr >> 12) & 7) < 7) { // if fine Y < 7
            this.addr += 0x1000;           // increment fine Y
        } else {
            this.addr &= ~0x7000;          // fine Y = 0
            let y = (this.addr & 0x03E0) >> 5; // let y = coarse Y
            if (y === 29) {                 // if coarse Y is 29
                y = 0;                      // coarse Y = 0
                this.addr ^= 0x0800;        // switch vertical nametable
            } else if (y === 31) {          // if coarse Y is 31
                y = 0;                      // coarse Y = 0, nametable not switched
            } else {
                y++;                        // increment coarse Y
            }
            this.addr = (this.addr & ~0x03E0) | (y << 5); // put coarse Y back into v
        }
    }
    
    transferX() {
        if (!((this.mask >> 3) & 1 || (this.mask >> 4) & 1)) return; // No rendering
        this.addr = (this.addr & 0xFFE0) | (this.tempAddr & 0x001F); // Transfer coarse X
        this.addr = (this.addr & 0xF3FF) | (this.tempAddr & 0x0400); // Transfer nametable X
    }

    transferY() {
        if (!((this.mask >> 3) & 1 || (this.mask >> 4) & 1)) return; // No rendering
        this.addr = (this.addr & 0x8C1F) | (this.tempAddr & 0x7BE0); // Transfer fine Y and coarse Y and nametable Y
    }
    
    loadBackgroundShifters() {
        this.bgShifterPatternLo = (this.bgShifterPatternLo & 0xFF00) | this.bgNextTileLsb;
        this.bgShifterPatternHi = (this.bgShifterPatternHi & 0xFF00) | this.bgNextTileMsb;
        this.bgShifterAttribLo = (this.bgShifterAttribLo & 0xFF00) | ((this.bgNextTileAttr & 1) ? 0xFF : 0x00);
        this.bgShifterAttribHi = (this.bgShifterAttribHi & 0xFF00) | ((this.bgNextTileAttr & 2) ? 0xFF : 0x00);
    }

    // Main clock function, called by the Bus
    clock() {
        // Update power-up state
        if (!this.canWriteRegisters) {
            this.powerUpCycles++;
            // Allow register writes after ~29658 NTSC cycles (pre-render scanline)
            if (this.powerUpCycles >= 29658) {
                this.canWriteRegisters = true;
            }
        }
        
        const renderingEnabled = (this.mask & 0x18) > 0;
        const isVisibleScanline = this.scanline >= 0 && this.scanline < 240;
        const isPreRenderScanline = this.scanline === -1;
        const isVBlankScanline = this.scanline >= 241 && this.scanline <= 260;
        
        // Background rendering logic
        if (renderingEnabled) {
            if (isVisibleScanline || isPreRenderScanline) {
                // Background Tile fetches (cycles 1-256 and 321-336)
                if ((this.cycle >= 1 && this.cycle <= 256) || (this.cycle >= 321 && this.cycle <= 336)) {
                    // Shift background registers every cycle
                    this.bgShifterPatternLo <<= 1;
                    this.bgShifterPatternHi <<= 1;
                    this.bgShifterAttribLo <<= 1;
                    this.bgShifterAttribHi <<= 1;

                    // Every 8 cycles, fetch new background tile information
                    switch ((this.cycle - 1) % 8) {
                        case 0: // Load background shifters and fetch nametable byte
                            this.loadBackgroundShifters();
                            this.fetchNametableByte();
                            break;
                        case 2: // Fetch attribute table byte
                            this.fetchAttributeTableByte();
                            break;
                        case 4: // Fetch low background tile byte
                            this.fetchTileBitmapLow();
                            break;
                        case 6: // Fetch high background tile byte
                            this.fetchTileBitmapHigh();
                            break;
                        case 7: // Increment horizontal scroll (coarse X)
                            this.incrementScrollX();
                            break;
                    }
                }
                
                // 34th background fetch (cycle 337) - never used for rendering but some mappers rely on it
                if (this.cycle === 337) {
                    this.fetchNametableByte(); // Fetch nametable byte that won't be used
                }
                
                // At cycle 256, increment vertical scroll (coarse Y)
                if (this.cycle === 256) {
                    this.incrementScrollY();
                }

                // At cycle 257, transfer horizontal scroll bits from tempAddr to addr
                if (this.cycle === 257) {
                    this.transferX();
                }

                // In pre-render scanline, cycles 280-304, transfer vertical scroll bits from tempAddr to addr
                if (isPreRenderScanline && this.cycle >= 280 && this.cycle <= 304) {
                    this.transferY();
                }
                
                // Sprite evaluation (cycles 257-320)
                if (this.cycle >= 257 && this.cycle <= 320) {
                    this.evaluateSpritesStep();
                }
                
                // Sprite pattern fetching (cycles 257-320 for sprites, 1-64 for next line)
                if (this.mask & 0x10) { // Only if sprites enabled
                    if (this.cycle >= 257 && this.cycle <= 320) {
                        this.fetchSpritePatternsStep();
                    } else if (this.cycle >= 1 && this.cycle <= 64) {
                        this.fetchSpritePatternsStep();
                    }
                }
            }
        }

        // Pixel rendering
        if (isVisibleScanline && this.cycle >= 1 && this.cycle <= 256) {
            this.pixelRendering();
        }
        
        // NMI and PPUSTATUS flags
        if (this.scanline === 241 && this.cycle === 1) { // Start of VBlank
            this.status |= 0x80; // Set VBlank flag
            if (this.control & 0x80) { // NMI enabled
                this.nmi = true;
            }
        }

        if (isPreRenderScanline && this.cycle === 1) { // Start of pre-render scanline
            this.status &= ~0x80; // Clear VBlank flag
            this.status &= ~0x40; // Clear Sprite 0 Hit flag
            this.status &= ~0x20; // Clear Sprite Overflow flag
            this.nmi = false;
            this.spriteZeroPossible = false; // Reset sprite 0 hit flag
            this.spriteZeroHitNextLine = false;
            // Clear backbuffer, not front buffer to prevent flashing
            this.screenBackbuffer.fill(0); 
            this.frameReady = false;
            
            // Skip dot on odd frames (if rendering enabled and background/sprites enabled)
            if (renderingEnabled && this.oddFrame) {
                this.cycle = 1;
            }
        }
        
        // OAMADDR reset during sprite tile loading (cycles 257-320)
        if (renderingEnabled && (this.cycle >= 257 && this.cycle <= 320)) {
            this.oamAddr = 0;
        }

        // Increment cycle, scanline, frame
        this.cycle++;
        if (this.cycle >= 341) {
            this.cycle = 0;
            this.scanline++;
            if (this.scanline >= 261) {
                this.scanline = -1; // Wrap around to pre-render scanline
                this.frame++;
                this.oddFrame = !this.oddFrame; // Toggle odd frame
                this.frameReady = true; // Mark frame as ready for rendering
            }
        }
    }
    
    pixelRendering() {
        const x = this.cycle - 1;
        const y = this.scanline;
        
        // Skip rendering for x = 0 (first cycle is for fetches)
        if (x === 0) return;
        
        // Early exit if both background and sprites are disabled
        if (!(this.mask & 0x18)) return;
        
        // Check left-side clipping
        const leftClippingEnabled = !(this.mask & 0x02) || !(this.mask & 0x04);
        if (x < 8 && leftClippingEnabled) {
            // Background and sprites are clipped in leftmost 8 pixels
            // Render backdrop color
            const colorIndex = this.getColorFromPalette(0, 0);
            const pixelIndex = (y * 256 + x) * 4;
            const color = this.getNESColor(colorIndex);
            this.screenBackbuffer[pixelIndex] = color.r;
            this.screenBackbuffer[pixelIndex + 1] = color.g;
            this.screenBackbuffer[pixelIndex + 2] = color.b;
            this.screenBackbuffer[pixelIndex + 3] = 255;
            return;
        }
        
        let bgPixel = 0;
        let bgPalette = 0;
        let bgOpaque = false;

        // Background rendering
        if (this.mask & 0x08) { // Background rendering enabled
            const fineXShift = 15 - this.fineX; // Selects fineX bit from 16-bit shifter

            const p0 = (this.bgShifterPatternLo >> fineXShift) & 1;
            const p1 = (this.bgShifterPatternHi >> fineXShift) & 1;
            bgPixel = (p1 << 1) | p0;

            const a0 = (this.bgShifterAttribLo >> fineXShift) & 1;
            const a1 = (this.bgShifterAttribHi >> fineXShift) & 1;
            bgPalette = (a1 << 1) | a0;
            
            bgOpaque = bgPixel !== 0;
        }

        // Sprite rendering
        let spritePixel = 0;
        let spritePalette = 0;
        let spritePriority = 0;
        let spriteOpaque = false;
        let spriteFound = false;
        let spriteZeroHit = false;

        if (this.mask & 0x10) { // Sprite rendering enabled
            // Find the first non-transparent sprite pixel at this x position
            for (let i = 0; i < this.spriteScanline.length; i++) {
                const spriteData = this.getSpritePixel(i, x);
                
                if (spriteData.pixel !== 0) { // Non-transparent sprite pixel
                    spritePixel = spriteData.pixel;
                    spritePalette = spriteData.palette;
                    spritePriority = spriteData.priority;
                    spriteOpaque = true;
                    spriteFound = true;
                    
                    // Check for sprite 0 hit with proper edge cases
                    if (this.spriteZeroPossible && spriteData.oamIndex === 0 && bgOpaque && x > 0 && x < 255) {
                        // Don't trigger if background or sprites are disabled in this area
                        if (!((this.mask & 0x08) === 0 || (this.mask & 0x10) === 0)) {
                            spriteZeroHit = true;
                        }
                    }
                    break; // Only check first sprite (priority handled below)
                }
            }
        }

        // Sprite 0 hit detection
        if (spriteZeroHit && !(this.status & 0x40)) { // Only set once per frame
            this.status |= 0x40; // Set sprite 0 hit flag
        }

        // Final pixel composition
        let finalPixel = 0;
        let finalPalette = 0;

        if (!spriteFound) {
            // No sprite pixel at this position
            finalPixel = bgPixel;
            finalPalette = bgPalette;
        } else if (!bgOpaque) {
            // Background is transparent, show sprite
            finalPixel = spritePixel;
            finalPalette = spritePalette;
        } else if (spriteOpaque && spritePriority === 0) {
            // Sprite has priority over background
            finalPixel = spritePixel;
            finalPalette = spritePalette;
        } else {
            // Background has priority or sprite is transparent
            finalPixel = bgPixel;
            finalPalette = bgPalette;
        }

        const colorIndex = this.getColorFromPalette(finalPalette, finalPixel);
        const pixelIndex = (y * 256 + x) * 4;
        const color = this.getNESColor(colorIndex);
        
        // Write to backbuffer instead of front buffer
        this.screenBackbuffer[pixelIndex] = color.r;
        this.screenBackbuffer[pixelIndex + 1] = color.g;
        this.screenBackbuffer[pixelIndex + 2] = color.b;
        this.screenBackbuffer[pixelIndex + 3] = 255;
    }
    
    fetchNametableByte() {
        // v = AAAA AAAA AAAA AAAA
        //     |||| |||| |||| ||||
        //     NTY NTY NTY NTY Y Y
        // Address = 0x2000 | (v & 0x0FFF)
        this.bgNextTileId = this.ppuRead(0x2000 | (this.addr & 0x0FFF));
    }
    
    fetchAttributeTableByte() {
        // v = AAAA AAAA AAAA AAAA
        //     |||| |||| |||| ||||
        //     NTY NTY NTY NTY Y Y
        // Address = 0x23C0 | (v_nametable_y << 3) | (v_nametable_x << 1)
        const addrOffset = 0x23C0 | (this.addr & 0x0C00) | ((this.addr >> 4) & 0x38) | ((this.addr >> 2) & 0x07);
        this.bgNextTileAttr = this.ppuRead(addrOffset);
        
        // Select the relevant 2-bit attribute palette based on coarse X/Y
        if ((this.addr >> 5) & 1) this.bgNextTileAttr >>= 4; // Use bits 4-7 for lower half of 16x16 block
        if ((this.addr >> 1) & 1) this.bgNextTileAttr >>= 2; // Use bits 2-3 or 6-7 for right half of 16x16 block
        this.bgNextTileAttr &= 0x03; // Mask to get the 2 bits
    }
    
    fetchTileBitmapLow() {
        const fineY = (this.addr >> 12) & 7; // Fine Y from v
        const patternTable = (this.control & 0x10) << 8; // Pattern table selection from PPUCTRL bit 4
        this.bgNextTileLsb = this.ppuRead(patternTable + (this.bgNextTileId << 4) + fineY);
    }
    
    fetchTileBitmapHigh() {
        const fineY = (this.addr >> 12) & 7; // Fine Y from v
        const patternTable = (this.control & 0x10) << 8; // Pattern table selection from PPUCTRL bit 4
        this.bgNextTileMsb = this.ppuRead(patternTable + (this.bgNextTileId << 4) + fineY + 8);
    }
    
    // Step-by-step sprite evaluation (cycles 257-320)
    evaluateSpritesStep() {
        const cycleOffset = this.cycle - 257;
        const spriteHeight = (this.control & 0x20) ? 16 : 8;
        
        if (cycleOffset === 0) {
            // Initialize sprite evaluation
            this.secondaryOAM.fill(0xFF); // Clear secondary OAM
            this.spriteEvaluationIndex = 0;
            this.foundSprites = 0;
            this.spriteOverflowIndex = -1;
            this.spriteScanline = [];
            this.spriteZeroPossible = false;
        } else if (cycleOffset < 64) {
            // Primary OAM search (cycles 1-64)
            if (this.spriteEvaluationIndex < 64) {
                const oamEntryY = this.oam[this.spriteEvaluationIndex * 4];
                
                // Check if sprite is on the next scanline
                if (this.scanline + 1 >= oamEntryY && this.scanline + 1 < oamEntryY + spriteHeight) {
                    if (this.foundSprites < 8) {
                        // Copy to secondary OAM
                        const secondaryIndex = this.foundSprites * 4;
                        this.secondaryOAM[secondaryIndex] = oamEntryY;
                        this.secondaryOAM[secondaryIndex + 1] = this.oam[this.spriteEvaluationIndex * 4 + 1];
                        this.secondaryOAM[secondaryIndex + 2] = this.oam[this.spriteEvaluationIndex * 4 + 2];
                        this.secondaryOAM[secondaryIndex + 3] = this.oam[this.spriteEvaluationIndex * 4 + 3];
                        
                        // Add to sprite scanline for rendering
                        const sprite = {
                            y: oamEntryY,
                            id: this.oam[this.spriteEvaluationIndex * 4 + 1],
                            attr: this.oam[this.spriteEvaluationIndex * 4 + 2],
                            x: this.oam[this.spriteEvaluationIndex * 4 + 3],
                            palette: (this.oam[this.spriteEvaluationIndex * 4 + 2] & 0x03) + 4,
                            priority: (this.oam[this.spriteEvaluationIndex * 4 + 2] & 0x20) ? 1 : 0,
                            hFlip: (this.oam[this.spriteEvaluationIndex * 4 + 2] & 0x40) ? 1 : 0,
                            vFlip: (this.oam[this.spriteEvaluationIndex * 4 + 2] & 0x80) ? 1 : 0,
                            oamIndex: this.spriteEvaluationIndex
                        };
                        
                        this.spriteScanline.push(sprite);
                        
                        if (this.spriteEvaluationIndex === 0) {
                            this.spriteZeroPossible = true;
                            this.spriteZeroHitNextLine = true;
                        }
                        
                        this.foundSprites++;
                    } else if (this.spriteOverflowIndex === -1) {
                        // Found 9th sprite - set overflow flag
                        this.spriteOverflowIndex = this.spriteEvaluationIndex;
                        this.status |= 0x20; // Set sprite overflow flag
                    }
                }
                
                this.spriteEvaluationIndex++;
            }
        } else if (cycleOffset >= 64) {
            // Copy secondary OAM back to primary OAM (cycles 65-320)
            // This is where OAMADDR gets set to the 9th sprite index
            if (this.spriteOverflowIndex >= 0) {
                this.oamAddr = this.spriteOverflowIndex;
            }
        }
    }
    
    // Step-by-step sprite pattern fetching
    fetchSpritePatternsStep() {
        const cycleOffset = this.cycle - 257;
        if (cycleOffset >= 0 && cycleOffset < this.spriteScanline.length * 2) {
            const spriteIndex = Math.floor(cycleOffset / 2);
            const isHighByte = cycleOffset % 2 === 1;
            
            if (spriteIndex < this.spriteScanline.length) {
                const sprite = this.spriteScanline[spriteIndex];
                const spriteHeight = (this.control & 0x20) ? 16 : 8;
                const patternTable = (this.control & 0x08) ? 0x1000 : 0x0000;
                
                // Calculate which tile line to fetch from sprite
                let tileY = this.scanline - sprite.y;
                if (sprite.vFlip) {
                    tileY = spriteHeight - 1 - tileY;
                }
                
                let patternAddr;
                if (spriteHeight === 16) {
                    const table = sprite.id & 1 ? 0x1000 : 0x0000;
                    const tileIndex = (sprite.id & 0xFE) | (tileY >= 8 ? 1 : 0);
                    patternAddr = table + (tileIndex << 4) + ((tileY & 7) << 1);
                } else {
                    patternAddr = patternTable + (sprite.id << 4) + ((tileY & 7) << 1);
                }
                
                if (!isHighByte) {
                    // Fetch low byte
                    this.spritePatterns[spriteIndex * 2] = this.ppuRead(patternAddr);
                } else {
                    // Fetch high byte
                    this.spritePatterns[spriteIndex * 2 + 1] = this.ppuRead(patternAddr + 1);
                }
                
                // Store additional sprite info
                this.spritePositions[spriteIndex] = sprite.x;
                this.spritePriorities[spriteIndex] = sprite.priority;
                this.spritePalettes[spriteIndex] = sprite.palette;
                this.spritePatterns[spriteIndex * 2 + 8] = sprite.hFlip;
                this.spritePatterns[spriteIndex * 2 + 9] = sprite.oamIndex;
            }
        }
    }
    
    // Legacy method - kept for compatibility
    fetchSpritePatterns() {
        const spriteHeight = (this.control & 0x20) ? 16 : 8;
        const patternTable = (this.control & 0x08) ? 0x1000 : 0x0000;
        
        // Clear previous sprite pattern data
        this.spritePatterns.fill(0);
        this.spritePositions.fill(0);
        this.spritePriorities.fill(0);
        this.spritePalettes.fill(0);
        
        // For each sprite on this scanline, fetch its pattern data
        for (let i = 0; i < this.spriteScanline.length; i++) {
            const sprite = this.spriteScanline[i];
            
            // Calculate which tile line to fetch from sprite
            let tileY = this.scanline - sprite.y;
            if (sprite.vFlip) {
                tileY = spriteHeight - 1 - tileY;
            }
            
            let patternAddr;
            if (spriteHeight === 16) {
                const table = sprite.id & 1 ? 0x1000 : 0x0000;
                const tileIndex = (sprite.id & 0xFE) | (tileY >= 8 ? 1 : 0);
                patternAddr = table + (tileIndex << 4) + ((tileY & 7) << 1);
            } else {
                patternAddr = patternTable + (sprite.id << 4) + ((tileY & 7) << 1);
            }
            
            const patternLow = this.ppuRead(patternAddr);
            const patternHigh = this.ppuRead(patternAddr + 1);
            
            this.spritePatterns[i * 2] = patternLow;
            this.spritePatterns[i * 2 + 1] = patternHigh;
            this.spritePositions[i] = sprite.x;
            this.spritePriorities[i] = sprite.priority;
            this.spritePalettes[i] = sprite.palette;
            this.spritePatterns[i * 2 + 8] = sprite.hFlip;
            this.spritePatterns[i * 2 + 9] = sprite.oamIndex;
        }
    }
    
    getSpritePixel(spriteIndex, x) {
        const spriteX = this.spritePositions[spriteIndex];
        if (x < spriteX || x >= spriteX + 8) {
            return { pixel: 0, palette: 0, priority: 0 }; // No pixel at this x position
        }
        
        const relativeX = x - spriteX;
        const hFlip = this.spritePatterns[spriteIndex * 2 + 8];
        const bitPosition = hFlip ? relativeX : (7 - relativeX);
        
        const patternLow = this.spritePatterns[spriteIndex * 2];
        const patternHigh = this.spritePatterns[spriteIndex * 2 + 1];
        
        const bit0 = (patternLow >> bitPosition) & 1;
        const bit1 = (patternHigh >> bitPosition) & 1;
        const pixel = (bit1 << 1) | bit0;
        
        // Pixel 0 is transparent for sprites
        if (pixel === 0) {
            return { pixel: 0, palette: 0, priority: 0 };
        }
        
        return {
            pixel: pixel,
            palette: this.spritePalettes[spriteIndex],
            priority: this.spritePriorities[spriteIndex],
            oamIndex: this.spritePatterns[spriteIndex * 2 + 9]
        };
    }
    
    getColorFromPalette(palette, index) {
        let addr = 0x3F00 + (palette << 2) + index;
        return this.ppuRead(addr);
    }
    
getNESColor(colorIndex) {
        if (this.mask & 0x01) { // Greyscale mode
            colorIndex &= 0x30;
        }
        
        // Check cache first
        const cacheIndex = (this.mask & 0xE0) | colorIndex; // Include emphasis in cache key
        if (this.colorCache[cacheIndex]) {
            return this.colorCache[cacheIndex];
        }
        
        const palette = [
            {r: 84,  g: 84,  b: 84},   {r: 0,   g: 30,  b: 116},  {r: 8,   g: 16,  b: 144},  {r: 48,  g: 0,   b: 136},
            {r: 68,  g: 0,   b: 100},  {r: 92,  g: 0,   b: 48},   {r: 84,  g: 4,   b: 0},    {r: 60,  g: 24,  b: 0},
            {r: 32,  g: 42,  b: 0},    {r: 8,   g: 58,  b: 0},    {r: 0,   g: 64,  b: 0},    {r: 0,   g: 60,  b: 0},
            {r: 0,   g: 50,  b: 60},   {r: 0,   g: 0,   b: 0},    {r: 0,   g: 0,   b: 0},    {r: 0,   g: 0,   b: 0},
            {r: 152, g: 152, b: 152},  {r: 8,   g: 76,  b: 196},  {r: 48,  g: 50,  b: 236},  {r: 92,  g: 30,  b: 228},
            {r: 136, g: 20,  b: 176},  {r: 160,  g: 20,  b: 100},  {r: 152,  g: 34,  b: 32},   {r: 120, g: 60,  b: 0},
            {r: 84,  g: 90,  b: 0},    {r: 40,  g: 114, b: 0},    {r: 8,   g: 124, b: 0},    {r: 0,   g: 118, b: 40},
            {r: 0,   g: 102, b: 120},  {r: 0,   g: 0,   b: 0},    {r: 0,   g: 0,   b: 0},    {r: 0,   g: 0,   b: 0},
            {r: 236, g: 236, b: 236},  {r: 76,  g: 154, b: 236},  {r: 120, g: 124, b: 236},  {r: 176, g: 98,  b: 236},
            {r: 228, g: 84,  b: 236},  {r: 236,  g: 88,  b: 180},  {r: 236, g: 120, b: 120},  {r: 212, g: 136, b: 32},
            {r: 160, g: 170, b: 0},    {r: 116, g: 196, b: 0},    {r: 76,  g: 208, b: 32},   {r: 56,  g: 204, b: 108},
            {r: 56,  g: 180, b: 204},  {r: 60,  g: 60,  b: 60},    {r: 0,   g: 0,   b: 0},    {r: 0,   g: 0,   b: 0},
            {r: 236, g: 236, b: 236},  {r: 168, g: 204, b: 236},  {r: 188, g: 188, b: 236},  {r: 212, g: 178, b: 236},
            {r: 236, g: 174, b: 236},  {r: 236, g: 174, b: 212},  {r: 236, g: 180, b: 176},  {r: 228, g: 196, b: 144},
            {r: 204, g: 210, b: 120},  {r: 180, g: 222, b: 120},  {r: 168, g: 226, b: 144},  {r: 152, g: 226, b: 180},
            {r: 160, g: 214, b: 228},  {r: 160, g: 160, b: 160},  {r: 0,   g: 0,   b: 0},    {r: 0,   g: 0,   b: 0},
        ];
        
        let color = {...palette[Math.min(colorIndex, 63)]};

        // Apply color emphasis with different behavior for RGB vs composite PPUs
        const emphasis = this.mask >> 5;
        if (this.ppuType === 'RGB') {
            // RGB PPUs maximize brightness of emphasized channels
            if (emphasis & 1) { color.g = 255; }
            if (emphasis & 2) { color.r = 255; }
            if (emphasis & 4) { color.b = 255; }
        } else {
            // Composite PPUs darken non-emphasized channels
            if (emphasis & 1) { color.g *= 0.75; color.b *= 0.75; }
            if (emphasis & 2) { color.r *= 0.75; color.b *= 0.75; }
            if (emphasis & 4) { color.r *= 0.75; color.g *= 0.75; }
        }

        const result = { r: Math.floor(color.r), g: Math.floor(color.g), b: Math.floor(color.b) };
        
        // Cache the result
        this.colorCache[cacheIndex] = result;
        return result;
    }
        
        let color = {...palette[Math.min(colorIndex, 63)]};

        // Apply color emphasis with different behavior for RGB vs composite PPUs
        const emphasis = this.mask >> 5;
        if (this.ppuType === 'RGB') {
            // RGB PPUs maximize brightness of emphasized channels
            if (emphasis & 1) { color.g = 255; }
            if (emphasis & 2) { color.r = 255; }
            if (emphasis & 4) { color.b = 255; }
        } else {
            // Composite PPUs darken non-emphasized channels
            if (emphasis & 1) { color.g *= 0.75; color.b *= 0.75; }
            if (emphasis & 2) { color.r *= 0.75; color.b *= 0.75; }
            if (emphasis & 4) { color.r *= 0.75; color.g *= 0.75; }
        }

        const result = { r: Math.floor(color.r), g: Math.floor(color.g), b: Math.floor(color.b) };
        
        // Cache the result
        this.colorCache[cacheIndex] = result;
        return result;
    }
        
        const palette = [
            {r: 84,  g: 84,  b: 84},   {r: 0,   g: 30,  b: 116},  {r: 8,   g: 16,  b: 144},  {r: 48,  g: 0,   b: 136},
            {r: 68,  g: 0,   b: 100},  {r: 92,  g: 0,   b: 48},   {r: 84,  g: 4,   b: 0},    {r: 60,  g: 24,  b: 0},
            {r: 32,  g: 42,  b: 0},    {r: 8,   g: 58,  b: 0},    {r: 0,   g: 64,  b: 0},    {r: 0,   g: 60,  b: 0},
            {r: 0,   g: 50,  b: 60},   {r: 0,   g: 0,   b: 0},    {r: 0,   g: 0,   b: 0},    {r: 0,   g: 0,   b: 0},
            {r: 152, g: 152, b: 152},  {r: 8,   g: 76,  b: 196},  {r: 48,  g: 50,  b: 236},  {r: 92,  g: 30,  b: 228},
            {r: 136, g: 20,  b: 176},  {r: 160, g: 20,  b: 100},  {r: 152, g: 34,  b: 32},   {r: 120, g: 60,  b: 0},
            {r: 84,  g: 90,  b: 0},    {r: 40,  g: 114, b: 0},    {r: 8,   g: 124, b: 0},    {r: 0,   g: 118,  b: 40},
            {r: 0,   g: 102, b: 120},  {r: 0,   g: 0,   b: 0},    {r: 0,   g: 0,   b: 0},    {r: 0,   g: 0,   b: 0},
            {r: 236, g: 236, b: 236},  {r: 76,  g: 154, b: 236},  {r: 120, g: 124, b: 236},  {r: 176, g: 98,  b: 236},
            {r: 228, g: 84,  b: 236},  {r: 236, g: 88,  b: 180},  {r: 236, g: 120, b: 120},  {r: 212, g: 136, b: 32},
            {r: 160, g: 170, b: 0},    {r: 116, g: 196, b: 0},    {r: 76,  g: 208, b: 32},   {r: 56,  g: 204, b: 108},
            {r: 56,  g: 180, b: 204},  {r: 60,  g: 60,  b: 60},    {r: 0,   g: 0,   b: 0},    {r: 0,   g: 0,   b: 0},
            {r: 236, g: 236, b: 236},  {r: 168, g: 204, b: 236},  {r: 188, g: 188, b: 236},  {r: 212, g: 178, b: 236},
            {r: 236, g: 174, b: 236},  {r: 236, g: 174, b: 212},  {r: 236, g: 180, b: 176},  {r: 228, g: 196, b: 144},
            {r: 204, g: 210, b: 120},  {r: 180, g: 222, b: 120},  {r: 168, g: 226, b: 144},  {r: 152, g: 226, b: 180},
            {r: 160, g: 214, b: 228},  {r: 160, g: 160, b: 160},  {r: 0,   g: 0,   b: 0},    {r: 0,   g: 0,   b: 0},
        ];
        
        let color = {...palette[Math.min(colorIndex, 63)]};

        const emphasis = this.mask >> 5;
        if (emphasis & 1) { color.g *= 0.75; color.b *= 0.75; }
        if (emphasis & 2) { color.r *= 0.75; color.b *= 0.75; }
        if (emphasis & 4) { color.r *= 0.75; color.g *= 0.75; }

        const result = { r: Math.floor(color.r), g: Math.floor(color.g), b: Math.floor(color.b) };
        
        // Cache the result
        this.colorCache[cacheIndex] = result;
        return result;
    }
    
    // PPU Register Interface
    readRegister(addr) {
        addr &= 0x07; // PPU registers are mirrored every 8 bytes
        let result = 0;
        
        switch (addr) {
            case 0x00: // PPUCTRL is write-only, returns open bus
                result = this.openBus & 0x1F;
                break;
            case 0x01: // PPUMASK is write-only, returns open bus
                result = this.openBus & 0x1F;
                break;
            case 0x02: // PPUSTATUS
                result = (this.status & 0xE0) | (this.openBus & 0x1F); // Return flags and open bus
                this.status &= ~0x80; // Clear VBlank flag on read
                this.addrLatch = 0;   // Reset address latch for $2005/$2006 writes
                this.openBus = result; // Update open bus
                return result;
            case 0x03: // OAMADDR is write-only, returns open bus
                result = this.openBus & 0x1F;
                break;
            case 0x04: // OAMDATA
                result = this.oam[this.oamAddr];
                // OAMDATA reads during rendering expose internal OAM accesses
                if ((this.mask & 0x18) && this.scanline >= 0 && this.scanline < 240) {
                    // Return whatever is being accessed internally during sprite evaluation
                    if (this.cycle >= 257 && this.cycle <= 320) {
                        const evalCycle = this.cycle - 257;
                        if (evalCycle < 64 && this.spriteEvaluationIndex < 64) {
                            result = this.oam[this.spriteEvaluationIndex * 4 + (evalCycle % 4)];
                        }
                    }
                }
                this.openBus = result; // Update open bus
                return result;
            case 0x05: // PPUSCROLL is write-only, returns open bus
                result = this.openBus & 0x1F;
                break;
            case 0x06: // PPUADDR is write-only, returns open bus
                result = this.openBus & 0x1F;
                break;
            case 0x07: // PPUDATA
                result = this.dataBuffer; // Return buffered value
                this.dataBuffer = this.ppuRead(this.addr); // Read VRAM, buffer for next read
                
                // Palette reads are immediate (no buffering)
                if (this.addr >= 0x3F00) {
                    result = this.dataBuffer;
                    // Apply greyscale mode to palette reads
                    if (this.mask & 0x01) {
                        result &= 0x30;
                    }
                    // Add PPU open bus bits for some PPU revisions
                    if (this.ppuRevision === 'G' || this.ppuRevision === 'H') {
                        result |= (this.openBus & 0xC0);
                    }
                }
                
                this.addr += (this.control & 0x04) ? 32 : 1; // Increment VRAM address based on PPUCTRL
                this.openBus = result; // Update open bus
                return result;
            default: // Fallback for any other mirrored register
                result = this.openBus & 0x1F;
                break;
        }
        
        this.openBus = result; // Update open bus for all reads
        return result;
    }
    
    writeRegister(addr, data) {
        // Update open bus latch
        this.openBus = data & 0xFF;
        addr &= 0x07;
        
        // Check if writes are allowed (power-up state)
        if (!this.canWriteRegisters && (addr === 0x00 || addr === 0x01 || addr === 0x05 || addr === 0x06)) {
            // Ignore writes to these registers during power-up
            return;
        }
        
        switch (addr) {
            case 0x00: // PPUCTRL
                this.control = data;
                // Update nametable select bits (bits 0-1) and fine Y (bits 12-14) in tempAddr
                this.tempAddr = (this.tempAddr & 0xF3FF) | ((data & 0x03) << 10); // Nametable X/Y
                this.tempAddr = (this.tempAddr & 0x8FFF) | ((data & 0x80) << 5); // Fine Y (bit 7 -> bit 15)
                
                // Check for race condition at dot 257
                if (this.scanline >= 0 && this.scanline < 240 && this.cycle === 257) {
                    // Bit 0 race condition can cause nametable glitches
                    // This is a simplified version - full implementation would need CPU-PPU alignment
                    const mirror = this.cartridge?.getMirror() || 'horizontal';
                    if (mirror === 'vertical') {
                        // Can cause wrong nametable to be drawn for one scanline
                        // This is rarely triggered but important for accuracy
                    }
                }
                break;
            case 0x01: // PPUMASK
                this.mask = data;
                this.colorCache.length = 0; // Clear color cache
                break;
            case 0x03: // OAMADDR
                this.oamAddr = data;
                
                // OAMADDR corruption bug on 2C02G
                if (this.ppuRevision === 'G') {
                    // Copy sprites 8 and 9 (address $20) to the target address
                    // This is a simplified version of the corruption
                    if (data < 0xF8) { // Only corrupt if not at end of OAM
                        for (let i = 0; i < 8; i++) {
                            this.oam[(data & 0xF8) + i] = this.oam[0x20 + i];
                        }
                    }
                }
                break;
            case 0x04: // OAMDATA
                // OAMDATA writes during rendering are ignored (but increment still happens)
                if (!((this.mask & 0x18) && this.scanline >= 0 && this.scanline < 240)) {
                    this.oam[this.oamAddr] = data;
                }
                this.oamAddr = (this.oamAddr + 1) & 0xFF; // Increment with wrap-around
                break;
            case 0x05: // PPUSCROLL
                if (this.addrLatch === 0) { // First write (X scroll)
                    this.fineX = data & 0x07; // Fine X scroll
                    this.tempAddr = (this.tempAddr & 0xFFE0) | (data >> 3); // Coarse X scroll
                    this.scrollX = data; // For debug display
                    this.addrLatch = 1;
                } else { // Second write (Y scroll)
                    this.tempAddr = (this.tempAddr & 0x8C1F) | ((data & 0xF8) << 2) | ((data & 0x07) << 12); // Coarse Y and fine Y
                    this.scrollY = data; // For debug display
                    this.addrLatch = 0;
                }
                break;
            case 0x06: // PPUADDR
                if (this.addrLatch === 0) { // First write (high byte)
                    this.tempAddr = (this.tempAddr & 0x00FF) | ((data & 0x3F) << 8); // PPU address high byte
                    // Bit 14 is forced to 0 in internal t register
                    this.tempAddr &= ~0x4000;
                    this.addrLatch = 1;
                } else { // Second write (low byte)
                    this.tempAddr = (this.tempAddr & 0xFF00) | data; // PPU address low byte
                    this.addr = this.tempAddr; // Transfer to current VRAM address
                    this.addrLatch = 0;
                    
                    // Palette corruption workaround
                    if ((this.addr & 0x3F00) === 0x3F00) {
                        // Writing to palette memory - check for corruption conditions
                        // This is a simplified version - full implementation would need precise timing
                    }
                }
                break;
            case 0x07: // PPUDATA
                this.ppuWrite(this.addr, data);
                this.addr += (this.control & 0x04) ? 32 : 1; // Increment VRAM address based on PPUCTRL
                break;
        }
    }
    
    // OAM DMA (triggered by CPU writing to $4014)
    oamDMA(page) {
        const sourceAddr = page << 8; // Source page in CPU memory ($XX00)
        
        // OAM DMA takes 513 or 514 CPU cycles
        // The CPU is suspended during this transfer
        
        // Check for OAMADDR corruption during DMA
        if (this.ppuRevision === 'G' && this.oamAddr !== 0) {
            // On 2C02G, non-zero OAMAddr can cause corruption during DMA
            // For simplicity, we'll just reset OAMAddr to 0 as most games expect
            this.oamAddr = 0;
        }
        
        // Perform the DMA transfer
        for (let i = 0; i < 256; i++) {
            this.oam[i] = this.bus.read(sourceAddr + i);
        }
        
        // OAMADDR is set to 0 after DMA (as per hardware behavior)
        this.oamAddr = 0;
    }
    
    // Set PPU type for different behaviors
    setPPUType(type, revision) {
        this.ppuType = type;
        this.ppuRevision = revision;
    }
    
    // Check for PAL-specific behavior
    isPAL() {
        return this.ppuType === '2C07';
    }
    
    // PAL forced refresh (happens 24 scanlines after NMI)
    palForcedRefresh() {
        if (this.isPAL() && this.scanline >= 265 && this.scanline <= 310) {
            // PAL PPU forces OAM refresh during these scanlines
            // Increment OAMADDR every 2 pixels (except at pixel 0)
            if (this.cycle % 2 === 0 && this.cycle !== 0) {
                this.oamAddr = (this.oamAddr + 1) & 0xFF;
            }
        }
    }
    
    // PPU Memory Access (Nametables, Pattern Tables, Palettes)
    ppuRead(addr) {
        addr &= 0x3FFF; // Mask to 14-bit PPU address space
        
        if (addr < 0x2000) return this.cartridge?.ppuRead(addr) || 0; // Pattern Tables (CHR ROM/RAM)
        
        if (addr < 0x3F00) { // Nametables
            addr &= 0x0FFF; // Mask to 12-bit nametable address
            const mirror = this.cartridge?.getMirror() || 'horizontal'; // Get mirroring type from cartridge
            
            if (mirror === 'vertical') {
                if (addr >= 0x0800) addr &= ~0x0800; // Mirror $2800/$2C00 to $2000/$2400
            } else if (mirror === 'horizontal') {
                if (addr >= 0x0400 && addr < 0x0800) addr &= ~0x0400; // Mirror $2400 to $2000
                if (addr >= 0x0C00) addr &= ~0x0400; // Mirror $2C00 to $2800
            } else if (mirror === 'single-screen') {
                // Single-screen mirroring - all nametables point to same VRAM
                addr &= 0x03FF;
            } else if (mirror === 'four-screen') {
                // Four-screen VRAM - use cartridge-provided VRAM
                // For now, fall back to horizontal mirroring
                if (addr >= 0x0400 && addr < 0x0800) addr &= ~0x0400;
                if (addr >= 0x0C00) addr &= ~0x0400;
            }
            return this.vram[addr & 0x07FF]; // Read from VRAM (2KB)
        }
        
        // Palettes
        addr &= 0x1F; // Mask to 5-bit palette address
        if ((addr & 0x3) === 0) addr &= ~0x10; // Mirror $3F10/$3F14/$3F18/$3F1C to $3F00
        
        // Palette reading behavior varies by PPU revision
        let result = this.palette[addr];
        
        // Some PPU revisions support reading palette RAM with immediate return
        if (this.ppuRevision === 'G' || this.ppuRevision === 'H') {
            // These revisions support palette reads
            // The result is already in 'result'
        } else {
            // Earlier revisions might not support palette reads
            // Return the buffered value instead
            result = this.dataBuffer;
        }
        
        return result;
    }
    
    ppuWrite(addr, data) {
        addr &= 0x3FFF; // Mask to 14-bit PPU address space
        
        if (addr < 0x2000) { 
            this.cartridge?.ppuWrite(addr, data); 
            return; 
        } // Pattern Tables
        
        if (addr < 0x3F00) { // Nametables
            addr &= 0x0FFF;
            const mirror = this.cartridge?.getMirror() || 'horizontal';
            
            if (mirror === 'vertical') {
                if (addr >= 0x0800) addr &= ~0x0800;
            } else if (mirror === 'horizontal') {
                if (addr >= 0x0400 && addr < 0x0800) addr &= ~0x0400;
                if (addr >= 0x0C00) addr &= ~0x0400;
            } else if (mirror === 'single-screen') {
                addr &= 0x03FF;
            } else if (mirror === 'four-screen') {
                // Four-screen VRAM - would need cartridge-provided VRAM
                if (addr >= 0x0400 && addr < 0x0800) addr &= ~0x0400;
                if (addr >= 0x0C00) addr &= ~0x0400;
            }
            
            this.vram[addr & 0x07FF] = data;
            return;
        }
        
        // Palettes
        addr &= 0x1F;
        if ((addr & 0x3) === 0) addr &= ~0x10; // Mirror $3F10/$3F14/$3F18/$3F1C to $3F00
        
        // Palette corruption protection
        // When writing to palette memory, some games use a workaround
        // to prevent corruption by writing to $3F00 multiple times
        this.palette[addr] = data;
        
        // Shared palette entries (background and sprite palettes share entry 0)
        if ((addr & 0x13) === 0x00) {
            // $3F00, $3F10, $3F04, $3F14, $3F08, $3F18, $3F0C, $3F1C all share the same storage
            this.palette[addr ^ 0x10] = data; // Mirror to the other palette
        }
    }
    
    getPalette() {
        return this.palette;
    }
    
    getScreen() { return this.screen; }
    getScreenBuffer() { 
        // Swap buffers when frame is complete and return completed frame
        if (this.frameReady) {
            const temp = this.screen;
            this.screen = this.screenBackbuffer;
            this.screenBackbuffer = temp;
            this.frameReady = false;
        }
        return this.screen; 
    }
    
    checkNMI() {
        if (this.nmi) {
            this.nmi = false;
            return true;
        }
        return false;
    }
}