const env = require("../config/env");
const { NotificationTemplate } = require("../models/NotificationTemplate");
const { templates } = require("./defaultTemplates");

const seedDefaultTemplates = async () => {
  if (!env.seedDefaultTemplates) {
    return;
  }

  for (const template of templates) {
    const existing = await NotificationTemplate.findOne({ templateKey: template.templateKey });
    if (existing) {
      continue;
    }

    await NotificationTemplate.create({
      ...template,
      versions: [
        {
          version: 1,
          subject: template.subject,
          body: template.body,
          html: template.html || null,
          variables: template.variables || [],
          updatedBy: "seed"
        }
      ]
    });
  }
};

module.exports = { seedDefaultTemplates };
