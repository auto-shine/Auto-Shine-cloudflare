export const onRequest: PagesFunction = async (context) => {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('text/html')) return response;

  return new HTMLRewriter()
    .on('head', {
      element(element) {
        element.append('<script defer src="/js/tracking.js"></script>', { html: true });
      },
    })
    .transform(response);
};
