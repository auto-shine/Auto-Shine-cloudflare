export const onRequest: PagesFunction = async (context) => {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('text/html')) return response;

  const pathname = new URL(context.request.url).pathname;
  const isBookingPage = /^\/book(?:\.html)?\/?$/.test(pathname);
  const rewriter = new HTMLRewriter().on('head', {
    element(element) {
      element.append('<script defer src="/js/tracking.js"></script>', { html: true });
      if (isBookingPage) element.append('<script defer src="/js/booking-enhancements.js"></script>', { html: true });
    },
  });

  return rewriter.transform(response);
};
