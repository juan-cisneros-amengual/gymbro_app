# GymBro – Functional Prototype (Practice 3)

GymBro is a mobile-first web app that helps gym users **find training partners** and **check real-time occupancy by zone**.
Human-Computer Interaction · Universidad Francisco de Vitoria · 2026/2027.

**Live demo:** https://YOUR-USER.github.io/gymbro/
**Figma prototype:** https://www.figma.com/proto/hc0aHTmllQn5ZjLTu2ruA4/Gymbro-Final-model

## Critical tasks covered

| ID | Task | Where |
|----|------|-------|
| T01 | Register and onboarding (account, email code, gym, schedule, goal/level, privacy, review) | First screen → Sign up |
| T02 | Update profile (light) | Profile → Edit profile |
| T10 | Check zone occupancy | Facilities → tap a zone |
| T11 | Report zone occupancy (validation, 2-min cooldown, 5-s undo) | Zone detail → Report Status |
| T04 | Find and message a partner (filters, invitation, chat) | Partners → Send Chat Invitation → Chats |
| T05 | Propose and confirm a session (date/time/workout validation) | Chat → Propose Session |

## For usability testing

- **First visit** opens the welcome screen. *Sign up* runs the full onboarding (T01). The email code is always **1234**.
- *Log in with the demo account* skips onboarding and opens the app as Juan (use it for the occupancy and session tasks).
- **Reset between participants:** Profile → Log out. This returns to the welcome screen.

## Tech

Plain HTML, CSS and JavaScript (no framework, no build step). All data is simulated (`js/data.js`).
Open `index.html` in any modern browser, or use the live demo. Best viewed on a phone or in a mobile viewport.

| File | Purpose |
|------|---------|
| `index.html` | App structure, bottom navigation, dialogs |
| `css/styles.css` | Dark/light themes, components |
| `js/data.js` | Simulated zones, partners and chats |
| `js/onboarding.js` | T01 sign up and onboarding, profile editing |
| `js/app.js` | Navigation, validation, simulated live data, theme and text size |

## Accessibility

- Crowd levels shown with text (Free / Moderate / Full), not color alone
- WCAG 2.2 AA contrast in both themes; touch targets ≥ 44–48 px
- Adjustable text size, keyboard navigation, focus-trapping dialogs, screen-reader error announcements
- Live updates can be paused; reduced-motion respected
- Confirmations combine visual feedback with vibration (on supported devices)

## Changes in v3 (Practice 3)

- **New: T01 Register and onboarding** following the P2 task analysis and storyboard: field-level validation with reasons for every piece of data, 18+ age check, privacy terms with a plain-language summary, simulated email confirmation, 4-step gym profile with progress bar, data kept when going back, editable review, and first partner suggestions filtered by the new profile.
- **New: Edit profile** (T02, light) and Log out from the Profile screen.
- Vibration feedback on report confirmation, session proposal and acceptance (requirement from P2, section 8).
- Fix: the "Skip to content" link no longer sends the user to Home.

## Generative AI

Code was produced with the support of generative AI (Claude) from the team's Figma design, then reviewed and tested by the team.
