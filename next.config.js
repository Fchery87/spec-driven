/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    config.snapshot = {
      ...config.snapshot,
      managedPaths: undefined,
      buildDependencies: {
        timestamp: true,
        hash: true,
      },
    };

    // Disable file system caching on Windows to prevent stale cache issues
    if (process.platform === 'win32') {
      config.cache = {
        type: 'memory',
      };
    }

    return config;
  },
  experimental: {
    turbo: {
      enabled: false,
    },
  },
}

module.exports = nextConfig