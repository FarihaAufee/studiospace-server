// Seed 26 realistic StudioSpace demo studios into the existing `studios` collection.
//
// - Idempotent: every record carries a deterministic 24-hex `_id` derived
//   from its slug, so re-running never inserts duplicates.
// - Non-destructive: only documents that do not exist yet are inserted;
//   existing (user-created) studios are never updated or deleted.
// - Fields match utils/validation.js (validateStudioPayload) exactly.
//
// Run: npm run seed:studios

import { MongoClient, ObjectId } from "mongodb";
import crypto from "node:crypto";
import dotenv from "dotenv";
import { validateStudioPayload } from "../utils/validation.js";

dotenv.config();

/* ------------------------------------------------------------------ */
/* Demo data                                                           */
/* ------------------------------------------------------------------ */

const DEMO_HOSTS = [
  { hostName: "Rahman Ahmed", hostEmail: "rahman.ahmed@studiospace-demo.com" },
  { hostName: "Nusrat Jahan", hostEmail: "nusrat.jahan@studiospace-demo.com" },
  { hostName: "Tanvir Hasan", hostEmail: "tanvir.hasan@studiospace-demo.com" },
  { hostName: "Farhana Islam", hostEmail: "farhana.islam@studiospace-demo.com" },
  { hostName: "Sabbir Khan", hostEmail: "sabbir.khan@studiospace-demo.com" },
  { hostName: "Meha Chowdhury", hostEmail: "meha.chowdhury@studiospace-demo.com" },
];

// Category values use the canonical title form (mirrors the existing
// "Modern Photography Studio" document and utils/categories.js).
const STUDIOS = [
  // ------------------------------ Photo Studios (6) ------------------------------
  {
    slug: "lumina-photo-studio-dhanmondi",
    title: "Lumina Photo Studio",
    category: "Photo Studios",
    location: "Dhaka",
    address: "House 27, Road 8, Dhanmondi, Dhaka 1205",
    image:
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80",
    overview:
      "A daylight-filled photography studio with a 3-metre cyc wall, adjustable LED panels and a full set of colored backdrops. Ideal for fashion lookbooks, product shoots and family portraits.",
    hourlyRate: 1800,
    securityDeposit: 2500,
    maxCapacity: 14,
    amenities: ["Professional Lighting", "Cyc Wall", "Changing Room", "Air Conditioning", "WiFi", "Makeup Station"],
  },
  {
    slug: "aperture-house-gulshan",
    title: "Aperture House",
    category: "Photo Studios",
    location: "Dhaka",
    address: "Level 4, Bay's Galleria, Gulshan 1, Dhaka 1212",
    image:
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80",
    overview:
      "Rooftop-adjacent studio in Banani with huge windows, seamless paper roll backdrops in 12 colours and a living-room style lifestyle set for commercial and e-commerce photography.",
    hourlyRate: 2200,
    securityDeposit: 4000,
    maxCapacity: 20,
    amenities: ["Floor-to-Ceiling Windows", "Paper Backdrops", "Professional Lighting", "Air Conditioning", "WiFi", "Free Parking"],
  },
  {
    slug: "chhaya-studio-chattogram",
    title: "Chhaya Creative Studio",
    category: "Photo Studios",
    location: "Chattogram",
    address: "Plot 14, Zakir Hossain Road, Khulshi, Chattogram 4000",
    image:
      "https://images.unsplash.com/photo-1520390138845-fd4d177aa2fb?auto=format&fit=crop&w=1200&q=80",
    overview:
      "Khulshi's first Nhaka-style professional studio with blackout capability, strobe lighting kits and a prop warehouse. Popular for wedding previews, catalogue shoots and children's portraits.",
    hourlyRate: 1500,
    securityDeposit: 2000,
    maxCapacity: 12,
    amenities: ["Blackout Studio", "Professional Lighting", "Prop Library", "Changing Room", "Air Conditioning", "WiFi"],
  },
  {
    slug: "obhino-photo-workshop-uttara",
    title: "Obhino Photo Workshop",
    category: "Photo Studios",
    location: "Dhaka",
    address: "House 52, Sector 7, Uttara, Dhaka 1230",
    image:
      "https://images.unsplash.com/photo-1554048612-b6a482bc67e5?auto=format&fit=crop&w=1200&q=80",
    overview:
      "Purpose-built product photography corner with light tent and macro setup, plus a full studio floor for portraits. On-call photographer assistant available on request.",
    hourlyRate: 1200,
    securityDeposit: 1500,
    maxCapacity: 8,
    amenities: ["Photo Lighting", "Light Tent Setup", "Makeup Station", "Air Conditioning", "WiFi", "Free Parking"],
  },
  {
    slug: "surjo-daylight-studio-sylhet",
    title: "Surjo Daylight Studio",
    category: "Photo Studios",
    location: "Sylhet",
    address: "Road 3, Subid Bazar, Sylhet 3100",
    image:
      "https://images.unsplash.com/photo-1471341971476-ae15ff979d0b?auto=format&fit=crop&w=1200&q=80",
    overview:
      "A north-facing daylight studio with big windows, wooden floors and a warm neutral aesthetic. The most requested natural-light space in Sylhet for editorial and portrait work.",
    hourlyRate: 1100,
    securityDeposit: 1500,
    maxCapacity: 10,
    amenities: ["Natural Daylight", "Wooden Floor Set", "Changing Room", "Air Conditioning", "WiFi", "Free Parking"],
  },
  {
    slug: "cholochitro-film-photo-studio-mirpur-doe-c",
    title: "Cholochitro Corner Studio",
    category: "Photo Studios",
    location: "Dhaka",
    address: "Block D, DOE Housing Scheme, Shyamoli, Dhaka 1207",
    image:
      "https://images.unsplash.com/photo-1503389152951-9f343605f61e?auto=format&fit=crop&w=1200&q=80",
    overview:
      "A two-floor studio near Shishu Mela with a wide 4-metre white cyc wall, ceiling-mounted rigging and an in-house set carpenter for custom photo builds.",
    hourlyRate: 2500,
    securityDeposit: 5000,
    maxCapacity: 25,
    amenities: ["4m Cyc Wall", "Grid & Rigging", "Professional Lighting", "Change Area", "Air Conditioning", "WiFi", "Free Parking"],
  },

  // ------------------------------ Film Stages (5) ------------------------------
  {
    slug: "fakhruddin-film-stage-dhaka",
    title: "Fakhruddin Film Stage",
    category: "Film Stages",
    location: "Dhaka",
    address: "Line No. 2, Bangladesh Film City (FDC), Zirabo, Dhaka 1349",
    image:
      "https://images.unsplash.com/photo-1489599849927-2b91ca835ea1?auto=format&fit=crop&w=1200&q=80",
    overview:
      "A 240 sqm sound-treated stage with 5.5-metre ceilings, a full-door cyclorama and 3-phase power. Comes with a grip truck, dolly track and a dedicated art department bay.",
    hourlyRate: 8000,
    securityDeposit: 15000,
    maxCapacity: 40,
    amenities: ["Soundproof Stage", "5.5m Ceiling", "Cyclorama", "Grip Package", "Loading Dock", "Backup Generator", "Free Parking"],
  },
  {
    slug: "shomporko-production-stage-tejgaon",
    title: "Shomporko Production Stage",
    category: "Film Stages",
    location: "Dhaka",
    address: "Plot 2/B, Tejgaon I/A, Dhaka 1208",
    image:
      "https://images.unsplash.com/photo-1524850011238-e3d235c7d4c9?auto=format&fit=crop&w=1200&q=80",
    overview:
      "Mid-size sound stage built for TV commercials and music videos, with a U-shaped lighting grid, overhead barndoors and a green screen bay on the adjoining mezzanine.",
    hourlyRate: 6500,
    securityDeposit: 12000,
    maxCapacity: 30,
    amenities: ["Lighting Grid", "Green Screen", "Makeup Station", "Air Conditioning", "Backup Generator", "WiFi", "Free Parking"],
  },
  {
    slug: "ontorongo-audio-stage-jahaj-bari",
    title: "Ontorongo Stage 1",
    category: "Film Stages",
    location: "Dhaka",
    address: "Jahaj Bari Road, Sutrapur, Dhaka 1100",
    image:
      "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1200&q=80",
    overview:
      "A converted warehouse stage with rooftop water-tank access and a cargo-lift loading bay, frequently used for drama serial sets, web series shoots and short films.",
    hourlyRate: 5500,
    securityDeposit: 10000,
    maxCapacity: 35,
    amenities: ["Warehouse Set Space", "Hanging Light Rig", "Loading Dock", "Backup Generator", "Free Parking"],
  },
  {
    slug: "padma-river-side-film-stage-narayanganj",
    title: "Padma Riverside Film Stage",
    category: "Film Stages",
    location: "Narayanganj",
    address: "Khanpur Ferry Ghat Road, Fatullah, Narayanganj 1400",
    image:
      "https://images.unsplash.com/photo-1533488765986-dfa2a9939acd?auto=format&fit=crop&w=1200&q=80",
    overview:
      "An open-sided waterside stage with a wide jetty, Ola-type lighting stand and a boat-shed costume and props store. Beautiful golden-hour production space.",
    hourlyRate: 7000,
    securityDeposit: 14000,
    maxCapacity: 45,
    amenities: ["Waterfront Access", "Jetty Platform", "Props Store", "Backup Generator", "Free Parking", "Cafeteria"],
  },
  {
    slug: "bongo-bondhu-film-stage-coxs-bazar",
    title: "Long Beach Film Stage",
    category: "Film Stages",
    location: "Cox's Bazar",
    address: "Kalatoli Road, Cox's Bazar 4700",
    image:
      "https://images.unsplash.com/photo-1526229659967-6e33ca2fedd2?auto=format&fit=crop&w=1200&q=80",
    overview:
      "Staging bay five minutes from the world's longest natural sea beach, with production office rooms, a star van parking lot and pre-cleared beach permit assistance.",
    hourlyRate: 9000,
    securityDeposit: 20000,
    maxCapacity: 50,
    amenities: ["Beach Staging Area", "Production Offices", "Star Van Parking", "Backup Generator", "Cafeteria", "WiFi"],
  },

  // ------------------------------ Podcast Rooms (5) ------------------------------
  {
    slug: "kotha-podcast-room-banani",
    title: "Kotha Podcast Room",
    category: "Podcast Rooms",
    location: "Dhaka",
    address: "House 9, Road 11, Banani, Dhaka 1213",
    image:
      "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?auto=format&fit=crop&w=1200&q=80",
    overview:
      "A sound-treated podcast room with a Shure SM7B, RØDECaster Pro II mixer and a three-camera multicam setup. Records straight into an SD card so you leave with the raw files.",
    hourlyRate: 1600,
    securityDeposit: 3000,
    maxCapacity: 6,
    amenities: ["Acoustic Treatment", "Shure Microphones", "RØDECaster Pro II", "Multi-camera Setup", "Air Conditioning", "WiFi", "Studio Monitors"],
  },
  {
    slug: "jhonj-podcast-lounge-gulshan-2",
    title: "Jhonj Podcast Lounge",
    category: "Podcast Rooms",
    location: "Dhaka",
    address: "Level 6, Gulshan Tower, Gulshan 2, Dhaka 1212",
    image:
      "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=1200&q=80",
    overview:
      "Lounge-style podcast set with a four-seat wooden table, warm film lighting and live streaming-capable internet. Built for interview shows and LinkedIn audio series.",
    hourlyRate: 2000,
    securityDeposit: 3500,
    maxCapacity: 8,
    amenities: ["4-Seat Podcast Table", "Ring & Key Lighting", "Shure SM7B", "Live Stream Internet", "Air Conditioning", "WiFi"],
  },
  {
    slug: "bhasha-audio-room-chattogram-agrabad",
    title: "Bhasha Audio Room",
    category: "Podcast Rooms",
    location: "Chattogram",
    address: "Sheikh Mujib Road, Agrabad, Chattogram 4100",
    image:
      "https://images.unsplash.com/photo-1581594693702-fbdc51b2763b?auto=format&fit=crop&w=1200&q=80",
    overview:
      "Two-presenter audio podcast room with dual broadcast chains, isolated 100% noise-floor construction and a Bangla-English teleprompter on a mounted iPad.",
    hourlyRate: 1400,
    securityDeposit: 2500,
    maxCapacity: 5,
    amenities: ["Broadcast Microphones", "Isolation Booth", "Audio Mixer", "Air Conditioning", "WiFi", "Free Parking"],
  },
  {
    slug: "bolo-podcast-studio-sylhet",
    title: "Bolo Podcast Studio",
    category: "Podcast Rooms",
    location: "Sylhet",
    address: "Mirboxtula Point, Amberkhana, Sylhet 3100",
    image:
      "https://images.unsplash.com/photo-1589903308904-1010c2294adc?auto=format&fit=crop&w=1200&q=80",
    overview:
      "Amberkhana's podcast spot for students and startup founders — two seated mic kits, an 8-channel Zoom recorder and a set that works on camera.",
    hourlyRate: 1000,
    securityDeposit: 2000,
    maxCapacity: 6,
    amenities: ["Zoom Recorder", "Podcast Mics", "Camera-Ready Set", "Air Conditioning", "WiFi", "Free Parking"],
  },
  {
    slug: "kanthe-heri-podcast-corner-rajshahi",
    title: "Kanthe Heri Podcast Corner",
    category: "Podcast Rooms",
    location: "Rajshahi",
    address: "Greater Road (Shaheb Bazar), Rajshahi 6100",
    image:
      "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=80",
    overview:
      "A cosy two-person podcast nook with velvet curtains, two SM58s and an interface-presets board for quick warm-up shows. Bright evening lighting included.",
    hourlyRate: 900,
    securityDeposit: 1500,
    maxCapacity: 4,
    amenities: ["Podcast Mics", "Audio Interface", "Warm Lighting", "Air Conditioning", "WiFi", "Free Parking"],
  },

  // ------------------------------ Music Suites (5) ------------------------------
  {
    slug: "sur-ota-music-suite-dhanmondi-27",
    title: "Sur Ota Music Suite",
    category: "Music Suites",
    location: "Dhaka",
    address: "House 18, Road 27, Dhanmondi, Dhaka 1209",
    image:
      "https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?auto=format&fit=crop&w=1200&q=80",
    overview:
      "A fully floating-floored rehearsal and tracking suite with a house drum kit, guitar amps, a vintage upright piano and a Pro Tools rig running through Yamaha HS monitors.",
    hourlyRate: 2500,
    securityDeposit: 4000,
    maxCapacity: 10,
    amenities: ["Acoustic Treatment", "Drum Kit", "Guitar Amps", "Upright Piano", "Pro Tools Rig", "Studio Monitors", "Air Conditioning"],
  },
  {
    slug: "taal-taranga-music-room-bashundhara-r-a",
    title: "Taal Taranga Music Room",
    category: "Music Suites",
    location: "Dhaka",
    address: "Block C, Bashundhara R/A, Dhaka 1229",
    image:
      "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?auto=format&fit=crop&w=1200&q=80",
    overview:
      "Percussion-focused music room with a tabla-and-harmonium corner, a six-piece drum kit and a second room for vocal overdubs. Great for classical fusions and band practice.",
    hourlyRate: 1800,
    securityDeposit: 3000,
    maxCapacity: 8,
    amenities: ["Drum Kit", "Tabla & Harmonium", "Vocal Booth", "Studio Monitors", "Air Conditioning", "WiFi", "Free Parking"],
  },
  {
    slug: "shur-sobuj-music-suite-chattogram-khulshi",
    title: "Shur Sobuj Music Suite",
    category: "Music Suites",
    location: "Chattogram",
    address: "House 6, South Khulshi, Chattogram 4201",
    image:
      "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=1200&q=80",
    overview:
      "Home-studio style music suite with a MIDI corner, Focusrite interface, acoustic and electric guitars on wall mounts, and a treated control room separated by a glass partition.",
    hourlyRate: 1500,
    securityDeposit: 2500,
    maxCapacity: 6,
    amenities: ["MIDI Keyboard", "Focusrite Interface", "Electric & Acoustic Guitars", "Treated Control Room", "Air Conditioning", "WiFi"],
  },
  {
    slug: "roder-konthe-music-studio-uttara-10",
    title: "Roder Konthe Music Studio",
    category: "Music Suites",
    location: "Dhaka",
    address: "House 21, Road 10, Sector 10, Uttara, Dhaka 1230",
    image:
      "https://images.unsplash.com/photo-1507838153414-b4b713384a76?auto=format&fit=crop&w=1200&q=80",
    overview:
      "Late-night-friendly music suite with a bleed room for singing practice, a Roland keyboard amplifier and Marshall stack, plus a sofa lounge for producers to hang out.",
    hourlyRate: 2000,
    securityDeposit: 3500,
    maxCapacity: 10,
    amenities: ["Marshall Amp", "Keyboard Amp", "Bleed Room", "Studio Monitors", "Air Conditioning", "WiFi", "Free Parking"],
  },
  {
    slug: "bikeli-bandhob-music-room-khulna-sonadanga",
    title: "Bikeli Bandhob Music Room",
    category: "Music Suites",
    location: "Khulna",
    address: "Sundarban Housing Estate Road, Sonadanga, Khulna 9000",
    image:
      "https://images.unsplash.com/photo-1445985543470-41fba5c3144a?auto=format&fit=crop&w=1200&q=80",
    overview:
      "A garage-style band practice room in Sonadanga with hard-shell insulation, a large storage loft for gear and monthly rehearsal lockers for regular bands.",
    hourlyRate: 1200,
    securityDeposit: 2000,
    maxCapacity: 12,
    amenities: ["Band Setup", "Drum Kit", "Bass Amp", "Gear Lockers", "Air Conditioning", "Free Parking"],
  },

  // ------------------------------ Art Workshops (5) ------------------------------
  {
    slug: "rokto-chokh-art-workshop-zoo-road",
    title: "Chokh Art Workshop",
    category: "Art Workshops",
    location: "Dhaka",
    address: "Road 5A, Zoo Road (Mirpur 1), Dhaka 1216",
    image:
      "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=80",
    overview:
      "A bright 20-seat art workshop with long teak workbenches, ten standing easels, an apron station and a washable floor. Sip-and-paint classes, kids' art camps and sketch meetups.",
    hourlyRate: 1500,
    securityDeposit: 2500,
    maxCapacity: 20,
    amenities: ["Easels & Desks", "Apron Station", "Washable Floor", "Sinks", "Air Conditioning", "WiFi", "Free Parking"],
  },
  {
    slug: "rong-tuli-pottery-studio-mohakhali-wt",
    title: "Rong Tuli Pottery Studio",
    category: "Art Workshops",
    location: "Dhaka",
    address: "Wireless Gate, Mohakhali C/A, Dhaka 1212",
    image:
      "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe265?auto=format&fit=crop&w=1200&q=80",
    overview:
      "Pottery-focused art studio with three wheels, a mid-size electric kiln, clay storage and a dedicated glazing counter. Wheel-throwing and hand-building classes run weekly.",
    hourlyRate: 2000,
    securityDeposit: 3500,
    maxCapacity: 14,
    amenities: ["Pottery Wheels", "Electric Kiln", "Clay & Glaze Supplies", "Sinks", "Air Conditioning", "WiFi"],
  },
  {
    slug: "chiro-koli-craft-workshop-khulna-khalishpur",
    title: "Koli Craft Workshop",
    category: "Art Workshops",
    location: "Khulna",
    address: "Shibbari Bazar Road, Khalishpur, Khulna 9000",
    image:
      "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=1200&q=80",
    overview:
      "A craft-heavy workshop space with needle-and-thread stations, a block printing table and bamboo-work counters. Weekend-only availability for family craft afternoons.",
    hourlyRate: 1000,
    securityDeposit: 1800,
    maxCapacity: 16,
    amenities: ["Craft Tables", "Block Printing Station", "Bamboo Work Counters", "Wash Area", "Air Conditioning", "WiFi"],
  },
  {
    slug: "ruf-surjo-life-drawing-studio-sylhet-zindabazar",
    title: "Surjo Life Drawing Studio",
    category: "Art Workshops",
    location: "Sylhet",
    address: "Chowhatta Point, Zindabazar, Sylhet 3100",
    image:
      "https://images.unsplash.com/photo-1515405295579-ba1b1a1a6063?auto=format&fit=crop&w=1200&q=80",
    overview:
      "North-lit sketching studio with 15 easels, nine drawing horses, huge skylights and a still-life cabinet that rotates weekly for composition practice.",
    hourlyRate: 1300,
    securityDeposit: 2000,
    maxCapacity: 15,
    amenities: ["15 Easels", "Skylights", "Still-life Cabinet", "Drawing Horses", "Air Conditioning", "WiFi"],
  },
  {
    slug: "chalchitra-sketch-corner-rajshahi-shaheb-bazar",
    title: "Chalchitra Sketch Corner",
    category: "Art Workshops",
    location: "Rajshahi",
    address: "Binodpur Road, Rajpara, Rajshahi 6100",
    image:
      "https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=1200&q=80",
    overview:
      "Sketch, watercolour and calligraphy corner with 16 workstations, a cursive-practice wall and paper-trim services on site. University students get a discounted hourly rate.",
    hourlyRate: 900,
    securityDeposit: 1500,
    maxCapacity: 16,
    amenities: ["Workstations", "Calligraphy Wall", "Paper Trimmer", "Wash Area", "Air Conditioning", "WiFi", "Free Parking"],
  },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Pick a demo host deterministically from the studio slug so every run
 * produces identical documents.
 */
function pickHost(slug) {
  const hash = crypto.createHash("sha256").update(`${slug}:host`).digest();
  const index = hash[0] % DEMO_HOSTS.length;
  return DEMO_HOSTS[index];
}

/**
 * Deterministic 24-hex-char _id derived from the studio slug (sha-256).
 * Same slug -> same _id on every run, which is what makes the seed
 * idempotent. Also keeps `_id` ObjectId-shaped so all existing lookup
 * helpers in studioController keep working unchanged.
 */
function studioId(slug) {
  return crypto.createHash("sha256").update(slug).digest("hex").slice(0, 24);
}

function buildStudioDocument(seed) {
  const now = new Date();

  const doc = {
    title: seed.title,
    category: seed.category,
    location: seed.location,
    address: seed.address,
    image: seed.image,
    overview: seed.overview,
    hourlyRate: seed.hourlyRate,
    securityDeposit: seed.securityDeposit,
    maxCapacity: seed.maxCapacity,
    amenities: seed.amenities,
    ...pickHost(seed.slug),
    createdAt: now,
    updatedAt: now,
  };

  // Round-trip through the API's own validator so a schema change later
  // fails the seed loudly instead of inserting incompatible documents.
  const { isValid, errors, data } = validateStudioPayload(doc, {
    requireAll: true,
  });

  if (!isValid) {
    throw new Error(
      `Seeded studio "${seed.slug}" failed validateStudioPayload: ${JSON.stringify(errors)}`
    );
  }

  return { _id: studioId(seed.slug), ...data, createdAt: now, updatedAt: now };
}

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  const uri = process.env.MONGODB_URL;
  const dbName = process.env.MONGODB_DB_NAME;

  if (!uri) throw new Error("MONGODB_URL is missing from the .env file");
  if (!dbName) throw new Error("MONGODB_DB_NAME is missing from the .env file");

  const collectionName =
    process.env.MONGODB_STUDIOS_COLLECTION || "studios";

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // Which of the demo studios are already seeded? Only missing ones
    // are inserted — nothing is updated, so user-created (or edited)
    // studios are preserved as-is.
    const seededIds = STUDIOS.map((s) => studioId(s.slug));
    const existing = await collection
      .find({ _id: { $in: seededIds } }, { projection: { _id: 1 } })
      .toArray();
    const existingIds = new Set(existing.map((doc) => String(doc._id)));

    const docs = STUDIOS.map(buildStudioDocument);
    const toInsert = docs.filter((doc) => !existingIds.has(String(doc._id)));

    if (toInsert.length === 0) {
      console.log(
        `Seed skipped: all ${STUDIOS.length} demo studios are already present in "${dbName}.${collectionName}".`
      );
    } else {
      const result = await collection.insertMany(toInsert, {
        ordered: false,
      });

      console.log(
        `Seed complete: ${result.insertedCount} new demo studio(s) inserted, ${STUDIOS.length - toInsert.length} already existed.`
      );
    }

    // Verification: total count + per-category distribution.
    const total = await collection.countDocuments({});
    console.log(`Total studios in collection: ${total}`);

    const byCategory = await collection
      .aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    console.log("Category distribution:");
    for (const { _id: category, count } of byCategory) {
      console.log(`  - ${category}: ${count}`);
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
