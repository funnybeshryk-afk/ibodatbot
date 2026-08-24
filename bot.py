import asyncio
import logging
import os

from aiogram import Bot, Dispatcher, Router, F
from aiogram.client.default import DefaultBotProperties
from aiogram.filters import CommandStart
from aiogram.types import CallbackQuery, FSInputFile, Message
from aiogram.utils.keyboard import InlineKeyboardBuilder
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "")

# TODO: shu yerga o'z ma'lumotlaringizni kiriting (yoki .env faylida to'ldiring)
CARD_NUMBER = os.getenv("CARD_NUMBER", "0000 0000 0000 0000")
CARD_HOLDER = os.getenv("CARD_HOLDER", "F.I.SH.")
CLICK_LINK = os.getenv("CLICK_LINK", "")   # Click kassangizdagi to'lov havolasi (bo'lsa)
PAYME_LINK = os.getenv("PAYME_LINK", "")   # Payme kassangizdagi to'lov havolasi (bo'lsa)

# QR-kodlar tayyor bo'lganda shu papkaga shu nomlar bilan qo'shing — kod o'zgartirish shart emas
QR_CLICK_PATH = "assets/qr_click.png"
QR_PAYME_PATH = "assets/qr_payme.png"

# TODO: loyihangiz haqida qisqacha, aniq matn yozing
ABOUT_TEXT = (
    "📖 <b>Ilova haqida</b>\n\n"
    "Ushbu ilova — kundalik ibodat va diniy ehtiyojlar uchun mo'ljallangan bepul dastur "
    "(bu yerga ilovaning asosiy funksiyalari haqida 2-3 gap yozing: namoz vaqtlari, azon, "
    "Qur'on va h.k.).\n\n"
    "Ilova to'liq bepul va reklamasiz ishlaydi. Serverlar, yangilanishlar va rivojlantirish "
    "uchun xarajatlar mavjud, shu sababli loyihani ixtiyoriy homiylik orqali qo'llab-quvvatlashingiz mumkin."
)

SUPPORT_INTRO = (
    "🤲 <b>Ibodatni qo'llab-quvvatlash</b>\n\n"
    "Loyihani rivojlantirishda yordam bermoqchi bo'lsangiz, quyidagi usullardan birini tanlang. "
    "Bu — to'liq ixtiyoriy homiylik, hech qanday majburiyat yo'q."
)

CARD_TEXT_TEMPLATE = (
    "🔢 <b>Karta orqali</b>\n\n"
    "Karta raqami: <code>{card}</code>\n"
    "Karta egasi: {holder}\n\n"
    "Istalgan bank ilovasi (Humo, Uzcard, Payme, Click) orqali shu raqamga o'tkazma qilishingiz mumkin."
)

router = Router()


def main_menu_kb():
    kb = InlineKeyboardBuilder()
    kb.button(text="📖 Loyiha haqida", callback_data="about")
    kb.button(text="🤲 Qo'llab-quvvatlash", callback_data="support")
    kb.adjust(1)
    return kb.as_markup()


def about_kb():
    kb = InlineKeyboardBuilder()
    kb.button(text="⬅️ Orqaga", callback_data="back_main")
    kb.adjust(1)
    return kb.as_markup()


def support_menu_kb():
    kb = InlineKeyboardBuilder()
    kb.button(text="💳 Click orqali", callback_data="pay_click")
    kb.button(text="💳 Payme orqali", callback_data="pay_payme")
    kb.button(text="🔢 Karta raqami", callback_data="pay_card")
    kb.button(text="⬅️ Orqaga", callback_data="back_main")
    kb.adjust(1)
    return kb.as_markup()


def back_to_support_kb():
    kb = InlineKeyboardBuilder()
    kb.button(text="⬅️ Orqaga", callback_data="support")
    kb.adjust(1)
    return kb.as_markup()


@router.message(CommandStart())
async def cmd_start(message: Message):
    await message.answer(
        f"Assalomu alaykum, {message.from_user.first_name}!\n\n"
        "Botga xush kelibsiz. Quyidagi bo'limlardan birini tanlang:",
        reply_markup=main_menu_kb(),
    )


@router.callback_query(F.data == "about")
async def cb_about(callback: CallbackQuery):
    await callback.message.edit_text(ABOUT_TEXT, reply_markup=about_kb())
    await callback.answer()


@router.callback_query(F.data == "back_main")
async def cb_back_main(callback: CallbackQuery):
    await callback.message.edit_text(
        "Quyidagi bo'limlardan birini tanlang:",
        reply_markup=main_menu_kb(),
    )
    await callback.answer()


@router.callback_query(F.data == "support")
async def cb_support(callback: CallbackQuery):
    await callback.message.edit_text(SUPPORT_INTRO, reply_markup=support_menu_kb())
    await callback.answer()


@router.callback_query(F.data == "pay_click")
async def cb_pay_click(callback: CallbackQuery):
    link_line = f"\n\nHavola: {CLICK_LINK}" if CLICK_LINK else ""
    text = "💳 <b>Click orqali homiylik</b>\n\nQR kodni skanerlang." + link_line

    if os.path.exists(QR_CLICK_PATH):
        await callback.message.answer_photo(
            FSInputFile(QR_CLICK_PATH), caption=text, reply_markup=back_to_support_kb()
        )
        await callback.message.delete()
    else:
        await callback.message.edit_text(
            text + "\n\n(QR kod hali qo'shilmagan — assets/qr_click.png fayliga joylashtiring)",
            reply_markup=back_to_support_kb(),
        )
    await callback.answer()


@router.callback_query(F.data == "pay_payme")
async def cb_pay_payme(callback: CallbackQuery):
    link_line = f"\n\nHavola: {PAYME_LINK}" if PAYME_LINK else ""
    text = "💳 <b>Payme orqali homiylik</b>\n\nQR kodni skanerlang." + link_line

    if os.path.exists(QR_PAYME_PATH):
        await callback.message.answer_photo(
            FSInputFile(QR_PAYME_PATH), caption=text, reply_markup=back_to_support_kb()
        )
        await callback.message.delete()
    else:
        await callback.message.edit_text(
            text + "\n\n(QR kod hali qo'shilmagan — assets/qr_payme.png fayliga joylashtiring)",
            reply_markup=back_to_support_kb(),
        )
    await callback.answer()


@router.callback_query(F.data == "pay_card")
async def cb_pay_card(callback: CallbackQuery):
    text = CARD_TEXT_TEMPLATE.format(card=CARD_NUMBER, holder=CARD_HOLDER)
    await callback.message.edit_text(text, reply_markup=back_to_support_kb())
    await callback.answer()


async def main():
    logging.basicConfig(level=logging.INFO)

    if not BOT_TOKEN:
        raise RuntimeError(
            "BOT_TOKEN topilmadi. .env faylida BOT_TOKEN=... qatorini to'ldiring "
            "(tokenni @BotFather dan olasiz)."
        )

    bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode="HTML"))
    dp = Dispatcher()
    dp.include_router(router)

    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
