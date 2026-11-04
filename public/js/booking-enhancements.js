(() => {
  const noticeText = 'Prices shown as “from” are starting estimates. We’ll confirm your final price during booking confirmation; photos or an inspection may be needed.';

  function enhance() {
    const serviceSection = document.getElementById('s-service');
    const solo = document.getElementById('services-solo');
    if (solo) {
      const uv = document.querySelector('#services input[name="service"][value="HLUV"]')?.closest('label');
      if (uv && !solo.contains(uv)) solo.appendChild(uv);
    }
    if (serviceSection && !serviceSection.querySelector('[data-pricing-notice]')) {
      const note = document.createElement('p');
      note.dataset.pricingNotice = 'true';
      note.className = 'muted';
      note.textContent = noticeText;
      serviceSection.appendChild(note);
    }

    const completed = document.getElementById('s-done');
    if (completed && !completed.hidden && completed.childElementCount && !completed.querySelector('[data-pricing-notice]')) {
      const notice = document.createElement('p');
      notice.dataset.pricingNotice = 'true';
      notice.className = 'muted';
      notice.textContent = noticeText;
      completed.appendChild(notice);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance);
  else enhance();
  const observer = new MutationObserver(enhance);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
})();
