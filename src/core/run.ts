import type { Cpu } from './cpu.js';
import { MachineError } from './errors.js';
import { MACHINE } from './isa.js';
import type { CpuSnapshot } from './types.js';

export interface RunResult {
  readonly reason: 'halted' | 'faulted' | 'limit';
  readonly executedSteps: number;
  readonly state: CpuSnapshot;
}

/** Ограниченный синхронный запуск для тестов/CLI; UI будет вызывать step() порциями. */
export function run(cpu: Cpu, maxSteps: number = MACHINE.defaultStepLimit): RunResult {
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 1) {
    throw new MachineError('INVALID_STEP_LIMIT', 'Лимит команд должен быть положительным безопасным целым числом.');
  }
  let state = cpu.snapshot();
  let executedSteps = 0;
  while (state.status === 'ready' && executedSteps < maxSteps) {
    const result = cpu.step();
    state = result.state;
    if (result.executed) executedSteps += 1;
  }
  return { reason: state.status === 'ready' ? 'limit' : state.status, executedSteps, state };
}
