declare module 'pdfjs-dist' {
  import pdfjs from 'pdfjs-dist'
  export = pdfjs
}

declare module 'pdfjs-dist/webpack' {
  import pdfjs from 'pdfjs-dist'
  export = pdfjs
}

declare module 'pdfjs-dist/legacy/build/pdf' {
  const pdfjs: any
  export default pdfjs
}
