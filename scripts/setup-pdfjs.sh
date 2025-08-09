rm -rf public/pdfjs-dist
mkdir -p public/pdfjs-dist
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdfjs-dist/

# cmaps 디렉토리 복사
rm -rf public/cmaps
mkdir -p public/cmaps
cp -R node_modules/pdfjs-dist/cmaps/* public/cmaps/