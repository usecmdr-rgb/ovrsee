/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  eslint: {
    // Don't fail build on ESLint warnings/errors during production builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Don't fail build on TypeScript errors during production builds
    ignoreBuildErrors: false,
  },
  async redirects() {
    return [
      // Redirect old agent route names to new canonical routes (top-level)
      // Legacy routes: alpha, beta, mu, xi → New routes: aloha, insight, studio, sync
      {
        source: "/alpha",
        destination: "/aloha",
        permanent: true,
      },
      {
        source: "/app/alpha",
        destination: "/aloha",
        permanent: true,
      },
      {
        source: "/beta",
        destination: "/insight",
        permanent: true,
      },
      {
        source: "/app/beta",
        destination: "/insight",
        permanent: true,
      },
      {
        source: "/mu",
        destination: "/studio",
        permanent: true,
      },
      {
        source: "/app/mu",
        destination: "/studio",
        permanent: true,
      },
      {
        source: "/xi",
        destination: "/sync",
        permanent: true,
      },
      {
        source: "/app/xi",
        destination: "/sync",
        permanent: true,
      },
      // Redirect duplicate /app/* agent routes to top-level canonical routes
      {
        source: "/app/aloha",
        destination: "/aloha",
        permanent: true,
      },
      {
        source: "/app/insight",
        destination: "/insight",
        permanent: true,
      },
      {
        source: "/app/studio",
        destination: "/studio",
        permanent: true,
      },
      {
        source: "/app/sync",
        destination: "/sync",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
