/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  webpack: (config, { isServer }) => {
    // Disable file system caching on Windows to prevent stale cache issues
    if (process.platform === 'win32') {
      config.cache = {
        type: 'memory',
      };
    }

    return config;
  },
}

module.exports = nextConfig
