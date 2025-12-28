export class Cartridge {
    constructor() {
        this.mapperID = 0;
        this.prgBanks = 0;
        this.chrBanks = 0;
        this.prgROM = null;
        this.chrROM = null;
        this.prgRAM = new Uint8Array(0x2000);
        this.mirror = 'horizontal';
        
        // Mapper specific properties
        this.mapper = null;
    }
    
    static fromINES(data) {
        const cartridge = new Cartridge();
        
        // Verify iNES header
        if (data.length < 16 || 
            String.fromCharCode(data[0], data[1], data[2], data[3]) !== 'NES\x1A') {
            throw new Error('Invalid iNES file format');
        }
        
        // Parse header
        cartridge.prgBanks = data[4];
        cartridge.chrBanks = data[5];
        
        const flags6 = data[6];
        const flags7 = data[7];
        
        // Extract mapper ID
        cartridge.mapperID = ((flags7 >> 4) << 4) | (flags6 >> 4);
        
        // Determine mirroring
        if (flags6 & 0x01) {
            cartridge.mirror = 'vertical';
        } else {
            cartridge.mirror = 'horizontal';
        }
        
        // 4-screen mirroring (rare)
        if (flags6 & 0x08) {
            cartridge.mirror = 'four-screen';
        }
        
        // Battery-backed PRG RAM
        const hasBattery = (flags6 & 0x02) !== 0;
        
        // Trainer (512 bytes)
        let trainerOffset = 16;
        if (flags6 & 0x04) {
            trainerOffset += 512;
        }
        
        // Calculate ROM sizes
        const prgSize = cartridge.prgBanks * 0x4000; // 16KB per bank
        const chrSize = cartridge.chrBanks * 0x2000; // 8KB per bank
        
        // Extract PRG ROM
        cartridge.prgROM = new Uint8Array(data.buffer, trainerOffset, prgSize);
        
        // Extract CHR ROM or allocate CHR RAM
        const chrOffset = trainerOffset + prgSize;
        if (cartridge.chrBanks > 0) {
            cartridge.chrROM = new Uint8Array(data.buffer, chrOffset, chrSize);
        } else {
            cartridge.chrROM = new Uint8Array(0x2000); // 8KB CHR RAM
        }
        
        // Initialize mapper
        cartridge.initMapper();
        
        return cartridge;
    }
    
    initMapper() {
        // For now, implement basic mapper 0 (NROM)
        // Future mappers would be implemented as separate classes
        this.mapper = new Mapper0(this.prgBanks, this.chrBanks, this);
    }
    
    cpuRead(addr) {
        return this.mapper?.cpuRead(addr) || 0x00;
    }
    
    cpuWrite(addr, data) {
        this.mapper?.cpuWrite(addr, data);
    }
    
    ppuRead(addr) {
        return this.mapper?.ppuRead(addr) || 0x00;
    }
    
    ppuWrite(addr, data) {
        this.mapper?.ppuWrite(addr, data);
    }
    
    getMirror() {
        return this.mirror;
    }
}

// Base Mapper class
export class Mapper {
    constructor(prgBanks, chrBanks, cartridge) {
        this.prgBanks = prgBanks;
        this.chrBanks = chrBanks;
        this.cartridge = cartridge;
    }
    
    cpuRead(addr) { return 0x00; }
    cpuWrite(addr, data) {}
    ppuRead(addr) { return 0x00; }
    ppuWrite(addr, data) {}
}

// Mapper 0 - NROM (no bank switching)
export class Mapper0 extends Mapper {
    constructor(prgBanks, chrBanks, cartridge) {
        super(prgBanks, chrBanks, cartridge);
    }
    
    cpuRead(addr) {
        if (addr >= 0x8000 && addr <= 0xFFFF) {
            if (this.prgBanks === 1) {
                // 16KB PRG ROM, mirror at $C000
                return this.cartridge.prgROM[addr & 0x3FFF];
            } else {
                // 32KB PRG ROM
                return this.cartridge.prgROM[addr & 0x7FFF];
            }
        }
        return 0x00;
    }
    
    cpuWrite(addr, data) {
        if (addr >= 0x6000 && addr <= 0x7FFF) {
            // PRG RAM
            this.cartridge.prgRAM[addr & 0x1FFF] = data;
        }
        // PRG ROM is read-only
    }
    
    ppuRead(addr) {
        if (addr >= 0x0000 && addr <= 0x1FFF) {
            return this.cartridge.chrROM[addr];
        }
        return 0x00;
    }
    
    ppuWrite(addr, data) {
        if (addr >= 0x0000 && addr <= 0x1FFF) {
            if (this.chrBanks === 0) {
                // CHR RAM
                this.cartridge.chrROM[addr] = data;
            }
            // CHR ROM is read-only
        }
    }
}

// Utility function to load a ROM file
export async function loadROM(file) {
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);
    return Cartridge.fromINES(data);
}