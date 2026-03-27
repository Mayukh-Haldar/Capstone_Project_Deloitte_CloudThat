const Handlebars = require("handlebars");

const renderer = Handlebars.create();

renderer.registerHelper("uppercase", (value) => String(value || "").toUpperCase());

const compileTemplate = (content) => renderer.compile(content || "");

const renderTemplate = (template, variables) => {
  const subject = compileTemplate(template.subject)(variables);
  const body = compileTemplate(template.body)(variables);
  const html = template.html ? compileTemplate(template.html)(variables) : null;

  return {
    subject,
    body,
    html
  };
};

module.exports = { renderTemplate };
