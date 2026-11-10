// Mobile navigation
const toggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('site-nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.classList.toggle('open', open);
  });
}

// Cookie consent for Google Analytics (opt-in, matching the previous site)
const banner = document.querySelector('.cookie-banner');
const pill = document.querySelector('.cookie-pill');
const choice = localStorage.getItem('as-cookies');
const showBanner = (show) => {
  banner.hidden = !show;
  pill.hidden = show;
};
if (banner && pill) {
  showBanner(!choice);
  banner.addEventListener('click', (event) => {
    const value = event.target.closest('[data-cookies]')?.dataset.cookies;
    if (!value) return;
    localStorage.setItem('as-cookies', value);
    const state = value === 'accepted' ? 'granted' : 'denied';
    gtag('consent', 'update', { analytics_storage: state, ad_storage: state, ad_user_data: state, ad_personalization: state });
    showBanner(false);
  });
  pill.addEventListener('click', () => showBanner(true));
}

const quoteForm = document.querySelector('form.quote-form');
if (quoteForm) {
  const button = quoteForm.querySelector('.qf-submit');
  const status = quoteForm.querySelector('[role="status"]');
  button.disabled = false;
  quoteForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    button.disabled = true;
    status.textContent = 'Sending your enquiry...';
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(quoteForm))),
      });
      if (!response.ok) throw new Error('Enquiry could not be sent');
      quoteForm.reset();
      status.textContent = 'Your enquiry has been sent to Jake. You can send photos by email or WhatsApp.';
      if (typeof gtag === 'function') {
        try { gtag('event', 'conversion', { send_to: 'AW-16467941872/cqdSCOqa_qwdEPCzw6w9' }); } catch (error) { console.error('Enquiry tracking failed', error); }
      }
    } catch (error) {
      console.error('Contact enquiry failed', error);
      status.textContent = 'We could not send your enquiry. Please email jake@auto-shine.co.uk or contact Jake on WhatsApp.';
    } finally {
      button.disabled = false;
    }
  });
}

// Count a tap on any WhatsApp link as an enquiry (Google Ads + Google Analytics).
// The "Message Jake" button shown after a completed booking is skipped: that customer is already counted as a booking.
document.addEventListener('click', (event) => {
  const link = event.target.closest && event.target.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"], a[href*="whatsapp.com/send"]');
  if (!link || link.closest('#s-done') || typeof gtag !== 'function') return;
  try {
    gtag('event', 'conversion', { send_to: 'AW-16467941872/cqdSCOqa_qwdEPCzw6w9' });
    gtag('event', 'whatsapp_click', { link_location: location.pathname });
  } catch (e) { /* tracking must never block the link */ }
});

// Homepage: show the next free date (hidden if unavailable, far away, or the request fails).
(() => {
  const strip = document.getElementById('next-available');
  if (!strip || !window.fetch) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  fetch('/api/next-available', { signal: controller.signal })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data || !data.available || !data.label) return;
      document.getElementById('next-available-day').textContent = data.label;
      strip.hidden = false;
      strip.addEventListener('click', () => {
        try { gtag('event', 'next_available_click', { days_away: data.daysAway }); } catch (e) { /* ignore */ }
      });
    })
    .catch(() => {})
    .finally(() => clearTimeout(timer));
})();
