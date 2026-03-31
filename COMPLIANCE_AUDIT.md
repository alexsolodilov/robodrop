# Аудит соответствия Trading Slots требованиям Stake Engine

> Дата: 2026-02-26
> Источник требований: STAKE_ENGINE_REFERENCE.md (https://stake-engine.com/docs)
> Основной компонент: `web-sdk/apps/trading/src/components/TradingSlots.svelte`

---

## КОНЦЕПЦИЯ: Слот-машина с трейдинговой тематикой

Игра — это **слот-машина**, где вместо символов на барабанах используются **свечные графики**:
- 5 "барабанов" (свечей) раскрываются последовательно
- Игрок выбирает LONG или SHORT (аналог выбора payline)
- Leverage = множитель ставки (аналог bet mode)
- Liquidation = нулевой payout (аналог проигрыша)
- Insider Mode = SUPER bet mode (25x cost)

### Вердикт по концепции: ✅ СОВМЕСТИМА

- **Stateless** — каждая ставка независима, один запрос к RGS = полный результат
- **Нет cashout** — игрок не может выйти досрочно
- **Нет continuation** — нет HOLD между раундами
- **Нет gamble feature** — LONG/SHORT это выбор до ставки, не gamble после выигрыша
- **Нет jackpots** — отсутствуют

**Возможный риск:** LONG/SHORT выбор — нестандартен для слотов. Рекомендуется уточнить с командой Stake Engine, что это приемлемо. Но формально правила не запрещают выбор направления до ставки.

---

## ДЕТАЛЬНЫЙ АУДИТ

### 1. GENERAL REQUIREMENTS

| # | Требование | Статус | Комментарий |
|---|---|---|---|
| 1 | Stateless (каждая ставка независима) | ✅ ОК | Один spin = один результат, нет зависимости между ставками |
| 2 | Нет jackpots | ✅ ОК | |
| 3 | Нет gamble features | ✅ ОК | LONG/SHORT — выбор до ставки, не gamble |
| 4 | Нет continuation | ✅ ОК | Нет HOLD между раундами |
| 5 | Нет early cashout | ✅ ОК | Нельзя выйти досрочно |
| 6 | IP/copyright compliance | ✅ ОК | Оригинальный дизайн |
| 7 | Оригинальные ассеты | ⚠️ ПРОВЕРИТЬ | Убедиться что не используются sample-ассеты SDK |
| 8 | Нет Stake™ брендинга | ✅ ОК | |
| 9 | Нет offensive контента | ✅ ОК | |
| 10 | Нет underage appeal | ✅ ОК | |
| 11 | Blurb для promotional material | ❌ НУЖНО | Короткое описание игры для Stake |

### 2. BET REPLAY (ОБЯЗАТЕЛЬНО)

| # | Требование | Статус |
|---|---|---|
| 1 | Поддержка replay mode | ❌ НЕ РЕАЛИЗОВАНО |
| 2 | Query параметры (replay, game, version, mode, event, rgs_url) | ❌ |
| 3 | Fetch GET {rgs_url}/bet/replay/{game}/{version}/{mode}/{event} | ❌ |
| 4 | Auto-load без взаимодействия | ❌ |
| 5 | Play button для replay | ❌ |
| 6 | Disable betting UI в replay | ❌ |
| 7 | Play Again кнопка | ❌ |
| 8 | Нет session calls в replay | ❌ |
| 9 | Тестовые event IDs (normal win, big win, wincap, loss, bonus) | ❌ |

**Приоритет: КРИТИЧЕСКИЙ** — без Bet Replay игру не примут.

### 3. RGS COMMUNICATION

| # | Требование | Статус | Комментарий |
|---|---|---|---|
| 1 | rgs_url из query params | ⚠️ ЧАСТИЧНО | Сейчас использует mock, нужна интеграция |
| 2 | Respect betLevels из authenticate | ❌ НУЖНО | Сейчас bet change вручную ±10, нужно из RGS |
| 3 | Strict XSS — только static files | ⚠️ ПРОВЕРИТЬ | Howler загружает MP3 — нужно с CDN |
| 4 | Все изображения/шрифты с CDN | ⚠️ ПРОВЕРИТЬ | Проверить при сборке |
| 5 | English поддержка | ✅ ОК | |
| 6 | Текст не ломается при других языках | ⚠️ ТЕСТ | Нужно тестировать |
| 7 | Все валюты отображаются | ❌ НУЖНО | Сейчас просто число, нет форматирования валют |

### 4. FRONT END REQUIREMENTS

| # | Требование | Статус | Комментарий |
|---|---|---|---|
| 1 | Уникальные ассеты | ⚠️ ПРОВЕРИТЬ | |
| 2 | Нет visual bugs | ⚠️ ТЕСТ | |
| 3 | Mini-player/popout view | ⚠️ ТЕСТ | Есть responsive, нужно тестить |
| 4 | Mobile view | ⚠️ ТЕСТ | innerWidth/innerHeight responsive есть |
| 5 | **Rules/Paytable popup** | ✅ ОК | Полный popup с rules, paytable, disclaimer |
| 6 | **RTP отображается** | ✅ ОК | 96.00% в rules stats |
| 7 | **Max win отображается** | ✅ ОК | 50× в rules stats |
| 8 | **Payout table** | ✅ ОК | Таблица P&L → Payout с примерами |
| 9 | **Mode descriptions** | ✅ ОК | BET MODES: BASE (1×) vs INSIDER (25×) |
| 10 | **UI guide** | ✅ ОК | CONTROLS секция |
| 11 | Bet size change | ✅ ОК | ± кнопки есть |
| 12 | Balance отображается | ✅ ОК | `displayBalance` с анимацией |
| 13 | Final win shown | ✅ ОК | WinOverlay компонент |
| 14 | Incremental payout update | ⚠️ ПРОВЕРИТЬ | PnL обновляется посвечно |
| 15 | **Sound disable option** | ✅ ОК | `soundMuted` toggle есть |
| 16 | **Spacebar = bet button** | ✅ ОК | Реализовано (строка 93) |
| 17 | **Autoplay confirmation** | ✅ ОК | `showAutoConfirm` popup (строка 451) |
| 18 | No network errors | ⚠️ ТЕСТ | |
| 19 | Fastplay legibility | ⚠️ ТЕСТ | Turbo mode есть, нужно проверить читаемость |

### 5. MATH VERIFICATION

| # | Требование | Статус | Комментарий |
|---|---|---|---|
| 1 | RTP 90-98% | ✅ ОК | 96.9% |
| 2 | Multi-mode RTP ±0.5% | ✅ ОК | BASE + INSIDER modes в math SDK |
| 3 | Max win реалистичен (>1 in 10M) | ⚠️ ПРОВЕРИТЬ | 50x — нужно проверить hit rate |
| 4 | 100K-1M симуляций | ✅ ОК | 1M для каждого mode |
| 5 | Достаточное разнообразие | ⚠️ ПРОВЕРИТЬ | |
| 6 | Non-zero win hit rate | ⚠️ ПРОВЕРИТЬ | |
| 7 | Нет пробелов в win ranges | ⚠️ ПРОВЕРИТЬ | |
| 8 | Mode cost в rules | ✅ ОК | BET MODES секция: BASE=1×, INSIDER=25× |

### 6. MATH SDK — Синхронизация с фронтендом

| Проблема | Статус |
|---|---|
| ~~WAIT_FOR_ACTION в gamestate.py~~ | ✅ УДАЛЕНО |
| ~~INSIDER mode не в math SDK~~ | ✅ ДОБАВЛЕНО (cost=25x, guaranteed first candle, trend multiplier) |
| ~~Leverage не в math SDK~~ | ✅ ДОБАВЛЕНО (1x-100x с RTP bias per leverage) |
| ~~news_events в math SDK~~ | ✅ УДАЛЕНО (frontend не использует) |
| ~~CASHOUT_FEE в gamestate.py~~ | ✅ УДАЛЕНО |
| ~~3 раунда по 5 свечей~~ | ✅ ИСПРАВЛЕНО → 1 раунд, 5 свечей |
| ~~100K симуляций~~ | ✅ ОБНОВЛЕНО → 1M для каждого mode |

**Статус: ✅ СИНХРОНИЗИРОВАНО** — math SDK и frontend теперь генерируют идентичные события.

### 7. GAME TILE ASSETS

| Требование | Статус |
|---|---|
| Background image (GameTitle-BG.png/jpg) | ❌ НУЖНО |
| Foreground image (GameTitle-FG.png, transparent) | ❌ НУЖНО |
| Provider Logo (ProviderName-Logo.png, transparent) | ❌ НУЖНО |
| Combined <3MB | N/A |

### 8. DISCLAIMER

| Требование | Статус |
|---|---|
| Disclaimer в rules popup | ✅ ГОТОВО |

Полный текст disclaimer добавлен в rules popup, включая "not representative of any physical device" и "TM and (c) 2025 Stake Engine".

### 9. JURISDICTION (stake.us)

| Требование | Статус |
|---|---|
| social=true/false handling | ❌ НУЖНО |
| Запрещённые термины | ❌ НУЖНО |
| sweeps_<lang> file | ❌ НУЖНО |

Термины для замены в нашей игре: "bet" → "play", "balance" → "balance" (ок), "cash" → "coins", "buy" → "play" (для Insider)

### 10. FILE FORMAT

| Требование | Статус | Комментарий |
|---|---|---|
| index.json | ✅ ОК | |
| CSV lookup (uint64) | ⚠️ ПРОВЕРИТЬ | |
| .jsonl.zst books | ✅ ОК | |
| id, events, payoutMultiplier | ✅ ОК | |
| payoutMultiplier match CSV↔books | ⚠️ ПРОВЕРИТЬ | |

---

## СВОДКА БЛОКЕРОВ

### ❌ КРИТИЧЕСКИЕ (без них не примут)

1. **Bet Replay** — обязательный функционал, нужно реализовать с нуля
2. ~~**Rules/Paytable popup**~~ — ✅ РЕШЕНО (RTP, max win, payout table, bet modes, disclaimer)
3. ~~**Math-Frontend рассинхрон**~~ — ✅ РЕШЕНО

### ⚠️ ВЫСОКИЕ (нужно до submission)

4. **Game tile assets** — BG, FG, Logo
5. **RGS интеграция** — сейчас mock, нужно подключить к реальному RGS
6. **Bet levels из RGS** — вместо ручных ±10
7. **Валюты** — форматирование 35+ валют
8. **Jurisdiction** — social mode, sweeps lang
9. ~~**1M симуляций**~~ — ✅ РЕШЕНО

### ✅ УЖЕ СДЕЛАНО

- Stateless механика
- Sound system + mute toggle
- Spacebar = bet
- Autoplay с подтверждением
- Turbo mode
- Balance display
- Win overlay
- Responsive layout
- LONG/SHORT выбор
- Leverage system
- Liquidation механика
- Math SDK synced (single round, leverage, insider mode)
- Rules popup (RTP 96%, max win 50×, payout table, bet modes, disclaimer)

---

## ПЛАН ДЕЙСТВИЙ

### Фаза 1: Math SDK sync ✅ ГОТОВО
- ✅ Убраны WAIT_FOR_ACTION, CASH_OUT, fees, news_events из gamestate.py
- ✅ Переписан gamestate.py: 1 раунд × 5 свечей, leverage, insider mode
- ✅ Добавлен INSIDER (cost=25x) mode в game_config.py
- ✅ run.py обновлён: 1M симуляций для base + insider
- ✅ Frontend cleanup: удалены старые типы, моки, newsEvents.ts

### Фаза 2: Bet Replay
- Реализовать replay mode по спецификации
- Query params detection
- RGS replay endpoint fetch
- Slimmed UI для replay

### Фаза 3: Rules & Compliance
- Rules/Paytable popup
- Disclaimer
- RTP display
- Jurisdiction (social mode + sweeps lang)

### Фаза 4: RGS Integration
- Подключить authenticate/play/end-round
- Bet levels из RGS
- Currency formatting

### Фаза 5: Assets & Polish
- Game tile images
- Promotional blurb
- Testing (mobile, mini-player, currencies, languages)
