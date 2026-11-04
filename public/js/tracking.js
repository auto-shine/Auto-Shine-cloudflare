// Shared Google Analytics, Google Ads, and conversion tracking injected into HTML responses.
(() => {
  const GA4_ID = 'G-HN05H8ETGP';
  const ADS_ID = 'AW-16467941872';

  // Existing page-level gtag snippets already initialize and configure Google tags.
  // Initialize only on pages that don't already provide gtag to avoid double page views.
  if (typeof window.gtag !== 'function') {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };

    let consent = 'denied';
    try {
      if (localStorage.getItem('as-cookies') === 'accepted') consent = 'granted';
    } catch (error) {
      // Keep the default denied state when storage is unavailable.
    }

    window.gtag('consent', 'default', {
      analytics_storage: consent,
      ad_storage: consent,
      ad_user_data: consent,
      ad_personalization: consent,
    });
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID);
    window.gtag('config', ADS_ID);

    const tag = document.createElement('script');
    tag.async = true;
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
    document.head.appendChild(tag);
  }

  // site.js already delegates WhatsApp tracking on the main site pages.
  // Add the supplied link listener on standalone pages without that shared script.
  const hasSiteTracking = document.querySelector('script[src="/js/site.js"]');
  if (!hasSiteTracking) {
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('a[href*="wa.me"], a[href*="api.whatsapp.com"], a[href*="whatsapp"]').forEach((link) => {
        link.addEventListener('click', () => {
          window.gtag('event', 'whatsapp_click', {
            event_category: 'Contact',
            event_label: 'WhatsApp Click',
            value: 1,
          });
          window.gtag('event', 'conversion', {
            send_to: `${ADS_ID}/cqdSCOqa_qwdEPCzw6w9`,
          });
        });
      });
    });
  }

  const path = window.location.pathname;
  const isBookingPage = /\/book(?:\.html)?\/?$/.test(path);
  const isThankYouPage = /\/thank-you(?:\.html)?\/?$/.test(path);

  if (isThankYouPage) {
    // This legacy thank-you page already had a placeholder conversion label;
    // send the configured booking conversion and GA4 lead event instead.
    document.addEventListener('DOMContentLoaded', () => {
      window.gtag('event', 'conversion', {
        send_to: `${ADS_ID}/Gn9vCNHG36wdEPCzw6w9`,
        value: 1.0,
        currency: 'GBP',
      });
      window.gtag('event', 'generate_lead', {
        event_category: 'Booking',
        event_label: 'Online Booking Completed',
      });
    });
  } else if (isBookingPage) {
    // book.html already sends the Ads conversion only after the booking API
    // confirms success. Add the GA4 lead event at that same success point.
    const completedBooking = document.getElementById('s-done');
    if (completedBooking) {
      const reportLead = () => {
        if (!completedBooking.hidden && completedBooking.childElementCount > 0) {
          window.gtag('event', 'generate_lead', {
            event_category: 'Booking',
            event_label: 'Online Booking Completed',
          });
          observer.disconnect();
        }
      };
      const observer = new MutationObserver(reportLead);
      observer.observe(completedBooking, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
      reportLead();
    }
  }
})();
