import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/main.js',
  output: {
    file: 'dist/nes-emu.js',
    format: 'iife',
    name: 'NESEmulator',
    sourcemap: true
  },
  plugins: [resolve(), commonjs()]
};