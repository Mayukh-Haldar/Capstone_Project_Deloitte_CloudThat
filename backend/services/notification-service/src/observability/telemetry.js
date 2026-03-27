const { NodeSDK } = require("@opentelemetry/sdk-node");
const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http");

const startTelemetry = (serviceName) => {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    return { shutdown: async () => {} };
  }

  const sdk = new NodeSDK({
    serviceName,
    traceExporter: new OTLPTraceExporter({ url: endpoint }),
    instrumentations: [getNodeAutoInstrumentations()]
  });

  sdk.start();

  return {
    shutdown: async () => {
      await sdk.shutdown();
    }
  };
};

module.exports = { startTelemetry };
