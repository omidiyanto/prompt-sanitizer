<script lang="ts">
  import { onDestroy } from 'svelte';
  import { play, suspendAudio, unlockAudio, type Sound } from './lib/sfx';

  const LOOP_MS = 12_000;
  const PHASES: [number, number][] = [
    [1_500, 1],
    [4_000, 2],
    [5_800, 3],
  ];
  const CUES: [number, Sound][] = [
    [780, 'paste'],
    [2_200, 'stamp'],
    [2_550, 'stamp'],
    [2_900, 'stamp'],
    [3_250, 'stamp'],
    [4_800, 'click'],
    [4_880, 'ding'],
    [5_800, 'whoosh'],
    [6_800, 'paste'],
    [7_980, 'send'],
    [9_600, 'reply'],
  ];
  const ASSISTANTS = ['Claude', 'ChatGPT', 'DeepSeek', 'Gemini', 'Copilot'];
  const LINES = [
    { prefix: 'ssh ', original: 'andi@web-prod-01', placeholder: '[USER_1]@[HOST_1]' },
    { prefix: 'password=', original: 'Tr0ub4dor', placeholder: '[SECRET_1]' },
    { prefix: 'from ', original: '10.20.30.40', placeholder: '[IPV4_1]' },
    { prefix: 'mail ', original: 'andi@maju.co.id', placeholder: '[EMAIL_1]' },
  ];
  const STEPS = [
    { title: 'Paste', body: 'Drop a prompt, a stack trace or a whole log file into Before. There is no length limit.' },
    {
      title: 'Review',
      body: 'Sensitive values turn into black placeholders in After. Hover one to see what it replaced.',
    },
    { title: 'Copy', body: 'Press Copy. Only the sanitized text reaches your clipboard.' },
    {
      title: 'Ask your AI',
      body: 'Paste into Claude, ChatGPT, DeepSeek or any chatbot. A value keeps the same placeholder everywhere, so the answer still makes sense.',
    },
  ];

  let dialog: HTMLDialogElement | undefined = $state();
  let cycle = $state(0);
  let phase = $state(0);
  let muted = $state(false);
  let timers: ReturnType<typeof setTimeout>[] = [];

  const assistant = $derived(ASSISTANTS[cycle % ASSISTANTS.length]);

  function stop() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function start() {
    stop();
    cycle += 1;
    phase = 0;
    timers = [
      ...PHASES.map(([at, next]) => setTimeout(() => (phase = next), at)),
      ...CUES.map(([at, sound]) => setTimeout(() => !muted && play(sound), at)),
      setTimeout(start, LOOP_MS),
    ];
  }

  export function open() {
    void unlockAudio();
    dialog?.showModal();
    start();
  }

  function handleClose() {
    stop();
    suspendAudio();
  }

  onDestroy(handleClose);
</script>

<dialog bind:this={dialog} aria-labelledby="guidance-title" onclose={handleClose}>
  <div class="frame">
    <header>
      <h2 id="guidance-title">How it works</h2>
      <div class="controls">
        <button class="button ghost" type="button" aria-pressed={!muted} onclick={() => (muted = !muted)}>
          Sound {muted ? 'off' : 'on'}
        </button>
        <button class="button" type="button" onclick={() => dialog?.close()}>Close</button>
      </div>
    </header>

    <div class="body">
      <figure class="stage" aria-label="Animated walkthrough: paste, review, copy, then paste into an AI chat">
        {#key cycle}
          <div class="scene" aria-hidden="true">
            <div class="mock-app">
              <div class="mock-head">
                <span>Before</span>
                <span class="after-head">
                  After
                  <span class="mock-copy"><span class="copy-label">Copy</span><span class="copied-label">Copied</span></span>
                </span>
              </div>
              <div class="mock-body">
                <div class="mock-pane">
                  {#each LINES as line (line.original)}
                    <p class="line">{line.prefix}{line.original}</p>
                  {/each}
                </div>
                <div class="mock-pane after">
                  {#each LINES as line (line.original)}
                    <p class="line">
                      {line.prefix}<span class="token"
                        ><span class="original">{line.original}</span><span class="placeholder"
                          >{line.placeholder}</span
                        ></span
                      >
                    </p>
                  {/each}
                </div>
              </div>
            </div>

            <div class="mock-chat">
              <div class="chat-head"><span class="status"></span>{assistant}</div>
              <div class="chat-log">
                <p class="bubble user">Why can't [USER_1] reach [HOST_1] from [IPV4_1]?</p>
                <p class="typing"><i></i><i></i><i></i></p>
                <p class="bubble ai">Check that [IPV4_1] is allowed on [HOST_1] and that [USER_1]'s key is in authorized_keys.</p>
              </div>
              <div class="chat-input">
                <span class="draft">Why can't [USER_1] reach [HOST_1] from [IPV4_1]?</span>
                <span class="send">↑</span>
              </div>
            </div>

            <div class="cursor">
              <svg viewBox="0 0 20 24" width="20" height="24">
                <path d="M2 2 L2 19 L6.5 15 L9.5 22 L12.5 20.8 L9.6 14 L16 14 Z" />
              </svg>
            </div>

            <div class="progress"><span></span></div>
          </div>
        {/key}
        <figcaption class="caption">
          <span class="caption-step">{phase + 1}/4</span>
          {STEPS[phase]?.title}
        </figcaption>
      </figure>

      <div class="text">
        <ol class="steps">
          {#each STEPS as step, index (step.title)}
            <li class:active={index === phase}>
              <span class="number">0{index + 1}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          {/each}
        </ol>
        <div class="tips">
          <h3>Tips</h3>
          <ul>
            <li>Add company and client names under <strong>Settings → Your terms</strong>.</li>
            <li>List domains that identify you under <strong>Settings → Domains to redact</strong>.</li>
            <li>The engine is heuristic. Read the output once before you send it.</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</dialog>

<style>
  dialog {
    width: min(1120px, calc(100vw - 32px));
    max-width: none;
    max-height: calc(100dvh - 32px);
    margin: auto;
    padding: 0;
    border: 1px solid var(--line);
    background: var(--bg);
    color: var(--fg);
    overflow: auto;
  }

  dialog[open] {
    animation: pop 340ms var(--ease) both;
  }

  dialog::backdrop {
    background: rgb(0 0 0 / 0.55);
    animation: fade 340ms var(--ease) both;
  }

  .frame {
    display: grid;
    gap: 20px;
    padding: clamp(16px, 3vw, 28px);
  }

  header,
  .controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  h2 {
    margin: 0;
    font-family: var(--sans);
    font-size: clamp(20px, 3vw, 28px);
    font-weight: 800;
    letter-spacing: -0.03em;
  }

  .body {
    display: grid;
    grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
    gap: clamp(16px, 3vw, 32px);
    align-items: start;
  }

  .stage {
    position: relative;
    margin: 0;
    aspect-ratio: 16 / 10;
    border: 1px solid var(--line);
    background: var(--wash);
    overflow: hidden;
    container-type: size;
  }

  .scene {
    position: absolute;
    inset: 0;
    font-size: 2.15cqw;
    line-height: 1.5;
    animation:
      fade 300ms var(--ease) both,
      vanish 500ms var(--ease) 11500ms forwards;
  }

  .mock-app,
  .mock-chat {
    position: absolute;
    inset: 6cqh 5cqw 16cqh;
    display: grid;
    border: 1px solid var(--line);
    background: var(--bg);
  }

  .mock-app {
    grid-template-rows: 11cqh 1fr;
    animation: slide-out 500ms var(--ease) 5800ms forwards;
  }

  .mock-head,
  .mock-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .mock-head {
    align-items: center;
    border-bottom: 1px solid var(--line);
    font-size: 0.8em;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .mock-head > span {
    padding: 0 1.8cqw;
  }

  .mock-head > .after-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 100%;
    border-left: 1px solid var(--line);
    padding-right: 1.5cqw;
  }

  .mock-copy {
    display: inline-grid;
    padding: 0.4em 0.8em;
    border: 1px solid var(--line);
    animation: press 300ms var(--ease) 4800ms both;
  }

  .copy-label,
  .copied-label {
    grid-area: 1 / 1;
    text-align: center;
  }

  .copy-label {
    animation: vanish 1ms linear 4800ms forwards;
  }

  .copied-label {
    opacity: 0;
    animation: appear-flat 1ms linear 4800ms forwards;
  }

  .mock-pane {
    padding: 2.4cqh 1.8cqw;
    overflow: hidden;
  }

  .mock-pane.after {
    border-left: 1px solid var(--line);
  }

  .line {
    margin: 0 0 1.2cqh;
    white-space: nowrap;
    opacity: 0;
    animation: rise 260ms var(--ease) both;
  }

  .mock-pane .line:nth-child(1) {
    animation-delay: 800ms;
  }
  .mock-pane .line:nth-child(2) {
    animation-delay: 860ms;
  }
  .mock-pane .line:nth-child(3) {
    animation-delay: 920ms;
  }
  .mock-pane .line:nth-child(4) {
    animation-delay: 980ms;
  }
  .mock-pane.after .line:nth-child(1) {
    animation-delay: 1500ms;
  }
  .mock-pane.after .line:nth-child(2) {
    animation-delay: 1560ms;
  }
  .mock-pane.after .line:nth-child(3) {
    animation-delay: 1620ms;
  }
  .mock-pane.after .line:nth-child(4) {
    animation-delay: 1680ms;
  }

  .token {
    display: inline-grid;
  }

  .original,
  .placeholder {
    grid-area: 1 / 1;
  }

  .placeholder {
    padding: 0 0.25em;
    background: var(--fg);
    color: var(--bg);
    clip-path: inset(0 100% 0 0);
    animation: ink 240ms var(--ease) forwards;
  }

  .original {
    animation: vanish 120ms linear forwards;
  }

  .line:nth-child(1) .token > span {
    animation-delay: 2200ms;
  }
  .line:nth-child(2) .token > span {
    animation-delay: 2550ms;
  }
  .line:nth-child(3) .token > span {
    animation-delay: 2900ms;
  }
  .line:nth-child(4) .token > span {
    animation-delay: 3250ms;
  }

  .mock-chat {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: 11cqh 1fr 14cqh;
    opacity: 0;
    animation: slide-in 500ms var(--ease) 5900ms forwards;
  }

  .chat-head {
    display: flex;
    align-items: center;
    gap: 1cqw;
    padding: 0 1.8cqw;
    border-bottom: 1px solid var(--line);
    font-weight: 700;
  }

  .status {
    width: 1cqw;
    height: 1cqw;
    border-radius: 50%;
    background: var(--fg);
  }

  .chat-log {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 1.6cqh;
    padding: 2cqh 1.8cqw;
    overflow: hidden;
  }

  .bubble {
    max-width: 78%;
    margin: 0;
    padding: 1.2cqh 1.4cqw;
    border: 1px solid var(--line);
    opacity: 0;
  }

  .bubble.user {
    align-self: flex-end;
    background: var(--fg);
    color: var(--bg);
    animation: rise 320ms var(--ease) 8000ms forwards;
  }

  .bubble.ai {
    align-self: flex-start;
    animation: rise 320ms var(--ease) 9600ms forwards;
  }

  .typing {
    display: flex;
    gap: 0.6cqw;
    margin: 0;
    opacity: 0;
    animation:
      appear-flat 1ms linear 8500ms forwards,
      collapse 1ms linear 9550ms forwards;
  }

  .typing i {
    width: 1cqw;
    height: 1cqw;
    border-radius: 50%;
    background: var(--fg);
    animation: dot 600ms ease-in-out infinite alternate;
  }

  .typing i:nth-child(2) {
    animation-delay: 200ms;
  }
  .typing i:nth-child(3) {
    animation-delay: 400ms;
  }

  .chat-input {
    display: flex;
    align-items: center;
    gap: 1.5cqw;
    padding: 0 1.5cqw 0 1.8cqw;
    border-top: 1px solid var(--line);
  }

  .draft {
    flex: 1;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    clip-path: inset(0 100% 0 0);
    animation:
      type 600ms steps(24) 6800ms forwards,
      vanish 1ms linear 7980ms forwards;
  }

  .send {
    display: grid;
    place-items: center;
    width: 6cqw;
    height: 6cqw;
    background: var(--fg);
    color: var(--bg);
    font-weight: 700;
    animation: press 300ms var(--ease) 7980ms;
  }

  .cursor {
    position: absolute;
    top: 0;
    left: 0;
    width: 3.2cqw;
    animation: cursor 12000ms linear forwards;
  }

  .cursor svg {
    display: block;
    width: 100%;
    height: auto;
    fill: var(--fg);
    stroke: var(--bg);
    stroke-width: 1.4;
    transform-origin: 10% 10%;
    animation: click 12000ms linear forwards;
  }

  .progress {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    background: var(--hairline);
  }

  .progress span {
    display: block;
    height: 100%;
    background: var(--fg);
    transform-origin: left;
    animation: fill 12000ms linear forwards;
  }

  .caption {
    position: absolute;
    left: 5cqw;
    bottom: 4.5cqh;
    display: flex;
    align-items: center;
    gap: 1.2cqw;
    font-size: 2cqw;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .caption-step {
    padding: 0.2em 0.5em;
    background: var(--fg);
    color: var(--bg);
  }

  .text {
    display: grid;
    gap: 24px;
  }

  .steps {
    display: grid;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .steps li {
    display: flex;
    gap: 14px;
    padding: 12px 14px;
    border-left: 2px solid var(--hairline);
    color: var(--muted);
    transition:
      border-color 240ms var(--ease),
      color 240ms var(--ease),
      background 240ms var(--ease);
  }

  .steps li.active {
    border-color: var(--fg);
    background: var(--wash);
    color: var(--fg);
  }

  .number {
    font-size: 11px;
    font-weight: 700;
    padding-top: 2px;
  }

  h3 {
    margin: 0 0 4px;
    font-size: 12px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .steps p {
    margin: 0;
    font-size: 12px;
  }

  .tips {
    padding-top: 16px;
    border-top: 1px solid var(--hairline);
    font-size: 12px;
  }

  .tips ul {
    display: grid;
    gap: 6px;
    margin: 8px 0 0;
    padding-left: 18px;
    color: var(--muted);
  }

  .tips strong {
    color: var(--fg);
    font-weight: 600;
  }

  @media (max-width: 860px) {
    .body {
      grid-template-columns: 1fr;
    }

    .stage {
      aspect-ratio: 4 / 3;
    }

    .scene {
      font-size: 2.9cqw;
    }

    .steps li {
      padding: 8px 12px;
    }
  }

  @keyframes cursor {
    0% {
      translate: 96cqw 96cqh;
      opacity: 0;
    }
    3% {
      opacity: 1;
    }
    5.5%,
    33% {
      translate: 25cqw 45cqh;
    }
    38.5%,
    48% {
      translate: 88cqw 11cqh;
    }
    54%,
    64% {
      translate: 40cqw 77cqh;
    }
    66%,
    85% {
      translate: 89cqw 77cqh;
      opacity: 1;
    }
    90%,
    100% {
      translate: 89cqw 77cqh;
      opacity: 0;
    }
  }

  @keyframes click {
    0%,
    6%,
    7%,
    39%,
    40.5%,
    56%,
    57.5%,
    66%,
    67.5%,
    100% {
      scale: 1;
    }
    6.5%,
    39.5%,
    56.5%,
    66.5% {
      scale: 0.78;
    }
  }

  @keyframes rise {
    from {
      opacity: 0;
      translate: 0 0.6em;
    }
    to {
      opacity: 1;
      translate: 0 0;
    }
  }

  @keyframes ink {
    to {
      clip-path: inset(0 0 0 0);
    }
  }

  @keyframes type {
    to {
      clip-path: inset(0 0 0 0);
    }
  }

  @keyframes press {
    0% {
      scale: 1;
    }
    40% {
      scale: 0.9;
      background: var(--fg);
      color: var(--bg);
    }
    100% {
      scale: 1;
      background: var(--fg);
      color: var(--bg);
    }
  }

  @keyframes slide-out {
    to {
      opacity: 0;
      translate: -6cqw 0;
    }
  }

  @keyframes slide-in {
    from {
      opacity: 0;
      translate: 6cqw 0;
    }
    to {
      opacity: 1;
      translate: 0 0;
    }
  }

  @keyframes appear-flat {
    to {
      opacity: 1;
    }
  }

  @keyframes vanish {
    to {
      opacity: 0;
    }
  }

  @keyframes collapse {
    to {
      opacity: 0;
      height: 0;
      margin: 0;
    }
  }

  @keyframes dot {
    to {
      translate: 0 -0.5cqw;
      opacity: 0.4;
    }
  }

  @keyframes fill {
    from {
      scale: 0 1;
    }
    to {
      scale: 1 1;
    }
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  @keyframes pop {
    from {
      opacity: 0;
      scale: 0.97;
    }
  }
</style>
