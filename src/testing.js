export class TestFramework {
    constructor() {
        this.tests = [];
        this.results = [];
    }
    
    addTest(name, testFunction) {
        this.tests.push({ name, testFunction });
    }
    
    async runTests() {
        this.results = [];
        
        for (const test of this.tests) {
            try {
                console.log(`Running test: ${test.name}`);
                const startTime = performance.now();
                
                await test.testFunction();
                
                const endTime = performance.now();
                const duration = endTime - startTime;
                
                this.results.push({
                    name: test.name,
                    status: 'passed',
                    duration,
                    message: 'Test passed'
                });
                
                console.log(`✓ ${test.name} (${duration.toFixed(2)}ms)`);
            } catch (error) {
                console.error(`✗ ${test.name}: ${error.message}`);
                this.results.push({
                    name: test.name,
                    status: 'failed',
                    duration: 0,
                    message: error.message
                });
            }
        }
        
        return this.results;
    }
    
    generateReport() {
        const passed = this.results.filter(r => r.status === 'passed').length;
        const failed = this.results.filter(r => r.status === 'failed').length;
        const total = this.results.length;
        
        let report = `Test Results:\n`;
        report += `Total: ${total}, Passed: ${passed}, Failed: ${failed}\n\n`;
        
        for (const result of this.results) {
            const status = result.status === 'passed' ? '✓' : '✗';
            report += `${status} ${result.name} (${result.duration.toFixed(2)}ms)\n`;
            if (result.status === 'failed') {
                report += `  Error: ${result.message}\n`;
            }
        }
        
        return report;
    }
}

export class MovieSystem {
    constructor() {
        this.frames = [];
        this.currentFrame = 0;
        this.recording = false;
        this.playing = false;
    }
    
    startRecording() {
        this.frames = [];
        this.currentFrame = 0;
        this.recording = true;
        console.log('Started recording movie');
    }
    
    stopRecording() {
        this.recording = false;
        console.log(`Stopped recording. Captured ${this.frames.length} frames`);
    }
    
    recordFrame(controller1State, controller2State = 0) {
        if (this.recording) {
            this.frames.push({
                frame: this.frames.length,
                controller1: controller1State,
                controller2: controller2State
            });
        }
    }
    
    startPlayback() {
        this.currentFrame = 0;
        this.playing = true;
        console.log(`Started playback of ${this.frames.length} frames`);
    }
    
    stopPlayback() {
        this.playing = false;
        console.log('Stopped playback');
    }
    
    getNextFrame() {
        if (!this.playing || this.currentFrame >= this.frames.length) {
            return null;
        }
        
        const frame = this.frames[this.currentFrame];
        this.currentFrame++;
        
        if (this.currentFrame >= this.frames.length) {
            this.playing = false;
            console.log('Playback completed');
        }
        
        return frame;
    }
    
    saveMovie() {
        const movieData = JSON.stringify(this.frames);
        const blob = new Blob([movieData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `nes-movie-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    }
    
    loadMovie(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    this.frames = JSON.parse(e.target.result);
                    this.currentFrame = 0;
                    console.log(`Loaded movie with ${this.frames.length} frames`);
                    resolve();
                } catch (error) {
                    reject(new Error('Failed to parse movie file'));
                }
            };
            reader.readAsText(file);
        });
    }
}

export class CRC32 {
    static compute(data) {
        const table = CRC32.generateTable();
        let crc = 0xFFFFFFFF;
        
        for (let i = 0; i < data.length; i++) {
            crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
        }
        
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }
    
    static generateTable() {
        const table = new Array(256);
        
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            table[i] = c;
        }
        
        return table;
    }
}

export class RegressionTestSuite {
    constructor() {
        this.goldenHashes = new Map();
        this.testResults = [];
    }
    
    loadGoldenHashes(manifest) {
        this.goldenHashes.clear();
        for (const [romName, hash] of Object.entries(manifest)) {
            this.goldenHashes.set(romName, hash);
        }
    }
    
    async runRegressionTest(nes, romPath, targetFrame = 3600) {
        console.log(`Running regression test for ${romPath}`);
        
        try {
            // Load ROM
            const response = await fetch(romPath);
            const buffer = await response.arrayBuffer();
            const data = new Uint8Array(buffer);
            const cartridge = await nes.loadCartridge(data);
            
            // Fast-forward to target frame
            const startTime = performance.now();
            
            while (nes.ppu.frame < targetFrame) {
                // Run multiple cycles per iteration for faster execution
                for (let i = 0; i < 1000; i++) {
                    nes.step();
                }
            }
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // Generate hash of frame buffer
            const screenData = nes.ppu.getScreen();
            const hash = CRC32.compute(screenData);
            
            // Compare with golden hash
            const expectedHash = this.goldenHashes.get(romPath);
            const passed = expectedHash === undefined || hash === expectedHash;
            
            const result = {
                romPath,
                frame: nes.ppu.frame,
                hash: hash.toString(16).padStart(8, '0'),
                expectedHash: expectedHash ? expectedHash.toString(16).padStart(8, '0') : 'unknown',
                passed,
                duration,
                message: passed ? 'Regression test passed' : `Hash mismatch: expected ${expectedHash}, got ${hash}`
            };
            
            this.testResults.push(result);
            
            console.log(`${passed ? '✓' : '✗'} ${romPath}: ${result.message} (${duration.toFixed(2)}ms)`);
            
            return result;
        } catch (error) {
            const result = {
                romPath,
                frame: 0,
                hash: 'error',
                expectedHash: 'error',
                passed: false,
                duration: 0,
                message: `Test failed: ${error.message}`
            };
            
            this.testResults.push(result);
            console.error(`✗ ${romPath}: ${error.message}`);
            
            return result;
        }
    }
    
    generateReport() {
        const passed = this.testResults.filter(r => r.passed).length;
        const failed = this.testResults.filter(r => !r.passed).length;
        const total = this.testResults.length;
        
        let report = `Regression Test Results:\n`;
        report += `Total: ${total}, Passed: ${passed}, Failed: ${failed}\n\n`;
        
        for (const result of this.testResults) {
            const status = result.passed ? '✓' : '✗';
            report += `${status} ${result.romPath}\n`;
            report += `  Frame: ${result.frame}, Hash: ${result.hash}`;
            if (!result.passed) {
                report += `, Expected: ${result.expectedHash}\n`;
                report += `  ${result.message}`;
            }
            report += `\n`;
        }
        
        return report;
    }
    
    updateGoldenHash(romPath, hash) {
        this.goldenHashes.set(romPath, hash);
        console.log(`Updated golden hash for ${romPath}: ${hash.toString(16).padStart(8, '0')}`);
    }
    
    saveGoldenManifest() {
        const manifest = {};
        for (const [romPath, hash] of this.goldenHashes) {
            manifest[romPath] = hash;
        }
        
        const manifestData = JSON.stringify(manifest, null, 2);
        const blob = new Blob([manifestData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'golden-hashes.json';
        a.click();
        
        URL.revokeObjectURL(url);
    }
}