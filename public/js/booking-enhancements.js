(() => {
  const NOTICE = 'Prices marked “from” are estimates. We’ll confirm the final price during booking confirmation; photos or an inspection may be needed.';
  let defaultServiceChangeSent = false;

  function dispatchServiceChange(input) {
    if (!input || input.type !== 'radio' || input.name !== 'service') return;
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // The page builds service radio buttons dynamically. Delegate clicks so clicks
  // on the card/label as well as the hidden radio always update the app's state
  // and invoke selectService(), which loads the availability calendar.
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const card = target.closest('#services label, #services-solo label');
    const input = target.matches('input[name="service"]')
      ? target
      : card?.querySelector('input[name="service"]');
    if (input) dispatchServiceChange(input);
  }, true);

  function enhance() {
    const section = document.getElementById('s-service');
    const main = document.getElementById('services');
    const solo = document.getElementById('services-solo');
    if (main && solo) {
      for (const code of ['ENGINE', 'HL', 'HLUV']) {
        const input = main.querySelector(`input[name="service"][value="${code}"]`);
        const card = input && input.closest('label');
        if (card && !solo.contains(card)) solo.appendChild(card);
      }

      // Auto-start the availability request once the async service menu has rendered.
      if (!defaultServiceChangeSent) {
        const target = main.querySelector('input[name="service"]:checked')
          || main.querySelector('input[name="service"]')
          || solo.querySelector('input[name="service"]:checked')
          || solo.querySelector('input[name="service"]');
        if (target) {
          defaultServiceChangeSent = true;
          dispatchServiceChange(target);
        }
      }
    }

    if (section && !section.querySelector('[data-pricing-notice]')) {
      const p = document.createElement('p');
      p.dataset.pricingNotice = 'true';
      p.className = 'muted';
      p.textContent = NOTICE;
      section.appendChild(p);
    }

    const done = document.getElementById('s-done');
    if (done && !done.hidden && done.childElementCount && !done.querySelector('[data-pricing-notice]')) {
      const p = document.createElement('p');
      p.dataset.pricingNotice = 'true';
      p.className = 'muted';
      p.textContent = NOTICE;
      done.appendChild(p);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance);
  else enhance();
  new MutationObserver(enhance).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden'],
  });
})();
