import { MACHINE } from '../core/index.js';

const MAX_WORD = (1n << BigInt(MACHINE.wordBits)) - 1n;

/** Интерпретация готовых слов памяти; не вычисляет сумму или произведения массивов. */
export function signedResult(words: readonly number[]): bigint {
  if (words.length !== 2 && words.length !== 3) {
    throw new Error('Результат должен содержать два или три слова.');
  }
  let value = 0n;
  for (const [index, word] of words.entries()) {
    value |= validateWord(word) << BigInt(index * MACHINE.wordBits);
  }
  return BigInt.asIntN(words.length * MACHINE.wordBits, value);
}

function validateWord(word: number): bigint {
  if (!Number.isInteger(word) || word < 0 || BigInt(word) > MAX_WORD) {
    throw new Error(`Слово результата должно быть целым числом 0…${MAX_WORD}.`);
  }
  return BigInt(word);
}
