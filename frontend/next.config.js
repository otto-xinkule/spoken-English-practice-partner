/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/:path*",
      },
    ];
  },
  webpack: (config) => {
    // 避免 onnxruntime-web 的 Node.js 文件被 Webpack 打包（Terser 无法处理 .mjs with import）
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: "javascript/auto",
    });
    return config;
  },
};
module.exports = nextConfig;
