# Haraya Bay By Zaldy Land — Hotel Room Reservation System (Simulation)

A hotel room reservation system built **for academic demonstration only**. It includes:
- a guest-facing website;
- an **interactive 3D virtual room tour**;
- **interactive 3D hotel amenities** (pool, gym, sauna, restaurant, casino-style lounge and game hall);
- **3D event venues and attractions** (Grand Entrance Fountain, Haraya Theater and Grand Ballroom);
- an **Events & Celebrations** page with registration and venue requests;
- an interactive **2D hotel and mall map** with directions;
- **light, dark, Christmas and system themes**;
- a separate staff dashboard.

All of them use the same database, so every booking, registration, change and cancellation shows up everywhere straight away.

Haraya Bay By Zaldy Land is a fictional hotel. The visual design (layout, navy-and-gold palette, Cormorant Garamond + Jost typography and navigation) is adapted from a supplied single-page design concept ("The Aurelian Manila — Rooms & Suites"). Only the look was adopted: the concept's browser-only storage was not used, and every page still runs on the Express + SQLite backend. The hotel name, logo and contact details are original and fictional.

> **Simulation notice:** No real payments, banking services or emails are used. All guest data is fictional, and "emails" are simulated messages stored inside the app. Facility hours, capacities, access rules, events and prices are sample information. The casino-style lounge is a visual simulation with no gambling, betting or money of any kind. The attached Haraya Bay Galleria mall and all its shops are fictional, and the map's exits, safety equipment and evacuation routes are **illustrative only**: they have not been validated against any building plan and must not be used in a real emergency.

---

## Quick start

Requirements: **Node.js 22.13 or newer** (uses Node's built-in `node:sqlite`, so there are no native database drivers to compile).

```bash
npm install      # installs Express and Three.js (served locally, no CDN)
npm start        # starts the server on http://localhost:3000
```

| Page | URL |
|---|---|
| Guest website | http://localhost:3000/ |
| Virtual Room Tour (3D) | http://localhost:3000/room.html |
| Hotel Amenities & Recreation | http://localhost:3000/amenities.html |
| 3D Facility Explorer | http://localhost:3000/facility.html?id=pool |
| Events & Celebrations | http://localhost:3000/events.html |
| Property map (hotel + mall) | http://localhost:3000/map.html |
| Staff dashboard | http://localhost:3000/staff.html |

Other commands:

```bash
npm test         # runs the automated reservation, event and map tests
npm run reset    # deletes the database; the next `npm start` recreates it with fresh sample data
```

Optional environment variables: `PORT` (default `3000`) and `DB_FILE` (default `data/hotel.db`).

---

## Room inventory

The hotel has exactly **20 rooms**. The inventory is fixed in `server/inventory.js` and checked against the database every time the server starts; if the count doesn't match, the server refuses to start.

| Category | Rooms | Room numbers | Nightly rate | Max guests | Size | Bed / view |
|---|---:|---|---:|---:|---|---|
| Economy Room | 10 | 101–110 | ₱4,500 | 2 | 24 sqm | 1 Queen, garden view |
| Deluxe Room | 6 | 201–206 | ₱8,500 | 3 | 38 sqm | 1 King + sofa, partial bay view |
| VIP Suite | 4 | 301–304 | ₱18,000 | 4 | 72 sqm | 1 King + living area, panoramic bay view |
| **Total** | **20** | | | | | |

---

## Guest features (`/`)

### Browse rooms and check availability
- Each category is shown as a large alternating image-and-text block with its photo, room count and view, size, bed type, capacity, description, **in-room features** and nightly rate.
- A booking bar overlapping the bottom of the hero has check-in date, check-out date, number of guests and a **Check availability** button.
- Each card has a live availability indicator for the chosen dates:
  - "X of Y rooms available", with a segmented bar (one segment per room)
  - an **Available**, **Only N left** or **Sold out** badge
  - the total price for the selected number of nights
- The **Reserve** button is disabled when a category is sold out, or when the chosen number of guests is more than the room holds.
- Every room block has an **Explore in 3D** button, and the Rooms & Suites heading and footer have a **Virtual Room Tour** link (see below). Your chosen dates and guest count are carried over.
- A summary line shows the chosen dates, number of nights and how many of the 20 rooms are free.

### Make a reservation
- The booking form asks for first name, last name, email, phone, room category, guests, check-in, check-out and optional special requests.
- Availability for the chosen category updates live inside the form, and each category option shows its remaining count.
- A price summary shows rate × nights = estimated total (no payment is collected).
- Required fields and date ranges are checked in the browser and again on the server; invalid fields are highlighted with a message.
- After booking, a confirmation dialog shows the **booking reference** (format `HRY-XXXXXX`), the assigned room number, stay details and total.
- Guest bookings are confirmed instantly, and a simulated confirmation email is recorded.
- The most recent booking reference is remembered in the browser so the Manage form is prefilled.

### Manage a reservation
- Look up a booking with its **booking reference + email address** (both must match).
- See full details: status, guest and contact info, room category, room number, dates, guests, nights, total and special requests.
- **Modify** the room category, check-in/check-out dates, number of guests or special requests, subject to availability. The form shows the new total and the difference from the current total.
- **Cancel** the booking after a confirmation prompt. The room is released immediately.
- Only **Pending** or **Confirmed** reservations can be changed online. For other statuses the guest is told to contact the front desk.
- A **Messages** list shows every simulated email for that booking: confirmation, modification, cancellation and status updates.

### Site layout and design
- A navy top bar (fictional address, phone, Staff Console link) and a sticky header with a gold diamond "H" monogram, the "Haraya Bay / By Zaldy Land" wordmark, the main navigation (Rooms & Suites, Amenities, Events, Map, Manage Booking, Contact), the theme button and a **Reserve** button. The header gains a shadow once the page scrolls.
- A full-height hero with three slowly cross-fading photos (paused for reduced-motion users), a serif headline and the booking bar.
- The Rooms & Suites list, a four-item highlights strip (front desk, pool, restaurant and fitness centre), the **Hotel Amenities & Recreation** section (see below), an **Events & Celebrations** teaser with the next three upcoming events (the Bakebe workshop first) and their *View Event* / *Register* buttons, the **Manage Booking** section, a contact section and a navy footer.
- The same top bar, header and footer appear on every guest page (rooms tour, amenities, facility explorer, events and map), with the current page highlighted in the navigation.
- Below 1120 px the navigation folds into a menu button with a drop-down panel (closes on link click, Escape or an outside click).
- Fonts (Cormorant Garamond and Jost) are self-hosted from the `@fontsource` npm packages at `/vendor/fonts/…`, so no Google Fonts or other external requests are made.
- Responsive layouts for desktop, tablet and mobile.

---

## Interactive 3D room tour (`/room.html`)

Each room category can be explored as a real-time 3D interior rendered in the browser with [Three.js](https://threejs.org) (WebGL). These are actual 3D scenes you can move around in, not photos, a pre-rendered image or a 360° panorama.

### The three rooms
Every room is built procedurally in code from simple shapes and generated textures. Nothing is downloaded from paid asset stores or online services.

| Room | Size in 3D | What you see |
|---|---|---|
| **Economy Room** | 4.4 × 5.4 m | Simple and warm: oak plank floor, queen bed with wooden headboard, nightstands with lamps, desk and chair, TV console, wardrobe, mini fridge, entry door and a garden-view window with curtains and sheers. |
| **Deluxe Room** | 6.2 × 6.2 m | Upgraded: walnut floor, striped wallpaper with wainscoting and crown moulding, tufted king bed and bench, a lounge with sofa, marble coffee table, armchair and floor lamp, a media console, mirror, writing desk and a wide bay-and-skyline window. |
| **VIP Suite** | 9.6 × 7.6 m | Luxurious: a floor-to-ceiling glass wall with a sunset bay view, a walnut slat feature wall, platform king bed, living room with chandelier, dining table for four under brass pendants, a marble bar with stools, a freestanding soaking tub behind a glass partition, and cove lighting. |

Lighting is physically based. Sunlight comes through the window and casts shadows, lamps and sconces glow, and an environment map gives realistic reflections on metal, glass and marble.

### Controls
- **Drag** to look around (rotate), **scroll / pinch** to zoom, **right-drag / two-finger drag** to pan.
- When the 3D view has focus, **W / S** or **↑ / ↓** walk forward and back, **A / D** step sideways, and **Q / E** or **← / →** turn.
- The camera is kept inside the room's walls, so you can't fly out of the room.
- **Viewpoint buttons** under the viewer move the camera smoothly to set positions, such as *Entrance*, *Queen bed*, *Garden window* or *Soaking tub*. The Economy and Deluxe rooms have 5 viewpoints, and the VIP Suite has 6.
- **Auto tour** visits each viewpoint in turn, and stops as soon as you take control of the camera.
- **Reset** returns to the starting view. **Full screen** expands the viewer.
- A short hint showing the controls appears when the viewer opens, then fades.

### Room details and booking
- Tabs at the top switch between Economy, Deluxe and VIP without leaving the page. The URL updates too (`/room.html?type=DELUXE&checkIn=…&checkOut=…&guests=…`), so a link opens the same room.
- The side panel shows the category, nightly rate, maximum occupancy, room size, bed, view, description and **in-room features**, with a note and link explaining that the pool, gym, sauna, dining and recreation are shared hotel facilities.
- **Check availability** lets you change the dates and guest count and shows live availability for that category (the same segmented bar as the room cards) plus the estimated total.
- **Book This Room** opens the normal reservation form on the main site with the category, dates and guest count already filled in. All the usual booking rules apply, including no overbooking, the capacity limit and server-side validation. The button is disabled when the category is sold out or the guest count exceeds the room's capacity. If someone follows an old link to a category that has sold out since, the form isn't opened and a message explains why.

### Performance and fallbacks
- Three.js is installed with npm and served by the app from `/vendor/three`, so the tour works offline and needs no API keys or external services.
- The scene is only re-rendered while the camera is moving. Shadows are calculated once per room, the pixel ratio is capped, and switching rooms frees the previous room's memory.
- A loading indicator is shown while a room is built (about 0.1 seconds per room).
- If WebGL isn't available, the 3D code can't load, or the graphics context is lost, the viewer shows a photo of the room with an explanation. Room details, availability and booking keep working.
- On phones the viewer and the room details are stacked, the field of view widens, and the viewpoint buttons scroll sideways.

---

## Interactive 3D hotel amenities and recreation

Six **shared hotel facilities** and three **event venues and attractions** can be explored as real-time 3D environments. They are built the same way as the room tour: Three.js, procedural models and generated textures, with no paid assets or API keys. They are kept separate from room features: room cards and the room tour list **in-room features**, while the facilities below are shared by guests of every room category.

### Where to find them
- **Homepage:** a *Hotel Amenities & Recreation* section with one card per facility (preview image, category, tagline, description, access label and hours) and **View Facility** / **Explore in 3D** buttons, plus a **View all amenities** button. The header has an *Amenities* link, and the menu has *Amenities & Recreation* and *Explore Facilities in 3D*.
- **Amenities page (`/amenities.html`):** an intro comparing in-room features with shared facilities, a **live 3D preview** that auto-tours the selected facility, a category filter (Wellness, Dining, Recreation, Venues & Attractions) and facility cards. **View Facility** loads that facility into the preview; **Explore in 3D** opens the full explorer; venues also have **See events**.
- **3D Facility Explorer (`/facility.html?id=…`):** a full-screen-capable viewer with tabs to switch facility, a details panel and **Back to Amenities** and **Book a room** buttons. Each facility also opens on its own through its URL (`pool`, `gym`, `sauna`, `restaurant`, `casino`, `gameroom`, `fountain`, `theater`, `ballroom`).

### The facilities

| Facility | Access (sample) | What you can explore and do |
|---|---|---|
| **Infinity Pool & Sun Deck** | Free for hotel guests | Rooftop pool with animated rippling water, caustic light, mosaic tiles, ladder and steps; loungers with umbrellas, a pergola lounge, pool bar, towel station, palms, glass balustrade and a bay skyline. *Toggle the underwater lights.* |
| **Haraya Fitness Centre** | Free for hotel guests | Treadmills, spin bikes, dumbbell rack, benches, power rack, kettlebells, cable machines, mirror wall, stretching mats and balls, class TVs and a bay window. *Start a treadmill (moving belt), spin the bike flywheels.* |
| **Cedar Sauna** | Reservation required | Cedar walls and two-tier benches, stone heater with glowing embers, warm LED strips, bucket and ladle, thermometer/hygrometer, sand timer and rules sign. *Pour water on the stones for a burst of steam.* |
| **Sunset Brasserie** | Open to the public | Dining tables with candles, booths, a marble bar with back-bar bottles and espresso machine, a buffet with heat lamps and food displays, a dessert station, host stand, chandelier and pendants. *Lift the cloche on the chef's table.* |
| **The Gilded Room** (casino-style lounge) | Restricted, adults 21+ | Slot machines with spinning reels, two poker tables, a roulette wheel, cocktail bar, velvet lounge, chandeliers and neon. *Spin the reels, deal community cards, spin the roulette wheel.* **Visual simulation only:** there are no bets, credits, money, prizes or payments, and the cashier cage is a display labelled "no real money or chips". |
| **Arcade & Game Hall** | Free; golf simulator and batting cage need a reservation | Billiards (two tables), a PS5-style console lounge with TVs and gaming chairs, table tennis, retro arcade cabinets, an indoor golf simulator (screen, hitting mat, clubs) with a putting green, and a **baseball batting cage only** (netted tunnel, pitching machine, protective screen, home plate; no field or stadium). *Break the billiard rack, switch TV games, play a table-tennis rally, insert a free-play credit, take a golf swing, putt, and pitch a ball.* |

### Event venues and attractions

| Venue | Capacity (sample) | What you can explore and do |
|---|---|---|
| **Grand Entrance Fountain** (Fountain Plaza, `PLAZA`) | 250 standing | A tiered fountain with particle water jets (central plume, 12 rim arcs, 8 vertical jets), overflow sheets, a rosette-paved plaza, palms, hedges and flower beds, benches, lamp posts, the drop-off lane, and the hotel facade with its revolving door and canopy sign. *Cycle the water show (Classic, Dancing jets, Light show) and switch between daytime and evening lighting.* |
| **Haraya Theater** (`THEATER`) | 320 seats | A proscenium stage with an apron, footlights, wings and back drape. There are 312 instanced seats in 12 raked rows with two aisles, aisle step lights and wheelchair bays. Line-array speakers, subwoofers, a lighting truss, a control booth and exit doors complete the room. *Open and close the velvet curtains, play a film preview on the 9 m screen, and switch house / show / film lighting.* |
| **Grand Ballroom** (`BALLROOM`) | 600 max | A coffered ceiling with three crystal chandeliers and cove lighting, mirrored wall bays, a stage with an LED wall, a parquet dance floor with a mirror ball, and entrance and bridal/VIP doors. *Switch the room setup: wedding reception (round tables, head table, floral arch, cake; 360 guests), formal banquet (long tables, candelabra, lectern; 480) or corporate conference (600 theater-style chairs, panel table, AV desk; 600). Cycle Bright / Evening / Party lighting.* |

For venues, the explorer's side panel shows:
- the venue capacity and the capacity of the selected setup, with a **setup picker** for the ballroom that stays in sync with the in-scene control and the URL (`&setup=banquet`);
- features and a sample-information note;
- the **upcoming schedule** loaded from the events database, with loading, empty and error/retry states (private events show only as "Private … event");
- **Book This Venue**, which opens the venue request form on the Events page with the venue and setup already selected, and **See all events**.

The 3D scenes link to the Events page too: a "See performances" hotspot in the theater, a "Book This Venue" hotspot in the ballroom and a "See plaza events" hotspot at the fountain.

### Exploring a facility
- **Mouse / touch:** drag to rotate, scroll or pinch to zoom, right-drag or two-finger drag to pan.
- **Walk:** W A S D or arrow keys (Q / E turn), or hold the **on-screen move pad** (turn, forward, back, step left/right), which also works on touch screens.
- **Hotspots:** numbered markers float over points of interest. Click a marker, click the object itself, or use the *Explore inside* chips in the panel. The camera flies there and an info card explains it, with an action button where the object is interactive. Markers hide when they are behind walls or far away and can be toggled with **Markers**.
- **Viewpoints**, **Auto tour**, **Reset** and **Full screen** work as in the room tour.
- The details panel shows the facility's category, access label, location, hours, capacity, description, features and (for the game hall) per-zone access, all marked as **sample information**.

### Technical notes
- Each facility is its own module in `public/js/facility3d/` and is only downloaded when it is opened. Shared building blocks live in `kit.js`.
- Facility data (names, descriptions, hours, access labels) is in `public/js/facilities-data.js`.
- Loading indicators are shown while a facility is built. If WebGL is unavailable or the graphics context is lost, a pre-rendered image of the facility (`public/img/amenities/*.jpg`) is shown with an explanation, and all text details stay available.
- The six shared facilities do not take reservations in this simulation; access labels are informational. The three event venues accept **simulated** venue requests through the Events page. There are no external booking services.

---

## Events & Celebrations (`/events.html`)

- **Featured event:** the **Bakebe DIY Cake-Baking Workshop** sample event appears at the top:
  - Haraya Event Studio, 30 September of the next upcoming year (2027 when seeded in October 2026), 10:00–16:00, starting at ₱999.
  - It lists the cake designs, and has **View Event** and **Register now** buttons.
  - It carries a note that the date and price are sample information to be confirmed, and that the hotel is **not** officially affiliated with Bakebe or The Dessert Museum.
- **Event cards:**
  - Each card has a generated poster, a date badge, category and venue, date and time, a short description and the price (or *Free*).
  - Cards show places left, or *Fully booked*, *Invitation only* or *Open entry*.
  - Each card has a status of **Upcoming**, **Ongoing**, **Completed** or **Cancelled**, worked out from the date, time and staff status.
- **List and calendar views:** the calendar is a month grid with previous/next navigation and an agenda list on small screens. The chosen view is kept in the URL.
- **Filters:**
  - search by name, keyword or event code;
  - category, venue, date range and status (*Upcoming & ongoing* by default), with a result count and a reset button;
  - loading, empty and error states.
- **Event details dialog:**
  - full description, what's included, venue (with **Explore in 3D** and **Show on map** links), organiser, capacity and remaining places;
  - **simulated registration**: name, email, phone, 1–6 places and notes, validated on the server.
  - Registering returns a `REG-XXXXXX` reference and records a simulated confirmation email.
  - Registration is closed for past, ongoing, cancelled, private, invite-only and fully booked events, and the same email can't register twice.
- **Cancel a registration** with the reference and email address.
- **Our event venues:**
  - one card per venue with capacity, setups and features;
  - **Explore in 3D** (where a scene exists) and **Show on map** links, and an "upcoming events" button that filters the list to that venue;
  - **Book this venue** opens a request form. It checks the venue's booked time slots for the chosen date as you type and validates the setup capacity. It creates a *Pending* request (held time slot) for staff to review.
  - No deposit or payment is taken.
- Deep links:
  - `?event=ID` (add `&register` to open the form);
  - `?venue=THEATER`, `?category=…`, `?q=…`, `?view=calendar`;
  - `?book=BALLROOM&setup=banquet`.

### Event and venue rules (enforced on the server, `server/events.js`)

1. **No double-booking a venue.** Two events in the same venue conflict when their times overlap on the same date (back-to-back is allowed). Pending venue requests hold their slot, and cancelled events release it. Conflict errors name the clashing event and time.
2. **Capacity** can't exceed the venue's (or the ballroom setup's) maximum, or drop below the places already registered.
3. **Registrations** never exceed capacity (checked inside a transaction), are limited to 6 places per registration, and are refused for duplicate emails.
4. **Status workflow:** `Pending` → `Scheduled` → `Ongoing` → `Completed`, or `Cancelled`.
   - A cancelled event can't be reopened.
   - Cancelling voids its registrations and records a simulated notification for each attendee.
   - Approving a pending request re-checks conflicts.
5. **Validation:** required title, valid category and venue, setup required for the ballroom, valid date (not in the past for new events), start/end times on the same day, whole-peso price.
6. Guests checking venue availability see booked time slots, but never the details of private events.

---

## Property map (`/map.html`)

An interactive 2D SVG map of the hotel and the attached fictional **Haraya Bay Galleria** mall.

- **Floors:**
  - **G**: lobby, Galleria link, drop-off, Fountain Plaza and the casino lounge;
  - **2**: Grand Ballroom, Haraya Theater, Event Studio, Sunset Brasserie and the skybridge to the Galleria;
  - **3**: sauna, spa, gym, Kids Club and meeting rooms;
  - **4**: Arcade & Game Hall and Sky Garden;
  - **R**: rooftop infinity pool (Level 9).
  - The Galleria has floors G, 2 and 3. Guest-room floors 5–8 are private and not shown.
- **Fictional shops and food outlets** such as Isla Botika, Kape Kultura, Sampaguita Threads, Mabuhay Fresh Market, Sinehan Bay Cinemas, Kainan Food Hall and Ube & Co. Bakeshop, plus lifts, stairs, escalators, restrooms and information desks.
- **Click (or keyboard-select) any area** for a details card with its type, building and floor, description and sample hours. The card's buttons are *Directions here*, *I'm here*, *Explore in 3D* (facilities and venues) and *See events* (venues).
- **Search** by name, type or keyword (e.g. *restroom*, *CR*, *pharmacy*, *coffee*, *ballroom*). Matches are highlighted on the map and listed with their floor. Enter jumps to the first result, and an empty state appears when nothing matches.
- **Views:** a floor selector (with dots for floors on the current route and the floor you are on), **Combined / Hotel / Galleria** framing, a clickable **legend** that highlights one type of area, **zoom** (buttons, mouse wheel, pinch) and **pan** (drag), plus reset.
- **You Are Here** defaults to the lobby kiosk; any area can be set as your location (remembered in the browser).
- **Directions:**
  - shortest-path routing between any two areas, across floors and between buildings;
  - a highlighted route line with start and end pins, and floor-change badges you can click to follow the route;
  - walking distance and estimated time, and numbered steps such as "Take the atrium escalators up to Level 3".
  - The **Step-free route** option uses lifts and level walkways only.
- **Illustrative safety layer** (off by default):
  - exits and protected stairs, fire extinguishers, alarm call points, first-aid points, an AED and the plaza assembly point;
  - computed evacuation paths to the nearest exit on each floor, which **never use lifts or escalators**.
  - It is labelled on the map, in a warning above the map and in the legend as **illustrative only, not validated against an actual building plan and not certified for real emergencies**.
- Deep links:
  - `?find=THEATER` (venue codes, facility ids or area ids), `?floor=2`, `?view=mall`, `?safety=1`;
  - `?from=lobby&to=ube&accessible=1`.

---

## Themes

A theme button in the header of every page (including the staff portal and 3D explorers) switches between **Light**, **Dark**, **Christmas** and **System default** (follows the device's light/dark setting and updates when it changes).
- Themes switch instantly without a page reload, keep page state (open dialogs, selections, 3D views), and are saved in `localStorage` (`haraya:theme`) so every page opens in the same theme.
- The theme is applied before the page paints, so there is no flash of the wrong theme.
- Christmas adds a greeting banner, a string of lights under the header, a wreath on the logo, light snowfall (disabled for reduced-motion users) and festive accents.
- Christmas also plays *The Bells At Christmas* (`public/The Bells At Christmas.mp3`) on a loop, and stops it when you switch to another theme. Browsers block sound until the visitor interacts with the page, so on a fresh page load the music starts on the first click, tap or key press. Choosing Christmas from the theme menu starts it straight away. The song continues from the same point when you move between pages, and a **Music on / Play music** button in the greeting banner turns it off or on (the choice is remembered).
- The map, status pills, forms, dialogs and the staff portal all have theme-aware colours.

---

## Staff features (`/staff.html`)

The staff portal is a separate console with a navy header (date, theme button, Guest site link and **+ New reservation**) and a tab bar for Dashboard, Reservations, Guests, Rooms, Events and Notifications (the tabs scroll sideways on small screens). It has **no login**, because this is a simulation.

### Dashboard
- Pick any date to see occupancy for that night; the default is today.
- Summary cards show **Total rooms** (20), **Available rooms**, **Occupied rooms** and **Current reservations** (Pending + Confirmed + Checked In).
- **Occupancy by category** shows a bar for each category with free and total room counts.
- **Reservation status** counts link straight to a filtered reservation list.
- **Arrivals** and **Departures** lists for the selected date. When the date is today, they have one-click **Check in** and **Check out** buttons.
- The latest simulated notifications are listed at the bottom.

### Reservations
- A table of every reservation showing reference, guest, category and room, stay dates, nights, guests, total, status and whether the guest or staff made it.
- **Search and filters** (results update as you type):
  - guest name, email, phone or booking reference
  - room category
  - status
  - stay dates ("staying from" / "staying to" finds stays that overlap the range)
- Change a reservation's **status** directly from the table.
- **View** opens the full details, a status changer and the notification history.
- **Create** a reservation:
  - for a new guest or an existing guest
  - with any category and dates (staff may record past or walk-in stays)
  - with automatic room assignment, or a specific room picked from a list of rooms free for those dates
  - with an initial status of Pending or Confirmed
  - with a live free-room count and price total in the form
- **Edit** a reservation's category, room, dates, guests or notes. Availability is re-checked, and the reservation keeps its current room if that room is still free.
- **Cancel** a reservation after a confirmation prompt.

### Reservation statuses
`Pending` → `Confirmed` → `Checked In` → `Checked Out`, plus `Cancelled`.

- **Checked In** is only allowed on or after the check-in date, and before the check-out date.
- **Checked Out** is only allowed for a guest who is currently checked in.
- **Cancelling** (by guest or staff) is allowed for Pending or Confirmed reservations.
- **Reinstating** a cancelled or checked-out reservation re-checks availability. It gets another room in the same category if needed, and is refused if the category is full.

### Guests
- A searchable guest list (name, email or phone) showing each guest's total and active reservations and their latest check-in.
- Open a guest profile to **edit** their name, email or phone and see their full reservation history.
- **Book** a new reservation for an existing guest straight from the list.
- Each guest is identified by their email address. A returning guest who books with the same email reuses their profile, and two guests can't share an email.

### Rooms & availability
- One summary card per category showing tonight's available, reserved and in-house rooms.
- A **14-day timeline** listing all 20 rooms, grouped into Economy, Deluxe and VIP:
  - each booking appears as a colored block (Pending, Confirmed or Checked In) labelled with the guest name and reference
  - click a block to open that reservation
  - today's column is highlighted
  - move the timeline by 7 days, jump back to today, or choose any start date
- Each room shows a status chip (Available, Reserved or Occupied) and the current guest's name.

### Events & Venues
- Summary cards: upcoming events (and how many in the next 7 days), events happening now, pending venue requests and registered places.
- **Pending venue requests** from guests, with **Approve** (re-checks conflicts) and **Decline**.
- An **events table** with search (title, code, organiser) and filters for venue, category, status and dates. It shows code, title, venue and setup, date and time, a capacity bar (registered / capacity / remaining) and a status control (*Scheduled → Ongoing → Completed*).
- A **14-day venue schedule** grid (one row per venue) with colour-coded event blocks; click a block to open the event.
- **Create / edit an event:**
  - title, category, venue, ballroom setup, date, start and end times, capacity, price, registration mode (open, invitation, no registration), public/private, organiser, contact details, poster theme, description and inclusions;
  - a **live conflict check** while you choose the venue and time;
  - the server rejects overlapping events and capacities above the venue or setup limit.
- **View an event:** full details and the **attendee list** (reference, name, contact, places, status), with per-registration cancel and a "Guest view" link.
- **Cancel an event** after a confirmation prompt. Its registrations are voided and attendees get a simulated cancellation email.
- The note under the page title also links to the guest Events page and the Property map.

### Notifications (simulated email outbox)
- Lists every simulated email the system has produced (reservations, event registrations, venue requests and confirmations, schedule changes and cancellations), with time, reference, recipient, type, subject and message. Nothing is actually sent.

---

## Reservation and availability rules

These rules are enforced on the server (`server/reservations.js`), so both the guest site and the staff dashboard follow them:

1. **No overbooking.** Every reservation is assigned to a real room that is free for the **whole stay**, so a category can never be booked beyond its room count.
2. **No overlapping bookings for the same room.** Two stays overlap when `existing.checkIn < new.checkOut AND new.checkIn < existing.checkOut`.
3. **The check-out date frees the room.** A guest checking out on the 12th leaves the room available for someone arriving on the 12th.
4. **Cancelled and checked-out reservations release their room.** Only `Pending`, `Confirmed` and `Checked In` reservations hold a room.
5. **Availability is always recalculated** from the reservation records after every create, modify, cancel or status change. Nothing is cached.
6. **Several guests can book at the same time.** Each booking runs inside a database transaction (`BEGIN IMMEDIATE`), so two guests competing for the last room can't both get it.
7. **Validation:**
   - first name, last name, email and phone are required
   - email and phone must have a valid format
   - check-out must be **after** check-in (same-day or earlier is rejected)
   - guests can't book check-in dates in the past
   - stays are limited to 30 nights
   - the number of guests can't exceed the room's capacity
8. **Prices** are calculated as nightly rate × nights and saved with the reservation.

---

## Sample data

On first start, the database is filled with **14 fictional guests and reservations** (all emails use `@example.com`). Their dates are set relative to the day the database is created, so there is always current activity: guests in-house, arrivals and departures today, upcoming Pending and Confirmed stays, a past checked-out stay and a cancelled booking.

Sample reservations are created through the same booking rules as real ones, so they can never put the inventory in an inconsistent state. An automated test checks this. Run `npm run reset` to start over with fresh sample data.

The database also gets **11 sample events**, created through the same conflict and capacity rules, with dates relative to the creation day:
- the **Bakebe DIY Cake-Baking Workshop** (next 30 September, ₱999, Event Studio, with sample registrations);
- jazz, film, musical and comedy nights in the Haraya Theater;
- a Sunset Acoustic Session on the Pool Deck;
- a private wedding reception, a leadership summit and a New Year's Eve gala in the Grand Ballroom;
- a Christmas Tree Lighting & Fountain Show at the Fountain Plaza;
- one pending guest venue request.

Event details, prices and dates are sample information. The Bakebe event is based on a supplied promotional advertisement and does not imply any partnership with Bakebe or The Dessert Museum.

---

## Data storage

Records are stored in a local **SQLite** database at `data/hotel.db`, so they survive page refreshes and server restarts. Tables:

| Table | Contents |
|---|---|
| `rooms` | The 20 rooms (number and category) |
| `guests` | Guest profiles (name, unique email, phone) |
| `reservations` | Bookings (reference, guest, room, dates, guests, status, rate, total, source) |
| `events` | Events and venue requests (code, title, category, venue, setup, date, times, capacity, price, registration mode, visibility, organiser, status) |
| `event_registrations` | Event registrations (reference, event, guest details, places, status) |
| `notifications` | Simulated email messages (reservations and events) |
| `meta` | Records when sample data was created |

Venues (codes, capacities, ballroom setups) are defined in `server/venues.js`. Map floors, areas and walkways are static data in `public/js/map-data.js`. The theme and "You are here" choices are stored only in the browser's `localStorage`.

---

## API reference

All endpoints return JSON. Errors look like `{ "error": "...", "details": { "field": "message" } }`, with status `400` (validation), `404` (not found) or `409` (conflict or unavailable).

**Guest and shared endpoints**

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/config` | Room types, statuses, total rooms, today's date |
| GET | `/api/availability?checkIn=&checkOut=` | Available / booked count per category |
| POST | `/api/reservations` | Create a guest booking |
| POST | `/api/reservations/lookup` | Find a booking by `reference` + `email` |
| PUT | `/api/reservations/:reference` | Modify a booking (body must include `email`) |
| POST | `/api/reservations/:reference/cancel` | Cancel a booking (body must include `email`) |
| GET | `/api/venues` | Venues, setups, event categories and statuses |
| GET | `/api/venues/:code/schedule` | Upcoming events at a venue (private events masked) |
| GET | `/api/venues/:code/availability?date=` | Booked time slots at a venue on a date |
| POST | `/api/venues/:code/requests` | Request a venue (creates a Pending event that holds the slot) |
| GET | `/api/events?q=&venue=&category=&from=&to=` | Public events with status, remaining places and `canRegister` |
| GET | `/api/events/:id` | Public event details |
| POST | `/api/events/:id/register` | Register for an event (1–6 places) |
| POST | `/api/event-registrations/:reference/cancel` | Cancel a registration (body must include `email`) |

**Staff endpoints**

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/staff/dashboard?date=` | Dashboard statistics for a date |
| GET | `/api/staff/rooms?start=&days=` | Room timeline (1–31 days) |
| GET | `/api/staff/free-rooms?category=&checkIn=&checkOut=&excludeId=` | Room numbers free for a stay |
| GET | `/api/staff/reservations?q=&category=&status=&from=&to=` | Search and filter reservations |
| GET | `/api/staff/reservations/:id` | Reservation details + notifications |
| POST | `/api/staff/reservations` | Create a reservation |
| PUT | `/api/staff/reservations/:id` | Edit a stay |
| PATCH | `/api/staff/reservations/:id/status` | Change status |
| POST | `/api/staff/reservations/:id/cancel` | Cancel a reservation |
| GET | `/api/staff/guests?q=` | Search guests |
| GET | `/api/staff/guests/:id` | Guest profile + reservation history |
| PUT | `/api/staff/guests/:id` | Update guest details |
| GET | `/api/staff/notifications` | Latest 50 simulated emails |
| GET | `/api/staff/events?q=&venue=&category=&status=&from=&to=` | All events, including private and pending |
| GET | `/api/staff/events/conflicts?venue=&date=&startTime=&endTime=&excludeId=` | Live venue conflict check |
| GET | `/api/staff/events/:id` | Event details + attendee list |
| POST | `/api/staff/events` | Create an event |
| PUT | `/api/staff/events/:id` | Edit an event |
| PATCH | `/api/staff/events/:id/status` | Change status (approve, ongoing, completed) |
| POST | `/api/staff/events/:id/cancel` | Cancel an event (voids registrations, notifies attendees) |
| POST | `/api/staff/event-registrations/:id/cancel` | Cancel one registration |

---

## Automated tests

`npm test` runs **31 tests** against an in-memory database.

**Reservations** (`test/reservations.test.js`, 16 tests) check that:

- the inventory has exactly 10 Economy, 6 Deluxe and 4 VIP rooms, and starts fully available
- booking reduces availability and returns a valid reference and correct total
- a full category rejects further bookings
- no room ever gets overlapping reservations
- a room is free again on the previous guest's check-out date
- cancellation releases the room
- modifying re-checks availability, recalculates the total and never conflicts with the booking's own room
- reinstating a cancelled booking is refused when the category is full
- staff can't assign a room that is already taken
- required fields, email format, date order, past dates and guest capacity are validated
- status rules for check-in and check-out are enforced
- guest lookup requires a matching reference and email
- sample data never overbooks any night
- notifications are recorded for confirmations, changes and cancellations

**Events** (`test/events.test.js`, 11 tests) check that:

- overlapping events in the same venue are rejected, while back-to-back events, other venues and other dates are allowed
- cancelled events release the venue and pending venue requests hold it
- editing re-checks conflicts but never conflicts with itself, and approving a request re-checks conflicts
- dates, times, venue and setup capacities are validated
- registration tracks capacity, prevents overbooking and duplicate emails, and is closed for past, ongoing, private and invite-only events
- cancelling an event voids its registrations and records notifications
- guests checking venue availability never see private event details
- the sample events (including the Bakebe workshop) seed without conflicts

**Map** (`test/map.test.js`, 4 tests) check that:

- every walkway references existing points and every area has a unique id and a valid floor
- every guest area is reachable from the lobby, including by a step-free route
- every area has a walking route to an exit on its own floor without lifts or escalators (illustrative evacuation)
- every bookable event venue appears on the map

---

## Project structure

```
hotelsystem/
├── server.js                 # Entry point: opens DB, seeds sample data, starts Express
├── server/
│   ├── config.js             # Port, database path, public, Three.js and font folders
│   ├── inventory.js          # Room categories, rates, the 20-room list, statuses
│   ├── db.js                 # SQLite schema, room setup, transactions
│   ├── reservations.js       # Availability, room assignment, booking rules, staff queries
│   ├── venues.js             # Event venues, capacities and ballroom setups
│   ├── events.js             # Events, venue conflicts, registrations, venue requests
│   ├── validation.js         # Input validation and error class
│   ├── dates.js              # Calendar-date helpers (YYYY-MM-DD)
│   ├── seed.js               # Fictional sample reservations and events
│   ├── reset.js              # `npm run reset`
│   └── app.js                # REST API routes, static files, /vendor/three, /vendor/fonts
├── public/
│   ├── index.html            # Guest website
│   ├── room.html             # Virtual Room Tour (3D) page
│   ├── amenities.html        # Hotel Amenities & Recreation page (cards + live 3D preview)
│   ├── facility.html         # 3D Facility Explorer
│   ├── events.html           # Events & Celebrations page
│   ├── map.html              # Property map (hotel + Galleria)
│   ├── staff.html            # Staff dashboard
│   ├── css/styles.css        # Shared design system + guest styles
│   ├── css/room3d.css        # 3D viewer layout (rooms and facilities), hotspots, move pad
│   ├── css/amenities.css     # Amenities page, facility explorer and homepage amenity cards
│   ├── css/events.css        # Events page, posters, calendar, dialogs, homepage teaser
│   ├── css/map.css           # Property map
│   ├── css/themes.css        # Dark and Christmas themes + theme switcher
│   ├── css/staff.css         # Dashboard layout
│   ├── js/theme.js           # Theme preference (light / dark / Christmas / system), switcher
│   ├── js/site.js            # Shared guest-page header: scroll state, mobile menu, footer year
│   ├── js/common.js          # API client, toasts, form helpers, formatting
│   ├── js/guest.js           # Guest site logic (incl. homepage events teaser)
│   ├── js/events.js          # Events page: list, calendar, filters, details, registration, venue requests
│   ├── js/event-art.js       # Generated SVG event posters
│   ├── js/map-data.js        # Map floors, areas, fictional shops, walkways, illustrative safety points
│   ├── js/map.js             # Map rendering, search, zoom/pan, routing, safety layer
│   ├── js/room.js            # 3D tour page: tabs, details panel, availability, booking link
│   ├── js/room3d/viewer.js   # WebGL renderer, camera controls, walking, hotspots, viewpoints, auto tour
│   ├── js/room3d/rooms.js    # Room shells and the Economy / Deluxe / VIP layouts
│   ├── js/room3d/furniture.js# Procedural furniture, lighting and decor models
│   ├── js/room3d/textures.js # Generated textures (wood, fabric, marble, art, window views)
│   ├── js/facilities-data.js # Facility names, descriptions, hours and access labels (sample info)
│   ├── js/amenities.js       # Amenities page: cards, filter, live 3D preview
│   ├── js/facility.js        # Facility explorer: tabs, hotspots panel, move pad, fallbacks
│   ├── js/facility3d/
│   │   ├── index.js          # Lazy loader for the facility scenes
│   │   ├── kit.js            # Shared helpers: textures, signs, live screens, animation
│   │   ├── pool.js           # Infinity Pool & Sun Deck
│   │   ├── gym.js            # Haraya Fitness Centre
│   │   ├── sauna.js          # Cedar Sauna
│   │   ├── restaurant.js     # Sunset Brasserie
│   │   ├── casino.js         # The Gilded Room (visual simulation only)
│   │   ├── gameroom.js       # Arcade & Game Hall (incl. golf simulator and batting cage)
│   │   ├── fountain.js       # Grand Entrance Fountain & plaza
│   │   ├── theater.js        # Haraya Theater
│   │   └── ballroom.js       # Grand Ballroom (wedding / banquet / conference setups)
│   ├── js/staff.js           # Staff dashboard logic
│   ├── js/staff-events.js    # Staff Events & Venues view
│   └── img/                  # Logo emblem, photos and 3D fallback images (img/amenities/)
├── test/                     # Automated tests (reservations, events, map)
└── data/hotel.db             # SQLite database (created on first run, git-ignored)
```

---

## Credits and limitations

- Photos are royalty-free images from [Unsplash](https://unsplash.com), stored locally so the app works offline.
- The 3D rooms and facilities use [Three.js](https://threejs.org) (MIT licence). All models and textures are generated in code, so no third-party 3D assets are used. The facility preview images were rendered from these scenes.
- Facility information is sample data for this academic project. The casino-style lounge has no real gambling, and no facility connects to an external booking service.
- Events, prices and registrations are simulated: no tickets are issued and no payment is taken. The Bakebe workshop is sample content based on a supplied advertisement; the hotel is not affiliated with Bakebe or The Dessert Museum.
- Haraya Bay Galleria and its shops are fictional. Map exits, fire-safety equipment and evacuation routes are illustrative, have not been validated against any building plan, and are not certified for real emergencies.
- Fonts: [Cormorant Garamond](https://fontsource.org/fonts/cormorant-garamond) and [Jost](https://fontsource.org/fonts/jost) (SIL Open Font License), installed via `@fontsource` and served locally.
- The layout is adapted from a supplied design concept for academic purposes only. Haraya Bay By Zaldy Land is a fictional property and is not affiliated with any real hotel.
- The staff portal has no authentication, and there is no real payment or email integration. Both are intentionally out of scope for this simulation.
