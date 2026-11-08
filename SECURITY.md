# Security Policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's **Report a vulnerability** button on the Security tab of this repository. Do not open a public issue.

Include the input that triggers the problem (with real data replaced), the browser, and what you expected to happen. A missed detection that leaks a common kind of secret counts as a security issue.

## Threat model

- All detection runs in a Web Worker in the visitor's browser. The app makes no network requests with user text, and the Content-Security-Policy sets `connect-src 'none'`, so the page cannot make any.
- The pasted text is never written to storage. Only settings (custom terms, allowlist, detector toggles) are saved, in `localStorage` on the visitor's device.
- Output is rendered with `textContent` and Svelte text bindings only, never as HTML.
- Detection is heuristic. It reduces exposure but cannot guarantee that every sensitive value is caught. Review the output before sending it anywhere.
