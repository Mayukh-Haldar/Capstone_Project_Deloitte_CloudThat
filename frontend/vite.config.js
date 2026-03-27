import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const proxyTargets = {
  auth: process.env.VITE_AUTH_SERVICE_URL || "http://localhost:8081",
  venueVendor: process.env.VITE_VENUE_VENDOR_SERVICE_URL || "http://localhost:8083",
  event: process.env.VITE_EVENT_SERVICE_URL || "http://localhost:8082",
  ticketing: process.env.VITE_TICKETING_SERVICE_URL || "http://localhost:8084",
  finance: process.env.VITE_FINANCE_SERVICE_URL || "http://localhost:8085",
  notification: process.env.VITE_NOTIFICATION_SERVICE_URL || "http://localhost:8086"
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api/v1/auth": { target: proxyTargets.auth, changeOrigin: true },
      "/api/v1/account-requests": { target: proxyTargets.auth, changeOrigin: true },
      "/api/v1/users": { target: proxyTargets.auth, changeOrigin: true },
      "/api/v1/categories": { target: proxyTargets.event, changeOrigin: true },
      "/api/v1/events": { target: proxyTargets.event, changeOrigin: true },
      "/api/v1/venues": { target: proxyTargets.venueVendor, changeOrigin: true },
      "/api/v1/vendors": { target: proxyTargets.venueVendor, changeOrigin: true },
      "/api/v1/contracts": { target: proxyTargets.venueVendor, changeOrigin: true },
      "/api/v1/registrations": { target: proxyTargets.ticketing, changeOrigin: true },
      "/api/v1/tickets": { target: proxyTargets.ticketing, changeOrigin: true },
      "/api/v1/checkin": { target: proxyTargets.ticketing, changeOrigin: true },
      "/api/v1/ticket-types": { target: proxyTargets.ticketing, changeOrigin: true },
      "/api/v1/attendees": { target: proxyTargets.ticketing, changeOrigin: true },
      "/api/v1/payments": { target: proxyTargets.finance, changeOrigin: true },
      "/api/v1/expenses": { target: proxyTargets.finance, changeOrigin: true },
      "/api/v1/budgets": { target: proxyTargets.finance, changeOrigin: true },
      "/api/v1/notifications": { target: proxyTargets.notification, changeOrigin: true },
      "/socket.io": { target: proxyTargets.notification, changeOrigin: true, ws: true }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) return "react-core";
          if (id.includes("react-router")) return "router";
          if (id.includes("recharts")) return "charts";
          if (id.includes("/firebase/") || id.includes("/@firebase/")) return "firebase";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("react-hook-form")) return "forms";
          if (id.includes("jspdf")) return "pdf";
          if (id.includes("html2canvas")) return "canvas";
          if (id.includes("jsqr")) return "qr";
          if (id.includes("next-themes") || id.includes("sonner")) return "ux";
          if (id.includes("date-fns")) return "dates";
          if (id.includes("clsx") || id.includes("tailwind-merge") || id.includes("class-variance-authority") || id.includes("tw-animate-css")) return "styling";
          if (id.includes("@mui")) return "mui";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("react-dnd")) return "dnd";
          if (id.includes("react-resizable-panels")) return "panels";
          if (id.includes("lucide-react")) return "icons";
          return "vendor";
        },
      },
    },
  },
  assetsInclude: ["**/*.svg", "**/*.csv"],
});
