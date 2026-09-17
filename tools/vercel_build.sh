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
# trang QA so sánh splash art là đồ nội bộ, nằm trong /studio/ để đi chung gate
# STUDIO_BASIC_AUTH_* của middleware.js chứ không đứng trần ở gốc site.
[ -f showcase-v4-preview.html ] && cp showcase-v4-preview.html site/studio/showcase-v4-preview.html

if [ -d assets ]; then
  cp -r assets site/assets            # gói phát hành + bộ giọng mẫu
fi

echo "site/ có: $(ls site | tr '\n' ' ')"
