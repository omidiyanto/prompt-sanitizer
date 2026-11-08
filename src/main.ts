import { mount } from 'svelte';
import App from './App.svelte';
import { browserStorage } from './lib/settings';
import { applyTheme, initialTheme } from './lib/theme';
import './app.css';

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app mount point');

applyTheme(initialTheme(browserStorage()));

export default mount(App, { target });
