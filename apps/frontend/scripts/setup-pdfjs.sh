#!/bin/bash

cd temp
curl $(npm view pdfjs-dist@5.3.93 dist.tarball) -o pdfjs-dist.tar.gz
tar -xzf pdfjs-dist.tar.gz
mv package pdfjs-dist
cd ..

rm -rf public/pdfjs-dist
mkdir -p public/pdfjs-dist
cp temp/pdfjs-dist/build/pdf.worker.min.mjs public/pdfjs-dist/

# cmaps 디렉토리 복사
rm -rf public/cmaps
mkdir -p public/cmaps
cp -R temp/pdfjs-dist/cmaps/* public/cmaps/

rm -rf temp/pdfjs-dist