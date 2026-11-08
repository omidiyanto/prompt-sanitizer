<script lang="ts">
  import { CATEGORIES } from './lib/rules';
  import { defaultSettings, parseDomains, parseTerms, type Settings } from './lib/settings';

  let { settings = $bindable(), saved }: { settings: Settings; saved: boolean } = $props();

  const TERMS_EXAMPLE = 'COMPANY: PT Maju Jaya\nCLIENT: Globex Corporation\nCLIENT: Initech\nPROJECT: Falcon';
  const DOMAIN_EXAMPLE = 'maju.co.id\nglobex.com\ninitech.io';

  let dialog: HTMLDialogElement | undefined = $state();

  const termCount = $derived(parseTerms(settings.terms).length);
  const domainCount = $derived(parseDomains(settings.domains).length);

  export function open() {
    dialog?.showModal();
  }

  function forget() {
    if (confirm('Remove your saved terms, domains and detector choices from this browser?')) {
      settings = defaultSettings();
    }
  }
</script>

<dialog bind:this={dialog} aria-labelledby="settings-title">
  <form method="dialog" class="sheet">
    <header>
      <h2 id="settings-title">Settings</h2>
      <button class="button ghost" type="submit">Close</button>
    </header>

    <section>
      <div class="label-row">
        <label for="terms">Your terms</label>
        <span class="count">{termCount} {termCount === 1 ? 'term' : 'terms'}</span>
      </div>
      <p class="help">
        One per line as <code>LABEL: value</code>. Matched case-insensitively on whole words and replaced with
        <code>[LABEL_1]</code>, <code>[LABEL_2]</code>, …
      </p>
      <textarea
        id="terms"
        rows="7"
        bind:value={settings.terms}
        placeholder={TERMS_EXAMPLE}
        spellcheck="false"
        autocomplete="off"
      ></textarea>
    </section>

    <section>
      <div class="label-row">
        <label for="domains">Domains to redact</label>
        <span class="count">{domainCount} {domainCount === 1 ? 'domain' : 'domains'}</span>
      </div>
      <p class="help">
        Public domains stay readable. List the ones that identify you or your clients, one per line; every subdomain is
        included. Names under private suffixes such as <code>.internal</code>, <code>.local</code> or <code>.svc</code>
        are always redacted.
      </p>
      <textarea
        id="domains"
        rows="4"
        bind:value={settings.domains}
        placeholder={DOMAIN_EXAMPLE}
        spellcheck="false"
        autocomplete="off"
      ></textarea>
    </section>

    <fieldset>
      <legend>Detectors</legend>
      <div class="grid">
        {#each CATEGORIES as category (category.id)}
          <label class="toggle">
            <input type="checkbox" bind:checked={settings.enabled[category.id]} />
            <span class="box" aria-hidden="true"></span>
            <span class="text">
              <span class="name">{category.name}</span>
              <span class="example">{category.example}</span>
            </span>
          </label>
        {/each}
      </div>
    </fieldset>

    <footer>
      <p class:warn={!saved}>
        {saved
          ? 'Saved automatically to localStorage on this device only.'
          : 'This browser blocks localStorage. Settings reset when the tab closes.'}
      </p>
      <button class="button" type="button" onclick={forget}>Forget saved settings</button>
    </footer>
  </form>
</dialog>

<style>
  dialog {
    width: min(560px, 100vw);
    max-width: 100vw;
    height: 100dvh;
    max-height: 100dvh;
    margin: 0 0 0 auto;
    padding: 0;
    border: 0;
    border-left: 1px solid var(--line);
    background: var(--bg);
    color: var(--fg);
  }

  dialog[open] {
    animation: slide 320ms var(--ease) both;
  }

  dialog::backdrop {
    background: rgb(0 0 0 / 0.45);
    animation: fade 320ms var(--ease) both;
  }

  .sheet {
    display: flex;
    flex-direction: column;
    gap: 28px;
    min-height: 100%;
    padding: 20px clamp(16px, 4vw, 28px) 28px;
  }

  header,
  footer,
  .label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  h2 {
    margin: 0;
    font-family: var(--sans);
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.03em;
  }

  label,
  legend {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .count {
    color: var(--muted);
    font-size: 11px;
  }

  .help {
    margin: 6px 0 10px;
    color: var(--muted);
    font-size: 12px;
  }

  code {
    padding: 0 0.3em;
    background: var(--wash);
  }

  textarea {
    width: 100%;
    padding: 12px;
    border: 1px solid var(--line);
    background: var(--bg);
    font-size: 13px;
    line-height: 1.6;
    resize: vertical;
  }

  textarea::placeholder {
    color: var(--muted);
  }

  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    margin-bottom: 12px;
    padding: 0;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    border-top: 1px solid var(--hairline);
    border-left: 1px solid var(--hairline);
  }

  .toggle {
    position: relative;
    display: flex;
    gap: 10px;
    padding: 10px 12px;
    border-right: 1px solid var(--hairline);
    border-bottom: 1px solid var(--hairline);
    font-size: 12px;
    font-weight: 400;
    letter-spacing: 0;
    text-transform: none;
    cursor: pointer;
    transition: background 140ms var(--ease);
  }

  .toggle:hover {
    background: var(--wash);
  }

  .toggle input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .box {
    flex: none;
    width: 14px;
    height: 14px;
    margin-top: 2px;
    border: 1px solid var(--line);
    transition: background 140ms var(--ease);
  }

  .toggle input:checked + .box {
    background: var(--fg);
    box-shadow: inset 0 0 0 2px var(--bg);
  }

  .toggle input:focus-visible + .box {
    outline: 2px solid var(--fg);
    outline-offset: 2px;
  }

  .text {
    display: grid;
  }

  .example {
    color: var(--muted);
    font-size: 11px;
  }

  footer {
    flex-wrap: wrap;
    margin-top: auto;
    padding-top: 16px;
    border-top: 1px solid var(--hairline);
  }

  footer p {
    margin: 0;
    color: var(--muted);
    font-size: 11px;
  }

  footer p.warn {
    color: var(--fg);
    font-weight: 700;
  }

  @keyframes slide {
    from {
      transform: translateX(32px);
      opacity: 0;
    }
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }
</style>
