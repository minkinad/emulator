import DefaultTheme from 'vitepress/theme';
import { h } from 'vue';
import ProcessorCard from './ProcessorCard.vue';
import HomeRoadmap from './HomeRoadmap.vue';
import './style.css';

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'home-hero-image': () => h(ProcessorCard),
      'home-features-after': () => h(HomeRoadmap),
    });
  },
};
