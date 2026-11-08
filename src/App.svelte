<script lang="ts">
  import { onDestroy } from 'svelte';
  import GuidanceDialog from './GuidanceDialog.svelte';
  import Mascot from './Mascot.svelte';
  import SettingsDialog from './SettingsDialog.svelte';
  import { BULK_SEGMENT_THRESHOLD, segments } from './lib/highlight';
  import { SAMPLE } from './lib/sample';
  import type { SanitizeResult } from './lib/sanitize';
  import type { WorkerRequest } from './lib/sanitize.worker';
  import {
    browserStorage,
    loadSettings,
    parseDomains,
    parseTerms,
    saveSettings,
    saveTheme,
    type Theme,
  } from './lib/settings';
  import { applyTheme } from './lib/theme';

  type WorkerResponse = { id: number; result?: SanitizeResult; error?: string };

  const EMPTY: SanitizeResult = { output: '', segments: [], counts: {} };
  const storage = browserStorage();

  let input = $state('');
  let settings = $state(loadSettings(storage));
  let result = $state.raw<SanitizeResult>(EMPTY);
  let busy = $state(false);
  let error = $state('');
  let copied = $state(false);
  let saved = $state(true);
  let theme = $state<Theme>(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  let settingsDialog: ReturnType<typeof SettingsDialog> | undefined = $state();
  let guidanceDialog: ReturnType<typeof GuidanceDialog> | undefined = $state();

  const ruleCount = $derived(parseTerms(settings.terms).length + parseDomains(settings.domains).length);
  const lineCount = $derived(input ? (input.match(/\n/g)?.length ?? 0) + 1 : 0);
  const redactions = $derived(result.segments.reduce((total, segment) => total + (segment.label ? 1 : 0), 0));
  const bulk = $derived(result.segments.length > BULK_SEGMENT_THRESHOLD);
  const summary = $derived(Object.entries(result.counts).sort(([, a], [, b]) => b - a));

  const worker = new Worker(new URL('./lib/sanitize.worker.ts', import.meta.url), { type: 'module' });
  let latestRequest = 0;
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
    if (event.data.id !== latestRequest) return;
    busy = false;
    error = event.data.error ?? '';
    result = event.data.result ?? EMPTY;
  });

  worker.addEventListener('error', () => {
    busy = false;
    result = EMPTY;
    error = 'The detection engine stopped. Reload the page to try again.';
  });

  $effect(() => {
    saved = saveSettings(storage, $state.snapshot(settings));
  });

  $effect(() => {
    const request: WorkerRequest = { id: ++latestRequest, text: input, settings: $state.snapshot(settings) };
    if (!request.text) {
      busy = false;
      result = EMPTY;
      return;
    }
    busy = true;
    const timer = setTimeout(() => worker.postMessage(request), request.text.length > 100_000 ? 300 : 90);
    return () => clearTimeout(timer);
  });

  onDestroy(() => {
    worker.terminate();
    clearTimeout(copiedTimer);
  });

  async function copyOutput() {
    try {
      await navigator.clipboard.writeText(result.output);
      copied = true;
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => (copied = false), 1600);
    } catch {
      error = 'Clipboard access was blocked. Select the text on the right and copy it manually.';
    }
  }

  function toggleTheme(event: MouseEvent) {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    const commit = () => {
      theme = next;
      applyTheme(next);
    };
    saveTheme(storage, next);
    if (!('startViewTransition' in document) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      commit();
      return;
    }
    const button = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = button.left + button.width / 2;
    const y = button.top + button.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.startViewTransition(commit).ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 560, easing: 'cubic-bezier(0.2, 0.7, 0.1, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    }, () => undefined);
  }

  const formatNumber = (value: number) => value.toLocaleString('en-US');
</script>

<div class="shell">
  <header class="top">
    <div class="brand">
      <div class="title-row">
        <h1>Prompt <span class="redact">Sanitizer</span></h1>
        <Mascot />
      </div>
      <p class="tagline">
        Paste logs or a prompt. Emails, IPs, hosts, credentials and your own client names come back as placeholders,
        ready for Claude or ChatGPT.
      </p>
    </div>
    <div class="actions">
      <span class="local" title="No network requests are made with your text">
        <span class="dot" aria-hidden="true"></span>Runs locally
      </span>
      <button class="button" type="button" onclick={() => guidanceDialog?.open()}>Guidance</button>
      <button
        class="button icon"
        type="button"
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
        onclick={toggleTheme}
      >
        <svg class="theme-icon" class:dark={theme === 'dark'} viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 1.5a6.5 6.5 0 0 1 0 13z" />
        </svg>
      </button>
      <button class="button" type="button" onclick={() => settingsDialog?.open()}>
        Settings{ruleCount ? ` · ${ruleCount}` : ''}
      </button>
    </div>
  </header>

  <main class="workspace">
    <section class="pane" aria-labelledby="before-title">
      <header class="pane-head">
        <h2 id="before-title">Before</h2>
        <span class="meta">{formatNumber(input.length)} chars · {formatNumber(lineCount)} lines</span>
        <div class="pane-actions">
          <button class="button ghost" type="button" onclick={() => (input = SAMPLE)}>Sample</button>
          <button class="button ghost" type="button" disabled={!input} onclick={() => (input = '')}>Clear</button>
        </div>
      </header>
      <textarea
        bind:value={input}
        aria-label="Text to sanitize"
        placeholder="Paste a prompt, a stack trace, or ten thousand lines of syslog."
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
      ></textarea>
    </section>

    <section class="pane" aria-labelledby="after-title" aria-busy={busy}>
      <header class="pane-head">
        <h2 id="after-title">After</h2>
        <span class="meta">
          {#if busy}
            Scanning…
          {:else}
            {formatNumber(redactions)} redacted
          {/if}
        </span>
        <div class="pane-actions">
          <button
            class="button copy"
            class:done={copied}
            type="button"
            disabled={busy || !result.output}
            onclick={copyOutput}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </header>
      <div class="progress" class:active={busy} aria-hidden="true"></div>
      {#if bulk}
        <pre class="output bulk" aria-label="Sanitized text" use:segments={result.segments}></pre>
      {:else if result.output}
        <pre class="output" aria-label="Sanitized text">{#each result.segments as segment, index (index)}{#if segment.label}<mark title={segment.original}>{segment.text}</mark>{:else}{segment.text}{/if}{/each}</pre>
      {:else}
        <div class="empty">
          <p>Sanitized text appears here.</p>
          <p class="hint">Highlighted blocks are redactions. Hover one to see what it replaced.</p>
        </div>
      {/if}
    </section>
  </main>

  <footer class="foot">
    {#if error}
      <p class="error" role="alert">{error}</p>
    {:else if summary.length}
      <ul class="summary" aria-label="Unique values redacted per type">
        {#each summary as [label, count] (label)}
          <li><span>{label}</span>{count}</li>
        {/each}
      </ul>
    {:else}
      <p class="note">Nothing you paste is uploaded, logged or stored. Only your settings are saved, in this browser.</p>
    {/if}
  </footer>
</div>

<SettingsDialog bind:this={settingsDialog} bind:settings {saved} />
<GuidanceDialog bind:this={guidanceDialog} />

<style>
  .shell {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    height: 100dvh;
    overflow: hidden;
    max-width: 1600px;
    margin: 0 auto;
    padding: clamp(16px, 3vw, 40px);
    gap: clamp(16px, 2.5vw, 28px);
  }

  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px 32px;
    animation: rise 520ms var(--ease) both;
  }

  .brand {
    flex: 1 1 520px;
    min-width: 0;
  }

  .title-row {
    display: flex;
    align-items: flex-end;
    gap: clamp(12px, 2vw, 28px);
  }

  h1 {
    flex: none;
    margin: 0;
    font-family: var(--sans);
    font-size: clamp(2rem, 5vw, 3.5rem);
    font-weight: 800;
    letter-spacing: -0.045em;
    line-height: 0.95;
  }

  .redact {
    position: relative;
    display: inline-block;
  }

  .redact::after {
    content: '';
    position: absolute;
    inset: 0.08em -0.06em 0.02em;
    background: var(--fg);
    transform: scaleX(0);
    transform-origin: left;
    animation: strike 1300ms var(--ease) 300ms both;
  }

  .tagline {
    max-width: 58ch;
    margin: 14px 0 0;
    color: var(--muted);
    font-size: 13px;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .button.icon {
    padding: 0.35rem 0.55rem;
  }

  .theme-icon {
    display: block;
    transition: rotate 480ms var(--ease);
  }

  .theme-icon circle {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
  }

  .theme-icon path {
    fill: currentColor;
  }

  .theme-icon.dark {
    rotate: 180deg;
  }

  .local {
    margin-right: 8px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .dot {
    width: 7px;
    height: 7px;
    background: var(--fg);
    animation: blink 2.4s steps(1) infinite;
  }

  .workspace {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: minmax(0, 1fr);
    min-height: 0;
    border: 1px solid var(--line);
  }

  .pane {
    position: relative;
    display: grid;
    grid-template-rows: auto 1fr;
    min-width: 0;
    min-height: 0;
    animation: rise 520ms var(--ease) both;
  }

  .pane + .pane {
    border-left: 1px solid var(--line);
    animation-delay: 90ms;
  }

  .pane-head {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 48px;
    padding: 8px 8px 8px 16px;
    border-bottom: 1px solid var(--line);
  }

  h2 {
    margin: 0;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .meta {
    color: var(--muted);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .pane-actions {
    display: flex;
    gap: 4px;
    margin-left: auto;
  }

  textarea,
  .output {
    width: 100%;
    height: 100%;
    min-height: 0;
    margin: 0;
    padding: 16px;
    border: 0;
    background: transparent;
    font-family: var(--mono);
    font-size: 13px;
    line-height: 1.65;
    tab-size: 4;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    overflow: auto;
  }

  textarea {
    resize: none;
    outline: none;
  }

  textarea::placeholder {
    color: var(--muted);
  }

  .pane:focus-within .pane-head h2::before {
    content: '▸ ';
  }

  .output {
    position: absolute;
    inset: 48px 0 0;
    height: auto;
  }

  .output:focus-visible {
    outline-offset: -2px;
  }

  mark {
    padding: 0.05em 0.25em;
    background: var(--fg);
    color: var(--bg);
    animation: ink 280ms var(--ease) both;
  }

  .bulk :global(mark) {
    padding: 0.05em 0.25em;
    background: var(--fg);
    color: var(--bg);
  }

  mark:hover,
  .bulk :global(mark:hover) {
    outline: 1px solid var(--fg);
    outline-offset: 1px;
  }

  .copy.done {
    background: var(--fg);
    color: var(--bg);
  }

  .progress {
    position: absolute;
    top: 47px;
    left: 0;
    right: 0;
    height: 2px;
    overflow: hidden;
    opacity: 0;
    transition: opacity 120ms;
    z-index: 1;
  }

  .progress.active {
    opacity: 1;
  }

  .progress::after {
    content: '';
    position: absolute;
    inset: 0;
    width: 35%;
    background: var(--fg);
    animation: scan 900ms var(--ease) infinite;
  }

  .empty {
    align-self: center;
    justify-self: center;
    padding: 24px;
    text-align: center;
    color: var(--muted);
  }

  .empty p {
    margin: 0;
  }

  .empty .hint {
    margin-top: 6px;
    font-size: 11px;
  }

  .foot {
    height: 28px;
    overflow: hidden;
    font-size: 12px;
  }

  .note,
  .error {
    margin: 0;
    color: var(--muted);
  }

  .error {
    color: var(--fg);
    font-weight: 700;
  }

  .error::before {
    content: '! ';
  }

  .summary {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .summary li {
    flex: none;
    display: inline-flex;
    gap: 8px;
    padding: 3px 8px;
    border: 1px solid var(--hairline);
    font-variant-numeric: tabular-nums;
    animation: rise 260ms var(--ease) both;
  }

  .summary span {
    color: var(--muted);
  }

  @media (max-width: 860px) {
    .workspace {
      grid-template-columns: 1fr;
      grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
    }

    .tagline,
    .local {
      display: none;
    }

    .pane + .pane {
      border-left: 0;
      border-top: 1px solid var(--line);
    }

    .actions {
      width: 100%;
      justify-content: flex-end;
    }
  }

  @media (max-width: 480px) {
    .meta {
      display: none;
    }
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }

  @keyframes strike {
    0% {
      transform: scaleX(0);
      transform-origin: left;
    }
    45% {
      transform: scaleX(1);
      transform-origin: left;
    }
    55% {
      transform: scaleX(1);
      transform-origin: right;
    }
    100% {
      transform: scaleX(0);
      transform-origin: right;
    }
  }

  @keyframes ink {
    from {
      clip-path: inset(0 100% 0 0);
    }
    to {
      clip-path: inset(0 0 0 0);
    }
  }

  @keyframes scan {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(300%);
    }
  }

  @keyframes blink {
    50% {
      opacity: 0.2;
    }
  }
</style>
