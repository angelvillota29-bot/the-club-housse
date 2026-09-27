# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + React Router (SPA), same choice the user made for the sibling rebuild (rebot/La Delicia). Backend stays the existing PHP API untouched (`api/*.php`). This work happens on branch `rediseno-react` of the real repo `angelvillota29-bot/the-club-housse` — explicit user authorization to edit the real repo, but changes stay off `main`/production until the user approves and a deploy is triggered.

## Users

- **Diners**: order from The Club Housse (fast food / sandwiches, Cali, Colombia) for eat-in, pickup, or home delivery, by day-of-week menu or a fixed "menú único".
- **Restaurant admin** (client-side email/password, same mechanism as the sibling project, plus a hardcoded supreme-admin bootstrap): manages categories, dishes, weekly/single schedule with daily-resetting stock, open/closed status, delivery fees, branding, live order queue, and (supreme admin only) N8N connection and user management.
- **Kitchen staff**: use a separate app, "Receptor de Pedidos" (different repo, proxies this project's order endpoints), to see and clear incoming orders — out of scope for this surface but must keep the order-queue API contract stable since that app depends on it.

## Product Purpose

Real, live ordering site for an actual operating restaurant — not a demo. Lets customers order for delivery/pickup/eat-in and lets the owner run the menu, stock, and incoming orders day to day.

## Positioning

Real almuerzo-rápido/fast-food operation with three concrete fulfillment modes (domicilio/recoger/comer_aqui) each with server-enforced fee logic, a permanent sales history separate from the live kitchen queue, and multi-channel order intake (web page, on-site AI chat widget, and — per the user's newest request — WhatsApp via an external Forja bot) all landing in the same order pipeline with a `canal` field already built for it.

## Operating Context

- Same one-JSON-file datastore pattern (`data/data.json`) as sibling projects.
- Server-side is the source of truth for prices and fees — the client payload is never trusted for totals (`place-order.php` recomputes everything).
- `ordersData` (live, deletable kitchen queue) is distinct from `historialPedidos` (permanent, append-only log) — today only `ordersData` has any admin UI; `historialPedidos` has none yet.
- `get-users.php`, `get-orders.php`, `get-historial.php`, `delete-order.php`, `update-stock.php` are the external/API-key-gated surface consumed by n8n and by the separate "Receptor de Pedidos" app — do not change their request/response shape.
- An AI chat widget (Forja, Cloudflare Worker) is already embedded (`data-nombre="Housse Bot"`, theme updated to the new brand orange `#ff7a1a`) and can place orders directly via `canal: 'chat_web'`. Its script `src` (`forja-restaurante-ladelicia...workers.dev`) is confirmed correct by the user — that single worker serves both La Delicia and The Club Housse, it is not a misconfiguration. Re-added to `index.html` after the rebuild (the file replacement briefly dropped it — caught before shipping).
- **Known backend bug found during investigation**: `update-stock.php` checks only the legacy `data.json` `n8nConfig.apiKey` and ignores the `N8N_API_KEY` env var (every other protected endpoint checks both) — since the admin panel actively blanks that JSON field once the env var is set, this endpoint will start silently rejecting n8n stock updates. Flagged, not fixed here (backend logic, not this task's scope) unless the user asks.
- New chatbot requirement from the user: before a chatbot (the external ForjaBot) lets a customer finish an order, it must tell them they need to accept the site's Terms & Conditions — this surface must therefore publish real, linkable Terms & Conditions content the bot's flow can reference (mirrors what was just added to the sibling project).

## Capabilities and Constraints

- Public: day-of-week menu (or fixed "menú único"), category-flat dish list (no more combo/role system), cart, checkout collecting `tipoEntrega` (domicilio/recoger/comer_aqui — each with distinct fee rules), `metodoPago` (efectivo/nequi), open/closed gate (manual switch or schedule window, server-enforced).
- Admin: categories (name, deliveryEnabled, exentoEmpaque — flat, no combo roles anymore), dishes CRUD with images, weekly-matrix or single-menu scheduling with per-row daily-resetting stock, "Disponibilidad" section (open/closed + delivery-zone config for n8n only, never public), "Personalizar" (identity, WhatsApp, socials, background, fonts, colors), live order queue with mark-delivered/delete (supreme admin), N8N status + docs (supreme admin), user management (supreme admin).
- Must preserve every existing API contract byte-for-byte (`categories`, `dishes`, `schedule`/`singleMenuSchedule`, `menuMode`, `takeoutConfig`, `businessOpenConfig`, `deliveryZoneConfig`, `brandingConfig`, `usersData`, `n8nConfig`, `ordersData`, `notifyConfig`, `historialPedidos`) — this is a visual + architecture rebuild of the frontend only.
- Undecided / open for this surface: whether to give `historialPedidos` its own admin screen now (currently has zero UI) — worth asking the user rather than assuming.

## Brand Commitments

**This is not a greenfield brand** — The Club Housse has a real, already-shipped visual identity from actual marketing flyers the user supplied: a circular badge logo (dark-brown ring, illustrated club-sandwich-on-a-plate art, "THE CLUB HOUSSE" wordmark in a bold rounded script over an orange ribbon reading "COMIDAS RÁPIDAS", tagline "¿Hoy qué te provoca?"), a warm orange (~#f97316, already the color the site's own chat-widget config uses) plus dark-brown and cream, playful bold display type (Baloo 2 / Manrope already loaded as Google Fonts in the current site), real appetite-forward food photography (steaming pan-cook bowls, loaded sandwiches, salchipapas), and a recurring "orange drip/splash" banner shape at page edges. Redesign must inherit and refine this real identity, not invent a new one — see Evidence on Hand for the source images.

## Evidence on Hand

- Existing live site: `D:\Escritorio 2\Bots del restaurante\The-House-Club` (`index.html`, `script.js`, `styles.css`, full `api/`) — functional and visual ground truth for behavior; old look is evidence, not the rendering target (its current CSS is generic/unstyled-looking compared to the real flyer brand below).
- Real brand reference images supplied by the user in chat (business card layout, two food-promo flyers, a menu board photo, three food photos, and two unrelated-restaurant UX screenshots shown only as a feature reference for a post-add-to-cart "add extras/drink" upsell step, not as visual style reference).
- Existing menu/pricing visible on the physical menu-board photo (Club Housse 30k, Mandala 25k, Mote 20k, Quesadillas 18k, Filete de Pollo 18k, Pan Cook 20k, Nuggets 12k, Bulldog 15k, Ranchipapa 12k, Chori Housse 12k; Salchipapas Básica 10k through Oversize 70k; a la carte addition list; burgers/perros/colitas tiers; bebidas/gaseosas lists) — real content that can seed the new admin's categories/dishes instead of launching empty, unlike the sibling test project.
- Contact facts from the business card: Domicilios 318 762 8155 / 3187628155, address Cra 26p10 93-60 Marroquín 1 - Comuna 14, payment via Nequi/Daviplata 3187527225 and Datáfono.

## Product Principles

1. This is a real operating business — treat content, prices, and fee logic as production facts to get right, not placeholders (unlike the sibling demo project).
2. Preserve the existing API contract exactly; this is a frontend/visual rebuild, not a backend rewrite. Flag backend bugs found along the way rather than silently fixing or leaving them undocumented.
3. Inherit and elevate the real Club Housse brand (orange/brown, playful bold script, badge logo, appetite photography) rather than inventing a new visual world.
4. Admin panel is Operate-mode (clarity, density); public ordering is Persuade-mode (make ordering feel good, fast, trustworthy, on-brand).
5. Stay on the `rediseno-react` branch; never push to `main` or trigger a production deploy without the user's explicit go-ahead.

## Accessibility & Inclusion

No specific standard mandated; default to solid semantic HTML, keyboard-operable forms/modals, and real contrast against the brand's orange/cream palette (orange-on-white or orange-on-cream can fail contrast at small sizes — verify at build time).
