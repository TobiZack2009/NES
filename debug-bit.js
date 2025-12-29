#!/usr/bin/env node

const { NES } = require('../dist/nes-emu.js');
const fs = require('fs');

async function test() {
  // Load ROM
  const romData = fs.readFileSync('./tests/nestest.nes');
  const { loadROM } = require('../src/cartridge.js');
  const cartridge = loadROM(new Uint8Array(romData));

  const nes = new NES();
  nes.loadCartridge(cartridge);
  nes.reset();

  // Set up failing test state
  nes.cpu.pc = 0xC782;
  nes.cpu.a = 0xFF;
  nes.cpu.x = 0x00;
  nes.cpu.y = 0x00;
  nes.cpu.stkp = 0xFB;
  nes.cpu.status = 0xE4; // P:E4 (11100100)

  console.log('Before BIT $01:');
  console.log('PC:', nes.cpu.pc.toString(16).padStart(4, '0').toUpperCase());
  console.log('A:', nes.cpu.a.toString(16).padStart(2, '0').toUpperCase());
  console.log('Status:', nes.cpu.status.toString(2).padStart(8, '0'));

  // Enable tracing to see what happens
  nes.cpu.enableTrace();

  // Execute BIT instruction
  const opcode = 0x24; // BIT ZPG
  const instruction = nes.cpu.lookup[opcode];
  const addrData = nes.cpu.ZPG();
  
  console.log('Fetched operand address:', addrData.addr.toString(16));
  console.log('Fetched operand value:', nes.cpu.bus.read(addrData.addr).toString(16));
  
  instruction.operate.call(nes.cpu, addrData);

  console.log('After BIT $01:');
  console.log('PC:', nes.cpu.pc.toString(16).padStart(4, '0').toUpperCase());
  console.log('A:', nes.cpu.a.toString(16).padStart(2, '0').toUpperCase());
  console.log('Status:', nes.cpu.status.toString(2).padStart(8, '0'));
  console.log('Expected: P:E4 (11100100)');

  // Show trace
  console.log('Trace:');
  const trace = nes.cpu.getTrace();
  trace.forEach((entry, i) => {
    console.log(`${i}: PC=${entry.pc.toString(16)} A=${entry.a} Status=${entry.status} ${entry.name}`);
  });
}

test().catch(console.error);