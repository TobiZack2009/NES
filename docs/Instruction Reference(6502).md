# Instruction reference - NESdev Wiki

# Instruction reference

From NESdev Wiki

[Jump to navigation](#column-one)[Jump to search](#searchInput)

Official 6502 Instructions

[ADC](#ADC)

[AND](#AND)

[ASL](#ASL)

[BCC](#BCC)

[BCS](#BCS)

[BEQ](#BEQ)

[BIT](#BIT)

[BMI](#BMI)

[BNE](#BNE)

[BPL](#BPL)

[BRK](#BRK)

[BVC](#BVC)

[BVS](#BVS)

[CLC](#CLC)

[CLD](#CLD)

[CLI](#CLI)

[CLV](#CLV)

[CMP](#CMP)

[CPX](#CPX)

[CPY](#CPY)

[DEC](#DEC)

[DEX](#DEX)

[DEY](#DEY)

[EOR](#EOR)

[INC](#INC)

[INX](#INX)

[INY](#INY)

[JMP](#JMP)

[JSR](#JSR)

[LDA](#LDA)

[LDX](#LDX)

[LDY](#LDY)

[LSR](#LSR)

[NOP](#NOP)

[ORA](#ORA)

[PHA](#PHA)

[PHP](#PHP)

[PLA](#PLA)

[PLP](#PLP)

[ROL](#ROL)

[ROR](#ROR)

[RTI](#RTI)

[RTS](#RTS)

[SBC](#SBC)

[SEC](#SEC)

[SED](#SED)

[SEI](#SEI)

[STA](#STA)

[STX](#STX)

[STY](#STY)

[TAX](#TAX)

[TAY](#TAY)

[TSX](#TSX)

[TXA](#TXA)

[TXS](#TXS)

[TYA](#TYA)

## Official instructions by type

Type

Instructions

Access

[LDA](#LDA)

[STA](#STA)

[LDX](#LDX)

[STX](#STX)

[LDY](#LDY)

[STY](#STY)

Transfer

[TAX](#TAX)

[TXA](#TXA)

[TAY](#TAY)

[TYA](#TYA)

Arithmetic

[ADC](#ADC)

[SBC](#SBC)

[INC](#INC)

[DEC](#DEC)

[INX](#INC)

[DEX](#DEC)

[INY](#INY)

[DEY](#DEY)

Shift

[ASL](#ASL)

[LSR](#LSR)

[ROL](#ROL)

[ROR](#ROR)

Bitwise

[AND](#AND)

[ORA](#ORA)

[EOR](#EOR)

[BIT](#BIT)

Compare

[CMP](#CMP)

[CPX](#CPX)

[CPY](#CPY)

Branch

[BCC](#BCC)

[BCS](#BCS)

[BEQ](#BEQ)

[BNE](#BNE)

[BPL](#BPL)

[BMI](#BMI)

[BVC](#BVC)

[BVS](#BVS)

Jump

[JMP](#JMP)

[JSR](#JSR)

[RTS](#RTS)

[BRK](#BRK)

[RTI](#RTI)

Stack

[PHA](#PHA)

[PLA](#PLA)

[PHP](#PHP)

[PLP](#PLP)

[TXS](#TXS)

[TSX](#TSX)

Flags

[CLC](#CLC)

[SEC](#SEC)

[CLI](#CLI)

[SEI](#SEI)

[CLD](#CLD)

[SED](#SED)

[CLV](#CLV)

Other

[NOP](#NOP)

## Official instructions

### ADC - Add with Carry

`A = A + memory + C`

ADC adds the carry flag and a memory value to the accumulator. The carry flag is then set to the carry value coming out of bit 7, allowing values larger than 1 byte to be added together by carrying the 1 into the next byte's addition. This can also be thought of as unsigned overflow. It is common to clear carry with [CLC](#CLC) before adding the first byte to ensure it is in a known state, avoiding an off-by-one error. The overflow flag indicates whether signed overflow or underflow occurred. This happens if both inputs are positive and the result is negative, or both are negative and the result is positive.

Flag

New value

Notes

[C - Carry](/wiki/Status_flags#C "Status flags")

result > $FF

If the result overflowed past $FF (wrapping around), unsigned overflow occurred.

[Z - Zero](/wiki/Status_flags#Z "Status flags")

result == 0

[V - Overflow](/wiki/Status_flags#V "Status flags")

(result ^ A) & (result ^ memory) & $80

If the result's sign is different from both A's and memory's, signed overflow (or underflow) occurred.

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[#Immediate](/wiki/Addressing_modes#Immediate "Addressing modes")

$69

2

2

[Zero Page](/wiki/Addressing_modes#Zero_page_read "Addressing modes")

$65

2

3

[Zero Page,X](/wiki/Addressing_modes#Zero_page_indexed_read "Addressing modes")

$75

2

4

[Absolute](/wiki/Addressing_modes#Absolute_read "Addressing modes")

$6D

3

4

[Absolute,X](/wiki/Addressing_modes#Absolute_indexed_read "Addressing modes")

$7D

3

4 (5 if page crossed)

[Absolute,Y](/wiki/Addressing_modes#Absolute_indexed_read "Addressing modes")

$79

3

4 (5 if page crossed)

[(Indirect,X)](/wiki/Addressing_modes#Indirect_x_read "Addressing modes")

$61

2

6

[(Indirect),Y](/wiki/Addressing_modes#Indirect_y_read "Addressing modes")

$71

2

5 (6 if page crossed)

See also: [SBC](#SBC), [CLC](#CLC)

---

### AND - Bitwise AND

`A = A & memory`

This ANDs a memory value and the accumulator, bit by bit. If both input bits are 1, the resulting bit is 1. Otherwise, it is 0.

AND truth table Expand

A

memory

result

0

0

0

0

1

0

1

0

0

1

1

1

Flag

New value

[Z - Zero](/wiki/Status_flags#Z "Status flags")

result == 0

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[#Immediate](/wiki/Addressing_modes#Immediate "Addressing modes")

$29

2

2

[Zero Page](/wiki/Addressing_modes#Zero_page_read "Addressing modes")

$25

2

3

[Zero Page,X](/wiki/Addressing_modes#Zero_page_indexed_read "Addressing modes")

$35

2

4

[Absolute](/wiki/Addressing_modes#Absolute_read "Addressing modes")

$2D

3

4

[Absolute,X](/wiki/Addressing_modes#Absolute_indexed_read "Addressing modes")

$3D

3

4 (5 if page crossed)

[Absolute,Y](/wiki/Addressing_modes#Absolute_indexed_read "Addressing modes")

$39

3

4 (5 if page crossed)

[(Indirect,X)](/wiki/Addressing_modes#Indirect_x_read "Addressing modes")

$21

2

6

[(Indirect),Y](/wiki/Addressing_modes#Indirect_y_read "Addressing modes")

$31

2

5 (6 if page crossed)

See also: [ORA](#ORA), [EOR](#EOR)

---

### ASL - Arithmetic Shift Left

`value = value << 1`, or visually: `C <- [76543210] <- 0`

ASL shifts all of the bits of a memory value or the accumulator one position to the left, moving the value of each bit into the next bit. Bit 7 is shifted into the carry flag, and 0 is shifted into bit 0. This is equivalent to multiplying an unsigned value by 2, with carry indicating overflow.

This is a read-modify-write instruction, meaning that its addressing modes that operate on memory first write the original value back to memory before the modified value. This extra write can matter if targeting a hardware register.

Flag

New value

[C - Carry](/wiki/Status_flags#C "Status flags")

value bit 7

[Z - Zero](/wiki/Status_flags#Z "Status flags")

result == 0

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[Accumulator](/wiki/Addressing_modes#Accumulator "Addressing modes")

$0A

1

2

[Zero Page](/wiki/Addressing_modes#Zero_page_rmw "Addressing modes")

$06

2

5

[Zero Page,X](/wiki/Addressing_modes#Zero_page_indexed_rmw "Addressing modes")

$16

2

6

[Absolute](/wiki/Addressing_modes#Absolute_rmw "Addressing modes")

$0E

3

6

[Absolute,X](/wiki/Addressing_modes#Absolute_indexed_rmw "Addressing modes")

$1E

3

7

See also: [LSR](#LSR), [ROL](#ROL), [ROR](#ROR)

---

### BCC - Branch if Carry Clear

`PC = PC + 2 + memory (signed)`

If the carry flag is clear, BCC branches to a nearby location by adding the relative offset to the program counter. The offset is signed and has a range of \[-128, 127\] relative to the first byte _after_ the branch instruction. Branching further than that requires using a [JMP](#JMP) instruction, instead, and branching over that [JMP](#JMP) when carry is set with [BCS](#BCS).

The carry flag has different meanings depending on the context. BCC can be used after a compare to branch if the register is less than the memory value, so it is sometimes called BLT for Branch if Less Than. It can also be used after [SBC](#SBC) to branch if the unsigned value underflowed or after [ADC](#ADC) to branch if it did _not_ overflow.

Addressing mode

Opcode

Bytes

Cycles

[Relative](/wiki/Addressing_modes#Relative "Addressing modes")

$90

2

2 (3 if branch taken, 4 if page crossed)[\*](#footnote)

See also: [BCS](#BCS), [JMP](#JMP)

---

### BCS - Branch if Carry Set

`PC = PC + 2 + memory (signed)`

If the carry flag is set, BCS branches to a nearby location by adding the branch offset to the program counter. The offset is signed and has a range of \[-128, 127\] relative to the first byte _after_ the branch instruction. Branching further than that requires using a [JMP](#JMP) instruction, instead, and branching over that [JMP](#JMP) when carry is clear with [BCC](#BCC).

The carry flag has different meanings depending on the context. BCS can be used after a compare to branch if the register is greater than or equal to the memory value, so it is sometimes called BGE for Branch if Greater Than or Equal. It can also be used after [ADC](#ADC) to branch if the unsigned value overflowed or after [SBC](#SBC) to branch if it did _not_ underflow.

Addressing mode

Opcode

Bytes

Cycles

[Relative](/wiki/Addressing_modes#Relative "Addressing modes")

$B0

2

2 (3 if branch taken, 4 if page crossed)[\*](#footnote)

See also: [BCC](#BCC), [JMP](#JMP)

---

### BEQ - Branch if Equal

`PC = PC + 2 + memory (signed)`

If the zero flag is set, BEQ branches to a nearby location by adding the branch offset to the program counter. The offset is signed and has a range of \[-128, 127\] relative to the first byte _after_ the branch instruction. Branching further than that requires using a [JMP](#JMP) instruction, instead, and branching over that [JMP](#JMP) when zero is clear with [BNE](#BNE).

Comparison uses this flag to indicate if the compared values are equal. All instructions that change A, X, or Y also implicitly set or clear the zero flag depending on whether the register becomes 0.

Addressing mode

Opcode

Bytes

Cycles

[Relative](/wiki/Addressing_modes#Relative "Addressing modes")

$F0

2

2 (3 if branch taken, 4 if page crossed)[\*](#footnote)

See also: [BNE](#BNE), [JMP](#JMP)

---

### BIT - Bit Test

`A & memory`

BIT modifies flags, but does not change memory or registers. The zero flag is set depending on the result of the accumulator AND memory value, effectively applying a bitmask and then checking if any bits are set. Bits 7 and 6 of the memory value are loaded directly into the negative and overflow flags, allowing them to be easily checked without having to load a mask into A.

Because BIT only changes CPU flags, it is sometimes used to trigger the read side effects of a hardware register without clobbering any CPU registers, or even to waste cycles as a 3-cycle [NOP](#NOP). As an advanced trick, it is occasionally used to hide a 1- or 2-byte instruction in its operand that is only executed if jumped to directly, allowing two code paths to be interleaved. However, because the instruction in the operand is treated as an address from which to read, this carries risk of triggering side effects if it reads a hardware register. This trick can be useful when working under tight constraints on space, time, or register usage.

Flag

New value

[Z - Zero](/wiki/Status_flags#Z "Status flags")

result == 0

[V - Overflow](/wiki/Status_flags#V "Status flags")

memory bit 6

[N - Negative](/wiki/Status_flags#N "Status flags")

memory bit 7

Addressing mode

Opcode

Bytes

Cycles

[Zero page](/wiki/Addressing_modes#Zero_page_read "Addressing modes")

$24

2

3

[Absolute](/wiki/Addressing_modes#Absolute_read "Addressing modes")

$2C

3

4

See also: [AND](#AND)

---

### BMI - Branch if Minus

`PC = PC + 2 + memory (signed)`

If the negative flag is set, BMI branches to a nearby location by adding the branch offset to the program counter. The offset is signed and has a range of \[-128, 127\] relative to the first byte _after_ the branch instruction. Branching further than that requires using a [JMP](#JMP) instruction, instead, and branching over that [JMP](#JMP) when negative is clear with [BPL](#BPL).

All instructions that change A, X, or Y implicitly set or clear the negative flag based on bit 7 (the sign bit).

Addressing mode

Opcode

Bytes

Cycles

[Relative](/wiki/Addressing_modes#Relative "Addressing modes")

$30

2

2 (3 if branch taken, 4 if page crossed)[\*](#footnote)

See also: [BPL](#BPL), [JMP](#JMP)

---

### BNE - Branch if Not Equal

`PC = PC + 2 + memory (signed)`

If the zero flag is clear, BNE branches to a nearby location by adding the branch offset to the program counter. The offset is signed and has a range of \[-128, 127\] relative to the first byte _after_ the branch instruction. Branching further than that requires using a [JMP](#JMP) instruction, instead, and branching over that [JMP](#JMP) when negative is set with [BEQ](#BEQ).

Comparison uses this flag to indicate if the compared values are equal. All instructions that change A, X, or Y also implicitly set or clear the zero flag depending on whether the register becomes 0.

Addressing mode

Opcode

Bytes

Cycles

[Relative](/wiki/Addressing_modes#Relative "Addressing modes")

$D0

2

2 (3 if branch taken, 4 if page crossed)[\*](#footnote)

See also: [BEQ](#BEQ), [JMP](#JMP)

---

### BPL - Branch if Plus

`PC = PC + 2 + memory (signed)`

If the negative flag is clear, BPL branches to a nearby location by adding the branch offset to the program counter. The offset is signed and has a range of \[-128, 127\] relative to the first byte _after_ the branch instruction. Branching further than that requires using a [JMP](#JMP) instruction, instead, and branching over that [JMP](#JMP) when negative is set with [BMI](#BMI).

All instructions that change A, X, or Y implicitly set or clear the negative flag based on bit 7 (the sign bit).

Addressing mode

Opcode

Bytes

Cycles

[Relative](/wiki/Addressing_modes#Relative "Addressing modes")

$10

2

2 (3 if branch taken, 4 if page crossed)[\*](#footnote)

See also: [BMI](#BMI), [JMP](#JMP)

---

### BRK - Break (software IRQ)

`[push](#PHA) PC + 2 high byte to stack`  
`[push](#PHA) PC + 2 low byte to stack`  
`[push](#PHA) NV11DIZC flags to stack`  
`PC = ($FFFE)`

BRK triggers an interrupt request (IRQ). IRQs are normally triggered by external hardware, and BRK is the only way to do it in software. Like a typical IRQ, it pushes the current program counter and processor flags to the stack, sets the interrupt disable flag, and jumps to the IRQ handler. Unlike a typical IRQ, it sets the break flag in the flags byte that is pushed to the stack (like [PHP](#PHP)) and it triggers an interrupt even if the interrupt disable flag is set. Notably, the return address that is pushed to the stack skips the byte after the BRK opcode. For this reason, BRK is often considered a 2-byte instruction with an unused immediate.

Unfortunately, a 6502 bug allows the BRK IRQ to be overridden by an NMI occurring at the same time. In this case, only the NMI handler is called; the IRQ handler is skipped. However, the break flag is still set in the flags byte pushed to the stack, so the NMI handler can detect that this occurred (albeit slowly) by checking this flag.

Because BRK uses the value $00, any byte in a programmable ROM can be overwritten with a BRK instruction to send execution to an IRQ handler. This is useful for patching one-time programmable ROMs. BRK can also be used as a system call mechanism, and the unused byte can be used by software as an argument (although it is inconvenient to access). In the context of NES games, BRK is often most useful as a crash handler, where the unused program space is filled with $00 and the IRQ handler displays debugging information or otherwise handles the crash in a clean way.

Flag

New value

Notes

[I - Interrupt disable](/wiki/Status_flags#I "Status flags")

1

This is set to 1 after the old flags are pushed to the stack. The effect of changing this flag is _not_ delayed.

[B - Break](/wiki/Status_flags#B "Status flags")

Pushed as 1

This flag exists only in the flags byte pushed to the stack, not as real state in the CPU.

Addressing mode

Opcode

Bytes

Cycles

Notes

[Implied](/wiki/Addressing_modes#BRK "Addressing modes")

$00

1

7

Although BRK only uses 1 byte, its return address skips the following byte.

[#Immediate](/wiki/Addressing_modes#BRK "Addressing modes")

$00

2

7

Because BRK skips the following byte, it is often considered a 2-byte instruction.

See also: [RTI](#RTI), [PHP](#PHP)

---

### BVC - Branch if Overflow Clear

`PC = PC + 2 + memory (signed)`

If the overflow flag is clear, BVC branches to a nearby location by adding the branch offset to the program counter. The offset is signed and has a range of \[-128, 127\] relative to the first byte _after_ the branch instruction. Branching further than that requires using a [JMP](#JMP) instruction, instead, and branching over that [JMP](#JMP) when overflow is set with [BVS](#BVS).

Unlike zero, negative, and even carry, overflow is modified by very few instructions. It is most often used with the [BIT](#BIT) instruction, particularly for polling hardware registers. It is also sometimes used for signed overflow with [ADC](#ADC) and [SBC](#SBC). The standard 6502 chip allows an external device to set overflow using a pin, enabling software to poll for that event, but this is not present on the NES' 2A03.

Addressing mode

Opcode

Bytes

Cycles

[Relative](/wiki/Addressing_modes#Relative "Addressing modes")

$50

2

2 (3 if branch taken, 4 if page crossed)[\*](#footnote)

See also: [BVS](#BVS), [JMP](#JMP)

---

### BVS - Branch if Overflow Set

`PC = PC + 2 + memory (signed)`

If the overflow flag is set, BVS branches to a nearby location by adding the branch offset to the program counter. The offset is signed and has a range of \[-128, 127\] relative to the first byte _after_ the branch instruction. Branching further than that requires using a [JMP](#JMP) instruction, instead, and branching over that [JMP](#JMP) when overflow is clear with [BVC](#BVC).

Unlike zero, negative, and even carry, overflow is modified by very few instructions. It is most often used with the [BIT](#BIT) instruction, particularly for polling hardware registers. It is also sometimes used for signed overflow with [ADC](#ADC) and [SBC](#SBC). The standard 6502 chip allows an external device to set overflow using a pin, enabling software to poll for that event, but this is not present on the NES' 2A03 CPU.

Addressing mode

Opcode

Bytes

Cycles

[Relative](/wiki/Addressing_modes#Relative "Addressing modes")

$70

2

2 (3 if branch taken, 4 if page crossed)[\*](#footnote)

See also: [BVC](#BVC), [JMP](#JMP)

---

### CLC - Clear Carry

`C = 0`

CLC clears the carry flag. In particular, this is usually done before adding the low byte of a value with [ADC](#ADC) to avoid adding an extra 1.

Flag

New value

[C - Carry](/wiki/Status_flags#C "Status flags")

0

Addressing mode

Opcode

Bytes

Cycles

[Implied](/wiki/Addressing_modes#Implied "Addressing modes")

$18

1

2

See also: [SEC](#SEC)

---

### CLD - Clear Decimal

`D = 0`

CLD clears the decimal flag. The decimal flag normally controls whether binary-coded decimal mode (BCD) is enabled, but this mode is permanently disabled on the NES' 2A03 CPU. However, the flag itself still functions and can be used to store state.

Flag

New value

[D - Decimal](/wiki/Status_flags#D "Status flags")

0

Addressing mode

Opcode

Bytes

Cycles

[Implied](/wiki/Addressing_modes#Implied "Addressing modes")

$D8

1

2

See also: [SED](#SED)

---

### CLI - Clear Interrupt Disable

`I = 0`

CLI clears the interrupt disable flag, enabling the CPU to handle hardware IRQs. The effect of changing this flag is delayed one instruction because the flag is changed after IRQ is polled, allowing the next instruction to execute before any pending IRQ is detected and serviced. This flag has no effect on NMI, which (as the "non-maskable" name suggests) cannot be ignored by the CPU.

Flag

New value

Notes

[I - Interrupt disable](/wiki/Status_flags#I "Status flags")

0

The effect of changing this flag is delayed 1 instruction.

Addressing mode

Opcode

Bytes

Cycles

[Implied](/wiki/Addressing_modes#Implied "Addressing modes")

$58

1

2

See also: [SEI](#SEI)

---

### CLV - Clear Overflow

`V = 0`

CLV clears the overflow flag. There is no corresponding SEV instruction; instead, setting overflow is exposed on the 6502 CPU as a pin controlled by external hardware, and not exposed at all on the NES' 2A03 CPU.

Flag

New value

[V - Overflow](/wiki/Status_flags#V "Status flags")

0

Addressing mode

Opcode

Bytes

Cycles

[Implied](/wiki/Addressing_modes#Implied "Addressing modes")

$B8

1

2

---

### CMP - Compare A

`A - memory`

CMP compares A to a memory value, setting flags as appropriate but not modifying any registers. The comparison is implemented as a subtraction, setting carry if there is no borrow, zero if the result is 0, and negative if the result is negative. However, carry and zero are often most easily remembered as inequalities.

Note that comparison does _not_ affect overflow.

Flag

New value

[C - Carry](/wiki/Status_flags#C "Status flags")

A >= memory

[Z - Zero](/wiki/Status_flags#Z "Status flags")

A == memory

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[#Immediate](/wiki/Addressing_modes#Immediate "Addressing modes")

$C9

2

2

[Zero Page](/wiki/Addressing_modes#Zero_page_read "Addressing modes")

$C5

2

3

[Zero Page,X](/wiki/Addressing_modes#Zero_page_indexed_read "Addressing modes")

$D5

2

4

[Absolute](/wiki/Addressing_modes#Absolute_read "Addressing modes")

$CD

3

4

[Absolute,X](/wiki/Addressing_modes#Absolute_indexed_read "Addressing modes")

$DD

3

4 (5 if page crossed)

[Absolute,Y](/wiki/Addressing_modes#Absolute_indexed_read "Addressing modes")

$D9

3

4 (5 if page crossed)

[(Indirect,X)](/wiki/Addressing_modes#Indirect_x_read "Addressing modes")

$C1

2

6

[(Indirect),Y](/wiki/Addressing_modes#Indirect_y_read "Addressing modes")

$D1

2

5 (6 if page crossed)

See also: [CPX](#CPX), [CPY](#CPY)

---

### CPX - Compare X

`X - memory`

CPX compares X to a memory value, setting flags as appropriate but not modifying any registers. The comparison is implemented as a subtraction, setting carry if there is no borrow, zero if the result is 0, and negative if the result is negative. However, carry and zero are often most easily remembered as inequalities.

Note that comparison does _not_ affect overflow.

Flag

New value

[C - Carry](/wiki/Status_flags#C "Status flags")

X >= memory

[Z - Zero](/wiki/Status_flags#Z "Status flags")

X == memory

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[#Immediate](/wiki/Addressing_modes#Immediate "Addressing modes")

$E0

2

2

[Zero Page](/wiki/Addressing_modes#Zero_page_read "Addressing modes")

$E4

2

3

[Absolute](/wiki/Addressing_modes#Absolute_read "Addressing modes")

$EC

3

4

See also: [CMP](#CMP), [CPY](#CPY)

---

### CPY - Compare Y

`Y - memory`

CPY compares Y to a memory value, setting flags as appropriate but not modifying any registers. The comparison is implemented as a subtraction, setting carry if there is no borrow, zero if the result is 0, and negative if the result is negative. However, carry and zero are often most easily remembered as inequalities.

Note that comparison does _not_ affect overflow.

Flag

New value

[C - Carry](/wiki/Status_flags#C "Status flags")

Y >= memory

[Z - Zero](/wiki/Status_flags#Z "Status flags")

Y == memory

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[#Immediate](/wiki/Addressing_modes#Immediate "Addressing modes")

$C0

2

2

[Zero Page](/wiki/Addressing_modes#Zero_page_read "Addressing modes")

$C4

2

3

[Absolute](/wiki/Addressing_modes#Absolute_read "Addressing modes")

$CC

3

4

See also: [CMP](#CMP), [CPX](#CPX)

---

### DEC - Decrement Memory

`memory = memory - 1`

DEC subtracts 1 from a memory location. Notably, there is no version of this instruction for the accumulator; [ADC](#ADC) or [SBC](#SBC) must be used, instead.

This is a read-modify-write instruction, meaning that it first writes the original value back to memory before the modified value. This extra write can matter if targeting a hardware register.

Note that decrement does _not_ affect carry nor overflow.

Flag

New value

[Z - Zero](/wiki/Status_flags#Z "Status flags")

result == 0

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[Zero Page](/wiki/Addressing_modes#Zero_page_rmw "Addressing modes")

$C6

2

5

[Zero Page,X](/wiki/Addressing_modes#Zero_page_indexed_rmw "Addressing modes")

$D6

2

6

[Absolute](/wiki/Addressing_modes#Absolute_rmw "Addressing modes")

$CE

3

6

[Absolute,X](/wiki/Addressing_modes#Absolute_indexed_rmw "Addressing modes")

$DE

3

7

See also: [INC](#INC), [ADC](#ADC), [SBC](#SBC)

---

### DEX - Decrement X

`X = X - 1`

DEX subtracts 1 from the X register. Note that it does _not_ affect carry nor overflow.

Flag

New value

[Z - Zero](/wiki/Status_flags#Z "Status flags")

result == 0

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[Implied](/wiki/Addressing_modes#Implied "Addressing modes")

$CA

1

2

See also: [INX](#INX)

---

### DEY - Decrement Y

`Y = Y - 1`

DEY subtracts 1 from the Y register. Note that it does _not_ affect carry nor overflow.

Flag

New value

[Z - Zero](/wiki/Status_flags#Z "Status flags")

result == 0

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[Implied](/wiki/Addressing_modes#Implied "Addressing modes")

$88

1

2

See also: [INY](#INY)

---

### EOR - Bitwise Exclusive OR

`A = A ^ memory`

EOR exclusive-ORs a memory value and the accumulator, bit by bit. If the input bits are different, the resulting bit is 1. If they are the same, it is 0. This operation is also known as XOR.

6502 doesn't have a bitwise NOT instruction, but using EOR with value $FF has the same behavior, inverting every bit of the other value. In fact, EOR can be thought of as NOT with a bitmask; all of the 1 bits in one value have the effect of inverting the corresponding bit in the other value, while 0 bits do nothing.

EOR truth table Expand

A

memory

result

0

0

0

0

1

1

1

0

1

1

1

0

Flag

New value

[Z - Zero](/wiki/Status_flags#Z "Status flags")

result == 0

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[#Immediate](/wiki/Addressing_modes#Immediate "Addressing modes")

$49

2

2

[Zero Page](/wiki/Addressing_modes#Zero_page_read "Addressing modes")

$45

2

3

[Zero Page,X](/wiki/Addressing_modes#Zero_page_indexed_read "Addressing modes")

$55

2

4

[Absolute](/wiki/Addressing_modes#Absolute_read "Addressing modes")

$4D

3

4

[Absolute,X](/wiki/Addressing_modes#Absolute_indexed_read "Addressing modes")

$5D

3

4 (5 if page crossed)

[Absolute,Y](/wiki/Addressing_modes#Absolute_indexed_read "Addressing modes")

$59

3

4 (5 if page crossed)

[(Indirect,X)](/wiki/Addressing_modes#Indirect_x_read "Addressing modes")

$41

2

6

[(Indirect),Y](/wiki/Addressing_modes#Indirect_y_read "Addressing modes")

$51

2

5 (6 if page crossed)

See also: [AND](#AND), [ORA](#ORA)

---

### INC - Increment Memory

`memory = memory + 1`

INC adds 1 to a memory location. Notably, there is no version of this instruction for the accumulator; [ADC](#ADC) or [SBC](#SBC) must be used, instead.

This is a read-modify-write instruction, meaning that it first writes the original value back to memory before the modified value. This extra write can matter if targeting a hardware register.

Note that increment does _not_ affect carry nor overflow.

Flag

New value

[Z - Zero](/wiki/Status_flags#Z "Status flags")

result == 0

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[Zero Page](/wiki/Addressing_modes#Zero_page_rmw "Addressing modes")

$E6

2

5

[Zero Page,X](/wiki/Addressing_modes#Zero_page_indexed_rmw "Addressing modes")

$F6

2

6

[Absolute](/wiki/Addressing_modes#Absolute_rmw "Addressing modes")

$EE

3

6

[Absolute,X](/wiki/Addressing_modes#Absolute_indexed_rmw "Addressing modes")

$FE

3

7

See also: [DEC](#DEC), [ADC](#ADC), [SBC](#SBC)

---

### INX - Increment X

`X = X + 1`

INX adds 1 to the X register. Note that it does _not_ affect carry nor overflow.

Flag

New value

[Z - Zero](/wiki/Status_flags#Z "Status flags")

result == 0

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[Implied](/wiki/Addressing_modes#Implied "Addressing modes")

$E8

1

2

See also: [DEX](#DEX)

---

### INY - Increment Y

`Y = Y + 1`

INY adds 1 to the Y register. Note that it does _not_ affect carry nor overflow.

Flag

New value

[Z - Zero](/wiki/Status_flags#Z "Status flags")

result == 0

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[Implied](/wiki/Addressing_modes#Implied "Addressing modes")

$C8

1

2

See also: [DEY](#DEY)

---

### JMP - Jump

`PC = memory`

JMP sets the program counter to a new value, allowing code to execute from a new location. If you wish to be able to return from that location, [JSR](#JSR) should normally be used, instead.

The indirect addressing mode uses the operand as a pointer, getting the new 2-byte program counter value from the specified address. Unfortunately, because of a CPU bug, if this 2-byte variable has an address ending in $FF and thus crosses a page, then the CPU fails to increment the page when reading the second byte and thus reads the wrong address. For example, JMP ($03FF) reads $03FF and _$0300_ instead of $0400. Care should be taken to ensure this variable does not cross a page.

Addressing mode

Opcode

Bytes

Cycles

[Absolute](/wiki/Addressing_modes#Absolute "Addressing modes")

$4C

3

3

[(Indirect)](/wiki/Addressing_modes#Indirect "Addressing modes")

$6C

3

5

See also: [JSR](#JSR)

---

### JSR - Jump to Subroutine

`[push](#PHA) PC + 2 high byte to stack`  
`[push](#PHA) PC + 2 low byte to stack`  
`PC = memory`

JSR pushes the current program counter to the stack and then sets the program counter to a new value. This allows code to call a function and return with [RTS](#RTS) back to the instruction after the JSR.

Notably, the return address on the stack points 1 byte before the start of the next instruction, rather than directly at the instruction. This is because [RTS](#RTS) increments the program counter before the next instruction is fetched. This differs from the return address pushed by interrupts and used by [RTI](#RTI), which points directly at the next instruction.

Addressing mode

Opcode

Bytes

Cycles

[Absolute](/wiki/Addressing_modes#Absolute "Addressing modes")

$20

3

6

See also: [RTS](#RTS), [JMP](#JMP), [RTI](#RTI)

---

### LDA - Load A

`A = memory`

LDA loads a memory value into the accumulator.

Flag

New value

[Z - Zero](/wiki/Status_flags#Z "Status flags")

result == 0

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[#Immediate](/wiki/Addressing_modes#Immediate "Addressing modes")

$A9

2

2

[Zero Page](/wiki/Addressing_modes#Zero_page_read "Addressing modes")

$A5

2

3

[Zero Page,X](/wiki/Addressing_modes#Zero_page_indexed_read "Addressing modes")

$B5

2

4

[Absolute](/wiki/Addressing_modes#Absolute_read "Addressing modes")

$AD

3

4

[Absolute,X](/wiki/Addressing_modes#Absolute_indexed_read "Addressing modes")

$BD

3

4 (5 if page crossed)

[Absolute,Y](/wiki/Addressing_modes#Absolute_indexed_read "Addressing modes")

$B9

3

4 (5 if page crossed)

[(Indirect,X)](/wiki/Addressing_modes#Indirect_x_read "Addressing modes")

$A1

2

6

[(Indirect),Y](/wiki/Addressing_modes#Indirect_y_read "Addressing modes")

$B1

2

5 (6 if page crossed)

See also: [STA](#STA)

---

### LDX - Load X

`X = memory`

LDX loads a memory value into the X register.

Flag

New value

[Z - Zero](/wiki/Status_flags#Z "Status flags")

result == 0

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[#Immediate](/wiki/Addressing_modes#Immediate "Addressing modes")

$A2

2

2

[Zero Page](/wiki/Addressing_modes#Zero_page_read "Addressing modes")

$A6

2

3

[Zero Page,Y](/wiki/Addressing_modes#Zero_page_indexed_read "Addressing modes")

$B6

2

4

[Absolute](/wiki/Addressing_modes#Absolute_read "Addressing modes")

$AE

3

4

[Absolute,Y](/wiki/Addressing_modes#Absolute_indexed_read "Addressing modes")

$BE

3

4 (5 if page crossed)

See also: [STX](#STX)

---

### LDY - Load Y

`Y = memory`

LDY loads a memory value into the Y register.

Flag

New value

[Z - Zero](/wiki/Status_flags#Z "Status flags")

result == 0

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[#Immediate](/wiki/Addressing_modes#Immediate "Addressing modes")

$A0

2

2

[Zero Page](/wiki/Addressing_modes#Zero_page_read "Addressing modes")

$A4

2

3

[Zero Page,X](/wiki/Addressing_modes#Zero_page_indexed_read "Addressing modes")

$B4

2

4

[Absolute](/wiki/Addressing_modes#Absolute_read "Addressing modes")

$AC

3

4

[Absolute,X](/wiki/Addressing_modes#Absolute_indexed_read "Addressing modes")

$BC

3

4 (5 if page crossed)

See also: [STY](#STY)

---

### LSR - Logical Shift Right

`value = value >> 1`, or visually: `0 -> [76543210] -> C`

LSR shifts all of the bits of a memory value or the accumulator one position to the right, moving the value of each bit into the next bit. 0 is shifted into bit 7, and bit 0 is shifted into the carry flag. This is equivalent to dividing an unsigned value by 2 and rounding down, with the remainder in carry.

This is a read-modify-write instruction, meaning that its addressing modes that operate on memory first write the original value back to memory before the modified value. This extra write can matter if targeting a hardware register.

Flag

New value

[C - Carry](/wiki/Status_flags#C "Status flags")

value bit 0

[Z - Zero](/wiki/Status_flags#Z "Status flags")

result == 0

[N - Negative](/wiki/Status_flags#N "Status flags")

0

Addressing mode

Opcode

Bytes

Cycles

[Accumulator](/wiki/Addressing_modes#Accumulator "Addressing modes")

$4A

1

2

[Zero Page](/wiki/Addressing_modes#Zero_page_rmw "Addressing modes")

$46

2

5

[Zero Page,X](/wiki/Addressing_modes#Zero_page_indexed_rmw "Addressing modes")

$56

2

6

[Absolute](/wiki/Addressing_modes#Absolute_rmw "Addressing modes")

$4E

3

6

[Absolute,X](/wiki/Addressing_modes#Absolute_indexed_rmw "Addressing modes")

$5E

3

7

See also: [ASL](#ASL), [ROL](#ROL), [ROR](#ROR)

---

### NOP - No Operation

NOP has no effect; it merely wastes space and CPU cycles. This instruction can be useful when writing timed code to delay for a desired amount of time, as padding to ensure something does or does not cross a page, or to disable code in a binary.

Addressing mode

Opcode

Bytes

Cycles

[Implied](/wiki/Addressing_modes#Implied "Addressing modes")

$EA

1

2

---

### ORA - Bitwise OR

`A = A | memory`

ORA inclusive-ORs a memory value and the accumulator, bit by bit. If either input bit is 1, the resulting bit is 1. Otherwise, it is 0.

OR truth table Expand

A

memory

result

0

0

0

0

1

1

1

0

1

1

1

1

Flag

New value

[Z - Zero](/wiki/Status_flags#Z "Status flags")

result == 0

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[#Immediate](/wiki/Addressing_modes#Immediate "Addressing modes")

$09

2

2

[Zero Page](/wiki/Addressing_modes#Zero_page_read "Addressing modes")

$05

2

3

[Zero Page,X](/wiki/Addressing_modes#Zero_page_indexed_read "Addressing modes")

$15

2

4

[Absolute](/wiki/Addressing_modes#Absolute_read "Addressing modes")

$0D

3

4

[Absolute,X](/wiki/Addressing_modes#Absolute_indexed_read "Addressing modes")

$1D

3

4 (5 if page crossed)

[Absolute,Y](/wiki/Addressing_modes#Absolute_indexed_read "Addressing modes")

$19

3

4 (5 if page crossed)

[(Indirect,X)](/wiki/Addressing_modes#Indirect_x_read "Addressing modes")

$01

2

6

[(Indirect),Y](/wiki/Addressing_modes#Indirect_y_read "Addressing modes")

$11

2

5 (6 if page crossed)

See also: [AND](#AND), [EOR](#EOR)

---

### PHA - Push A

`($0100 + SP) = A`  
`SP = SP - 1`

PHA stores the value of A to the current stack position and then decrements the stack pointer.

Addressing mode

Opcode

Bytes

Cycles

[Implied](/wiki/Addressing_modes#Implied "Addressing modes")

$48

1

3

See also: [PLA](#PLA)

---

### PHP - Push Processor Status

`($0100 + SP) = NV11DIZC`  
`SP = SP - 1`

PHP stores a byte to the stack containing the 6 status flags and B flag and then decrements the stack pointer. The B flag and extra bit are both pushed as 1. The bit order is NV1BDIZC (high to low).

Flag

New value

Notes

[B - Break](/wiki/Status_flags#B "Status flags")

Pushed as 1

This flag exists only in the flags byte pushed to the stack, not as real state in the CPU.

Addressing mode

Opcode

Bytes

Cycles

[Implied](/wiki/Addressing_modes#Implied "Addressing modes")

$08

1

3

See also: [PLP](#PLP)

---

### PLA - Pull A

`SP = SP + 1`  
`A = ($0100 + SP)`

PLA increments the stack pointer and then loads the value at that stack position into A.

Flag

New value

[Z - Zero](/wiki/Status_flags#Z "Status flags")

result == 0

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[Implied](/wiki/Addressing_modes#Implied "Addressing modes")

$68

1

4

See also: [PHA](#PHA)

---

### PLP - Pull Processor Status

`SP = SP + 1`  
`NVxxDIZC = ($0100 + SP)`

PLP increments the stack pointer and then loads the value at that stack position into the 6 status flags. The bit order is NVxxDIZC (high to low). The B flag and extra bit are ignored. Note that the effect of changing I is delayed one instruction because the flag is changed after IRQ is polled, delaying the effect until IRQ is polled in the next instruction like with [CLI](#CLI) and [SEI](#SEI).

Flag

New value

Notes

[C - Carry](/wiki/Status_flags#C "Status flags")

result bit 0

[Z - Zero](/wiki/Status_flags#Z "Status flags")

result bit 1

[I - Interrupt disable](/wiki/Status_flags#I "Status flags")

result bit 2

The effect of changing this flag is delayed 1 instruction.

[D - Decimal](/wiki/Status_flags#D "Status flags")

result bit 3

[V - Overflow](/wiki/Status_flags#V "Status flags")

result bit 6

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[Implied](/wiki/Addressing_modes#Implied "Addressing modes")

$28

1

4

See also: [PHP](#PHP)

---

### ROL - Rotate Left

`value = value << 1 through C`, or visually: `C <- [76543210] <- C`

ROL shifts a memory value or the accumulator to the left, moving the value of each bit into the next bit and treating the carry flag as though it is both above bit 7 and below bit 0. Specifically, the value in carry is shifted into bit 0, and bit 7 is shifted into carry. Rotating left 9 times simply returns the value and carry back to their original state.

This is a read-modify-write instruction, meaning that its addressing modes that operate on memory first write the original value back to memory before the modified value. This extra write can matter if targeting a hardware register.

Flag

New value

[C - Carry](/wiki/Status_flags#C "Status flags")

value bit 7

[Z - Zero](/wiki/Status_flags#Z "Status flags")

result == 0

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[Accumulator](/wiki/Addressing_modes#Accumulator "Addressing modes")

$2A

1

2

[Zero Page](/wiki/Addressing_modes#Zero_page_rmw "Addressing modes")

$26

2

5

[Zero Page,X](/wiki/Addressing_modes#Zero_page_indexed_rmw "Addressing modes")

$36

2

6

[Absolute](/wiki/Addressing_modes#Absolute_rmw "Addressing modes")

$2E

3

6

[Absolute,X](/wiki/Addressing_modes#Absolute_indexed_rmw "Addressing modes")

$3E

3

7

See also: [ROR](#ROR), [ASL](#ASL), [LSR](#LSR)

---

### ROR - Rotate Right

`value = value >> 1 through C`, or visually: `C -> [76543210] -> C`

ROR shifts a memory value or the accumulator to the right, moving the value of each bit into the next bit and treating the carry flag as though it is both above bit 7 and below bit 0. Specifically, the value in carry is shifted into bit 7, and bit 0 is shifted into carry. Rotating right 9 times simply returns the value and carry back to their original state.

This is a read-modify-write instruction, meaning that its addressing modes that operate on memory first write the original value back to memory before the modified value. This extra write can matter if targeting a hardware register.

Flag

New value

[C - Carry](/wiki/Status_flags#C "Status flags")

value bit 0

[Z - Zero](/wiki/Status_flags#Z "Status flags")

result == 0

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[Accumulator](/wiki/Addressing_modes#Accumulator "Addressing modes")

$6A

1

2

[Zero Page](/wiki/Addressing_modes#Zero_page_rmw "Addressing modes")

$66

2

5

[Zero Page,X](/wiki/Addressing_modes#Zero_page_indexed_rmw "Addressing modes")

$76

2

6

[Absolute](/wiki/Addressing_modes#Absolute_rmw "Addressing modes")

$6E

3

6

[Absolute,X](/wiki/Addressing_modes#Absolute_indexed_rmw "Addressing modes")

$7E

3

7

See also: [ROL](#ROL), [ASL](#ASL), [LSR](#LSR)

---

### RTI - Return from Interrupt

`[pull](#PLA) NVxxDIZC flags from stack`  
`[pull](#PLA) PC low byte from stack`  
`[pull](#PLA) PC high byte from stack`

RTI returns from an interrupt handler, first pulling the 6 status flags from the stack and then pulling the new program counter. The flag pulling behaves like [PLP](#PLP) except that changes to the interrupt disable flag apply immediately instead of being delayed 1 instruction. This is because the flags change before IRQs are polled for the instruction, not after. The PC pulling behaves like [RTS](#RTS) except that the return address is the exact address of the next instruction instead of 1 byte before it.

Flag

New value

Notes

[C - Carry](/wiki/Status_flags#C "Status flags")

pulled flags bit 0

[Z - Zero](/wiki/Status_flags#Z "Status flags")

pulled flags bit 1

[I - Interrupt disable](/wiki/Status_flags#I "Status flags")

pulled flags bit 2

The effect of changing this flag is _not_ delayed.

[D - Decimal](/wiki/Status_flags#D "Status flags")

pulled flags bit 3

[V - Overflow](/wiki/Status_flags#V "Status flags")

pulled flags bit 6

[N - Negative](/wiki/Status_flags#N "Status flags")

pulled flags bit 7

Addressing mode

Opcode

Bytes

Cycles

[Implied](/wiki/Addressing_modes#Implied "Addressing modes")

$40

1

6

See also: [BRK](#BRK), [PLP](#PLP), [RTS](#RTS)

---

### RTS - Return from Subroutine

`[pull](#PLA) PC low byte from stack`  
`[pull](#PLA) PC high byte from stack`  
`PC = PC + 1`

RTS pulls an address from the stack into the program counter and then increments the program counter. It is normally used at the end of a function to return to the instruction after the [JSR](#JSR) that called the function. However, RTS is also sometimes used to implement jump tables (see [Jump table](/wiki/Jump_table "Jump table") and [RTS Trick](/wiki/RTS_Trick "RTS Trick")).

Addressing mode

Opcode

Bytes

Cycles

[Implied](/wiki/Addressing_modes#Implied "Addressing modes")

$60

1

6

See also: [JSR](#JSR), [PLA](#PLA)

---

### SBC - Subtract with Carry

`A = A - memory - ~C`, or equivalently: `A = A + ~memory + C`

SBC subtracts a memory value and the NOT of the carry flag from the accumulator. It does this by _adding_ the bitwise NOT of the memory value using [ADC](#ADC). This implementation detail explains the backward nature of carry; SBC subtracts 1 more when carry is _clear_, not when it's set, and carry is cleared when it underflows and set otherwise. As with [ADC](#ADC), carry allows the borrow from one subtraction to be carried into the next subtraction, allowing subtraction of values larger than 1 byte. It is common to set carry with [SEC](#SEC) before subtracting the first byte to ensure it is in a known state, avoiding an off-by-one error.

Overflow works the same as with [ADC](#ADC), except with an inverted memory value. Therefore, overflow or underflow occur if the result's sign is different from A's and the same as the memory value's.

Flag

New value

Notes

[C - Carry](/wiki/Status_flags#C "Status flags")

~(result < $00)

If the result underflowed below $00 (wrapping around), unsigned underflow occurred.

[Z - Zero](/wiki/Status_flags#Z "Status flags")

result == 0

[V - Overflow](/wiki/Status_flags#V "Status flags")

(result ^ A) & (result ^ ~memory) & $80

If result's sign is different from A's and the same as memory's, signed overflow (or underflow) occurred.

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[#Immediate](/wiki/Addressing_modes#Immediate "Addressing modes")

$E9

2

2

[Zero Page](/wiki/Addressing_modes#Zero_page_read "Addressing modes")

$E5

2

3

[Zero Page,X](/wiki/Addressing_modes#Zero_page_indexed_read "Addressing modes")

$F5

2

4

[Absolute](/wiki/Addressing_modes#Absolute_read "Addressing modes")

$ED

3

4

[Absolute,X](/wiki/Addressing_modes#Absolute_indexed_read "Addressing modes")

$FD

3

4 (5 if page crossed)

[Absolute,Y](/wiki/Addressing_modes#Absolute_indexed_read "Addressing modes")

$F9

3

4 (5 if page crossed)

[(Indirect,X)](/wiki/Addressing_modes#Indirect_x_read "Addressing modes")

$E1

2

6

[(Indirect),Y](/wiki/Addressing_modes#Indirect_y_read "Addressing modes")

$F1

2

5 (6 if page crossed)

See also: [ADC](#ADC), [SEC](#SEC)

---

### SEC - Set Carry

`C = 1`

SEC sets the carry flag. In particular, this is usually done before subtracting the low byte of a value with [SBC](#SBC) to avoid subtracting an extra 1.

Flag

New value

[C - Carry](/wiki/Status_flags#C "Status flags")

1

Addressing mode

Opcode

Bytes

Cycles

[Implied](/wiki/Addressing_modes#Implied "Addressing modes")

$38

1

2

See also: [CLC](#CLC)

---

### SED - Set Decimal

`D = 1`

SED sets the decimal flag. The decimal flag normally controls whether binary-coded decimal mode (BCD) is enabled, but this mode is permanently disabled on the NES' 2A03 CPU. However, the flag itself still functions and can be used to store state.

Flag

New value

[D - Decimal](/wiki/Status_flags#D "Status flags")

1

Addressing mode

Opcode

Bytes

Cycles

[Implied](/wiki/Addressing_modes#Implied "Addressing modes")

$F8

1

2

See also: [CLD](#CLD)

---

### SEI - Set Interrupt Disable

`I = 1`

SEI sets the interrupt disable flag, preventing the CPU from handling hardware IRQs. The effect of changing this flag is delayed one instruction because the flag is changed after IRQ is polled, allowing an IRQ to be serviced between this and the next instruction if the flag was previously 0.

Flag

New value

Notes

[I - Interrupt disable](/wiki/Status_flags#I "Status flags")

1

The effect of changing this flag is delayed 1 instruction.

Addressing mode

Opcode

Bytes

Cycles

[Implied](/wiki/Addressing_modes#Implied "Addressing modes")

$78

1

2

See also: [CLI](#CLI)

---

### STA - Store A

`memory = A`

STA stores the accumulator value into memory.

Addressing mode

Opcode

Bytes

Cycles

[Zero Page](/wiki/Addressing_modes#Zero_page_write "Addressing modes")

$85

2

3

[Zero Page,X](/wiki/Addressing_modes#Zero_page_indexed_write "Addressing modes")

$95

2

4

[Absolute](/wiki/Addressing_modes#Absolute_write "Addressing modes")

$8D

3

4

[Absolute,X](/wiki/Addressing_modes#Absolute_indexed_write "Addressing modes")

$9D

3

5

[Absolute,Y](/wiki/Addressing_modes#Absolute_indexed_write "Addressing modes")

$99

3

5

[(Indirect,X)](/wiki/Addressing_modes#Indirect_x_write "Addressing modes")

$81

2

6

[(Indirect),Y](/wiki/Addressing_modes#Indirect_y_write "Addressing modes")

$91

2

6

See also: [LDA](#LDA)

---

### STX - Store X

`memory = X`

STX stores the X register value into memory.

Addressing mode

Opcode

Bytes

Cycles

[Zero Page](/wiki/Addressing_modes#Zero_page_write "Addressing modes")

$86

2

3

[Zero Page,Y](/wiki/Addressing_modes#Zero_page_indexed_write "Addressing modes")

$96

2

4

[Absolute](/wiki/Addressing_modes#Absolute_write "Addressing modes")

$8E

3

4

See also: [LDX](#LDX)

---

### STY - Store Y

`memory = Y`

STY stores the Y register value into memory.

Addressing mode

Opcode

Bytes

Cycles

[Zero Page](/wiki/Addressing_modes#Zero_page_write "Addressing modes")

$84

2

3

[Zero Page,X](/wiki/Addressing_modes#Zero_page_indexed_write "Addressing modes")

$94

2

4

[Absolute](/wiki/Addressing_modes#Absolute_write "Addressing modes")

$8C

3

4

See also: [LDY](#LDY)

---

### TAX - Transfer A to X

`X = A`

TAX copies the accumulator value to the X register.

Flag

New value

[Z - Zero](/wiki/Status_flags#Z "Status flags")

result == 0

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[Implied](/wiki/Addressing_modes#Implied "Addressing modes")

$AA

1

2

See also: [TXA](#TXA), [TAY](#TAY), [TYA](#TYA)

---

### TAY - Transfer A to Y

`Y = A`

TAY copies the accumulator value to the Y register.

Flag

New value

[Z - Zero](/wiki/Status_flags#Z "Status flags")

result == 0

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[Implied](/wiki/Addressing_modes#Implied "Addressing modes")

$A8

1

2

See also: [TYA](#TYA), [TAX](#TAX), [TXA](#TXA)

---

### TSX - Transfer Stack Pointer to X

`X = SP`

TSX copies the stack pointer value to the X register.

Flag

New value

[Z - Zero](/wiki/Status_flags#Z "Status flags")

result == 0

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[Implied](/wiki/Addressing_modes#Implied "Addressing modes")

$BA

1

2

See also: [TXS](#TXS)

---

### TXA - Transfer X to A

`A = X`

TXA copies the X register value to the accumulator.

Flag

New value

[Z - Zero](/wiki/Status_flags#Z "Status flags")

result == 0

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[Implied](/wiki/Addressing_modes#Implied "Addressing modes")

$8A

1

2

See also: [TAX](#TAX), [TAY](#TAY), [TYA](#TYA)

---

### TXS - Transfer X to Stack Pointer

`SP = X`

TXS copies the X register value to the stack pointer.

Addressing mode

Opcode

Bytes

Cycles

[Implied](/wiki/Addressing_modes#Implied "Addressing modes")

$9A

1

2

See also: [TSX](#TSX)

---

### TYA - Transfer Y to A

`A = Y`

TYA copies the Y register value to the accumulator.

Flag

New value

[Z - Zero](/wiki/Status_flags#Z "Status flags")

result == 0

[N - Negative](/wiki/Status_flags#N "Status flags")

result bit 7

Addressing mode

Opcode

Bytes

Cycles

[Implied](/wiki/Addressing_modes#Implied "Addressing modes")

$98

1

2

See also: [TAY](#TAY), [TAX](#TAX), [TXA](#TXA)

---

### Note

For Relative addressing, the document [https://www.nesdev.org/6502\_cpu.txt](https://www.nesdev.org/6502_cpu.txt) seems to represent branch instructions as having 5 possible cycles, however 2-4 cycles as noted on this page is correct.

       1     PC      R  fetch opcode, increment PC
       2     PC      R  fetch operand, increment PC
       3     PC      R  Fetch opcode of next instruction,
                        If branch is taken, add operand to PCL.
                        Otherwise increment PC.
       4+    PC\*     R  Fetch opcode of next instruction.
                        Fix PCH. If it did not change, increment PC.
       5!    PC      R  Fetch opcode of next instruction,
                        increment PC.

These notes help clarify the way the cycles are represented in the document:

-   If the branch is not taken, cycle 3 shown here is actually cycle 1 of the next instruction (the branch instruction ending after 2 cycles).
-   If the branch is taken and does not cross a page boundary, cycle 4 shown here is cycle 1 of the next instruction (the branch instruction ending after 3 cycles).
-   If a page boundary is crossed, cycle 5 shown here is cycle 1 of the next instruction (the branch instruction ending after 4 cycles).

Retrieved from "[https://www.nesdev.org/w/index.php?title=Instruction\_reference&oldid=23166](https://www.nesdev.org/w/index.php?title=Instruction_reference&oldid=23166)"