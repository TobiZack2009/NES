import { assert } from 'chai';
import { CPU, FLAGS } from '../src/cpu.js';
import { MockBus } from './setup/mock-bus.js';

describe("CPU", function () {
    let cpu = null;
    let bus = null;
    let perform_check_cycles = true;

    beforeEach(function (done) {
        bus = new MockBus();
        cpu = new CPU(bus);
        
        // Set reset vector to point to 0x100 where tests place their instructions
        bus.write(0xFFFC, 0x00);
        bus.write(0xFFFD, 0x01);
        
        cpu.reset();
        perform_check_cycles = true;
        cpu.stkp = 0xfd;
        done();
    });

    function check_cycles() {
        return perform_check_cycles;
    }

    function skip_cycles() {
        perform_check_cycles = false;
    }

    function cpu_pc(counter) {
        cpu.pc = counter;
    };

    function memory_set(pos, val) {
        bus.cpuWrite(pos, val);
    }

    function memory_fetch(pos) {
        return bus.cpuRead(pos);
    }

    function execute() {
        // Execute one instruction completely
        if (cpu.cycles === 0) {
            cpu.clock();
        }
        while (cpu.cycles > 0) {
            cpu.clock();
        }
        return 0; // jsNES returns cycles, our interface is different
    }

    function cpu_set_register(register, value) {
        if (register == 'P') {
            cpu.status = value ^ 0b10; // Adjust for bit 2 difference
        } else if (register == 'A') {
            cpu.a = value;
        } else if (register == 'X') {
            cpu.x = value;
        } else if (register == 'Y') {
            cpu.y = value;
        } else if (register == 'SP') {
            cpu.stkp = value;
        } else if (register == 'PC') {
            cpu.pc = value;
        }
    }

    function cpu_register(register) {
        if (register == 'P') {
            return cpu.status ^ 0b10; // Adjust for bit 2 difference
        } else if (register == 'A') {
            return cpu.a;
        } else if (register == 'X') {
            return cpu.x;
        } else if (register == 'Y') {
            return cpu.y;
        } else if (register == 'SP') {
            return cpu.stkp;
        } else if (register == 'PC') {
            return cpu.pc + 1;
        }
        return null;
    }

    function cpu_flag(flag){
        const flagMap = {
            'C': FLAGS.C,
            'Z': FLAGS.Z,
            'I': FLAGS.I,
            'D': FLAGS.D,
            'V': FLAGS.V,
            'N': FLAGS.N
        };
        const flagBit = flagMap[flag];
        if (flagBit === undefined) return false;
        return Boolean(cpu.status & flagBit);
    }

    function cpu_set_flag(flag){
        const flagMap = {
            'C': FLAGS.C,
            'Z': FLAGS.Z,
            'I': FLAGS.I,
            'D': FLAGS.D,
            'V': FLAGS.V,
            'N': FLAGS.N
        };
        const flagBit = flagMap[flag];
        if (flagBit === undefined) return;
        cpu.status |= flagBit;
    }

    function cpu_unset_flag(flag){
        const flagMap = {
            'C': FLAGS.C,
            'Z': FLAGS.Z,
            'I': FLAGS.I,
            'D': FLAGS.D,
            'V': FLAGS.V,
            'N': FLAGS.N
        };
        const flagBit = flagMap[flag];
        if (flagBit === undefined) return;
        cpu.status &= ~flagBit;
    }

    it("lda immediate", function(done) {
        cpu_pc(0x100);
        memory_set(0x100, 0xa9);
        memory_set(0x101, 0xff);

        execute();

        assert.equal(cpu_register("A"), 0xff);
        done();
    });
    
    it("lda zeropage", function(done) {
        cpu_pc(0x100);
        memory_set(0x100, 0xa5);
        memory_set(0x101, 0x84);
        memory_set(0x84, 0xff);

        execute();

        assert.equal(cpu_register("A"), 0xff);
        done();
    });
    
    it("lda zero page x", function(done) {
        cpu_set_register("X", 0x1);
        cpu_pc(0x100);
        memory_set(0x100, 0xb5);
        memory_set(0x101, 0x84);
        memory_set(0x85, 0xff);

        execute();

        assert.equal(cpu_register("A"), 0xff);
        done();
    });
    
    it("lda absolute", function(done) {
        cpu_pc(0x100);
        memory_set(0x100, 0xad);
        memory_set(0x101, 0x84);
        memory_set(0x102, 0x0);
        memory_set(0x84, 0xff);

        execute();

        assert.equal(cpu_register("A"), 0xff);
        done();
    });

    it("tax", function(done) {
        cpu_set_register("A", 0xff);
        cpu_pc(0x100);
        memory_set(0x100, 0xaa);

        execute();

        assert.equal(cpu_register("X"), 0xff);
        done();
    });

    it("tay", function(done) {
        cpu_set_register("A", 0xff);
        cpu_pc(0x100);
        memory_set(0x100, 0xa8);

        execute();

        assert.equal(cpu_register("Y"), 0xff);
        done();
    });

    it("txa", function(done) {
        cpu_set_register("X", 0xff);
        cpu_pc(0x100);
        memory_set(0x100, 0x8a);

        execute();

        assert.equal(cpu_register("A"), 0xff);
        done();
    });

    it("tya", function(done) {
        cpu_set_register("Y", 0xff);
        cpu_pc(0x100);
        memory_set(0x100, 0x98);

        execute();

        assert.equal(cpu_register("A"), 0xff);
        done();
    });

    // More comprehensive tests from jsNES
    it("ldx immediate", function(done) {
        cpu_pc(0x100);
        memory_set(0x100, 0xa2);
        memory_set(0x101, 0xff);

        execute();

        assert.equal(cpu_register("X"), 0xff);
        done();
    });
    
    it("ldy immediate", function(done) {
        cpu_pc(0x100);
        memory_set(0x100, 0xa0);
        memory_set(0x101, 0xff);

        execute();

        assert.equal(cpu_register("Y"), 0xff);
        done();
    });

    it("sta zeropage", function(done) {
        cpu_set_register("A", 0xff);
        cpu_pc(0x100);
        memory_set(0x100, 0x85);
        memory_set(0x101, 0x84);

        execute();

        assert.equal(memory_fetch(0x84), 0xff);
        done();
    });

    it("stx zeropage", function(done) {
        cpu_set_register("X", 0xff);
        cpu_pc(0x100);
        memory_set(0x100, 0x86);
        memory_set(0x101, 0x84);

        execute();

        assert.equal(memory_fetch(0x84), 0xff);
        done();
    });

    it("sty zeropage", function(done) {
        cpu_set_register("Y", 0xff);
        cpu_pc(0x100);
        memory_set(0x100, 0x84);
        memory_set(0x101, 0x84);

        execute();

        assert.equal(memory_fetch(0x84), 0xff);
        done();
    });

    it("lda z flag set", function(done) {
        cpu_pc(0x100);
        memory_set(0x100, 0xa9);
        memory_set(0x101, 0x0);

        execute();

        assert.isTrue(cpu_flag("Z"));
        done();
    });
    
    it("lda z flag unset", function(done) {
        cpu_pc(0x100);
        memory_set(0x100, 0xa9);
        memory_set(0x101, 0x1);

        execute();

        assert.isFalse(cpu_flag("Z"));
        done();
    });
    
    it("lda n flag set", function(done) {
        cpu_pc(0x100);
        memory_set(0x100, 0xa9);
        memory_set(0x101, 0x81);

        execute();

        assert.isTrue(cpu_flag("N"));
        done();
    });
    
    it("lda n flag unset", function(done) {
        cpu_pc(0x100);
        memory_set(0x100, 0xa9);
        memory_set(0x101, 0x1);

        execute();

        assert.isFalse(cpu_flag("N"));
        done();
    });

    it("adc immediate", function(done) {
        cpu_set_register("A", 0x1);
        cpu_pc(0x100);
        memory_set(0x100, 0x69);
        memory_set(0x101, 0x2);

        execute();

        assert.equal(cpu_register("A"), 0x3);
        done();
    });

    it("sbc immediate", function(done) {
        cpu_set_flag("C");
        cpu_set_register("A", 0x2);
        cpu_pc(0x100);
        memory_set(0x100, 0xe9);
        memory_set(0x101, 0x1);

        execute();

        assert.equal(cpu_register("A"), 0x1);
        done();
    });
});