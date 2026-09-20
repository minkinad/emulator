import { assemble, AssemblyError } from '../../assembler/index.js';
import type { AssemblyResult } from '../../assembler/index.js';
import { Cpu, MACHINE } from '../../core/index.js';
import type { CpuSnapshot, WriteEvent } from '../../core/index.js';
import { DataInputError, parseInitialData } from './data.js';

export type Schedule = (callback: () => void, delay: number) => () => void;
export type Speed = 'slow' | 'normal' | 'fast';
export interface Notice {
  readonly kind: 'info' | 'success' | 'error';
  readonly text: string;
  readonly target?: 'source' | 'data';
  readonly line?: number;
  readonly column?: number;
}
export interface SessionSnapshot {
  readonly source: string;
  readonly dataText: string;
  readonly assembly: AssemblyResult | null;
  readonly cpu: CpuSnapshot;
  readonly memory: ReturnType<Cpu['memory']>;
  readonly running: boolean;
  readonly dirty: boolean;
  readonly notice: Notice | null;
  readonly changedRegisters: readonly number[];
  readonly changedData: readonly number[];
  readonly runSteps: number;
}

/** Оболочка над CPU. Планировщик внедряется, поэтому модель не зависит от DOM. */
export class EmulatorSession {
  #cpu = new Cpu();
  #listeners = new Set<() => void>();
  #source: string;
  #dataText: string;
  #compiledSource: string | null = null;
  #compiledData: string | null = null;
  #assembly: AssemblyResult | null = null;
  #running = false;
  #cancel: (() => void) | null = null;
  #generation = 0;
  #runSteps = 0;
  #snapshot!: SessionSnapshot;

  constructor(source: string, dataText: string, private readonly schedule: Schedule) {
    this.#source = source;
    this.#dataText = dataText;
    this.#publish(null);
    this.build();
  }

  // React useSyncExternalStore требует стабильный снимок до следующего изменения.
  getSnapshot = (): SessionSnapshot => this.#snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  };

  setDraft(source: string, dataText: string): void {
    this.#stop();
    this.#source = source;
    this.#dataText = dataText;
    this.#publish({ kind: 'info', text: this.#dirty() ? 'Есть изменения. Соберите программу перед выполнением.' : 'Исходник соответствует загруженной программе.' });
  }

  build(): boolean {
    this.#stop();
    try {
      const assembly = assemble(this.#source);
      const data = parseInitialData(this.#dataText);
      this.#cpu.load({ ...assembly.image, data });
      this.#assembly = assembly;
      this.#compiledSource = this.#source;
      this.#compiledData = this.#dataText;
      this.#runSteps = 0;
      this.#publish({ kind: 'success', text: `Собрано инструкций: ${assembly.image.instructions.length}. Программа готова к запуску.` });
      return true;
    } catch (error) {
      if (error instanceof AssemblyError) {
        this.#publish({ kind: 'error', text: error.message, target: 'source', line: error.diagnostic.line, column: error.diagnostic.column });
      } else if (error instanceof DataInputError) {
        this.#publish({ kind: 'error', text: error.message, target: 'data', line: error.line });
      } else {
        throw error;
      }
      return false;
    }
  }

  step(): void {
    if (this.#running || !this.#canExecute()) return;
    const result = this.#cpu.step();
    this.#publish(this.#executionNotice(result.state), result.writes);
  }

  run(speed: Speed, maxSteps: number = MACHINE.defaultStepLimit): void {
    if (this.#running || !this.#canExecute()) return;
    if (!Number.isSafeInteger(maxSteps) || maxSteps < 1 || maxSteps > 1_000_000) {
      this.#publish({ kind: 'error', text: 'Лимит должен быть целым числом от 1 до 1000000.' });
      return;
    }
    const size = speed === 'fast' ? 250 : 1;
    const delay = speed === 'slow' ? 1000 : speed === 'normal' ? 100 : 16;
    this.#runSteps = 0;
    this.#running = true;
    const generation = ++this.#generation;
    this.#publish({ kind: 'info', text: 'Программа выполняется.' });
    const tick = () => {
      if (!this.#running || generation !== this.#generation) return;
      this.#cancel = null;
      const writes: WriteEvent[] = [];
      let state = this.#cpu.snapshot();
      for (let i = 0; i < size && this.#runSteps < maxSteps && state.status === 'ready'; i++) {
        const result = this.#cpu.step();
        state = result.state;
        if (result.executed) this.#runSteps += 1;
        writes.push(...result.writes);
      }
      if (state.status !== 'ready') {
        this.#running = false;
        this.#publish(this.#executionNotice(state), writes);
      } else if (this.#runSteps >= maxSteps) {
        this.#running = false;
        this.#publish({ kind: 'info', text: `Пауза: достигнут лимит ${maxSteps} команд. Можно продолжить выполнение.` }, writes);
      } else {
        this.#publish({ kind: 'info', text: 'Программа выполняется.' }, writes);
        // Подписчик может остановить выполнение во время публикации снимка.
        if (this.#running && generation === this.#generation) this.#cancel = this.schedule(tick, delay);
      }
    };
    if (this.#running && generation === this.#generation) this.#cancel = this.schedule(tick, delay);
  }

  pause(): void {
    if (!this.#running) return;
    this.#stop();
    this.#publish({ kind: 'info', text: 'Выполнение приостановлено.' });
  }

  reset(): void {
    this.#stop();
    this.#cpu.reset();
    this.#runSteps = 0;
    this.#publish({ kind: 'info', text: this.#dirty()
      ? 'Загруженная программа сброшена. Изменения редактора ещё не собраны.'
      : 'Регистры и память восстановлены из начального образа.' });
  }

  dispose(): void {
    this.#stop();
    this.#listeners.clear();
  }

  #dirty(): boolean {
    return this.#source !== this.#compiledSource || this.#dataText !== this.#compiledData;
  }
  #canExecute(): boolean {
    return this.#assembly !== null && !this.#dirty() && this.#cpu.snapshot().status === 'ready';
  }
  #stop(): void {
    this.#running = false;
    this.#generation += 1;
    this.#cancel?.();
    this.#cancel = null;
  }
  #executionNotice(state: CpuSnapshot): Notice {
    if (state.fault !== null) return { kind: 'error', text: `Адрес 0x${state.fault.address.toString(16).toUpperCase()}: ${state.fault.message}` };
    if (state.status === 'halted') return { kind: 'success', text: `Программа остановлена командой HALT. Выполнено команд: ${state.steps}.` };
    return { kind: 'info', text: `Выполнен шаг ${state.steps}.` };
  }
  #publish(notice: Notice | null, writes: readonly WriteEvent[] = []): void {
    this.#snapshot = {
      source: this.#source, dataText: this.#dataText, assembly: this.#assembly,
      cpu: this.#cpu.snapshot(), memory: this.#cpu.memory(), running: this.#running,
      dirty: this.#dirty(), notice, runSteps: this.#runSteps,
      changedRegisters: [...new Set(writes.filter(write => write.kind === 'register').map(write => write.address))],
      changedData: [...new Set(writes.filter(write => write.kind === 'data').map(write => write.address))],
    };
    for (const listener of this.#listeners) listener();
  }
}
