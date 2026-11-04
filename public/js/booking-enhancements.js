(() => {
  const NOTICE = 'Prices marked “from” are estimates. We’ll confirm the final price during booking confirmation; photos or an inspection may be needed.';
  let defaultServiceChangeSent = false;

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

      // The service radios are rendered dynamically after the menu API returns.
      // A checked radio by itself does not update the booking app's private state;
      // always dispatch one change event so selectService() loads availability.
      if (!defaultServiceChangeSent) {
        const target = main.querySelector('input[name="service"]:checked')
          || main.querySelector('input[name="service"]')
          || solo.querySelector('input[name="service"]:checked')
          || solo.querySelector('input[name="service"]');
        if (target) {
          defaultServiceChangeSent = true;
          target.checked = true;
          target.dispatchEvent(new Event('change', { bubbles: true }));
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
