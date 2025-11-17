import { CREDENTIALS_SECTION } from './timeline.js';

// Small standalone renderer for the Credentials timeline.
// It imports CREDENTIALS_SECTION from ./timeline.js and mounts into #credentials-root.

const PREFERS_REDUCED = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

function createEl(tag, attrs = {}, html) {
  const el = document.createElement(tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (html !== undefined) el.innerHTML = html;
  return el;
}

function renderTimeline(container, section) {
  container.innerHTML = '';
  const rope = createEl('div', { class: 'rope', 'aria-hidden': 'true' });
  const svg = createEl('svg', { class: 'timeline-svg', 'aria-hidden': 'true' });
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  const list = createEl('ul', { class: 'timeline-list' });

  container.appendChild(rope);
  container.appendChild(svg);
  container.appendChild(list);

  section.cards.forEach((card, idx) => {
    const li = createEl('li', { class: 'timeline-item' });
    const dot = createEl('div', { class: 'timeline-dot', role: 'img', 'aria-hidden': 'true' });
    const time = createEl('time', {}, card.date);
    const content = createEl('div', { class: 'timeline-content', tabindex:0 });
    const inner = createEl('div', { class: 'parallax-inner' });
    inner.innerHTML = `<h3>${card.heading}</h3><p>${card.description}</p>`;
    content.appendChild(inner);
    li.appendChild(dot);
    li.appendChild(time);
    li.appendChild(content);
    list.appendChild(li);
  });

  // draw connectors as simple cubic bezier from dot to content edge
  const rafState = { scheduled: false };
  function drawConnectors() {
    if (rafState.scheduled) return;
    rafState.scheduled = true;
    requestAnimationFrame(() => {
      rafState.scheduled = false;
      // clear
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      const items = list.querySelectorAll('.timeline-item');
      const svgRect = container.getBoundingClientRect();
      items.forEach(item => {
        const dot = item.querySelector('.timeline-dot');
        const content = item.querySelector('.timeline-content');
        if (!dot || !content) return;
        const dRect = dot.getBoundingClientRect();
        const cRect = content.getBoundingClientRect();
        const startX = dRect.left + dRect.width/2 - svgRect.left;
        const startY = dRect.top + dRect.height/2 - svgRect.top;
        // pick target point on content nearest the rope side
        let endX, endY;
        if (cRect.left < svgRect.left + svgRect.width/2) {
          // content is on left side => connect to its right edge
          endX = cRect.left + cRect.width - svgRect.left;
        } else {
          // content on right side => connect to its left edge
          endX = cRect.left - svgRect.left;
        }
        endY = cRect.top + cRect.height/2 - svgRect.top;
        const path = document.createElementNS('http://www.w3.org/2000/svg','path');
        const dx = Math.abs(endX - startX);
        const cp1x = startX + dx*0.35;
        const cp2x = endX - dx*0.35;
        const d = `M ${startX} ${startY} C ${cp1x} ${startY} ${cp2x} ${endY} ${endX} ${endY}`;
        path.setAttribute('d', d);
        path.setAttribute('stroke', 'rgba(152,232,205,0.18)');
        path.setAttribute('stroke-width','2');
        path.setAttribute('fill','none');
        path.setAttribute('stroke-linecap','round');
        svg.appendChild(path);
      });
    });
  }

  // reveal on scroll
  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add('in-view');
        // sparkle on dot when it appears
        const dot = en.target.querySelector('.timeline-dot');
        if (dot) emitDotSparkle(dot);
      }
    });
  }, { threshold: 0.12 });

  list.querySelectorAll('.timeline-item').forEach(it => io.observe(it));

  // initial draw
  drawConnectors();

  // keep connectors updated on resize and scroll
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(drawConnectors, 120); });
  window.addEventListener('scroll', drawConnectors, { passive: true });

  // drag
  enableCardDrag(list, drawConnectors);
}

function emitDotSparkle(dot) {
  if (PREFERS_REDUCED) return;
  const burst = document.createElement('div');
  burst.className = 'sparkle-burst';
  dot.appendChild(burst);
  const count = 8;
  for (let i=0;i<count;i++){
    const s = document.createElement('div');
    s.className = 'spark';
    const angle = (Math.PI*2)*(i/count);
    const r = 18 + Math.random()*8;
    s.style.left = '50%';
    s.style.top = '50%';
    burst.appendChild(s);
    // animate
    const tx = Math.cos(angle)*r + (Math.random()*6-3);
    const ty = Math.sin(angle)*r + (Math.random()*6-3);
    s.animate([
      { transform: 'translate(-50%,-50%) scale(0.2)', opacity: 1 },
      { transform: `translate(${tx}px,${ty}px) scale(0.8)`, opacity: 0 }
    ], { duration: 700 + Math.random()*300, easing: 'cubic-bezier(.2,.9,.2,1)' });
  }
  setTimeout(()=>{ if (burst && burst.parentNode) burst.parentNode.removeChild(burst); }, 1200);
}

function enableCardDrag(list, onUpdate) {
  // limit radius
  const R = 120;
  const items = list.querySelectorAll('.timeline-content');
  items.forEach(item => {
    let pos = { x:0, y:0 };
    interact(item).draggable({
      listeners: {
        start() {
          item.style.willChange = 'transform';
        },
        move (evt) {
          pos.x += evt.dx; pos.y += evt.dy;
          // clamp to circle
          const d = Math.hypot(pos.x, pos.y);
          if (d > R) {
            pos.x = pos.x / d * R; pos.y = pos.y / d * R;
          }
          item.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
          onUpdate();
        },
        end() {
          // snap back
          anime.remove(item);
          anime({ targets: item, translateX: 0, translateY: 0, duration: 900, elasticity: 600, easing: 'easeOutElastic(1, .6)' });
          pos.x = 0; pos.y = 0;
          // ensure connectors redraw after animation completes
          setTimeout(onUpdate, 920);
        }
      }
    });
  });
}

// init on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('credentials-root');
  if (!root) return;
  renderTimeline(root, CREDENTIALS_SECTION);
});
