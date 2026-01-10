/**
 * Mock NES object for component testing
 * Provides minimal interface required by PPU and other components
 */
export function createMockNES() {
    return {
        cpu: {
            requestIrq: function(type) {
                this.lastIrqType = type;
            },
            IRQ_NMI: 1,
            IRQ_NORMAL: 0,
            mem: new Array(0x10000).fill(0),
            haltCycles: function(cycles) {
                this.lastHaltCycles = cycles;
            }
        },
        rom: {
            HORIZONTAL_MIRRORING: 0,
            VERTICAL_MIRRORING: 1,
            SINGLESCREEN_MIRRORING: 2,
            SINGLESCREEN_MIRRORING2: 3,
            FOURSCREEN_MIRRORING: 4
        },
        mmap: {
            clockIrqCounter: function() {},
            latchAccess: function(address) {
                this.lastLatchAddress = address;
            }
        },
        ui: {
            writeFrame: function(buffer) {
                this.lastFrameBuffer = buffer;
            }
        }
    };
}