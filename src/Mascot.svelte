<div class="lane" aria-hidden="true">
  <div class="ground"></div>
  <div class="walker">
    <div class="facing">
      <svg class="robot" viewBox="0 0 40 46" width="42" height="48">
        <g class="body">
          <line class="stroke" x1="20" y1="3" x2="20" y2="9" />
          <circle class="light" cx="20" cy="3" r="2.4" />
          <rect class="fill" x="6" y="9" width="28" height="18" rx="5" />
          <rect class="hole" x="10" y="13" width="21" height="9" rx="3" />
          <g class="eyes">
            <rect class="fill" x="15" y="15.5" width="4" height="4.5" rx="1" />
            <rect class="fill" x="24" y="15.5" width="4" height="4.5" rx="1" />
          </g>
          <rect class="fill" x="11" y="29" width="18" height="9" rx="2" />
          <rect class="hole" x="14" y="32" width="12" height="2.5" />
          <line class="stroke arm arm-back" x1="12" y1="31" x2="7" y2="37" />
          <line class="stroke arm arm-front" x1="28" y1="31" x2="33" y2="37" />
        </g>
        <rect class="fill leg leg-back" x="14" y="38" width="4.5" height="7" rx="1.2" />
        <rect class="fill leg leg-front" x="21.5" y="38" width="4.5" height="7" rx="1.2" />
      </svg>
    </div>
  </div>
</div>

<style>
  .lane {
    position: relative;
    flex: 1 1 260px;
    max-width: 360px;
    min-width: 90px;
    height: 56px;
    container-type: inline-size;
  }

  .ground {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 2px;
    border-bottom: 1px dashed var(--hairline);
  }

  .walker {
    position: absolute;
    left: 0;
    bottom: 3px;
    width: 42px;
    animation: patrol 16s linear infinite;
  }

  .facing {
    animation: face 16s steps(1) infinite;
  }

  .robot {
    display: block;
    overflow: visible;
  }

  .fill,
  .light {
    fill: var(--fg);
  }

  .hole {
    fill: var(--bg);
  }

  .stroke {
    stroke: var(--fg);
    stroke-width: 2.6;
    stroke-linecap: round;
  }

  .body {
    animation: bob 0.24s ease-in-out infinite alternate;
  }

  .light {
    animation: pulse 1.6s steps(1) infinite;
  }

  .eyes {
    transform-box: fill-box;
    transform-origin: center;
    animation: blink 4.2s infinite;
  }

  .leg {
    transform-box: fill-box;
    transform-origin: 50% 0;
    animation: stride 0.48s ease-in-out infinite alternate;
  }

  .leg-back {
    animation-delay: -0.48s;
  }

  .arm {
    transform-box: fill-box;
    transform-origin: 0 0;
    animation: swing 0.48s ease-in-out infinite alternate;
  }

  .arm-back {
    transform-origin: 100% 0;
    animation-delay: -0.48s;
  }

  @keyframes patrol {
    0%,
    4% {
      translate: 0;
    }
    46%,
    54% {
      translate: calc(100cqw - 42px);
    }
    96%,
    100% {
      translate: 0;
    }
  }

  @keyframes face {
    0% {
      scale: 1 1;
    }
    50% {
      scale: -1 1;
    }
  }

  @keyframes bob {
    to {
      translate: 0 -1.2px;
    }
  }

  @keyframes stride {
    from {
      rotate: -24deg;
    }
    to {
      rotate: 24deg;
    }
  }

  @keyframes swing {
    from {
      rotate: -18deg;
    }
    to {
      rotate: 18deg;
    }
  }

  @keyframes blink {
    0%,
    90%,
    100% {
      scale: 1 1;
    }
    94% {
      scale: 1 0.1;
    }
  }

  @keyframes pulse {
    50% {
      opacity: 0.25;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .walker,
    .facing,
    .body,
    .leg,
    .arm {
      animation: none;
    }
  }
</style>
