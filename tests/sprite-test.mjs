import { NES } from '../src/nes.js';
import { readFileSync } from 'fs';

async function testSpriteRendering() {
    console.log('🧪 Testing sprite rendering...');
    
    // Load a test ROM (using color_test.nes which should have sprites)
    const romData = readFileSync('/Users/tobizacchaeus/Documents/NES/tests/color_test.nes');
    const nes = new NES();
    
    try {
        const loaded = nes.load(romData);
        if (!loaded) {
            console.error('❌ Failed to load ROM');
            return;
        }
        
        console.log('✅ ROM loaded successfully');
        nes.reset();
        
        // Enable PPU rendering
        nes.ppu.writeRegister(0x00, 0x80); // Enable NMI
        nes.ppu.writeRegister(0x01, 0x1E); // Enable sprites and background
        
        // Run for a few frames to see sprite rendering
        for (let frame = 0; frame < 10; frame++) {
            console.log(`Rendering frame ${frame + 1}...`);
            
            // Run for one full frame (262 scanlines * 341 cycles per scanline)
            for (let cycles = 0; cycles < 262 * 341; cycles++) {
                nes.clock();
            }
            
            // Check if sprites were evaluated
            if (nes.ppu.spriteScanline.length > 0) {
                console.log(`  🎯 Found ${nes.ppu.spriteScanline.length} sprites on scanline`);
                nes.ppu.spriteScanline.forEach((sprite, i) => {
                    console.log(`    Sprite ${i}: ID=${sprite.id.toString(16)} X=${sprite.x} Y=${sprite.y} Palette=${sprite.palette}`);
                });
            }
            
            // Check PPU status
            const status = nes.ppu.status;
            console.log(`  📊 PPU Status: VBlank=${!!(status & 0x80)} Sprite0Hit=${!!(status & 0x40)} SpriteOverflow=${!!(status & 0x20)}`);
        }
        
        console.log('✅ Sprite rendering test completed');
        
    } catch (error) {
        console.error('❌ Error during sprite test:', error);
    }
}

testSpriteRendering().catch(console.error);