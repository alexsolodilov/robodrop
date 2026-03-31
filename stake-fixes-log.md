# Stake Engine — Fixes Log

Полный список правок по замечаниям Stake Engine. Сверяться перед каждой новой правкой, чтобы не сломать ранее сделанное.

---

## 1. RTP — spread между режимами (Math v4–v5)
**Замечание:** RTP must be 90–98%, all modes within 0.5% of each other.
**Фикс:** Все 8 режимов приведены к spread 0.16% (95.83–95.99%).
**Версия:** math v5

## 2. Social Mode — запрещённые слова
**Замечание:** "PAYOUT", "PAYTABLE" и другие restricted phrases в Social Mode.
**Фикс:**
- PAYOUT → WIN (win overlay)
- PAYTABLE → GAME INFO (menu item + panel title)
- "View payouts and winning combinations" → "View wins and combinations"
- "bet" → "play" в rules text
- "payout" → "win" в rules text
- BET → SPIN (UI labels)
- BUY BONUS → PLAY BONUS
**Версия:** front v9

## 3. End-round только для выигрышных раундов
**Замечание:** End-round request should NOT be sent for non-winning rounds.
**Фикс:** endRound отправляется только при положительном payout. Для проигрышей — не отправляется.
**Версия:** front v12

## 4. Game Info — RTP, Max Win, Mode Cost per mode
**Замечание:** Game Info must show RTP, Max Win, Mode Cost per mode as in math docs.
**Фикс:** Добавлены две таблицы (Base Modes / Insider Modes) с RTP, Max Win, Cost.
**Версия:** front v12

## 5. Убран endRound при загрузке
**Замечание:** Unsuccessful end-round request being sent every time the game loads.
**Фикс:** Убран автоматический endRound при загрузке. endRound теперь отправляется только после завершения анимации (для выигрышных раундов).
**Версия:** front v14

## 6. endRound после анимации без клика
**Замечание:** end-round sent only after clicking LAUNCH again, not after animation.
**Фикс:** endRound отправляется автоматически после завершения анимации, без дополнительных действий игрока. LAUNCH и bet controls остаются активными на result screen.
**Версия:** front v14

## 7. Убран отрицательный мультипликатор
**Замечание:** Negative multiplier display is misleading.
**Фикс:** Мультипликатор clamped to 0.0× minimum (display only).
**Версия:** front v16

## 8. Default bet level из RGS
**Замечание:** Game must use defaultBetLevel from authenticate response.
**Фикс:** Читаем defaultBetLevel из authenticate и используем как начальный betAmount. Если есть active round — используем bet amount раунда.
**Версия:** front v16

## 9. Reload mid-spin — LAUNCH не работает
**Замечание:** After reloading mid-spin, LAUNCH button does nothing.
**Фикс:** После mid-spin reload игра корректно закрывает предыдущий раунд перед стартом нового.
**Версия:** front v18

## 10. Max Win и Mode Cost — неверные значения
**Замечание:** Max Win and Mode Cost values don't match math docs.
**Фикс:** Max Win исправлен. Mode Cost для Insider modes исправлен на 1× (было неверно 10×). Math документация пересчитана.
**Версия:** front v19

## 11. RGS URL tampering detection (social mode)
**Замечание:** Modified rgs_url should show notification and block the game.
**Фикс:** rgs_url сохраняется в sessionStorage per session. При изменении — блокировка с "Game Unavailable".
**Версия:** front v21

## 12. Round state при refresh winning round (social)
**Замечание:** Game doesn't handle round state on refresh during winning round.
**Фикс:** При рефреше с активным winning round:
- Пропускает intro, сразу в betting state
- Вызывает requestEndRound
- Показывает win overlay с правильным payout
- Обновляет баланс сразу
- НЕ отправляет requestBet до действий игрока
**Версия:** front v21

## 13. RGS URL validation (missing/tampered)
**Замечание:** Tampered rgs_url (e.g. rgashdshads_url) should crash with error.
**Фикс:** Валидация rgs_url на старте. Если отсутствует/tampered — ошибка, игра не грузится.
**Версия:** front v23

## 14. Bet preservation & immediate round settlement on refresh
**Замечание:** Bet level must be retained on refresh; active round must be settled immediately.
**Фикс:**
- Bet amount сохраняется при рефреше mid-play
- Active round из authenticate → немедленный endRound
- Добавлено в rules: "If refreshed/disconnected, round settled immediately, result in game history"
**Версия:** front v23

## 15. Social mode — убрать $ и запрещённые слова (дополнительно)
**Замечание:** Dollar symbols and prohibited words still present.
**Фикс:**
- Убран $ из balance, bet, win overlay
- Иконка доллара в Game Info → нейтральная info icon
- "Cost" → "Multiplier" в paytable
- "price" → "level" в Bonus Targets rules
**Версия:** front v23

## 16. Responsive layout — menu panel
**Замечание:** Game not configured properly on small views (Popout S 400×225).
**Фикс:** Menu panel теперь скроллится на маленьких viewport-ах.
**Версия:** front v23

## 17. Replay Mode
**Замечание:** Implement Replay Mode per Game Approval Checklist.
**Фикс:**
- Language parameter при инициации replay
- Bet Replay info screen: Mode, Base Bet, Cost Multiplier, Total Bet Cost, Payout Multiplier, Total Win
- "Replay" button в конце
- Social translations: Base Bet → Base Play, Cost Multiplier → Feature Multiplier, Payout Multiplier → Final Multiplier
- Disclaimer: "This is a replay of a previous bet round. No bets will be placed."
**Версия:** front v23

## 18. Loader screen
**Замечание:** Raw content visible before game loads.
**Фикс:** Добавлен loader.
**Версия:** front v23

---

## 19. Bet level retention + round settlement
**Замечание:** "Game still does not retain the bet level upon refresh nor settles the round."
**Фикс:**
- **Authenticate.svelte**: `round?.state` → `round?.active` — теперь любой active round триггерит settlement, даже если state пустой
- **TradingSlots.svelte**: betAmount сохраняется в sessionStorage (`bet_level_{sessionID}`) при adjustBet() и восстанавливается в onMount (если нет active round для resume)
**Версия:** front v24

## 25. Replay — Social mode currency + горизонтальный скролл
**Замечание:** Replay не соблюдает Social mode ($ вместо GC/SC), горизонтальный скролл на всех views.
**Причина:**
- `handleReplay` в Authenticate.svelte не читал `currency` из URL → `stateBet.currency` оставался `'USD'` → `numberToCurrencyString` показывал `$`
- `.replay-info-card` имел `overflow-y: auto` без `overflow-x: hidden`, `margin: 0 -20px` на highlight-строках провоцировало горизонтальное переполнение
**Фикс:**
- **stateUrl.svelte.ts**: добавлен `currency` в `stateUrlDerived`
- **Authenticate.svelte**: `handleReplay` читает `currency` из URL и устанавливает `stateBet.currency`
- **TradingSlots.svelte**: `.replay-info-card` добавлен `overflow-x: hidden`
**Версия:** front v26 (текущая)

## 24. Bet level retention — всё ещё не работало
**Замечание:** "The game not retaining bet levels upon refresh still persists."
**Причина:** sessionStorage очищается при перезагрузке iframe (казино создаёт новый iframe контекст), а ключ `bet_level_{sessionID}` — sessionID меняется с каждой новой сессией от казино.
**Фикс:** **TradingSlots.svelte**: `sessionStorage` → `localStorage`, ключ `bet_level_{sessionID}` → `bet_level_{rgsUrl}`. localStorage переживает любые перезагрузки; rgs_url стабилен для данной игры/оператора.
**Версия:** front v25 (текущая)

## 20. Social mode — отображение валюты (GC/SC)
**Замечание:** "Please ensure the currencies (GC, SC) are properly displayed in Social mode" — суммы отображались без валюты.
**Причина:** `fmtAmount` в social mode использовал `toLocaleString()` без валюты вместо `numberToCurrencyString()`, который уже умеет XGC→"GC", XSC→"SC".
**Фикс:**
- **TradingSlots.svelte**: `fmtAmount` теперь всегда использует `numberToCurrencyString()` (убрана isSocial ветка с toLocaleString)
- **WinOverlay.svelte**: аналогично — импортирован `numberToCurrencyString`, убрана ручная isSocial ветка
- Все суммы (balance, bet, win overlay, replay info, auto session) теперь показывают GC/SC в social mode
**Версия:** front v24 (текущая)

## 21. Replay — prohibited words + горизонтальный скролл
**Замечание:** "Total Play Cost" содержит "Cost" (prohibited в social). Горизонтальный скролл на всех views.
**Фикс:**
- **TradingSlots.svelte**: "Total Play Cost" → "Total Play Amount" в social mode
- **app.html**: добавлен `overflow: hidden` на `<html>` элемент (body уже имел, но html — нет)
**Версия:** front v24 (текущая)

## 22. Replay — не помещается на Popout S (400×225)
**Замечание:** Replay info overlay не влезает на маленький viewport.
**Фикс:** Добавлен `@media (max-height: 350px)` с уменьшенными padding, gap, font-size для replay card, table, badge, button, disclaimer.
**Версия:** front v24 (текущая)

## 23. Bet level "+" кнопка ограничена балансом
**Замечание:** "Ensure we can access all bet levels even if higher than balance for testing."
**Фикс:** Убрана проверка `effectiveBetTotal >= balance` с disabled кнопки "+". Теперь можно листать все bet levels вверх. Кнопка LAUNCH всё ещё защищена проверкой `canBet` (balance >= betAmount).
**Версия:** front v24 (текущая)

---

## ВАЖНО: Инварианты (не ломать!)
- endRound отправляется **только** для winning rounds (payout > 0) в нормальном flow
- endRound при refresh с active round — отправляется **всегда** (и win, и loss)
- endRound **НЕ** отправляется при загрузке без active round
- defaultBetLevel из RGS используется как начальный bet
- Social mode: нет $, нет prohibited words (bet→play, payout→win, etc.), GC/SC отображаются через numberToCurrencyString
- rgs_url валидируется на старте и защищён от tampering в social mode
- Replay mode: info screen, replay button, social translations
