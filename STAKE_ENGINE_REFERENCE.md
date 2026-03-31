# Stake Engine Developer Reference

> **This is a comprehensive reference document compiled from [https://stake-engine.com/docs](https://stake-engine.com/docs) for the Stake Engine game development platform.** It covers the full development lifecycle: getting started with the RGS, building frontends with the PixiJS/Svelte SDK, defining game math with the Python SDK, passing approval guidelines, and legal/compliance requirements.
>
> Last compiled: February 2026

---

## Table of Contents

- [1. Getting Started](#1-getting-started)
  - [1.1 Introduction](#11-introduction)
  - [1.2 RGS Details](#12-rgs-details)
  - [1.3 Wallet Endpoints](#13-wallet-endpoints)
  - [1.4 Basic RGS Example](#14-basic-rgs-example)
- [2. Front End SDK](#2-front-end-sdk)
  - [2.1 Introduction](#21-introduction)
  - [2.2 Dependencies](#22-dependencies)
  - [2.3 Getting Started](#23-getting-started)
  - [2.4 Storybook](#24-storybook)
  - [2.5 Flowchart](#25-flowchart)
  - [2.6 Task Breakdown](#26-task-breakdown)
  - [2.7 Adding New Events](#27-adding-new-events)
  - [2.8 File Structure](#28-file-structure)
  - [2.9 Context](#29-context)
  - [2.10 UI](#210-ui)
- [3. Math SDK](#3-math-sdk)
  - [3.1 Introduction](#31-introduction)
  - [3.2 Setup](#32-setup)
  - [3.3 Quickstart Guide](#33-quickstart-guide)
  - [3.4 Math File Format](#34-math-file-format)
  - [3.5 SDK Directory](#35-sdk-directory)
  - [3.6 High-Level Structure / State Machine](#36-high-level-structure--state-machine)
  - [3.7 Game Structure](#37-game-structure)
  - [3.8 Game Format](#38-game-format)
  - [3.9 Simulation Acceptance](#39-simulation-acceptance)
  - [3.10 Configs](#310-configs)
  - [3.11 BetMode](#311-betmode)
  - [3.12 Distribution](#312-distribution)
  - [3.13 Source Files: Config](#313-source-files-config)
  - [3.14 Source Files: Events](#314-source-files-events)
  - [3.15 Source Files: Executables](#315-source-files-executables)
  - [3.16 Source Files: State](#316-source-files-state)
  - [3.17 Source Files: Win Manager](#317-source-files-win-manager)
  - [3.18 Source Files: Outputs](#318-source-files-outputs)
  - [3.19 Symbols](#319-symbols)
  - [3.20 Board](#320-board)
  - [3.21 Wins](#321-wins)
  - [3.22 Events](#322-events)
  - [3.23 Force Files](#323-force-files)
  - [3.24 Utilities](#324-utilities)
  - [3.25 Example Games](#325-example-games)
  - [3.26 Optimization Algorithm](#326-optimization-algorithm)
- [4. Approval Guidelines (COMPLIANCE REQUIREMENTS)](#4-approval-guidelines-compliance-requirements)
  - [4.1 General Requirements](#41-general-requirements)
  - [4.2 Game Replay Requirements](#42-game-replay-requirements)
  - [4.3 Game Quality Rankings](#43-game-quality-rankings)
  - [4.4 RGS Communication](#44-rgs-communication)
  - [4.5 Front End Requirements](#45-front-end-requirements)
  - [4.6 Math Verification](#46-math-verification)
  - [4.7 Game Tile Requirements](#47-game-tile-requirements)
  - [4.8 General Disclaimer](#48-general-disclaimer)
  - [4.9 Jurisdiction Requirements](#49-jurisdiction-requirements)
- [5. Legal](#5-legal)
  - [5.1 Terms and Conditions](#51-terms-and-conditions)
  - [5.2 Privacy Policy](#52-privacy-policy)

---

# 1. Getting Started

## 1.1 Introduction

The Stake Development Kit is a comprehensive framework designed to simplify the creation, simulation, and optimization of slot games. Whether you're an independent developer or part of a dedicated studio, the SDK empowers you to bring your gaming vision to life with precision and efficiency. By leveraging the Carrot Remote Gaming Server (RGS), developers can seamlessly integrate their games on Stake.com, facilitating smooth and scalable deployments.

### What Does the SDK Offer?

The SDK is an optional software package handling both the client-side rendering of games in-browser, and the generation of static files containing all possible game results.

- **Math Framework:** A Python-based engine for defining game rules, simulating outcomes, and optimizing win distributions. It generates all necessary backend and configuration files, lookup tables, and simulation results.
- **Frontend Framework:** A PixiJS/Svelte-based toolkit for creating visually engaging slot games. This component integrates seamlessly with the math engine's outputs, ensuring consistency between game logic and player experience.

### Stake Engine Game Format Criteria

For verification, testing and security purposes, games uploaded to Stake Engine must consist of static files. Developers utilizing their own frontend and/or math solutions are welcome to upload compatible file-formats to the Admin Control Panel (ACP).

- All possible game-outcomes must be contained within compressed game-files, typically separated out by modes.
- Each outcome must be mapped to a corresponding CSV file summarizing a single game-round by a simulation number, probability of selection, and final payout multiplier.
- When a betting round is initiated a simulation number is selected at a frequency proportional to the simulation weighting, and the corresponding game events are returned through the `/play` API response.

---

## 1.2 RGS Details

This specification outlines the API endpoints available to providers for communicating with the Stake Engine. These APIs enable key operations such as creating bets, completing bets, validating sessions, and retrieving player balances.

### Introduction

This document defines how the provider's frontend communicates with the Stake Engine endpoints. It includes a detailed description of the core API functionality, along with the corresponding request and response structures. The API facilitates communication between your game and the server. Each of the APIs will request the server to perform an action such as:

- Authenticating a session
- Playing a round of a game
- Ending a round of a game

### Stake Engine NPM Client

Simplify communication to the RGS via the Stake Engine client. This package has helpers to streamline communication with the RGS.

- GitHub: [https://github.com/StakeEngine/ts-client](https://github.com/StakeEngine/ts-client)

### API Flows

All flows require the `/wallet/authenticate` API to be called when the game first loads. This authorizes the sessionID to be used by the `/wallet/play`, `/wallet/balance` and `/wallet/end-round` endpoints.

If `/wallet/authenticate` endpoint has not been called by the game, all subsequent API calls will be returned with a `400 ERR_IS` response as the session is invalid.

### Basic Flow

You will call `/wallet/play` and `/wallet/end-round` in a basic flow which is the simplest way to interact with the API. If you have a longer round that may include many steps (such as a bonus round in a slot game) you may want to save where the user is up to watching in case they disconnect. When they reload the game in the future, you can use the value found in `round.event` in the `/wallet/authenticate` API response to know where to display the animations for that round from.

### URL Structure

Games are hosted under a predefined URL. Providers should use the parameters below to interact with the RGS on behalf of the user and correctly display game information.

```
https://{{.TeamName}}.cdn.stake-engine.com/{{.GameID}}/{{.GameVersion}}/index.html?sessionID={{.SessionID}}&lang={{.Lang}}&device={{.Device}}&rgs_url={{.RgsUrl}}
```

### Query Parameters

| Field | Description |
|-------|-------------|
| `sessionID` | Unique session ID for the player. Required for all requests made by the game. |
| `lang` | Language in which the game will be displayed. |
| `device` | Specifies `mobile` or `desktop`. |
| `rgs_url` | The URL used for authentication, placing bets, and completing rounds. This URL should not be hardcoded, as it may change dynamically. |

### Language

The `lang` parameter should be an ISO 639-1 language code. Supported languages:

| Code | Language |
|------|----------|
| `ar` | Arabic |
| `de` | German |
| `en` | English |
| `es` | Spanish |
| `fi` | Finnish |
| `fr` | French |
| `hi` | Hindi |
| `id` | Indonesian |
| `ja` | Japanese |
| `ko` | Korean |
| `pl` | Polish |
| `pt` | Portuguese |
| `ru` | Russian |
| `tr` | Turkish |
| `vi` | Vietnamese |
| `zh` | Chinese |

### Understanding Money

Monetary values in the Stake Engine are integers with six decimal places of precision. For example, to place a $1 bet, pass `"1000000"` as the amount. Currency impacts only the display layer; it does not affect gameplay logic.

**Social Casino Currencies:**
- `XGC` (Gold)
- `XSC` (Stake Cash)

### Bet Levels

Although bet levels are not mandatory, bets must satisfy these conditions:

- The bet must fall between `minBet` and `maxBet` (returned from `/wallet/authenticate`).
- The bet must be divisible by `stepBet`.
- It is recommended to use the predefined `betLevels` to guide players.

### Bet Modes / Cost Multipliers

Games may have multiple bet modes defined in the game configuration. When making a play request:

- **Player debit amount** = Base bet amount x Bet mode cost multiplier

### Response Codes

Stake Engine uses standard HTTP response codes (200, 400, 500) with specific error codes.

**400 Client Errors:**

| Code | Description |
|------|-------------|
| `ERR_VAL` | Invalid Request |
| `ERR_IPB` | Insufficient Player Balance |
| `ERR_IS` | Invalid Session Token / Session Timeout |
| `ERR_ATE` | Failed User Authentication / Token Expired |
| `ERR_GLE` | Gambling Limits Exceeded |
| `ERR_LOC` | Invalid Player Location |

**500 Server Errors:**

| Code | Description |
|------|-------------|
| `ERR_GEN` | General Server Error |
| `ERR_MAINTENANCE` | RGS Under Planned Maintenance |

---

## 1.3 Wallet Endpoints

The wallet endpoints enable interactions between the RGS and the Operator's Wallet API, managing the player's session and balance operations.

### Authenticate Request

Validates a `sessionID` with the operator. This **must** be called before using other wallet endpoints. Otherwise, they will throw `ERR_IS` (invalid session).

The `round` returned may represent a currently active or the last completed round. Frontends should continue the round if it remains active.

```
POST /wallet/authenticate
{
  "sessionID": "xxxxxxx"
}
```

**Response fields:** `balance` (amount, currency), `config` (minBet, maxBet, stepBet, defaultBetLevel, betLevels, jurisdiction {socialCasino, disabledFullscreen, disabledTurbo}), `round`.

### Balance Request

Retrieves the player's current balance. Useful for periodic balance updates.

```
POST /wallet/balance
{
  "sessionID": "xxxxxx"
}
```

**Response fields:** `balance` (amount, currency).

### Play Request

Initiates a game round and debits the bet amount from the player's balance.

```
POST /wallet/play
{
  "amount": 100000,
  "sessionID": "xxxxxxx",
  "mode": "BASE"
}
```

**Response fields:** `balance` (amount, currency), `round`.

### End Round Request

Completes a round, triggering a payout and ending all activity for that round.

```
POST /wallet/end-round
{
  "sessionID": "xxxxxx"
}
```

**Response fields:** `balance` (amount, currency).

### Game Play Event

Tracks in-progress player actions during a round. Useful for resuming gameplay if a player disconnects.

```
POST /bet/event
{
  "sessionID": "xxxxxx",
  "event": "xxxxxx"
}
```

**Response fields:** `event`.

---

## 1.4 Basic RGS Example

This brief tutorial is intended to get you up and running with the RGS using a simple game called **fifty-fifty**.

### Game Overview

- You request a response from the RGS's `/play` API.
- You have a 50/50 chance of either 2x your bet back or losing your 1x bet.
- Your balance is displayed alongside the outcome of the previously completed round.
- If your win is greater than 0, you'll need to manually call the `/end-round` API to finalize the bet.

### Simple Math Results

1. Navigate to the `math-sdk/games/fifty_fifty/` directory
2. Execute the `run.py` script
3. This will generate:
   - A Zstandard-compressed set of simulation results
   - A lookup table matching each result to its simulation
   - The required `index.json` file
4. All necessary files to publish the game to the Stake Engine will be placed in `library/publish_files/`

### Simple Frontend Implementation

- Svelte 5 bundled with Vite to create a static frontend
- Build the project with `yarn build`
- Deploy by uploading the contents of the `dist/` folder to the Stake Engine under frontend files

### What This Frontend Does

1. Authenticate your session with the RGS
2. Request a response from the `/play` API
3. Call the `/end-round` API to finalize a win

---

# 2. Front End SDK

## 2.1 Introduction

The `frontend-sdk` is a PixiJS/Svelte package used for developing web-based slot games in a declarative way. This package walks through how to utilize powerful tools such as Turborepo and Storybook to test and publish slot games. Sample slot games are provided which consume outputs provided by the math-sdk, though the repo is customizable and can be tailored to accommodate custom events for slot games covering all levels of complexity.

---

## 2.2 Dependencies

| Package | Purpose |
|---------|---------|
| `pixijs` | 2D rendering engine |
| `svelte` | Reactive UI framework |
| `turborepo` | Monorepo build system |
| `pixi-svelte` | In-house npm package combining PixiJS and Svelte for declarative PixiJS usage |
| `sveltekit` | Application framework |
| `storybook` | Component testing and development |
| `xstate` | State machine management |
| `typescript` | Type safety |
| `pnpm` | Package manager |

---

## 2.3 Getting Started

Get started with sample games in Storybook.

- **Preferred IDE:** VS Code
- **Node version:** 18.18.0
- **pnpm version:** 10.5.0

### Setup Steps

1. Clone the repo
2. `cd web-sdk`
3. `pnpm install`

### Run Storybook

```bash
pnpm run storybook --filter=<MODULE_NAME>
```

`MODULE_NAME` is the name in the `package.json` file of a module in `apps` or `packages` folders.

---

## 2.4 Storybook

Storybook is used to test games at multiple levels:

| Story Path | Purpose |
|-----------|---------|
| `COMPONENTS/<Game>/component` | Tests the Game component with loading screen |
| `COMPONENTS/<Game>/preSpin` | Tests with preSpin function |
| `COMPONENTS/<Game>/emitterEvent` | Tests with emitter events |
| `COMPONENTS/<Symbol>/component` | Tests Symbol component with controls/states |
| `COMPONENTS/<Symbol>/symbols` | Tests all symbols and all states |
| `MODE_BASE/book/random` | Tests Game with random book of base mode |
| `MODE_BASE/bookEvent/reveal` | Tests with "reveal" bookEvent of base mode |
| `MODE_BONUS/book/random` | Tests Game with random book of bonus mode |
| `MODE_BONUS/bookEvent/reveal` | Tests with "reveal" bookEvent of bonus mode |

If each bookEvent is implemented well with emitterEvents and its story is resolved properly, the game is technically finished.

---

## 2.5 Flowchart

Simplified flow of how a game is processed after an RGS request.

### Core Flow Functions

**`playBookEvents()`** - Created by `packages/utils-book/src/createPlayBookUtils.ts`. Goes through bookEvents one by one, handles each one with async `playBookEvent()`. Resolves them sequentially with `sequence()`. The sequence of bookEvents determines game behaviors.

**`playBookEvent()`** - Takes a bookEvent with context, finds the bookEventHandler in `bookEventHandlerMap` based on `bookEvent.type`.

**`sequence()`** - Async function resolving promises one after another (not like `Promise.all()`).

### Data Structures

**`book`** - JSON data returned from RGS for each game requested, composed of bookEvents. Contains:
- `id` - Simulation identifier
- `payoutMultiplier` - Final payout multiplier
- `events` - Array of bookEvents
- `criteria` - Win criteria classification
- `baseGameWins` - Base game win amount
- `freeGameWins` - Free game win amount

**`bookEvent`** - Element of `book.events` array. Has `index`, `type`, and type-specific data. Examples:
- `"reveal"` type: `board`, `paddingPositions`, `gameType`, `anticipation`
- `"setTotalWin"` type: `amount`

**`bookEventHandler`** - Async function that processes a bookEvent, usually broadcasts emitterEvents.

**`bookEventHandlerMap`** - Object mapping `bookEvent.type` to bookEventHandler. Example in `/apps/lines/src/game/bookEventHandlerMap.ts`.

### Event System

**`eventEmitter`** - Achieves event-driven programming. Three main functions:
- `broadcast()` - Fire-and-forget event emission
- `broadcastAsync()` - Awaitable event emission
- `subscribeOnMount()` - Subscribe to events within Svelte component lifecycle

Connects JS scope and Svelte component scope.

**`emitterEvent`** - JSON data that eventEmitter broadcasts. Components with `subscribeOnMount` receive and handle it synchronously or asynchronously.

**`EmitterEventHandler (Sync)`** - Handles sync operations like show/hide, updates.

**`EmitterEventHandler (Async)`** - Handles async operations like animations, fading, tweening.

**`emitterEventHandlerMap`** - Object mapping `emitterEvent.type` to handler. Each handler should follow Single Responsibility Principle.

---

## 2.6 Task Breakdown

Core principle: Task Breakdown applied across the whole SDK.

If an emitterEventHandler does too much work, split it into smaller emitterEventHandlers. Example: `"tumbleBoard"` bookEvent split into:
1. `tumbleBoardInit`
2. `tumbleBoardExplode`
3. `tumbleBoardRemoveExploded`
4. `tumbleBoardSlideDown`

Each can be tested independently in Storybook.

### Game Types

- **Stateless games:** A single RGS request finishes a game (e.g., slots)
- **Stateful games:** Multiple RGS requests needed (e.g., mines)

With the data structure of math and the functions provided, complicated games can be broken down into small atomic tasks (emitterEvents) that can be tested independently.

---

## 2.7 Adding New Events

Steps to add a new BookEvent (example: `updateGlobalMult` for bonus mode):

| Step | File Path | Action |
|------|-----------|--------|
| 1 | `/apps/<game>/src/stories/data/bonus_books.ts` | Add book data from math package |
| 2 | `/apps/<game>/src/stories/data/bonus_events.ts` | Add bookEvent to events object |
| 3 | `/apps/<game>/src/stories/ModeBonusBookEvent.stories.svelte` | Add Story for storybook testing |
| 4 | `/apps/<game>/src/game/typesBookEvent.ts` | Add TypeScript type for new bookEvent (union type) |
| 5 | `/apps/<game>/src/game/bookEventHandlerMap.ts` | Add bookEventHandler |
| 6 | `/apps/<game>/src/components/<Component>.svelte` | Create component with EmitterEvent types and subscribeOnMount handlers |
| 7 | `/apps/<game>/src/game/typesEmitterEvent.ts` | Add EmitterEvent types |
| 8 | `/apps/<game>/src/game/eventEmitter.ts` | Compose EmitterEvent union type |

### Testing

1. First test individually: `MODE_BONUS/bookEvent/updateGlobalMult`
2. Then test in books: `MODE_BONUS/book/random`
3. If component is hard to debug, create `COMPONENTS/<Component>/component` story for isolated testing with storybook controls

---

## 2.8 File Structure

TurboRepo monorepo structure:

```
root/
  apps/           # Individual game folders (cluster, lines, price, scatter, ways)
  packages/       # Shared packages
```

### `/apps`

Each game has an individual folder. Entry point: `src/routes/+page.svelte` with `setContext()` and `<Game/>`.

Run dev:
```bash
pnpm run dev --filter=<MODULE_NAME>
```

### `/packages` Naming Convention

Format: `<PACKAGE_TYPE>-<SPECIAL_DEPENDENCY_OR_USAGE>`

| Category | Packages |
|----------|----------|
| `config-*` | `config-lingui`, `config-storybook`, `config-svelte`, `config-ts`, `config-vite` |
| `pixi-*` | `pixi-svelte` (PixiJS+Svelte components), `pixi-svelte-storybook` |
| `constants-*` | `constants-shared` (global constants) |
| `state-*` | `state-shared` (global svelte `$state`) |
| `utils-*` | `utils-book`, `utils-fetcher`, `utils-shared`, `utils-slots`, `utils-sound`, `utils-event-emitter`, `utils-xstate`, `utils-layout` |
| `components-*` | `components-layout`, `components-pixi`, `components-shared`, `components-storybook`, `components-ui-pixi`, `components-ui-html` |

`*-shared` packages have minimal dependencies and broad use cases.

`pixi-svelte`, `utils-event-emitter`, `utils-layout`, `utils-xstate` create corresponding svelte-context accessible via `getContext<ContextName>()`.

---

## 2.9 Context

Four major svelte-contexts set at entry level:

### 1. ContextEventEmitter

`eventEmitter` for event-driven programming.

### 2. ContextLayout

`stateLayout` and `stateLayoutDerived` providing:
- `canvasSizes`
- `canvasRatio`
- `layoutType`

Uses window sizes from `svelte/reactivity`. Important for PixiJS manual positioning.

### 3. ContextXstate

`stateXstate` and `stateXstateDerived` for finite state machine (`gameActor`).

**States:** `rendering`, `idle`, `bet`, `autoBet`, `resumeBet`, `forceResult`

**Functions:** `matchesXstate`, `isRendering`, `isIdle`, `isBetting`, `isAutoBetting`, `isResumingBet`, `isForcingResult`, `isPlaying`

Uses xstate for betting logic.

### 4. ContextApp (AppContext)

`stateApp` with:
- `loadedAssets` (images, animations, sound via `PIXI.Assets.load`)
- `pixiApplication`
- `loading` state

---

## 2.10 UI

UI solutions available in `/packages/components-ui-pixi` and `/packages/components-ui-html`.

**Features:**
- Auto gaming
- Turbo mode
- Bonus button
- Responsiveness

Recommended to use as a starting point and customize for branding, or build from scratch.

**Key imports:**
- `UI`, `UiGameName` from `components-ui-pixi`
- `GameVersion`, `Modals` from `components-ui-html`

---

# 3. Math SDK

## 3.1 Introduction

The Carrot Math SDK provides:

- Predefined frameworks
- Mathematical precision
- Seamless RGS integration
- Scalability with multithreading

### Static File Outputs

Stake Engine requires all game-outcomes to be known at publication time. A subset of results defines the game, split into:

1. **Game logic files:** Ordered list of game details -- symbol names, board positions, payouts, winning positions
2. **CSV payout summaries:** Simulation number, probability of selection, payout amount

On game round request, the RGS consults the CSV/lookup table to select a simulation number, returns the JSON response from the game-logic file to the frontend, and updates the player wallet with the payout.

---

## 3.2 Setup

### Requirements

- Python3
- PIP
- Rust/Cargo (for optimization algorithm)

### Recommended Setup via Makefile

```bash
make setup    # Creates venv, installs requirements.txt, installs editable math-sdk module
make run GAME=<game_id>
```

### Manual Setup

```bash
python3 -m venv env
source env/bin/activate
pip install -r requirements.txt
pip install -e .
```

---

## 3.3 Quickstart Guide

Example games are located in `/games/`. Example: `games/0_0_lines/` -- a 3-row, 5-reel game paying on 20 win-lines.

### Running a Game

```bash
make run GAME=0_0_lines
```

Output files go to `library/publish_files/`.

### Key Output Files

| File | Description |
|------|-------------|
| `library/books/books_base.jsonl` | Simulation results with events (reveal, winInfo, setWin, setTotalWin, finalWin) |
| `library/lookup_tables/lookUpTable_base.csv` | Simulation number, selection weight, payout |
| `library/lookup_tables/lookUpTableIdToCriteria_<mode>.csv` | Criteria assignments |
| `library/lookup_tables/lookUpTableSegmented_<mode>.csv` | Game-type contributions |

### `run.py` Parameters

| Parameter | Description |
|-----------|-------------|
| `num_threads` | Number of threads for simulation |
| `compression` | Enable zstandard compression |
| `num_sim_args` | Simulations per mode (keys match bet mode names) |
| `run_conditions` | `run_sims`, `run_optimization`, `run_analysis`, `upload_data` |

### Production Recommendations

- 100,000+ simulations per mode recommended
- Optimization algorithm adjusts selection weights to balance game to specified RTP
- `run_analysis` generates PAR sheet with key statistics and hit-rates

### Configuration

- Game config in `game_config.py`
- Unique calculations in `game_executables/game_calculation` files
- Reusable functions in `/src/`, game-specific in `/games/<game_id>/`

---

## 3.4 Math File Format

Math verification on upload checks format and analyzes payout multipliers/probabilities.

### Minimum Files Per Game-Mode (3 files)

1. **`index.json`** -- Mode name, cost multiplier, logic/CSV filenames
2. **Lookup table CSV** -- ID, Probability, Payout (uint64 values)
3. **Game logic** -- zStandard compressed JSON-lines (`.jsonl.zst`)

### Index File Format

```json
{
  "modes": [
    {
      "name": "string",
      "cost": "float",
      "events": "file.jsonl.zst",
      "weights": "file.csv"
    }
  ]
}
```

### CSV Format

```
simulation_number, round_probability, payout_multiplier
```

- All values are uint64, no negatives
- `payoutMultiplier` in CSV must exactly match game-logic file values (hashed for verification)

### Game Logic Format

Each simulation must contain:
- `"id"`: int
- `"events"`: list of dicts
- `"payoutMultiplier"`: int

`payoutMultiplier` is in 100x units (e.g., `1150` = 11.5x payout).

Must be stored in compressed `.jsonl.zst` format.

---

## 3.5 SDK Directory

### Repository Structure

| Directory | Description |
|-----------|-------------|
| `games/` | Sample games |
| `src/` | Core reusable code: `calculations/`, `config/`, `events/`, `executables/`, `state/`, `wins/`, `write_data/` |
| `utils/` | `analysis/` (win distribution), `game_analytics/` (hit-rate, simulation properties) |
| `tests/` | PyTest for win calculations |
| `uploads/` | AWS S3 upload for testing |
| `optimization_program/` | Rust genetic algorithm for balancing discrete-outcome games |
| `docs/` | Markdown documentation |

### Sample Games

| Game ID | Description |
|---------|-------------|
| `0_0_cluster` | Cascading cluster-wins |
| `0_0_lines` | Win-lines |
| `0_0_ways` | Ways-wins |
| `0_0_scatter` | Pay-anywhere cascading |
| `0_0_expwilds` | Expanding wilds + prize collection |

---

## 3.6 High-Level Structure / State Machine

### GameState Class

Central hub for simulation batch management. Entry point: `run.py`.

**Handles:** simulation parameters, game modes, config, results, output files.

**Key attributes:** compression, tracing, multithreading, output files, cumulative win manager, betmode details, paytable, symbols, reelsets.

`run_spin()` creates sub-instance `GeneralGameState` for per-simulation modifications.

### Class Inheritance (MRO Order)

1. **GameStateOverride** (`game/game_override.py`) -- Modifies/extends core `state.py` actions
2. **GameExecutables** (`game/game_executables.py`) -- Groups common game actions
3. **GameCalculations** (`game/game_calculations.py`) -- Game-specific calculations

### Books

Single simulation result storing:
- `payoutMultiplier`
- `events`
- `criteria`
- `baseGameWins`
- `freeGameWins`

Stored in library collection.

### Lookup Tables

CSV summary of all simulation payouts:
- `simulation_number`, `weight`, `payout_multiplier`
- Used for win distribution analysis, RTP calculation, optimization input
- Initial: `lookUpTable_mode.csv`
- Optimized: `lookUpTable_mode_0.csv`

---

## 3.7 Game Structure

### Game Files Template (`games/template/`)

```
game/
  library/
    books/
    books_compressed/
    configs/
    forces/
    lookup_tables/
  reels/
  readme.txt
  run.py
  game_config.py
  game_executables.py
  game_calculations.py
  game_events.py
  game_override.py
  gamestate.py
```

### `run.py` Parameters

| Parameter | Description |
|-----------|-------------|
| `num_threads` | Number of simulation threads |
| `rust_threads` | Threads for Rust optimization |
| `batching_size` | Batch size for simulation |
| `compression` | Enable compression |
| `profiling` | Enable profiling |
| `num_sim_args` | Keys match bet mode names |

`create_books()` runs simulations and populates `library/` folders.

`generate_configs(gamestate)` creates `config_fe.json` (frontend), `config.json` (backend), `config_math.json` (optimization).

### GameConfig

Inherits `Config` class. Defines symbols, pay-tables, reel-strips, bet-mode info.

### gamestate.py

- `run_spin()` is entry point for single simulation
- `run_freespin()` for free-spin games

### Executables

Game-logic groups for drawing boards, handling win-types, event emission.

### Win Evaluation Types

- Lines
- Ways
- Scatter (pay anywhere)
- Cluster
- Expanding wild + prize collection
- Tumbling/cascading
- Conditions for simulation state checking

---

## 3.8 Game Format

### Standard Game Setup -- `GameConfig.__init__()`

| Parameter | Description |
|-----------|-------------|
| `game_id` | Unique game identifier |
| `provider_number` | Provider identifier |
| `working_name` | Display name |
| `wincap` | Maximum win cap |
| `win_type` | Win calculation type |
| `rtp` | Return to player percentage |
| `num_reels` | Number of reels |
| `num_rows` | Number of rows |
| `paytable` | Symbol payout table |
| `include_padding` | Enable padding symbols |
| `special_symbols` | Special symbol definitions |
| `freespin_triggers` | Freespin trigger conditions |
| `reels` | Reel strip definitions |
| `bet_modes` | Bet mode configurations |

### BetMode Configuration

| Field | Description |
|-------|-------------|
| `name` | Mode name |
| `cost` | Cost multiplier |
| `rtp` | Target RTP |
| `max_win` | Maximum win multiplier |
| `auto_close_disabled` | Manual round closing |
| `is_feature` | Feature mode flag |
| `is_buybonus` | Buy bonus flag |
| `distributions[]` | Distribution configurations |

### Distribution Configuration

| Field | Description |
|-------|-------------|
| `criteria` | Win criteria name |
| `quota` | Simulation ratio |
| `win_criteria` | Acceptance payout threshold |
| `conditions` | `reel_weights`, `force_wincap`, `force_freegame` |

### `run_spin()` Flow

1. `reset_seed(sim)`
2. Repeat loop:
   - `reset_book()`
   - `draw_board()`
   - Evaluate wins
   - Update `win_manager`
   - Emit events
   - `check_fs_condition()`
   - `run_freespin_from_base()`
   - `evaluate_finalwin()`
   - `check_repeat()`
   - `imprint_wins()`

### `run_freespin()` Flow

1. `reset_fs_spin()`
2. While `fs < tot_fs`:
   - `update_freespin()`
   - `draw_board()`
   - Evaluate wins
   - Check retrigger
   - `update_gametype_wins()`
3. `end_freespin()`

### Three Core Steps Per Game Round

1. Calculate board state
2. Update wallet manager
3. Emit events

### Outputs in `library/`

| Directory | Contents |
|-----------|----------|
| `books/books_compressed` | Compressed simulation results |
| `lookup_tables` | CSV payout summaries |
| `force/` | Recorded event data |
| `config/` | Frontend, backend, optimization configs |

---

## 3.9 Simulation Acceptance

### Win Criteria Segmentation

| Criteria | Condition |
|----------|-----------|
| `0` | Payout == 0 |
| `basegame` | Payout > 0, no freegame triggered |
| `freegame` | Freegame triggered from base |
| `max-win` | Maximum payout achieved |

### Purpose

Ensure sufficient simulations per criteria. Quotas in BetMode distribution determine the ratio. Acceptance criteria are pre-assigned to simulation numbers before running.

`check_repeat()` verifies conditions are satisfied. `self.repeat` stays `True` until criteria met.

### Notes

- Max-win scenarios typically use specific reelstrips
- More stringent criteria = longer simulation time
- Criteria predetermined to avoid multithreading imbalance

---

## 3.10 Configs

### `GameConfig.__init__()` Parameters

- **Game-types:** `basegame`/`freegame` by default. Transition handled by `reset_fs_spin()`.
- **Reels:** Dictionary mapping reel key to CSV file. Multiple reelstrips per mode for RTP adjustment via weighted draw. Specified in distribution conditions `reel_weights`.
- **Scatter triggers:** `{num_scatters: num_spins}` per gametype for freegame entry/retrigger.
- **Symbols:** Valid if in paytable or `special_symbols`. `RuntimeError` if unknown symbol in reelstrips.
- **Paytable:** `{(kind, name): value}`. `pay_group` for range-based payouts with `convert_range_table()`.
- **Special symbols:** `{attribute: [names]}`. Common: `wild`, `scatter`. Accessed via `symbol.attribute`.

---

## 3.11 BetMode

### BetMode Class

| Field | Description |
|-------|-------------|
| `name` | Mode identifier |
| `cost` | Cost multiplier |
| `rtp` | Target RTP |
| `max_win` | Maximum win multiplier |
| `auto_close_disabled` | Manual round close flag |
| `is_feature` | Feature mode flag |
| `is_buybonus` | Buy bonus flag |
| `distributions[]` | Distribution array |

### Flags

- **`auto_close_disabled`:** `False` = `/endround` called automatically. `True` = frontend must close bet manually (useful for bonus modes with resumable play).
- **`is_feature`:** `True` = preserve current bet-mode without player interaction after each round.
- **`is_buybonus`:** Flag for frontend to determine if mode was purchased directly.

### Distribution Conditions

Can include: `reel_weights`, `mult_values`, `scatter_triggers`, `force_wincap`, `force_freegame`.

---

## 3.12 Distribution

### Distribution Class Fields

| Field | Description |
|-------|-------------|
| `criteria` | Shorthand name for win condition |
| `quota` | Ratio of total simulations for this criteria (normalized, min 1 sim per criteria) |
| `conditions` | Required keys: `reel_weights`, `force_wincap` (default `False`), `force_freegame` (default `False`). Can have arbitrary additional keys (e.g. `mult_values`, `scatter_triggers`). |
| `win_criteria` (optional) | Payout multiplier for simulation acceptance (commonly `0.0` or `wincap`). Checked in `check_repeat()`. |

`get_distribution_conditions()` is used for weighted draws based on known expected simulation criteria. Allows biasing outcomes for specific scenarios (e.g. max-win).

---

## 3.13 Source Files: Config

`Config` super class inherited by `GameConfig`. Contains:

- Game specifications
- Custom `win_levels` (returned during win-events for animation type indication)
- Path destinations for file writing
- Functions to read/verify reelstrips from CSV

---

## 3.14 Source Files: Events

`events.py` -- Reusable game events modifying gamestate and logging actions.

### Functions

| Function | Description |
|----------|-------------|
| `json_ready_sym()` | Convert symbol to JSON-serializable dict |
| `reveal_event()` | Log initial board state with padding |
| `fs_trigger_event()` | Log freespin trigger (basegame or retrigger, not both) |
| `set_win_event()` | Update cumulative win for single outcome |
| `set_total_event()` | Update total win for betting round including freespins |
| `set_tumble_event()` | Log consecutive tumble wins |
| `wincap_event()` | Emit max win reached event, stop further spins |
| `win_info_event()` | Log winning positions and amounts |
| `update_tumble_win_event()` | Update tumble win banner |
| `update_freespin_event()` | Log current/total freespins remaining |
| `freespin_end_event()` | Log end of freespin feature |
| `final_win_event()` | Log final payout multiplier |
| `update_global_mult_event()` | Log global multiplier changes |
| `tumble_board_event()` | Log tumble removals and replacements |

All events append to `gamestate.book['events']`. Deep copies are used.

---

## 3.15 Source Files: Executables

`Executables` class -- Common reusable actions, overridable in `GameExecutables`/`GameCalculations`.

### Key Functions

| Function | Description |
|----------|-------------|
| `draw_board()` | Draw symbols from reelstrips |
| `force_special_board()` | Force specific board states |
| `emit_wayswin_events()` | Emit ways-win events |
| `emit_linewin_events()` | Emit line-win events |
| `emit_tumble_win_events()` | Emit tumble win events |
| `tumble_game_board()` | Cascade board after wins |
| `evaluate_wincap()` | Check if win cap reached |
| `count_special_symbols()` | Count special symbols on board |
| `check_fs_condition()` | Check freespin entry condition |
| `check_freespin_entry()` | Verify freespin trigger |
| `run_freespin_from_base()` | Transition to freespin from base |
| `update_freespin_amount()` | Update freespin count |
| `update_fs_retrigger_amt()` | Handle freespin retrigger |
| `update_freespin()` | Update freespin state |
| `end_freespin()` | End freespin mode |
| `evaluate_finalwin()` | Calculate final win amount |
| `update_global_mult()` | Update global multiplier |

**Dependencies:** `LineWins`, `ClusterWins`, `ScatterWins`, `WaysWins`, `Tumble`, `Conditions`, event handlers.

---

## 3.16 Source Files: State

`GeneralGameState` (ABC) -- Base class for game states.

### Key Methods

| Method | Description |
|--------|-------------|
| `create_symbol_map()` | Build symbol lookup map |
| `assign_special_sym_function()` | Abstract -- assign functions to special symbols |
| `reset_book()` | Reset book for new simulation |
| `reset_seed(sim)` | Reset random seed for simulation |
| `reset_fs_spin()` | Reset freespin state |
| `get_betmode(mode_name)` | Get bet mode by name |
| `get_current_betmode()` | Get active bet mode |
| `get_current_distribution_conditions()` | Get current distribution conditions |
| `get_wincap_triggered()` | Check if win cap was triggered |
| `in_criteria(*args)` | Check if in specified criteria |
| `record(description)` | Record event for force files |
| `imprint_wins()` | Finalize wins for accepted simulation |
| `update_final_win()` | Verify and update final win |
| `check_repeat()` | Check if simulation meets acceptance criteria |
| `run_spin(sim)` | Abstract -- run single simulation |
| `run_freespin()` | Abstract -- run freespin |
| `run_sims()` | Run all simulations |

`update_final_win()` verifies total wins don't exceed wincap, asserts base+free game payouts match recorded final payout.

---

## 3.17 Source Files: Win Manager

`WinManager` class tracks wins at multiple levels:

### Win Tracking Levels

| Level | Fields | Description |
|-------|--------|-------------|
| Cumulative | `total_cumulative_wins`, `cumulative_base_wins`, `cumulative_free_wins` | Updated on simulation acceptance |
| Spin-level | `running_bet_win` | Continuous, equals final `payoutMultiplier` |
| Spin-level | `basegame_wins`, `freegame_wins` | Reset per `run_spin` |
| Spin-level | `spin_win` | Reset per reveal |
| Spin-level | `tumble_win` | Consecutive wins within reveal |

`update_gametype_wins(gametype)` is called when basegame/freegame actions complete.

---

## 3.18 Source Files: Outputs

Output files in `game/library/`:

### Books

- `books/` -- Uncompressed, for frontend testing/debug
- `books_compressed/` -- Uploaded to AWS, consumed by RGS
- Contains: `payoutMultiplier`, win contributions, criteria, events

### Force Files

- `force_mode.json` per betmode (event counts from `.record()`)
- `force.json` (combined unique fields)
- Used by optimization for max-win/freegame identification

### Lookup Tables

- `lookUpTable_mode.csv` -- Payout summaries, weights for optimization
- `IdToCriteria` -- Criteria per simulation
- `Segmented` -- Gametype contributions

### Config Files

- `config_math.json` -- Optimization config
- `config_fe.json` -- Frontend symbols/padding/betmodes
- `config.json` -- RGS file hashes/verification

---

## 3.19 Symbols

### Symbol Class

| Property | Description |
|----------|-------------|
| `name` | Symbol identifier |
| `special_functions` | Callable functions assigned to symbol |
| `special` | Boolean -- is special symbol |
| `is_paying` | Boolean -- has paytable entry |
| `paytable` | Symbol's payout values |

- Properties from `config.special_symbols` set to `True` automatically
- `special_symbol_functions` in `GameStateOverride` assign callable functions to symbols on creation
- **Attributes:** `check_attribute()`, `get_attribute()`, `assign_attribute()` for dynamic properties like `multiplier`, `prize`, `enhance`
- Board is 2D array of `Symbol` objects

---

## 3.20 Board

- **Board:** 2D array of `Symbol` objects
- `print_board()` displays symbol names
- **`special_symbols_on_board`:** `{'property': [{'reel': int, 'row': int}]}` -- tracks special symbols on board

### Tumbling

- Winning symbols get `'explode'` attribute
- `tumble_board()` cascades symbols down

### Padding

- `include_padding` config option: `top_symbols` and `bottom_symbols` for partial visibility
- Active board row indexing starts at 1 when enabled
- Top symbol preserved during tumble

---

## 3.21 Wins

### Win Calculation Methods

- Lines
- Ways
- Cluster
- Scatter

### `win_data` Structure

```json
{
  "totalWin": "float",
  "wins": [
    {
      "symbol": "string",
      "kind": "int",
      "win": "float",
      "positions": [{"reel": "int", "row": "int"}],
      "meta": {}
    }
  ]
}
```

### Meta Fields

| Field | Description |
|-------|-------------|
| `lineIndex` | Line index for line wins |
| `multiplier` | Applied multiplier |
| `winWithoutMult` | Win before multiplier |
| `globalMult` | Global multiplier value |
| `lineMultiplier` | Line-specific multiplier |
| `overlay` | Cluster/scatter center-of-mass position |

### Multiplier Strategies (`wins/multiplier_strategy`)

- `global` -- Global multiplier applied to all wins
- `symbol` -- Symbol multipliers summed from winning positions
- `combined` -- Both global and symbol multipliers

### WalletManager Separation

| Field | Scope |
|-------|-------|
| `spin_win` | Per reveal |
| `running_bet_win` | Cumulative per simulation = final `payoutMultiplier` |
| `basegame_wins` / `freegame_wins` | Must sum to `final_win` or `RuntimeError` |

---

## 3.22 Events

Events are JSON objects returned from the RGS `/play` API. They contain all information for frontend display.

### Format

```json
{
  "index": "int",
  "type": "str",
  "...additional fields"
}
```

- Appended via `gamestate.book.add_event(event)`
- Emitted immediately after game action for state snapshot
- Events imported separately, not attached to gamestate object

### Required Coverage

Events must cover:
- Board symbols
- Freespin counters
- Win counters
- Win info
- Multipliers
- Special symbol actions

---

## 3.23 Force Files

### `force_record_<betmode>.json`

Records book-ids for custom search keys via `self.record(description)`. Used for frequency analysis of custom events (e.g. scatter trigger counts).

### Output Format

```json
[
  {
    "search": {"keys": "..."},
    "timesTriggered": "int",
    "bookIds": ["int"]
  }
]
```

### `force.json`

Combined unique search fields/keys for prototyping.

**Important:** Records only finalized after simulation acceptance (`imprint_wins()`), not prematurely.

---

## 3.24 Utilities

### Game Analytics (`run_analysis.py`)

Analyzes optimized win-distributions. Produces `.xlsx` with:
- Hit-rates
- RTP contributions
- Simulation counts per win-range

Uses `force_record` files and paytable for symbol hit-rates.

### Analysis

Win distribution from optimized lookup table (payout to probability mapping).

### Swap Lookups

Swap optimization output weights into lookup tables.

### Get File Hash

SHA256 comparison with `config.json` for file integrity verification.

---

## 3.25 Example Games

Four example games with basegame (1x cost) + freegame modes:

### 1. Lines Game

- 5-reel layout
- Wilds with multipliers in freegame (additive)
- Scatter triggers freegame (3+ scatters)
- Retrigger with 2 scatters on reels 2-4

### 2. Ways Game

- 5-reel, 3-row layout
- 9 paying symbols
- Wilds with multipliers (compound multiplicative in freegame)
- 3+ scatters for freegame entry

### 3. Cluster Game

- Tumbling/cascading mechanics
- 5+ like-symbols form clusters
- Freegame features:
  - Grid multipliers (doubling up to 512x)
  - Global multiplier (+1 per spin)
  - 4+ scatters for trigger
  - 3+ for retrigger

### 4. Scatter-Pays Game

- 6-reel, 5-row pay-anywhere tumbling
- Payouts grouped by cluster sizes
- Global multiplier +1 per tumble in freegame
- 3+ scatters trigger freegame (2 spins per scatter)

### 5. Expanding Wilds

- 5-reel, 5-row, 15 paylines
- Wilds expand to fill rows in freegame (sticky)
- Superspin mode (25x cost, hold-em style with prize symbols, 3 lives)

---

## 3.26 Optimization Algorithm

Rust-based genetic algorithm for balancing discrete-outcome games.

### Build

```bash
cargo build --release
```

### `OptimizationSetup` Class

Per-betmode `opt_params`:

| Parameter | Description |
|-----------|-------------|
| `conditions` | `ConstructConditions` -- separates simulation subsets for RTP optimization (freegame, max wins, 0-wins). Need 2 of 3: RTP, average wins, hit-rates. Order matters (exclusive simulation assignment). |
| `scaling` | Bias win-ranges with Gaussian weights and scale factors. |
| `parameters` | Number of trial distributions, min/max mean-to-median scores (volatility control), simulated test spins for ranking. |

### Execution

```python
OptimizationExecution().run_all_modes(config, modes, rust_threads)
```

Produces modified lookup tables with adjusted weights.

---

# 4. Approval Guidelines (COMPLIANCE REQUIREMENTS)

> **THIS IS THE MOST CRITICAL SECTION.** All games must satisfy these requirements to be approved for publication on Stake Engine. The review team evaluates functionality, clarity, communication, and technical performance. Non-compliance will result in rejection.

---

## 4.1 General Requirements

Review covers: functionality, clarity, communication, technical performance.

Must include:
- Short blurb for promotional material
- Game description tag

### KEY RESTRICTIONS

- **Games are STRICTLY STATELESS:** Each bet is independent of previous outcomes
- **NO jackpots, gamble features, continuation, or early cashout options**
- Must comply with IP/copyright law (team names, titles, assets)
- **Must be ORIGINAL designs** -- no pre-purchased/licensed games from other platforms
- **NO Stake(TM) branding or themes** in assets
- **NO offensive, explicit, or poor taste content**
- **NO content appealing to underage persons** -- no children/child-like characters in gambling context
- Auto-considered for stake.us with strict language requirements (see [Jurisdiction Requirements](#49-jurisdiction-requirements))

### POST RELEASE RULES

- Game must be finalized before submission
- After approval: **only minor visual updates permitted**
- **NO changes to math model, new game modes, or gameplay mechanic modifications after approval**

---

## 4.2 Game Replay Requirements

> **Bet Replay is MANDATORY for all new games. Games without it will NOT be approved.**

No player session is required for viewing replay (shareable URLs).

### Query Parameters (Replay Mode)

| Parameter | Required | Description |
|-----------|----------|-------------|
| `replay` | Yes | Set to `true` |
| `game` | Yes | Game identifier |
| `version` | Yes | Game version |
| `mode` | Yes | Game mode |
| `event` | Yes | Event identifier |
| `rgs_url` | Yes | RGS URL |
| `currency` | No | Display currency |
| `amount` | No | Bet amount |
| `lang` | No | Language |
| `device` | No | Device type |
| `social` | No | Social casino flag |

### RGS Endpoint

```
GET {rgs_url}/bet/replay/{game}/{version}/{mode}/{event}
```

**Response:** `{ payoutMultiplier, costMultiplier, state }`

### UX Requirements

- Auto-load without interaction
- Show "Play" button to start replay
- Play round with all animations/sounds
- Display final outcome exactly as player saw it
- **NO betting allowed** -- all bet controls disabled/hidden
- Show "Play Again" button after replay
- **Slimmed UI:** hide balance, play buttons, bet selector, autoplay. Keep win amount, replay controls, bet amount, currency display.

### Implementation Checklist

1. Detect replay mode
2. Fetch data
3. Loading state
4. Play button
5. Disable betting UI
6. Disable session calls
7. Play full animation
8. Show results
9. Play again button
10. Error handling
11. Prevent session transition

### Testing Requirements

Provide event IDs for every bet mode:
- Normal win
- Big win
- Win cap
- Loss
- Bonus trigger

---

## 4.3 Game Quality Rankings

Ranking scale: **0 to 3 stars.** Determines visibility and positioning.

| Rating | Description | Visibility |
|--------|-------------|------------|
| **3 stars** | Studio-quality, exceptional creativity/uniqueness | Optimal positioning, eligible for Burst Games, Stake Exclusives, featured New Releases |
| **2 stars** | Considerable creativity/originality but may lack polish | Can appear in Burst/Exclusives via popularity. New Releases placement depends on space |
| **1 star** | Lower polish, meets requirements | Limited visibility, bottom of New Releases. No promotional categories unless exceptional demand |
| **NA (0)** | Meets technical requirements only | Found only via search. No promotional/new-release categories |

- Review priority is based on star rating
- Initial rating given before comprehensive evaluation
- **New Releases:** 1+ star gets tag
- **Burst Games / Stake Exclusives:** Priority to 3-star, 2-star via popularity

---

## 4.4 RGS Communication

- Session auth and bets via Stake Engine RGS **exclusively**
- Frontend **MUST** respect authenticate response: default bet levels, currency-specific bet levels, min/max amounts
- Bet increments must reflect `authenticate/config/minStep`
- Min and max bet levels must be available for selection

### XSS Policy

**STRICT** -- Game build must be static files only, **NO external sources** (including fonts).

### RGS URL

Must use `rgs_url` query parameter (**not hardcoded**).

### Language Requirements

- English (`en`) is the **only required language**
- Text must not corrupt with other language params
- Supported: `ar`, `de`, `en`, `es`, `fi`, `fr`, `hi`, `id`, `ja`, `ko`, `po`, `pt`, `ru`, `tr`, `zh`, `vi`

### Supported Currencies

`USD`, `CAD`, `JPY`, `EUR`, `RUB`, `CNY`, `PHP`, `INR`, `IDR`, `KRW`, `BRL`, `MXN`, `DKK`, `PLN`, `VND`, `TRY`, `CLP`, `ARS`, `PEN`, `NGN`, `SAR`, `ILS`, `AED`, `TWD`, `NOK`, `KWD`, `JOD`, `CRC`, `TND`, `SGD`, `MYR`, `OMR`, `QAR`, `BHD`, `XGC` (Gold Coin), `XSC` (Stake Cash)

---

## 4.5 Front End Requirements

### Game Display

- Must use **UNIQUE audio/visual assets** (sample game assets NOT approved for publication)
- No visual bugs, broken/missing assets/animations
- Must support popout/mini-player view without distortion
- Must support mobile view with all UI functional during scaling
- All images/fonts loaded from Stake Engine CDN only

### Rules and Paytable (Accessible From UI)

- Detailed game rules description
- Cost of each bet mode and actions being purchased
- **RTP of game (and each mode) clearly communicated**
- **Maximum win amount per mode clearly displayed**
- Payout amounts for **ALL** symbol combinations
- All obtainable special symbol values listed (prizes, multipliers)
- Feature mode access description (e.g. "3 Scatters award 10 free spins")

### UI Components

- UI guide describing button functionality
- Bet size change capability with **ALL bet-levels from RGS auth**
- Current balance displayed
- Final win amounts shown for non-zero payouts
- Incremental payout update for multiple winning actions
- Sound disable option
- **Spacebar mapped to bet button**
- **Autoplay requires confirmation** (NO auto-consecutive bets with one click)

### Other Requirements

- No errors in network tab
- Tested with various currencies/languages
- Fastplay: wins, combinations, popups must remain legible

---

## 4.6 Math Verification

### Summary Statistics

| Requirement | Details |
|-------------|---------|
| Mode cost | Correctly represented in game rules |
| **RTP** | **Must be within 90.0% - 98.0%** |
| Multi-mode RTP | All modes within **0.5% variation** of each other |
| Maximum win | Must match game rules description |
| Max win obtainability | Must be realistically obtainable (typically >1 in 10,000,000) |
| Simulation count | **100,000 - 1,000,000** simulations for sufficient outcome diversity |
| Non-paying ratio | Reasonable portion must yield paying results (90,000 non-paying out of 100,000 = rejection risk) |
| Dominant simulation | Most likely single simulation should not be overwhelmingly dominant |

### Other Math Requirements

- Non-zero win hit-rate should align with industry standards (<1 in 20 bets or more frequent)
- Standard deviation within industry norms for 1x cost BASE modes
- List non-zero weight payouts; zero-weight should not dominate
- No gaps in win-ranges between small payouts and max payout

---

## 4.7 Game Tile Requirements

Required visual assets per game submission:

| Asset | Format | Naming Convention | Notes |
|-------|--------|-------------------|-------|
| **Background image** | PNG/JPG | `GameTitle-BG.format` | Environmental background showing game world |
| **Foreground image** | PNG (transparent) | `GameTitle-FG.png` | Feature character/key item |
| **Provider Logo** | PNG (transparent) | `ProviderName-Logo.png` | Must be legible at small sizes |

**Combined background + foreground must not exceed 3MB.** High quality, visually appealing assets required.

---

## 4.8 General Disclaimer

Game rules/info popup **MUST** include a disclaimer. You can use the template below or your own version conveying the same message:

> "Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and (c) 2025 Stake Engine."

---

## 4.9 Jurisdiction Requirements

For **stake.us**: US requirements prohibit certain gambling terms in rules, images, UI.

- RGS query parameter `social=true/false` indicates social casino mode
- Recommend `sweeps_<lang>` language file for phrase changes

### Prohibited Terms and Required Replacements

| Prohibited Term | Required Replacement |
|-----------------|---------------------|
| win feature | play feature |
| pay out / paid out | win / won |
| stake | play amount |
| betting | play / playing |
| total bet | total play |
| bet / bets | play / plays |
| cash / money | coins |
| payer | winner |
| pay / pays | win / wins |
| paid | won |
| buy / bought | play |
| purchase | play |
| at the cost of | for |
| rebet | respin |
| cost of | can be played for |
| credit | balance |
| buy bonus | get bonus |
| gamble | play |
| wager | play |
| deposit | get coins |
| withdraw | redeem |
| bonus buy | bonus / feature |
| be awarded to player's accounts | appear in player's accounts |
| place your bets | come and play / join in the game |
| currency | token |
| fund | balance |

---

# 5. Legal

## 5.1 Terms and Conditions

**Parties:** Carrot Gaming Pty Ltd (Australia) and Developer (registered entity).

Full document available at: [https://stake-engine.com/docs/terms](https://stake-engine.com/docs/terms)

### Key Obligations for Developers

- Developer grants Carrot **exclusive licence** to Game Rights in Territory
- Games must not include Prohibited Content (pornographic, defamatory, discriminatory, hate speech, IP-infringing, racist)
- Developer must notify Carrot of New Games under development (**right of first refusal, 30 days to respond**)
- Developer must maintain and update games, fix errors within reasonable timeframes
- Developer must not knowingly include material adversely affecting Carrot's reputation
- Developer responsible for ensuring game compliance with all applicable laws/regulations

### Intellectual Property

- Developer **retains ownership** of Game IP
- Developer grants **exclusive licence** to Carrot for use on Website
- Carrot may enforce Game Rights against third-party infringement

### Licence Fees

- Based on **Gross Gaming Revenue (GGR)** generated
- Carrot may suspend payments if Developer breaches agreement
- GGR during suspension does not contribute to Licence Fee calculation

### Game Removal

- Carrot/Stake can remove games from Website **without notice**
- Reasons include: regulatory requirements, quality concerns, breach of agreement

### Termination

- Either party may terminate with notice
- Carrot may terminate **immediately** for material breach
- Post-termination: developer IP rights survive, licence to Carrot terminates

### Confidentiality

- Both parties must protect confidential information
- Survives termination of agreement

---

## 5.2 Privacy Policy

**Controller:** Carrot Gaming Pty Ltd

**Contact:** support@stake-engine.com

### Data Collected

- Name
- Email
- GitHub repo link
- Usage description
- Age confirmation (18+)
- Individual/company status

### Data Usage

- Registration
- Communication
- Authentication
- RGS access
- Support
- Platform improvement
- Legal compliance
- Fraud prevention
- Monetization

### Data Protection

- **No third-party data sharing**
- GDPR rights apply (access, correction, deletion, portability, objection)
- Data retained as long as necessary per legal obligations
