# Robo Drop — Stake Engine Game

Physics arcade / ragdoll game. Robot tumbles down a slope, bouncing and losing limbs.
Two robots: TANK (low volatility) and ACRO (high volatility), same RTP ~96%.

## Game Mechanics

- Robot bounces down slope, each landing determined by book events
- Good landing (both feet): no penalty, spin bonuses possible
- Bad landing (one leg/arm): limb lost/loosened, multiplier divided
- Head landing: instant crash 0x (possible at any time)
- Flips in air: multiplicative bonuses to multiplier
- Distance: additive base multiplier grows
- TANK: 2-hit limbs (loosen then detach), /1.5 /2 /3 penalties
- ACRO: 1-hit limbs (instant detach), /2 /3 /4 penalties, bigger flip bonuses
- Max win: 1000x, RTP: 96%, spread < 0.5%

## Stake Engine Compliance Rules (MUST FOLLOW)

### Restricted Words (NEVER use in UI)
- "bet" -> use "play" or "spin" or just the play button
- "buy" -> use "play" or "activate"
- "payout" -> use "win"
- "paytable" -> use "game info"
- "bet amount" -> use "stake" or just show the number
- "autobet" -> use "auto" or "auto play"
- "cost" -> use "multiplier" or "level" (in social mode)

### Currency Display
- Real money mode: show currency symbol from RGS
- Social mode (SC/GC): NO $ sign, display "GC" or "SC" suffix
- Use `numberToCurrencyString()` from `utils-shared/amount` everywhere

### Required UI Elements
- Sound mute button
- Game info/rules panel with: RTP, Max Win, robot stats, game description, disclaimer
- Auto-play with confirmation dialog (cannot start with single click)
- Responsive: desktop + mobile layouts
- Spacebar = play button

### RGS Integration
- Use `rgs_url` query parameter for all API calls
- Validate `rgs_url` on startup
- Read bet levels from RGS `authenticate` response
- Use `defaultBetLevel` as initial bet
- Send `end-round` only for winning rounds (payout > 0)
- On refresh with active round: settle immediately via `end-round`

### Replay Mode
- Support `mode=replay` query parameter
- Show replay info screen with: Mode, Base Play, Feature Multiplier, Final Multiplier, Total Win
- "Replay" button at end
- No bets placed during replay

### Disclaimer (must be in rules)
"Malfunction voids all wins and plays. A consistent internet connection is required.
In the event of a disconnection, reload the game to finish any uncompleted rounds.
The expected return is calculated over many plays. The game display is not representative
of any physical device and is for illustrative purposes only. Winnings are settled according
to the amount received from the Remote Game Server and not from events within the web browser."

### Key Lessons from Previous Reviews (stake-fixes-log.md)
- end-round ONLY for winning rounds (payout > 0) in normal flow
- end-round on refresh with active round: ALWAYS (win or loss)
- NO end-round on load without active round
- defaultBetLevel from RGS as initial bet
- Social mode: no $, no prohibited words, GC/SC via numberToCurrencyString
- rgs_url validated on startup, tamper-protected in social mode
- Bet level retained via localStorage keyed by rgs_url (not sessionStorage)
- Replay: info screen, replay button, social translations, currency from URL
