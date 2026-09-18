<template>
  <figure class="processor-card" aria-label="Концептуальная схема трёхадресного процессора: раздельная память команд и данных, декодер, АЛУ и регистры">
    <div class="processor-toolbar">
      <span class="processor-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg></span>
      <span class="processor-title">Модель процессора</span>
      <span class="processor-badge">Вариант 7</span>
    </div>
    <div class="memory-banks">
      <div class="memory-bank">
        <div class="memory-block">
          <span class="diagram-label">Память команд</span>
          <div class="memory-cells"><span>Код программы</span></div>
        </div>
        <div class="bus" aria-hidden="true"><span>↓</span> инструкции</div>
      </div>
      <div class="memory-bank">
        <div class="memory-block">
          <span class="diagram-label">Память данных</span>
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
    <figcaption>Схема архитектуры · Исполнение появится в эмуляторе</figcaption>
  </figure>
</template>
