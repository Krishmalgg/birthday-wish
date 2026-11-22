/** @type {import('next').NextConfig} */
const nextConfig = {
  // hide the floating "N" dev badge so screenshots look like the real page
  devIndicators: false,
  /**
   * Next blocks dev-server assets (/_next/*) when the page is opened from an
   * origin other than localhost — which is exactly what breaks opening
   * http://192.168.1.247:3000 from a phone. Listing the LAN origins here fixes it.
   * Add your own machine's IP if it isn't covered.
   */
  allowedDevOrigins: [
    "192.168.1.247",
    "192.168.0.*",
    "192.168.1.*",
    "192.168.8.*",
    "10.0.0.*",
    "10.1.1.*",
    "172.20.10.*",
    "*.local",
  ],
};

export default nextConfig;
