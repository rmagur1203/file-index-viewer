/** @type {import('next').NextConfig} */
import path from 'path'
// import webpack from 'webpack'
// const { NormalModuleReplacementPlugin } = webpack

const nextConfig = {
  // TensorFlow.js Node.js를 위한 서버 외부 패키지 설정
  serverExternalPackages: [
    '@tensorflow/tfjs-node',
    'pdfjs-dist',
    'tesseract.js',
  ],
  // 외부 이미지 소스 허용 설정
  images: {
    remotePatterns: [
      // 로컬 개발 환경 (HTTP)
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3001',
        pathname: '/api/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '3001',
        pathname: '/api/**',
      },
      // 프로덕션 환경 (HTTPS)
      {
        protocol: 'https',
        hostname: 'localhost',
        port: '3001',
        pathname: '/api/**',
      },
      // 기타 포트들 (유연성을 위해)
      {
        protocol: 'http',
        hostname: 'localhost',
        pathname: '/api/**',
      },
      {
        protocol: 'https',
        hostname: 'localhost',
        pathname: '/api/**',
      },
      // API 서버 URL
      {
        protocol: 'http',
        hostname: new URL(process.env.NEXT_PUBLIC_API_URL).hostname,
        pathname: '/api/**',
      },
      {
        protocol: 'https',
        hostname: new URL(process.env.NEXT_PUBLIC_API_URL).hostname,
        pathname: '/api/**',
      },
    ],
  },
}

export default nextConfig
