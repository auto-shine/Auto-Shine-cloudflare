(() => {
  const form = document.querySelector('[data-location-prices]');
  if (!form) return;
  const input = form.querySelector('input');
  const button = form.querySelector('button');
  const status = form.querySelector('[role="status"]');
  const prices = document.querySelectorAll('[data-service-price]');
  button.disabled = false;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    button.disabled = true;
    status.textContent = 'Checking prices...';
    for (const price of prices) price.textContent = 'Check your postcode';
    try {
      const url = `/api/quote?postcode=${encodeURIComponent(input.value.trim())}&size=S`;
      const response = await fetch(url);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not check this postcode.');
      if (result.outOfArea) {
        status.textContent = 'This postcode is outside online booking. Please contact Jake for a travel quote.';
        return;
      }
      if (!result.menu) throw new Error('Prices are unavailable. Please try again or contact Jake.');
      for (const price of prices) {
        const service = result.menu[price.dataset.servicePrice];
        price.textContent = service ? `From £${service.price}` : 'Contact Jake for a quote';
      }
      status.textContent = 'Starting prices for a small car. The final quote depends on vehicle size and condition.';
    } catch (error) {
      status.textContent = error.message || 'Prices are unavailable. Please try again or contact Jake.';
    } finally {
      button.disabled = false;
    }
  });
})();
