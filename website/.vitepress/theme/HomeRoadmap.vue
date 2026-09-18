<script setup>
import { withBase } from 'vitepress';

const steps = [
  { number: '01', title: 'Описать машину', text: 'Память, регистры, форматы команд и правила арифметики.' },
  { number: '02', title: 'Собрать ядро', text: 'Выборка, декодирование и исполнение одной инструкции.' },
  { number: '03', title: 'Подключить ассемблер', text: 'Метки, машинные слова и понятные ошибки в программе.' },
  { number: '04', title: 'Показать результат', text: 'Интерфейс, две программы, проверки и отчёт для защиты.' },
];
</script>

<template>
  <section class="home-roadmap" aria-labelledby="roadmap-title">
    <div class="roadmap-heading">
      <div><p class="eyebrow">От спецификации к исполнению</p><h2 id="roadmap-title">Четыре шага к своей машине</h2></div>
      <a :href="withBase('/project/implementation.html')">Все этапы <span aria-hidden="true">↗</span></a>
    </div>
    <div class="roadmap-grid">
      <article v-for="step in steps" :key="step.number"><span class="step-number">{{ step.number }}</span><h3>{{ step.title }}</h3><p>{{ step.text }}</p></article>
    </div>
    <div class="project-note"><span class="note-label">Этап 2 готов</span><p>Спецификация и черновики программ готовы. Далее — ядро процессора на TypeScript.</p><a :href="withBase('/project/changelog.html')">История проекта →</a></div>
  </section>
</template>
