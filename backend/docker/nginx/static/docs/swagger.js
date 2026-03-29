(function bootstrapSwaggerUi() {
  const serviceName = document.querySelector('meta[name="service-name"]')?.content;
  const specUrl = document.querySelector('meta[name="spec-url"]')?.content;
  const pageTitle = document.querySelector('meta[name="page-title"]')?.content;
  if (pageTitle) {
    document.title = pageTitle;
    const titleNode = document.querySelector("[data-doc-title]");
    if (titleNode) titleNode.textContent = pageTitle;
  }
  const badge = document.querySelector("[data-service-name]");
  if (badge && serviceName) badge.textContent = serviceName;
  window.onload = function onLoad() {
    window.ui = window.SwaggerUIBundle({
      url: specUrl,
      dom_id: "#swagger-ui",
      deepLinking: true,
      presets: [window.SwaggerUIBundle.presets.apis, window.SwaggerUIStandalonePreset],
      layout: "StandaloneLayout",
      tryItOutEnabled: true,
      displayRequestDuration: true
    });
  };
})();
