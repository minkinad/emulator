import { isUnsigned, MachineError } from './errors.js';
import { MACHINE } from './isa.js';
import type { ProgramImage } from './types.js';

/** Проверить весь образ и отделить его от изменяемых объектов вызывающего кода. */
export function validateImage(input: unknown): ProgramImage {
  function invalid(message: string): never {
    throw new MachineError('INVALID_IMAGE', message);
  }
  if (typeof input !== 'object' || input === null) invalid('Образ программы должен быть объектом.');
  const image = input as Record<string, unknown>;
  if (!Array.isArray(image.instructions) || image.instructions.length < 1 || image.instructions.length > MACHINE.codeSize) {
    invalid(`Образ должен содержать от 1 до ${MACHINE.codeSize} инструкций.`);
  }
  const instructions: number[] = [];
  for (const value of image.instructions) {
    if (!isUnsigned(value, 0xffff_ffff)) invalid('Машинное слово должно быть целым числом от 0 до 4294967295.');
    instructions.push(value);
  }
  if (!isUnsigned(image.entryPoint, instructions.length - 1)) invalid('Точка входа должна указывать на загруженную инструкцию.');
  if (!Array.isArray(image.data)) invalid('Начальные данные должны быть списком ячеек.');
  const data: { address: number; value: number }[] = [];
  const addresses = new Set<number>();
  for (const cell of image.data as unknown[]) {
    if (typeof cell !== 'object' || cell === null) invalid('Начальные данные содержат неверную ячейку.');
    const { address, value } = cell as Record<string, unknown>;
    if (!isUnsigned(address, MACHINE.dataSize - 1)) invalid('Адрес начальных данных должен быть в диапазоне 0…4095.');
    if (!isUnsigned(value, 0xffff)) invalid('Слово данных должно быть целым числом от 0 до 65535.');
    if (addresses.has(address)) invalid(`Начальные данные повторно задают ячейку ${address}.`);
    addresses.add(address);
    data.push({ address, value });
  }
  return { instructions, entryPoint: image.entryPoint, data };
}
