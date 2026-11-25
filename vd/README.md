# VaqtDost 2.0
O'quvchilar uchun dars jadvali va vazifa rejalashtiruvchi veb-ilova (Hakmun Academy).

- `public/index.html` — butun ilova (dizayn + mantiq)
- `functions/api/[fn].js` — sinflar API'si (Cloudflare Pages Function)
- `wrangler.toml` — D1 baza (`DB`) ulanishi
- `schema.sql` — baza jadvali (bazada allaqachon yaratilgan)

Joylash: Cloudflare Pages → GitHub repozitoriyni ulash. Build command bo'sh, output directory `public`.
