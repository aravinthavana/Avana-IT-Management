# UI/UX and responsive audit

**Color correction:** The exclusive five-color theme was reverted at the user’s
request. The prior white/warm-neutral surfaces, gold brand scale, colorful status
indicators, chart colors and integration icons are restored. Accessibility,
responsive layout and interaction fixes remain in place.

## Scope and verification limits

Reviewed the application shell, sign-in, dashboard, asset/user lists, support tickets,
HR review, onboarding/offboarding, forms, charts, dialogs, and notifications.
This is a source audit with automated regression checks, not a completed visual
device audit or WCAG certification. The public sign-in page was inspected visually.
The isolated local preview could not be reached by the in-app browser, and native
Computer Use stopped because it could not verify the Chrome URL. No production
records were changed during this review.

## Findings and changes

| Priority | Finding | Implemented change |
| --- | --- | --- |
| High | `no-print` content was hidden on screen as well as in print | Moved hiding into the print media query; dialog headers and print controls remain available on screen. |
| Superseded | Exclusive five-color styling reduced visual clarity | Restored the original application colors while retaining semantic aliases for improved shared components. |
| High | Button and text contrast | Shared primary actions use the original darker gold with white text. Core shared-component text pairs are checked at 4.5:1 in both themes. |
| High | Dialogs allowed keyboard focus behind them and did not restore focus | Added focus trapping, Escape handling, nested-dialog handling, scroll locking and focus restoration. Shared dialogs render through a portal. Applied the hook to HR review, license editing, article editing, onboarding/offboarding and ticket dialogs. |
| High | Mobile drawer was visually hidden while its links remained focusable | Closed drawers use visibility hiding; open drawers manage focus and Escape. Desktop sidebar starts at 1024px so tablets retain room for content. |
| Medium | Several header/breadcrumb titles were missing | Added titles for all main views; constrained long header names and allowed breadcrumbs to wrap. |
| Medium | Closed account/theme menus remained keyboard-reachable | Closed menus use `hidden`; toggles expose expanded/selected state and respond to Escape. |
| Medium | Most form labels were not associated with controls | Added accessible names to 108 controls; added names to icon-only buttons and each OTP digit. |
| High | Signature drawing used unscaled coordinates on smaller screens | Scaled pointer coordinates to the canvas bitmap, added pointer capture, kept ink visible in both themes and prevented empty submission. |
| Medium | Sign-in card padding and fixed OTP boxes crowded narrow phones | Reduced mobile padding and placed six flexible OTP controls in a grid. Kept text-entry controls at 16px on phones to avoid automatic input zoom. |
| Medium | Dense charts/cards required a mouse | Added keyboard activation to shared cards, bar charts and doughnut legends; allowed legend text to wrap. |
| Medium | Large tables lacked keyboard-accessible scroll regions | Labeled table scroll containers and made them focusable. Kept ticket columns readable inside a horizontal scroll area. |
| Medium | Notifications disappeared too quickly, including failures | Errors persist until dismissed; success messages last six seconds. Added live-region roles, explicit labels, a dismiss button and viewport-constrained placement. |
| Medium | Dialog sizing used a static viewport height | Updated common dialogs to dynamic viewport height and retained internal scrolling. |
| Medium | Tiny controls and motion affected mobile/keyboard users | Added 44px mobile touch targets, readable small phone labels, visible focus outlines, a skip link and reduced-motion support. |

## Current color system

The original brand gold scale and warm-neutral light/dark themes are retained.
Status badges, warnings, errors, charts and integration icons use their original
semantic colors. The interface is no longer limited to five colors. Existing
raster images and uploaded content remain unchanged.

## Automated checks

Run from `frontend`:

```powershell
npm run test:ui
npx tsc --noEmit
npm run build
```

The UI suite checks preservation of the restored theme, core text contrast, focus cycling in both
directions, hidden controls, nested Escape/scroll locking, header titles, menu
visibility, mobile drawer semantics and scaled signature coordinates. It uses isolated DOM substitutes and
server-rendered markup; it does not measure a browser layout.

## Manual device checks still required

At 320px, 375px, 390px, 768px, 1024px and a desktop width, check sign-in/OTP, drawer
navigation, long employee/asset names, filters, table scrolling, ticket replies,
article editing, and wizard footers. Repeat with the software keyboard open and
in landscape. Check both themes, 200% zoom and keyboard-only navigation. Verify
print previews separately, since their physical paper dimensions are intentional.

The changes are local. Deployment and authenticated live-device verification are
separate steps.
