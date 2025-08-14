/** @type {import('next').NextConfig} */
const nextConfig = {
  // TensorFlow.js Node.js를 위한 서버 외부 패키지 설정
  serverExternalPackages: ['@tensorflow/tfjs-node'],

  async headers() {
    return [
      {
        source: '/pdfjs-dist/:path*.mjs',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript',
          },
        ],
      },
    ]
  },
  webpack: (config, { isServer }) => {
    // TensorFlow.js 최적화
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
      os: false,
      child_process: false,
    }

    // TensorFlow.js 웹어셈블리 처리
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    })

    // @mapbox/node-pre-gyp HTML 파일 무시
    config.module.rules.push({
      test: /\.html$/,
      type: 'asset/resource',
      generator: {
        emit: false,
      },
    })

    // 네이티브 바인딩 파일들 무시
    config.module.rules.push({
      test: /\.(node|gyp)$/,
      type: 'asset/resource',
      generator: {
        emit: false,
      },
    })

    // TensorFlow.js Node.js 서버 측 외부화
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push({
        '@tensorflow/tfjs-node': 'commonjs @tensorflow/tfjs-node',
      })
    } else {
      // Node.js 전용 모듈 무시
      config.externals = {
        ...config.externals,
        '@tensorflow/tfjs-node': 'tf',
        'node-gyp': 'node-gyp',
        npm: 'npm',
      }
    }

    // @mapbox/node-pre-gyp 문제 해결을 위한 resolve alias
    config.resolve.alias = {
      ...config.resolve.alias,
      '@mapbox/node-pre-gyp/lib/util/nw-pre-gyp': false,
    }

    // pdf-parse 관련 오류 해결을 위한 웹팩 설정 추가
    config.module.rules.push({
      test: /\.html$/,
      use: 'ignore-loader',
    })

    // 특정 테스트 파일을 무시하도록 설정
    config.module.rules.push({
      test: /05-versions-space\.pdf$/,
      use: 'ignore-loader',
    })

    return config
  },
}

export default nextConfig
