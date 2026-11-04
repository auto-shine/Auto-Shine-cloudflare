(() => {
  const NOTICE = 'Prices marked “from” are estimates. We’ll confirm the final price during booking confirmation; photos or an inspection may be needed.';
  const qs = (selector) => document.querySelector(selector);

  function enhance() {
    const serviceSection = document.getElementById('s-service');
    const mainServices = document.getElementById('services');
    const soloServices = document.getElementById('services-solo');
    if (mainServices && soloServices) {
      for (const code of ['ENGINE', 'HL', 'HLUV']) {
        const input = mainServices.querySelector(`input[name="service"][value="${code}"]`);
        const card = input && input.closest('label');
        if (card && !soloServices.contains(card)) soloServices.appendChild(card);
      }
      if (!mainServices.querySelector('input[name="service"]:checked')) {
        const firstService = mainServices.querySelector('input[name="service"]');
        if (firstService) {
          firstService.checked = true;
          firstService.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }
    if (serviceSection && !serviceSection.querySelector('[data-pricing-notice]')) {
      const note = document.createElement('p');
      note.dataset.pricingNotice = 'true';
      note.className = 'muted';
      note.textContent = NOTICE;
      serviceSection.appendChild(note);
    }
    const completed = document.getElementById('s-done');
    if (completed && !completed.hidden && completed.childElementCount && !completed.querySelector('[data-pricing-notice]')) {
      const note = document.createElement('p');
      note.dataset.pricingNotice = 'true';
      note.className = 'muted';
      note.textContent = NOTICE;
      completed.appendChild(note);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance);
  else enhance();
  new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
})();
