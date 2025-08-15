/** @type {import('next').NextConfig} */
import path from 'path'
import CopyPlugin from 'copy-webpack-plugin'
// import webpack from 'webpack'
// const { NormalModuleReplacementPlugin } = webpack

const nextConfig = {
  // TensorFlow.js Node.js를 위한 서버 외부 패키지 설정
  serverExternalPackages: [
    '@tensorflow/tfjs-node',
    'pdfjs-dist',
    'tesseract.js',
  ],
}

export default nextConfig
