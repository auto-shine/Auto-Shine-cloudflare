document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('booking-form');
  const message = document.getElementById('form-message');

  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    message.textContent = 'Sending...';

    try {
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Booking failed');
      }

      message.textContent = 'Thanks. Your booking request has been sent.';
      form.reset();
    } catch (error) {
      message.textContent = error.message || 'Something went wrong.';
    }
  });
});
