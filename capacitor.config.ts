import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.restaurant.ops",
  appName: "Restaurant Ops",
  webDir: "dist/public",
  server: {
    androidScheme: "https",
  },
};

export default config;
