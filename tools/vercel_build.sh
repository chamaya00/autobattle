#!/usr/bin/env bash
# Dựng thư mục "site/" để Vercel deploy — dùng CHUNG cho cả hai project
# (dev nội bộ + prod công khai). Nội dung hai project GIỐNG HỆT nhau; khác
# nhau ở cấu hình project trên Vercel Dashboard (production branch + Deployment
# Protection), không phải ở script này. Xem docs/deploy-vercel.md.
#
# Ăn theo đúng logic của .github/workflows/pages.yml (bản GitHub Pages) để hai
# đường triển khai không lệch nhau.
set -euo pipefail
cd "$(dirname "$0")/.."

python3 tools/mk_play.py

rm -rf site
mkdir -p site/studio
cp play.html site/index.html          # trang chơi (công khai) nằm ở gốc
cp index.html site/studio/index.html  # trang xưởng nằm trong /studio/

if [ -d assets ]; then
  cp -r assets site/assets            # gói phát hành + bộ giọng mẫu
fi

echo "site/ có: $(ls site | tr '\n' ' ')"
