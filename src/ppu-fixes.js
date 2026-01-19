# PPU Bug Fixes Implementation

## 1. Critical Mirroring Fix

**Problem**: Double mirroring in nametable reads and inconsistent 4-screen support.
**Fix**: Implement a clean mirroring system.

```javascript
mirroredAddr(addr) {
    addr &= 0x3FFF;
    const mirror = this.cartridge?.getMirror() || 'horizontal';
    
    switch (mirror) {
        case 'horizontal':
            // Mirror $2400 to $2000, $2C00 to $2800
            addr &= ~0x0400;
            if (addr >= 0x0800 && addr < 0x0C00) addr -= 0x0400;
            if (addr >= 0x0C00) addr &= ~0x0400;
            break;
        case 'vertical':
            // Mirror $2800 to $2000, $2C00 to $2400  
            addr &= ~0x0800;
            if (addr >= 0x1800 && addr < 0x1C00) addr -= 0x0800;
            if (addr >= 0x1C00) addr &= ~0x0800;
            break;
        case 'single-screen':
            addr &= 0x03FF;
            break;
        case 'four-screen':
            // No mirroring for four-screen
            return addr;
        default:
            return addr & 0x07FF; // Fallback to 2KB
    }
    
    return addr & 0x07FF;
}
```

## 2. Sprite Evaluation Timing Fix

**Problem**: Sprite 0 hit detection and overflow flag timing are inaccurate.
**Fix**: Proper 64-cycle sprite evaluation with accurate timing.

```javascript
evaluateSpritesStep() {
    const cycleOffset = this.cycle - 257;
    const spriteHeight = (this.control & 0x20) ? 16 : 8;
    
    if (cycleOffset === 0) {
        // Initialize sprite evaluation
        this.secondaryOAM.fill(0xFF);
        this.spriteEvaluationIndex = 0;
        this.foundSprites = 0;
        this.spriteOverflowIndex = -1;
        this.spriteScanline = [];
        this.spriteZeroPossible = false;
    } else if (cycleOffset < 64) {
        // Primary OAM search (cycles 1-64)
        if (this.spriteEvaluationIndex < 64) {
            const oamEntryY = this.oam[this.spriteEvaluationIndex * 4];
            
            // Check if sprite is on current scanline (not next!)
            if (this.scanline >= oamEntryY && this.scanline < oamEntryY + spriteHeight) {
                if (this.foundSprites < 8) {
                    // Copy to secondary OAM
                    const secondaryIndex = this.foundSprites * 4;
                    this.secondaryOAM[secondaryIndex] = oamEntryY;
                    this.secondaryOAM[secondaryIndex + 1] = this.oam[this.spriteEvaluationIndex * 4 + 1];
                    this.secondaryOAM[secondaryIndex + 2] = this.oam[this.spriteEvaluationIndex * 4 + 2];
                    this.secondaryOAM[secondaryIndex + 3] = this.oam[this.spriteEvaluationIndex * 4 + 3];
                    
                    // Add to sprite scanline for rendering
                    this.spriteScanline.push({
                        y: oamEntryY,
                        id: this.oam[this.spriteEvaluationIndex * 4 + 1],
                        attr: this.oam[this.spriteEvaluationIndex * 4 + 2],
                        x: this.oam[this.spriteEvaluationIndex * 4 + 3],
                        palette: (this.oam[this.spriteEvaluationIndex * 4 + 2] & 0x03) + 4,
                        priority: (this.oam[this.spriteEvaluationIndex * 4 + 2] & 0x20) ? 1 : 0,
                        hFlip: (this.oam[this.spriteEvaluationIndex * 4 + 2] & 0x40) ? 1 : 0,
                        vFlip: (this.oam[this.spriteEvaluationIndex * 4 + 2] & 0x80) ? 1 : 0,
                        oamIndex: this.spriteEvaluationIndex
                    });
                    
                    if (this.spriteEvaluationIndex === 0) {
                        this.spriteZeroPossible = true;
                    }
                    
                    this.foundSprites++;
                } else if (this.spriteOverflowIndex === -1) {
                    // Found 9th sprite - set overflow flag immediately
                    this.spriteOverflowIndex = this.spriteEvaluationIndex;
                    this.status |= 0x20; // Set sprite overflow flag
                }
            }
            
            this.spriteEvaluationIndex++;
        }
    } else if (cycleOffset >= 64) {
        // Copy secondary OAM back to primary OAM (cycles 65-320)
        if (this.spriteOverflowIndex >= 0) {
            this.oamAddr = this.spriteOverflowIndex;
        } else {
            this.oamAddr = 0;
        }
    }
}
```

## 3. Palette Simplification

**Problem**: Custom RGB/PAL transformation not part of NES spec.
**Fix**: Remove color transformation, use direct palette values.

```javascript
getNESColor(colorIndex) {
    if (this.mask & 0x01) { // Grayscale mode
        colorIndex &= 0x30;
    }
    
    // Use direct palette lookup without color processing
    colorIndex &= 0x3F; // Ensure 6-bit index
    
    // Return the 6-bit value directly - let renderer handle RGB conversion
    return colorIndex;
}
```

## 4. Register Write Cleanup

**Problem**: Power-up protection interfering with tests.
**Fix**: Simplify register write logic.

```javascript
writeRegister(addr, data) {
    this.openBus = data & 0xFF;
    addr &= 0x07;
    
    switch (addr) {
        case 0x00: // PPUCTRL
            this.control = data;
            this.tempAddr = (this.tempAddr & 0xF3FF) | ((data & 0x03) << 10);
            this.tempAddr = (this.tempAddr & 0x8FFF) | ((data & 0x80) << 5);
            break;
        case 0x01: // PPUMASK
            this.mask = data;
            this.colorCache.length = 0;
            break;
        // ... other cases
    }
}
```

## 5. Background/Sprite Priority Fix

**Problem**: Incorrect sprite 0 hit detection logic.
**Fix**: Simplify to hardware-accurate behavior.

```javascript
// In pixelRendering(), replace sprite 0 hit logic:
if (this.spriteZeroPossible && spriteData.oamIndex === 0 && bgOpaque && spritePixel !== 0) {
    if (!((this.mask & 0x08) === 0 || (this.mask & 0x10) === 0)) {
        this.status |= 0x40; // Set sprite 0 hit flag
    }
}
```

These fixes address the core PPU accuracy issues while maintaining performance and readability.