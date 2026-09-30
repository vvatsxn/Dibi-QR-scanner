# DiBi — Welcome in.

A responsive event ticket scanner for Brief C: record each supplied QR ticket once and get 300 people through quickly. The interface uses the logo, Clash Display / Satoshi typefaces, and palette from [DiBi’s website](https://dibiconference.com/). The camera, scan log and results use direct operational labels.

## Run

```sh
npm install
npm run dev
```

Open the URL printed by Vite. `npm run build` produces the static site in `dist`.

## Scan and record

The app opens in **Staff check-in**, with no fictional attendees in the desk log.

1. Choose **Open camera** and scan the guest’s existing ticket QR. **Upload QR image** and **Enter ticket code** are alternatives.
2. A first scan records the QR value and timestamp immediately, increments the count, and shows **Ticket scanned**. There is no registration form.
3. The same ticket scanned again shows **Already scanned**, including the first timestamp. It does not increase the count or create a second record.
4. Choose **Scan next ticket**. After a camera scan, this opens the camera again.

**Scan log** lists recorded tickets, supports searching by ticket/QR code, and exports a CSV. Previously collected guest details are preserved. Adding a name, email or company remains optional under an individual ticket’s details.

Scan results fill the screen: **green** for a recorded ticket, **amber** for an already-scanned ticket and **red** for an unsuccessful scan. A short symbol animation confirms the outcome; reduced-motion preferences disable it. Results stay visible until staff choose the next action. Unreadable images, invalid QR content and camera errors offer retry or manual-entry actions without increasing the count.

Duplicate tickets can be sent to the help queue for staff follow-up.

## On a phone

The scanner uses the rear camera when available. Bottom navigation stays within thumb reach, the scan log becomes a vertical list, and the next-ticket action stays visible while longer ticket details scroll. Layouts account for phone safe areas and the on-screen keyboard; ticket entry disables automatic capitalisation and spelling changes.

## QR identities

The scanner records exact text payloads, including ticket codes and full booking URLs. External values are case-sensitive; links are never opened or fetched. New codes are recorded without needing a preloaded attendee list. This is a scan log, not independent booking or payment validation.

Demo fixtures use `DEMO-EB-001` and `DEMO-EB-002`. Real ticket codes are recorded only when scanned and stay in browser storage; they are not included in the repository.

Each ticket needs a unique QR value. If everyone uses exactly the same event URL, scans cannot distinguish people: identical payloads count as the same ticket. Use each ticket’s unique printed code instead. Previously configured shared event QRs open individual ticket-code lookup without adding a scan.

## Demo mode and existing data

**Try demo** opens a separate workspace containing fictional attendees and sample arrivals. **Back to desk** restores the real scan log. Refresh always opens the desk workspace. Demo actions never affect the desk total.

The desk log uses `dibi-desk-v2` in localStorage. The previous `dibi-demo-v1` dataset is preserved as the demo workspace. On first migration, named custom registrations and their activity are copied to the desk log; generated `DIBI-` sample guests and the two unnamed ticket placeholders stay in demo mode. Existing desk registrations and check-ins are retained.

## Scope

Data is saved only in this browser on this device. Multiple staff devices do not share scans or duplicate detection. Shared-device operation needs a backend and staff access controls.

Camera access requires localhost or HTTPS and browser permission. No camera images are uploaded. Opening a result or leaving the scanner stops the camera. DiBi’s Clash Display and Satoshi fonts are bundled locally, with system sans-serif fallbacks.

## Verification

```sh
npm test
npm run build
```

For browser checks, start the dev server, install Chromium with `npx playwright install chromium`, then run:

```sh
npm run test:desk
npm run test:browser
npm run test:mobile
```

An existing compatible Chromium can be selected with `PLAYWRIGHT_EXECUTABLE_PATH`. Tests use isolated sessions and sample data. Mobile checks cover touch navigation, QR uploads, repeat scans, long QR payloads, guest-detail forms and landscape at phone widths from 320–430 pixels. These are browser emulations, not physical-device camera tests.

## Brand reference

The SVG logo and font files in `public/` come from assets referenced by [dibiconference.com](https://dibiconference.com/). The palette uses navy `#001a2d`, cream `#ffeedb`, teal `#70abaf`, purple `#6b58e1` and orange `#f86624`. `src/brand.css` holds the font faces and colour tokens; `src/style.css` contains the layout and component styles.


## Deploy on Vercel

Import `vvatsxn/Dibi-QR-scanner` as a new Vercel project. Use the repository root (`./`). The included `vercel.json` sets:

- Framework: Vite
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`

No environment variables or backend services are required for this version. See [Vercel’s Vite documentation](https://vercel.com/docs/frameworks/frontend/vite).

Use the deployed HTTPS URL and allow camera access when prompted. Each device still has its own scan log; publishing on Vercel does not synchronise scans. Existing localhost records remain on localhost, so export them first if needed. The deployed site starts a separate log for its own URL.
