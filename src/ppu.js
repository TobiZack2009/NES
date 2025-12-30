export class PPU {
    constructor(bus) {
        this.bus = bus;
        this.addrLatch = 0;
        this.fineX = 0;
        
        this.vram = new Uint8Array(2048);
        this.oam = new Uint8Array(256);
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
        
        this.cycle = 0;
        this.scanline = -1; // -1 (pre-render), 0-239 (visible), 240 (post-render), 241-260 (vblank)
        this.frame = 0;
        
        this.bgNextTileId = 0;
        this.bgNextTileAttr = 0;
        this.bgNextTileLsb = 0;
        this.bgNextTileMsb = 0;
        
        this.bgShifterPatternLo = 0;
        this.bgShifterPatternHi = 0;
        this.bgShifterAttribLo = 0;
        this.bgShifterAttribHi = 0;
        
        this.screen = new Uint8Array(256 * 240 * 4);
        
        this.nmi = false;
        this.spriteZeroHit = false;
        this.spriteOverflow = false;
        this.spriteZeroPossible = false; // Internal flag for sprite 0 hit detection
        
        this.spriteScanline = [];
        this.spritePatterns = new Uint8Array(8 * 2); // 8 sprites, 2 pattern bytes per sprite
        this.spritePositions = new Uint8Array(8);
        this.spritePriorities = new Uint8Array(8);
        this.spritePalettes = new Uint8Array(8);

        this.cartridge = null;
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
        
        this.cycle = 0;
        this.scanline = -1;
        this.frame = 0;
        
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
        this.oam.fill(0);
        this.vram.fill(0);
        this.palette.fill(0);
        
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
        const renderingEnabled = (this.mask & 0x18) > 0;
        const isVisibleScanline = this.scanline >= 0 && this.scanline < 240;
        const isPreRenderScanline = this.scanline === -1;
        
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
            }
        }

        // Sprite evaluation (happens on cycle 257 for visible scanlines)
        if (isVisibleScanline && this.cycle === 257) {
            this.evaluateSprites();
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
            this.screen.fill(0); // Clear screen buffer for new frame
        }

        // Increment cycle, scanline, frame
        this.cycle++;
        if (this.cycle >= 341) {
            this.cycle = 0;
            this.scanline++;
            if (this.scanline >= 261) {
                this.scanline = -1; // Wrap around to pre-render scanline
                this.frame++;
            }
        }
    }
    
    pixelRendering() {
        const x = this.cycle - 1;
        const y = this.scanline;
        
        let bgPixel = 0;
        let bgPalette = 0;

        if (this.mask & 0x08) { // Background rendering enabled
            const fineXShift = 15 - this.fineX; // Selects the fineX bit from the 16-bit shifter

            const p0 = (this.bgShifterPatternLo >> fineXShift) & 1;
            const p1 = (this.bgShifterPatternHi >> fineXShift) & 1;
            bgPixel = (p1 << 1) | p0;

            const a0 = (this.bgShifterAttribLo >> fineXShift) & 1;
            const a1 = (this.bgShifterAttribHi >> fineXShift) & 1;
            bgPalette = (a1 << 1) | a0;
        }

        // TODO: Sprite rendering and composition with background
        
        const finalPixel = bgPixel;
        const finalPalette = bgPalette;

        const colorIndex = this.getColorFromPalette(finalPalette, finalPixel);
        const pixelIndex = (y * 256 + x) * 4;
        const color = this.getNESColor(colorIndex);
        
        this.screen[pixelIndex] = color.r;
        this.screen[pixelIndex + 1] = color.g;
        this.screen[pixelIndex + 2] = color.b;
        this.screen[pixelIndex + 3] = 255;
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
    
    // Evaluate Sprites for the next scanline
    evaluateSprites() {
        this.spriteScanline = [];
        this.spriteZeroPossible = false;
        let spriteCount = 0;
        const spriteHeight = (this.control & 0x20) ? 16 : 8; // PPUCTRL bit 5
        
        for (let i = 0; i < 64 && spriteCount < 8; i++) {
            const oamEntryY = this.oam[i * 4];
            
            // Check if sprite is on the current scanline
            if (this.scanline >= oamEntryY && this.scanline < oamEntryY + spriteHeight) {
                const sprite = {
                    y: oamEntryY,
                    id: this.oam[i * 4 + 1],
                    attr: this.oam[i * 4 + 2],
                    x: this.oam[i * 4 + 3],
                    palette: (this.oam[i * 4 + 2] & 0x03) + 4, // Sprite palettes are 4-7
                    priority: (this.oam[i * 4 + 2] & 0x20) ? 1 : 0,
                    hFlip: (this.oam[i * 4 + 2] & 0x40) ? 1 : 0,
                    vFlip: (this.oam[i * 4 + 2] & 0x80) ? 1 : 0,
                    oamIndex: i // Keep original OAM index for sprite 0 hit
                };
                
                if (i === 0) this.spriteZeroPossible = true; // Mark sprite 0 potentially on this line
                this.spriteScanline.push(sprite);
                spriteCount++;
            }
        }
        if (spriteCount >= 8) {
            this.status |= 0x20; // Sprite overflow
        }
    }
    
    getColorFromPalette(palette, index) {
        let addr = 0x3F00 + (palette << 2) + index;
        return this.ppuRead(addr);
    }
    
    getNESColor(colorIndex) {
        if (this.mask & 0x01) { // Greyscale mode
            colorIndex &= 0x30;
        }
        
        const palette = [
            {r: 84,  g: 84,  b: 84},   {r: 0,   g: 30,  b: 116},  {r: 8,   g: 16,  b: 144},  {r: 48,  g: 0,   b: 136},
            {r: 68,  g: 0,   b: 100},  {r: 92,  g: 0,   b: 48},   {r: 84,  g: 4,   b: 0},    {r: 60,  g: 24,  b: 0},
            {r: 32,  g: 42,  b: 0},    {r: 8,   g: 58,  b: 0},    {r: 0,   g: 64,  b: 0},    {r: 0,   g: 60,  b: 0},
            {r: 0,   g: 50,  b: 60},   {r: 0,   g: 0,   b: 0},    {r: 0,   g: 0,   b: 0},    {r: 0,   g: 0,   b: 0},
            {r: 152, g: 152, b: 152},  {r: 8,   g: 76,  b: 196},  {r: 48,  g: 50,  b: 236},  {r: 92,  g: 30,  b: 228},
            {r: 136, g: 20,  b: 176},  {r: 160, g: 20,  b: 100},  {r: 152, g: 34,  b: 32},   {r: 120, g: 60,  b: 0},
            {r: 84,  g: 90,  b: 0},    {r: 40,  g: 114, b: 0},    {r: 8,   g: 124, b: 0},    {r: 0,   g: 118, b: 40},
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

        return { r: Math.floor(color.r), g: Math.floor(color.g), b: Math.floor(color.b) };
    }
    
    // PPU Register Interface
    readRegister(addr) {
        addr &= 0x07; // PPU registers are mirrored every 8 bytes
        
        switch (addr) {
            case 0x00: return (this.dataBuffer & 0x1F); // PPUCTRL is write-only, returns open bus
            case 0x01: return (this.dataBuffer & 0x1F); // PPUMASK is write-only, returns open bus
            case 0x02: // PPUSTATUS
                const result = (this.status & 0xE0) | (this.dataBuffer & 0x1F); // Return flags and open bus
                this.status &= ~0x80; // Clear VBlank flag on read
                this.addrLatch = 0;   // Reset address latch for $2005/$2006 writes
                return result;
            case 0x03: return (this.dataBuffer & 0x1F); // OAMADDR is write-only, returns open bus
            case 0x04: return this.oam[this.oamAddr]; // OAMDATA
            case 0x05: return (this.dataBuffer & 0x1F); // PPUSCROLL is write-only, returns open bus
            case 0x06: return (this.dataBuffer & 0x1F); // PPUADDR is write-only, returns open bus
            case 0x07: // PPUDATA
                let data = this.dataBuffer;
                this.dataBuffer = this.ppuRead(this.addr); // Read VRAM, buffer value
                if (this.addr >= 0x3F00) data = this.dataBuffer; // Palette reads are immediate
                this.addr += (this.control & 0x04) ? 32 : 1; // Increment VRAM address based on PPUCTRL
                return data;
            default: return (this.dataBuffer & 0x1F); // Fallback for any other mirrored register
        }
    }
    
    writeRegister(addr, data) {
        this.dataBuffer = data & 0xFF; // Any write to a PPU register updates the open bus latch
        addr &= 0x07;
        
        switch (addr) {
            case 0x00: // PPUCTRL
                this.control = data;
                // Update nametable select bits (bits 0-1) and fine Y (bits 12-14) in tempAddr
                this.tempAddr = (this.tempAddr & 0xF3FF) | ((data & 0x03) << 10); // Nametable X/Y
                this.tempAddr = (this.tempAddr & 0x8FFF) | ((data & 0x80) << 5); // Fine Y
                break;
            case 0x01: this.mask = data; break; // PPUMASK
            case 0x03: this.oamAddr = data; break; // OAMADDR
            case 0x04: this.oam[this.oamAddr] = data; this.oamAddr++; break; // OAMDATA
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
                    this.addrLatch = 1;
                } else { // Second write (low byte)
                    this.tempAddr = (this.tempAddr & 0xFF00) | data; // PPU address low byte
                    this.addr = this.tempAddr; // Transfer to current VRAM address
                    this.addrLatch = 0;
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
        for (let i = 0; i < 256; i++) {
            this.oam[(this.oamAddr + i) & 0xFF] = this.bus.read(sourceAddr + i);
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
            }
            return this.vram[addr & 0x07FF]; // Read from VRAM (2KB)
        }
        
        // Palettes
        addr &= 0x1F; // Mask to 5-bit palette address
        if ((addr & 0x3) === 0) addr &= ~0x10; // Mirror $3F10/$3F14/$3F18/$3F1C to $3F00
        return this.palette[addr];
    }
    
    ppuWrite(addr, data) {
        addr &= 0x3FFF; // Mask to 14-bit PPU address space
        
        if (addr < 0x2000) { this.cartridge?.ppuWrite(addr, data); return; } // Pattern Tables
        
        if (addr < 0x3F00) { // Nametables
            addr &= 0x0FFF;
            const mirror = this.cartridge?.getMirror() || 'horizontal';
            if (mirror === 'vertical') {
                if (addr >= 0x0800) addr &= ~0x0800;
            } else if (mirror === 'horizontal') {
                if (addr >= 0x0400 && addr < 0x0800) addr &= ~0x0400;
                if (addr >= 0x0C00) addr &= ~0x0400;
            }
            this.vram[addr & 0x07FF] = data;
            return;
        }
        
        // Palettes
        addr &= 0x1F;
        if ((addr & 0x3) === 0) addr &= ~0x10; // Mirror $3F10/$3F14/$3F18/$3F1C to $3F00
        this.palette[addr] = data;
    }
    
    getPalette() {
        return this.palette;
    }
    
    getScreen() { return this.screen; }
    getScreenBuffer() { return this.getScreen(); }
    
    checkNMI() {
        if (this.nmi) {
            this.nmi = false;
            return true;
        }
        return false;
    }
}