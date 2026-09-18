<template>
  <figure class="processor-card" aria-label="Концептуальная схема трёхадресного процессора: раздельная память команд и данных, декодер, АЛУ и регистры">
    <div class="processor-topline"><span class="status-dot" /> ARCHITECTURE / 7 <span>КОНЦЕПЦИЯ</span></div>
    <div class="memory-banks">
      <div class="memory-bank">
        <div class="memory-block">
          <span class="diagram-label">ПАМЯТЬ КОМАНД</span>
          <div class="memory-cells"><span>Код программы</span></div>
        </div>
        <div class="bus" aria-hidden="true"><span>↓</span> инструкции</div>
      </div>
      <div class="memory-bank">
        <div class="memory-block">
          <span class="diagram-label">ПАМЯТЬ ДАННЫХ</span>
          <div class="memory-cells"><span>Массивы · результат</span></div>
        </div>
        <div class="bus" aria-hidden="true"><span>↕</span> данные</div>
      </div>
    </div>
    <div class="cpu-block">
      <div class="cpu-caption"><span>CPU</span><span>3 операнда / инструкция</span></div>
      <div class="cpu-pipeline"><span>Выборка</span><span aria-hidden="true">→</span><span>Декодер</span><span aria-hidden="true">→</span><span class="alu">АЛУ</span></div>
      <div class="register-row"><span>PC</span><span>IR</span><span>R₀</span><span>R₁</span><span>R₂</span><span>Флаги</span></div>
    </div>
    <div class="instruction-line"><code><span>ADD</span> R0, R1, R2</code><span>R0 ← R1 + R2</span></div>
    <figcaption>Одна команда. Наблюдаемое изменение состояния.</figcaption>
  </figure>
</template>
