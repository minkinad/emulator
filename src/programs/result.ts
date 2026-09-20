/** Интерпретация готовых слов памяти; не вычисляет сумму или произведения массивов. */
export function signedResult(words: readonly number[]): bigint {
  if (words.length !== 2 && words.length !== 3) throw new Error('Результат должен содержать два или три слова.');
  let value = 0n;
  for (const [index, word] of words.entries()) {
    if (!Number.isInteger(word) || word < 0 || word > 0xffff) throw new Error('Слово результата должно быть целым числом 0…65535.');
    value |= BigInt(word) << BigInt(index * 16);
  }
  return BigInt.asIntN(words.length * 16, value);
}
