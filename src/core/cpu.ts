import { calculate, clearFlags } from './alu.js';
import { decode } from './codec.js';
import { isUnsigned, MachineError } from './errors.js';
import type { CpuFault } from './errors.js';
import { validateImage } from './image.js';
import { MACHINE } from './isa.js';
import type { DecodedInstruction } from './isa.js';
import type { CpuSnapshot, CpuStatus, Flags, ProgramImage, StepResult, WriteEvent } from './types.js';

export class Cpu {
  #registers = new Uint16Array(MACHINE.registerCount);
  #code = new Uint32Array(MACHINE.codeSize);
  #data = new Uint16Array(MACHINE.dataSize);
  #pc = 0;
  #ir = 0;
  #instructionAddress: number | null = null;
  #decoded: DecodedInstruction | null = null;
  #flags: Flags = clearFlags();
  #status: CpuStatus = 'ready';
  #steps = 0;
  #loadedInstructions = 0;
  #fault: CpuFault | null = null;
  #initialImage: ProgramImage | null = null;

  constructor(image?: ProgramImage) {
    if (image !== undefined) this.load(image);
  }

  load(image: unknown): CpuSnapshot {
    // До этой проверки не меняется ни машина, ни сохранённый образ сброса.
    const validated = validateImage(image);
    this.#initialImage = validated;
    return this.reset();
  }

  reset(): CpuSnapshot {
    this.#registers.fill(0);
    this.#code.fill(0);
    this.#data.fill(0);
    this.#pc = this.#initialImage?.entryPoint ?? 0;
    this.#ir = 0;
    this.#instructionAddress = null;
    this.#decoded = null;
    this.#flags = clearFlags();
    this.#status = 'ready';
    this.#steps = 0;
    this.#fault = null;
    this.#loadedInstructions = this.#initialImage?.instructions.length ?? 0;
    if (this.#initialImage !== null) {
      this.#code.set(this.#initialImage.instructions);
      for (const { address, value } of this.#initialImage.data) this.#data[address] = value;
    }
    return this.snapshot();
  }

  snapshot(): CpuSnapshot {
    return {
      registers: Array.from(this.#registers),
      pc: this.#pc,
      ir: this.#ir,
      instructionAddress: this.#instructionAddress,
      decoded: this.#decoded === null ? null : {
        ...this.#decoded,
        fields: { ...this.#decoded.fields },
        instruction: { ...this.#decoded.instruction },
      },
      flags: { ...this.#flags },
      status: this.#status,
      steps: this.#steps,
      loadedInstructions: this.#loadedInstructions,
      fault: this.#fault === null ? null : { ...this.#fault },
    };
  }

  readData(address: number): number {
    this.#checkDataAddress(address);
    return this.#data[address]!;
  }

  readInstruction(address: number): number {
    if (!isUnsigned(address, MACHINE.codeSize - 1)) {
      throw new MachineError('FETCH_OUT_OF_BOUNDS', `Адрес команд ${address} вне диапазона 0…1023.`);
    }
    return this.#code[address]!;
  }

  /** Копии для просмотра ОЗУ: они не позволяют менять память машины. */
  memory(): { instructions: Uint32Array; data: Uint16Array } {
    return { instructions: this.#code.slice(), data: this.#data.slice() };
  }

  step(): StepResult {
    const writes: WriteEvent[] = [];
    if (this.#status !== 'ready') return { executed: false, state: this.snapshot(), writes };
    let fetched = false;
    try {
      if (!isUnsigned(this.#pc, MACHINE.codeSize - 1) || this.#pc >= this.#loadedInstructions) {
        throw new MachineError('FETCH_OUT_OF_BOUNDS', `По адресу команд ${this.#pc} нет загруженной инструкции.`);
      }
      this.#ir = this.#code[this.#pc]!;
      this.#instructionAddress = this.#pc;
      this.#decoded = null;
      fetched = true;
      this.#decoded = decode(this.#ir);
      const i = this.#decoded.instruction;
      let nextPc = this.#pc + 1;
      let nextFlags = this.#flags;
      let nextStatus: CpuStatus = 'ready';
      let pendingWrite: { kind: 'register' | 'data'; address: number; value: number } | null = null;
      const read = (register: number) => this.#registers[register]!;
      switch (i.op) {
        case 'HALT': nextStatus = 'halted'; break;
        case 'MOV':
          pendingWrite = { kind: 'register', address: i.d, value: i.mode === 'immediate' ? i.value : read(i.value) };
          break;
        case 'LD':
        case 'ST': {
          const address = i.mode === 'direct' ? i.value : read(i.value);
          this.#checkDataAddress(address);
          pendingWrite = i.op === 'LD'
            ? { kind: 'register', address: i.d, value: this.#data[address]! }
            : { kind: 'data', address, value: read(i.d) };
          break;
        }
        case 'JMP': nextPc = i.target; break;
        case 'JZ': if (this.#flags.zf) nextPc = i.target; break;
        case 'JNZ': if (!this.#flags.zf) nextPc = i.target; break;
        default: {
          const result = calculate(i.op, read(i.a), i.op === 'SAR' ? i.shift : read(i.b), this.#flags);
          nextFlags = result.flags;
          if (i.op !== 'CMP') pendingWrite = { kind: 'register', address: i.d, value: result.value };
        }
      }
      // Все потенциальные ошибки проверены; применять эффекты можно целиком.
      if (pendingWrite !== null) {
        const { kind, address, value } = pendingWrite;
        const target = kind === 'register' ? this.#registers : this.#data;
        const before = target[address]!;
        target[address] = value;
        if (before !== value) writes.push({ kind, address, before, after: value });
      }
      this.#flags = nextFlags;
      this.#pc = nextPc;
      this.#status = nextStatus;
      this.#steps += 1;
      return { executed: true, state: this.snapshot(), writes };
    } catch (error) {
      if (!(error instanceof MachineError)) throw error;
      this.#status = 'faulted';
      this.#fault = {
        code: error.code,
        message: error.message,
        address: this.#pc,
        ...(fetched ? { word: this.#ir } : {}),
      };
      return { executed: false, state: this.snapshot(), writes };
    }
  }

  #checkDataAddress(address: number): void {
    if (!isUnsigned(address, MACHINE.dataSize - 1)) {
      throw new MachineError('DATA_OUT_OF_BOUNDS', `Адрес данных ${address} вне диапазона 0…4095.`);
    }
  }
}
