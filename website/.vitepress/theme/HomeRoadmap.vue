<script setup>
import { withBase } from 'vitepress';

const steps = [
  { number: '01', title: 'Написать программу', text: 'Инструкции, регистры и метки в обычном текстовом файле.' },
  { number: '02', title: 'Собрать машинный код', text: 'Проверка операндов и кодирование каждой инструкции.' },
  { number: '03', title: 'Выполнить по шагам', text: 'Выборка из памяти команд, декодирование и работа АЛУ.' },
  { number: '04', title: 'Проверить состояние', text: 'Регистры, память, флаги и изменения после команды.' },
];
</script>

<template>
  <section class="home-roadmap" aria-labelledby="roadmap-title">
    <div class="roadmap-heading">
      <div><p class="eyebrow">От исходника к результату</p><h2 id="roadmap-title">Как исполняется программа</h2></div>
      <a :href="withBase('/guide/assembler.html')">Справочник ассемблера <span aria-hidden="true">↗</span></a>
    </div>
    <div class="roadmap-grid">
      <article v-for="step in steps" :key="step.number"><span class="step-number">{{ step.number }}</span><h3>{{ step.title }}</h3><p>{{ step.text }}</p></article>
    </div>
    <div class="project-note"><span class="note-label">Рабочая область</span><p>Доступны браузерный редактор, сборка и исполнение. Состояние процессора видно после каждого шага.</p><a :href="withBase('/project/changelog.html')">История проекта →</a></div>
  </section>
</template>
