# Ibodat — qo'llab-quvvatlash boti

Oddiy Telegram bot: "Loyiha haqida" va "Qo'llab-quvvatlash" (Click/Payme QR + karta raqami) bo'limlari bilan. Hech qanday to'lov API integratsiyasi yo'q — faqat QR-kodlar va matnlar ko'rsatiladi.

## Ishga tushirish

1. Python 3.10+ o'rnatilgan bo'lishi kerak.
2. Kutubxonalarni o'rnating:
   ```
   pip install -r requirements.txt
   ```
3. `.env.example` faylidan nusxa oling va `.env` deb nomlang:
   ```
   cp .env.example .env
   ```
4. `.env` faylini to'ldiring:
   - `BOT_TOKEN` — @BotFather'ga yozib, botingiz uchun oldingiz token (agar bot allaqachon yaratilgan bo'lsa, @BotFather → /mybots → botingiz → API Token orqali qayta ko'rish mumkin).
   - `CARD_NUMBER`, `CARD_HOLDER` — karta orqali homiylik uchun (QR tayyor bo'lgunicha zaxira variant).
   - `CLICK_LINK`, `PAYME_LINK` — ixtiyoriy, agar to'lov havolangiz bo'lsa.
5. Botni ishga tushiring:
   ```
   python bot.py
   ```

Bot polling rejimida ishlaydi — alohida server yoki domen shart emas, kompyuteringiz yoki istalgan oddiy VPS'da ishga tushirish yetarli (dastur ishlab turgan vaqtda bot javob beradi).

## QR-kodlarni qo'shish

Click Business / Payme Business kabinetidan QR-kodni PNG formatida yuklab oling va shu nomlar bilan `assets/` papkasiga joylashtiring:

- `assets/qr_click.png`
- `assets/qr_payme.png`

Kod o'zgartirish shart emas — fayl mavjud bo'lsa, bot avtomatik ravishda uni rasm sifatida yuboradi; fayl hali yo'q bo'lsa, shunchaki "QR hali qo'shilmagan" matnini ko'rsatadi.

## Matnlarni tahrirlash

`bot.py` faylida `ABOUT_TEXT` va `SUPPORT_INTRO` o'zgaruvchilarini o'zingizning aniq matningiz bilan almashtiring — hozircha ular namunaviy (`TODO` bilan belgilangan).
