<template>
  <figure class="processor-card" aria-label="Концептуальная схема двухадресного процессора: единая память, декодер, АЛУ и регистры">
    <div class="processor-topline"><span class="status-dot" /> ARCHITECTURE / 10 <span>КОНЦЕПЦИЯ</span></div>
    <div class="memory-block">
      <span class="diagram-label">ЕДИНАЯ ПАМЯТЬ</span>
      <div class="memory-cells"><span>Код</span><span>Массив A</span><span>Массив B</span><span>Результат</span></div>
    </div>
    <div class="bus" aria-hidden="true"><span>↓</span> адрес · данные <span>↑</span></div>
    <div class="cpu-block">
      <div class="cpu-caption"><span>CPU</span><span>2 операнда / инструкция</span></div>
      <div class="cpu-pipeline"><span>Выборка</span><span aria-hidden="true">→</span><span>Декодер</span><span aria-hidden="true">→</span><span class="alu">АЛУ</span></div>
      <div class="register-row"><span>PC</span><span>IR</span><span>R₀</span><span>R₁</span><span>…</span><span>Флаги</span></div>
    </div>
    <div class="instruction-line"><code><span>ADD</span> R0, R1</code><span>R0 ← R0 + R1</span></div>
    <figcaption>Одна команда. Наблюдаемое изменение состояния.</figcaption>
  </figure>
</template>
