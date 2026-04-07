import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startTaskNotificationScheduler } from "./services/task-notification.scheduler";
import path from "path";
import { pool } from "./db";
import bcrypt from "bcryptjs";

const app = express();

// Serve attached assets (recipe images, etc.)
app.use('/attached_assets', express.static(path.resolve(process.cwd(), 'attached_assets')));
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// ANSI colour helpers
const c = {
  reset:  "\x1b[0m",
  dim:    "\x1b[2m",
  bold:   "\x1b[1m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  red:    "\x1b[31m",
  cyan:   "\x1b[36m",
  blue:   "\x1b[34m",
};

function statusColor(code: number) {
  if (code >= 500) return c.red;
  if (code >= 400) return c.yellow;
  if (code >= 300) return c.cyan;
  return c.green;
}

function methodColor(method: string) {
  switch (method) {
    case "GET":    return c.blue;
    case "POST":   return c.green;
    case "PATCH":
    case "PUT":    return c.yellow;
    case "DELETE": return c.red;
    default:       return c.reset;
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${c.dim}${formattedTime}${c.reset} ${c.dim}[${source}]${c.reset} ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (!path.startsWith("/api")) return;

    const status = res.statusCode;
    const sc = statusColor(status);
    const mc = methodColor(req.method);

    const durationStr = duration > 500
      ? `${c.yellow}${duration}ms${c.reset}`
      : `${c.dim}${duration}ms${c.reset}`;

    let logLine =
      `  ${mc}${c.bold}${req.method.padEnd(6)}${c.reset} ` +
      `${c.dim}${path}${c.reset} ` +
      `${sc}${c.bold}${status}${c.reset} ` +
      `${durationStr}`;

    if (capturedJsonResponse) {
      const formatted = JSON.stringify(capturedJsonResponse, null, 2)
        .split("\n")
        .map((line, i) => (i === 0 ? ` :: ${line}` : `     ${line}`))
        .join("\n");
      logLine += `\n${c.dim}${formatted}${c.reset}`;
    }

    console.log(logLine + "\n");
  });

  next();
});

async function ensureSeedData() {
  try {
    // Check if restaurants already exist
    const { rows } = await pool.query("SELECT COUNT(*) AS count FROM restaurants");
    if (parseInt(rows[0].count, 10) > 0) return;

    log("No restaurants found — seeding initial data…", "seed");

    // Create the two restaurants
    const r1 = await pool.query(
      "INSERT INTO restaurants (name) VALUES ($1) RETURNING id",
      ["Restaurant Immortl"]
    );
    const r2 = await pool.query(
      "INSERT INTO restaurants (name) VALUES ($1) RETURNING id",
      ["Restaurant Mini Pavillion"]
    );
    const immortlId = r1.rows[0].id;
    const miniId    = r2.rows[0].id;

    // Create admin user (attached to Immortl by default)
    const hash = await bcrypt.hash("demo123", 10);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role, restaurant_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING`,
      ["Admin User", "admin@demo.com", hash, "admin", immortlId]
    );

    log(`Seeded: Restaurant Immortl (${immortlId}), Restaurant Mini Pavillion (${miniId}), admin@demo.com`, "seed");
  } catch (err: any) {
    log(`Seed skipped: ${err.message}`, "seed");
  }
}

async function ensureSeedRecipes() {
  try {
    const { rows } = await pool.query("SELECT COUNT(*) AS count FROM recipes");
    // Only skip if we already have the full set (43 recipes)
    if (parseInt(rows[0].count, 10) >= 43) return;

    log("Seeding missing recipes…", "seed");

    // dish_base uses "" instead of null to satisfy any NOT NULL constraints
    const recipes = [
      { id: "11f4303c-6267-4f1e-9b43-080a47ed3e51", name: "American Wrap", dish_base: "Flat bread wrap", instructions: "1. Smear cream cheese on wrap.\n   2. Add spinach , avocado, 2 eggs cut in half and sprinkle of salt.\n   3. Close wrap and put on grill.\n   4. Toppings = sprouts & tortilla chips.\n", category: "Wrap", diet: "Omnivore", dish_sauce: "Cream cheese", timing_minutes: 15, post_type: "Kitchen", image_url: null },
      { id: "9ea5c66b-6295-43ea-b8d6-681aae3f63e5", name: "Apfel/Ananas", dish_base: "", instructions: "1/2 Sprudel Wasser\n1/2 Saft\n2 Trauben TK", category: "Schorle", diet: null, dish_sauce: null, timing_minutes: 5, post_type: "Bar", image_url: null },
      { id: "5e34b039-f270-4745-89e9-b1b6cfd1fd0f", name: "Avo bagel", dish_base: "Bagels", instructions: "1. Cut the bagel into halves and warm them up \n   2. Prepare 1/2 avocado for platting.\n   3. Smear a thick layer of cream cheese on both halves. \n   4. On the bottom half add spinach\n   5. On top of the spinach add the prepared avocado\n   6. Cover with the top half of the bagel.\n   7. Gently cut the whole Avo bagel into two halves.\n   8. Toppings = sprouts & tomatoes.\n", category: "Bread", diet: "Vegan", dish_sauce: "Cream cheese", timing_minutes: 7, post_type: "Kitchen", image_url: "/assets/images/avo-bagel.png" },
      { id: "93fd1ff6-435d-4cd9-9cda-5f36afbbb061", name: "Avocado bread", dish_base: "Vollkorn bread", instructions: "1. Heat up two whole grain breads.\n   2. Cut one avocado into halves for plating.\n   3. Plate the warm breads and smear a thick layer of  guacamole.\n   4. Place the cut avocados in opposite ends on the bread.\n   5. Add rucola in between the avocados.\n   6. Add carrots and sprouts on the alternating sides of the bread.\n   7. Toppings = Mozzarella balls.\n", category: "Bread", diet: "Omnivore", dish_sauce: "Guacamole", timing_minutes: 7, post_type: "Kitchen", image_url: null },
      { id: "0fc82d34-2e60-41a7-b32d-9eae6b4b2af0", name: "Beast mOAT", dish_base: "", instructions: "Mixer:\n80g Haferflocken\n1 Kokosmilch\n1 Chiasamen\n1 Ahornsirup\n\nToppings:\nBanane\nBlaubeeran\nApfel\nErdbeeran\nChiasamen\nMinze", category: "Bowls", diet: null, dish_sauce: null, timing_minutes: 7, post_type: "Bar", image_url: "/assets/images/beast-moat-bowl.png" },
      { id: "08f907b9-22bc-42ce-979c-100672a140d3", name: "Berry Detox", dish_base: "", instructions: "1 Sprudel\nBlaubeeran\nIngwer Stück/Saft\n1 Zitrone", category: "Schorle", diet: null, dish_sauce: null, timing_minutes: 5, post_type: "Bar", image_url: "/assets/images/berry-detox-water.png" },
      { id: "9f0af12c-a5b8-4c80-9686-b746e1e00c55", name: "Blue Magic", dish_base: "", instructions: "150ml Ananassaft\n150ml Kokosmilch\n1 Vanille Protein\n1 Blue Spirulina\n1 Banane TK\n1 Mango TK", category: "Shakes", diet: null, dish_sauce: null, timing_minutes: 7, post_type: "Bar", image_url: "/assets/images/blue-magic.png" },
      { id: "f8894247-8ded-4da1-a14a-e33dbecd0d59", name: "Breeze Bowl", dish_base: "", instructions: "Mixer:\n125ml Haferdrink\n1 Acai\n1 Banane TK\n4 Erdbeeran TK\nBlaubeeran\n\nToppings:\n1/2 Quinoa Pops\nBanane\nApfel\nWeintrauben\nErdbeeran\nKokosrasplen\nBienenpollen\nMinze", category: "Bowls", diet: null, dish_sauce: null, timing_minutes: 7, post_type: "Bar", image_url: "/assets/images/breeze-bowl.png" },
      { id: "0e335816-9411-4193-9cee-9cab56c0eb94", name: "Chimichuri Chicken Bowl", dish_base: "Rice", instructions: "1. Heat up chimichuri chicken & Sweet potatoes.\n   2. Plate Sushi rice.\n   3. On top of rice, add Mixed nuts, Edamame, Cucumber.\n   4. Mix chimichuri chicken with a drizzle of olive oil\n   5. Add heated Sweet potatoes and the mixed chicken. \n   6. Topping = sprouts & 3 plantain chips.\n", category: "Bowl", diet: "Omnivore", dish_sauce: "Peanut sauce", timing_minutes: 7, post_type: "Kitchen", image_url: "/assets/images/chimichuri-chicken-bowl.jpeg" },
      { id: "df1c0a78-b576-4b6d-bd91-3529250988f3", name: "Chimichuri Chicken Wrap", dish_base: "Flatbread wrap", instructions: "1. Warm up chimichuri chicken and sweet potatoes. \n   2. Add Peanut  sauce on the wrap.\n   3. Add cucumber, sprouts, mixed nuts.\n   4. Add the hot chimichuri chicken and sweet potatoes.\n   5. Close wrap and put it on the grill till closed.\n   6. Toppings = Tortilla chips & sprouts.", category: "Wrap", diet: "Omnivore", dish_sauce: "Peanut sauce", timing_minutes: 10, post_type: "Kitchen", image_url: "/assets/images/chimichuri-chicken-wrap.png" },
      { id: "7a30cba8-1af2-42a4-b17e-77eb43fc1c31", name: "Crispy chicken Wrap", dish_base: "Flatbread wrap", instructions: "1. Put three crispy chicken fingers on the grill.\n   2. Add Mango chili sauce on a wrap\n   3. Add Ice berg salad, sweet corn, roasted onions, sweet potatoes.\n   4. Add the warm crispy chicken to the wrap.\n   5. Close wrap and put it on the grill till sealed.\n   6. Toppings = Tortilla chips & sprouts.", category: "Wrap", diet: "Omnivore", dish_sauce: "Mango chilli sauce", timing_minutes: 10, post_type: "Kitchen", image_url: "/assets/images/crispy-chicken-wrap.png" },
      { id: "80897db2-8bb3-4526-baee-c45459e6db0f", name: "Dragon Bowl", dish_base: "", instructions: "Mixer:\n90ml Apfelsaft\n90ml Mandeldrink\n1 Dragonfrucht TK\n1 Banane TK\n4 Erdbeeran TK\n\nToppings:\n1/2 Granola\nBlaubeeran\nApfel\nErdbeeran\nKokosrasplen\nBienenpollen\nHonig\nMinze", category: "Bowls", diet: null, dish_sauce: null, timing_minutes: 7, post_type: "Bar", image_url: "/assets/images/dragon-bowl.png" },
      { id: "3626f8d4-3033-4edf-bb93-76abf5cc868f", name: "Egg Benedict", dish_base: "Bagels", instructions: "1. Cut the bagel into halves and warm them up \n   2. On boiling water, crack 2 eggs to make them poached eggs.\n   3. Prepare 1/2 avocado for platting.\n   4. Plate the bagels next to each other and Smear a thick layer of cream cheese on both halves of the warmed bagel. \n   5. Add spinach on both bagels and on top of one of  the bagels add the prepared avocado \n   6. Add the poached eggs on top of the other bagel.\n   7 Toppings = Sesame seeds on Avocado & chia seeds on poached egg.\n", category: "Bread", diet: "Omnivore", dish_sauce: "Cream cheese", timing_minutes: 7, post_type: "Kitchen", image_url: null },
      { id: "a9f0928b-45b4-4941-b6c1-c6d429b6274d", name: "Falafel Bowl", dish_base: "quinoa, spinach", instructions: "1. Heat up falafel and sweet potatoes.\n   2. Plate 1/2 quinoa and 1/2 spinach.\n   3. On top of bases, add Sweetcorn, 1/2 avocado, feta, beetroot hummus, sprouts,\n   4. Add the heated falafel.\n", category: "Bowl", diet: "Vegan", dish_sauce: "Joghurt sauce", timing_minutes: 7, post_type: "Kitchen", image_url: "/assets/images/falafel-bowl.jpeg" },
      { id: "675d3622-0759-4fae-bfe8-825f4fe57589", name: "Falafel Wrap", dish_base: "Flat bread wrap", instructions: "1. Warm up falafel.\n   2. Add Joghurt sauce on the wrap.\n   3. Add spinach, feta, beetroot hummus and sprouts.\n   4. Add the hot falafel.\n   5. Close wrap and put it on the grill till closed.\n   6. Toppings = Tortilla chips & sprouts.", category: "Wrap", diet: "Vegan", dish_sauce: "Joghurt sauce", timing_minutes: 7, post_type: "Kitchen", image_url: "/assets/images/falafel-wrap.png" },
      { id: "1571c096-bded-48aa-828a-e94309fd621b", name: "Grenadine", dish_base: "", instructions: "1/2 Lemonade\n1/2 Sprudel\nBlaubeeran\nOrangen", category: "Schorle", diet: null, dish_sauce: null, timing_minutes: 5, post_type: "Bar", image_url: null },
      { id: "97760552-5704-426d-bbd8-e1377a089704", name: "Hang Loose", dish_base: "", instructions: "2 Apfel\n1 Karotten\n1/2 Gurke\n1 Zitrone", category: "Juices", diet: null, dish_sauce: null, timing_minutes: 7, post_type: "Bar", image_url: "/assets/images/hang-loose.png" },
      { id: "4a0d7860-d786-4245-8a0b-9125ec8e92d5", name: "Healthy Start", dish_base: "", instructions: "3 Apfel\n1 Ingwer\n1 Cayenne Pfeffer\n1 Zitrone", category: "Juices", diet: null, dish_sauce: null, timing_minutes: 7, post_type: "Bar", image_url: "/assets/images/healthy-start.png" },
      { id: "d0cecd53-2667-46d7-8e69-a65377adf897", name: "Holunder", dish_base: "", instructions: "1 Sprudel\nHolunder Sirup\nMinze", category: "Schorle", diet: null, dish_sauce: null, timing_minutes: 5, post_type: "Bar", image_url: null },
      { id: "7eada5df-854e-4cbe-9044-3105a9a6e73b", name: "Hot Latte", dish_base: "", instructions: "250ml Hafer Barista\n1 Matcha/Blue Spirulina/Golden Milk\nHonig / Agavendicksaft\nKokosmilch", category: "Lattes", diet: null, dish_sauce: null, timing_minutes: 7, post_type: "Bar", image_url: null },
      { id: "740ca630-23fd-4fa2-8a5f-9a10bf64a1f3", name: "Hummus bread", dish_base: "Vollkorn bread", instructions: "1. Heat up two whole grain breads.\n   2. Plate the warm bread and smear a thick layer of beetroot hummus.\n   3. Add beetroot salad in opposite ends on the bread.\n   4. Add rucola in between the Beetroot salad.\n   5. Add carrots and sprouts on the alternating sides of the bread.\n   6. Toppings = tomatoes.\n", category: "Bread", diet: "Vegan", dish_sauce: "Beetroot hummus", timing_minutes: 7, post_type: "Kitchen", image_url: null },
      { id: "34707849-e8f6-44b9-9a19-3207feebc2ec", name: "Iced Latte", dish_base: "", instructions: "300ml Hafer Barista\n1 Matcha/Blue Spirulina/Golden Milk\nHonig / Agavendicksaft\nKokosmilch", category: "Lattes", diet: null, dish_sauce: null, timing_minutes: 7, post_type: "Bar", image_url: null },
      { id: "bf7046ec-2da8-44d6-8db0-075b6cc7670b", name: "Immortal Goddess", dish_base: "", instructions: "Mixer:\n150ml Haferdrink\n1 Banane Frisch\n1/2 Avocado\nHandfull Spinat\n1 spoon Erdnussbutter\n1 Vanille Protein\n\nToppings:\n1/4 Granola\nBlaubeeran\nWeintrauben\nApfel\nKokosrasplen\nMinze", category: "Bowls", diet: null, dish_sauce: null, timing_minutes: 7, post_type: "Bar", image_url: "/assets/images/immortal-goddess-bowl.png" },
      { id: "6f983277-f669-4f2b-872a-1cdfd1226b49", name: "Island Bowl", dish_base: "", instructions: "Mixer:\nFrozen Acai\n1 Banane TK\n4 Erdbeeran TK\nBlaubeeran\n\nToppings:\n1/2 Granola\nBanane\nErdbeeran\nWeintrauben\nBlaubeeran\nKokosrasplen\nMinze", category: "Bowls", diet: null, dish_sauce: null, timing_minutes: 7, post_type: "Bar", image_url: "/assets/images/island-bowl.png" },
      { id: "d6fe9c89-2103-4d7a-83ba-b9bafc11510d", name: "King Bowl", dish_base: "Rice", instructions: " 1. On top of base, add edamame, 1/2 avocado, Salmon, carrots and mango.\n    2. Add tortilla chips.\n    3. Topping = chia seeds.\n", category: "Bowl", diet: "Omnivore", dish_sauce: "Teriyaki sauce", timing_minutes: 7, post_type: "Kitchen", image_url: null },
      { id: "62795924-60a3-434f-bfd4-9ee86c859a2d", name: "King Wrap", dish_base: "Flat bread wrap", instructions: "1. Smear cream cheese on wrap.\n   2. Add lettuce, cucumber, 2 pieces of smoked salmon, and sprinkle of salt.\n   3. Close wrap and put on grill.\n   4. Toppings = sprouts & tortilla chips.\n", category: "Wrap", diet: "Omnivore", dish_sauce: "Cream cheese", timing_minutes: 15, post_type: "Kitchen", image_url: null },
      { id: "e5d0072b-75c6-4d55-8e42-50fa98005476", name: "Korean Barbecue Bowl", dish_base: "Rice & Rucola", instructions: "1. Heat up paprika chicken.\n   2. Plate 1/2 sushi rice and 1/2 rucola.\n   3. On top of bases, add edamame, 1/2 avocado, tomatoes, chili.\n   4. Mix hot paprika chicken with Korean BBQ sauce. \n   5. Add the chicken mix on top of the rice.\n   6. Topping = Sesame seeds & Spring onions", category: "Bowl", diet: "Omnivore", dish_sauce: "Barbecue sauce", timing_minutes: 7, post_type: "Kitchen", image_url: "/assets/images/korean-barbecue-bowl.jpeg" },
      { id: "c37a75dc-0701-4a72-ab87-ba644890373f", name: "Korean Wrap", dish_base: "Flat bread wrap", instructions: "1. Add Korean sauce on the wrap\n   2. Add rucola, 1/2 avocado, tomatoes, spring onions, pepperoni.\n   3. Mix chicken with Korean sauce and add it to the wrap.\n   4. Close wrap and put it on the grill till closed.\n   Toppings = Tortilla chips & sprouts.\n", category: "Wrap", diet: "Omnivore", dish_sauce: "Barbecue Sauce", timing_minutes: 7, post_type: "Kitchen", image_url: null },
      { id: "cbef5d0e-6da8-402c-b45d-4ac8bacaecfb", name: "Minze-Limette", dish_base: "", instructions: "1/2 Lemonade\n1/2 Sprudel\nMinze\nLimette", category: "Schorle", diet: null, dish_sauce: null, timing_minutes: 5, post_type: "Bar", image_url: null },
      { id: "01cb6c76-a673-4fba-83d1-70f69d3650a3", name: "Nature Detox", dish_base: "", instructions: "1 Sprudel\nMinze\nGurke\nLimette", category: "Schorle", diet: null, dish_sauce: null, timing_minutes: 5, post_type: "Bar", image_url: "/assets/images/nature-detox.png" },
      { id: "d3ac7717-f489-41fc-ad6d-1c00ff20e192", name: "Pacific Bowl", dish_base: "", instructions: "Mixer:\n90ml Ananassaft\n90ml Kokosmilch\n1 Mango TK\n1 Banane TK\n1 Blue Spirulina\n\nToppings:\n1/4 Granola\nMango\nWeintrauben\nApfel\nKokosrasplen\nMinze", category: "Bowls", diet: null, dish_sauce: null, timing_minutes: 7, post_type: "Bar", image_url: "/assets/images/pacific-bowl.png" },
      { id: "90c3028c-3e02-4edf-8631-c4ce78c6cdcb", name: "Peanut Protein", dish_base: "", instructions: "300ml Mandel Barista\n1 Vanille Protein\n1 Banane TK\n1 Erdnussbutter\n1 Ahorn Sirup", category: "Shakes", diet: null, dish_sauce: null, timing_minutes: 7, post_type: "Bar", image_url: "/assets/images/peanut-protein.png" },
      { id: "df03379a-03ee-4ebb-9958-9f129498b082", name: "Power Bowl", dish_base: "", instructions: "In a bowl; Joghurt\n\nToppings:\nBanane\nErdbeeran\nBlaubeeran\nWeintrauben\nGranola\nSchokoladenflocken\nApfelscheiben\nMinze", category: "Bowls", diet: null, dish_sauce: null, timing_minutes: 7, post_type: "Bar", image_url: "/assets/images/power-bowl.png" },
      { id: "72e50646-d32b-45b4-bcf1-38fddfc092f8", name: "Red Hummus Mezze", dish_base: "Red Hummus", instructions: "", category: "Bowl", diet: "Vegetarian", dish_sauce: "Joghurt", timing_minutes: 7, post_type: "", image_url: null },
      { id: "0f5f10bd-08fc-4cf4-8ba4-6e314a00495d", name: "Revitalise", dish_base: "", instructions: "300ml Apfelsaft\n1 Acai\n1 Banane TK\n4 Erdbeeran TK\n1 Kokosmilch", category: "Shakes", diet: null, dish_sauce: null, timing_minutes: 7, post_type: "Bar", image_url: null },
      { id: "a1e8a348-ae85-42ec-b4b8-a71348e82842", name: "Strawberry Protein", dish_base: "", instructions: "300ml Mandel Barista\n1 Vanille Protein\n1 Banane TK\n8 Erdbeeran TK\nGrain Syrup", category: "Shakes", diet: null, dish_sauce: null, timing_minutes: 7, post_type: "Bar", image_url: "/assets/images/strawberry-protein.png" },
      { id: "d828a2a7-8a96-44ef-9184-305653b878cb", name: "Sunkissed", dish_base: "", instructions: "150ml Ananassaft\n150ml Mandeldrink\n1 Vanille Protein\n1 Banane TK\n1 Mango TK\n1 Dragonfrucht TK\n1 Kokosmilch", category: "Shakes", diet: null, dish_sauce: null, timing_minutes: 7, post_type: "Bar", image_url: "/assets/images/sunkissed.png" },
      { id: "533e3a89-2cfd-4793-953f-30591003d389", name: "Sunset", dish_base: "", instructions: "2 Apfel\n2 Karotten\n1 Ingwer\n1 Zitrone", category: "Juices", diet: null, dish_sauce: null, timing_minutes: 7, post_type: "Bar", image_url: null },
      { id: "b5b7bced-3b8f-42ca-a248-62f6e5e6a5eb", name: "The OG", dish_base: "", instructions: "3 Orangen\n1 Ingwer\n1 Zitrone", category: "Juices", diet: null, dish_sauce: null, timing_minutes: 7, post_type: "Bar", image_url: "/assets/images/the-og.png" },
      { id: "4b99bbab-9211-482f-a7a2-d68945cce3c8", name: "Vegan Boss", dish_base: "Quinoa", instructions: "1. Heat up vegan chicken and sweet potatoes.\n    2. Add quinoa as base.\n    3. On top of base, add sweetcorn, 1/2 avocado, carrots.\n    4. Add the heated vegan chicken and sweet potatoes. \n    5. Topping = pepperoni, sesame seeds & plantains\n", category: "Bowl", diet: "Vegan", dish_sauce: "Vegan Aioli", timing_minutes: 7, post_type: "Kitchen", image_url: "/assets/images/vegan-boss-bowl.jpeg" },
      { id: "4c628d85-2c75-421f-8e01-a019e5d09dd5", name: "Vegan boss", dish_base: "Flat bread wrap", instructions: "1. Warm up vegan chicken. \n    2. Add aioli sauce on the wrap.\n    3. Add lettuce, carrots, almonds and pepperoni.\n    4. Add the hot vegan chicken.\n    5. Close wrap and put it on the grill till closed.\n    6. Toppings = Tortilla chips & sprouts.\n", category: "Wrap", diet: "Vegan", dish_sauce: "Vegan Aioli", timing_minutes: 14, post_type: "Kitchen", image_url: "/assets/images/vegan-boss-wrap.png" },
      { id: "30cfcfd3-5b11-4ced-b839-fec7e89d4bf5", name: "Vitamin Sea", dish_base: "", instructions: "2 Orangen\n1 Apfel\n1 Zitrone\n1 Minze", category: "Juices", diet: null, dish_sauce: null, timing_minutes: 7, post_type: "Bar", image_url: "/assets/images/vitamin-sea.png" },
      { id: "9f82a723-59b6-4a1a-b5e7-4c35b906ee6c", name: "Wake Up", dish_base: "", instructions: "250ml Haferdrink\n1 Vanille Protein\n1.5 Banane TK\n1 Erdnussbutter\n1 Espresso\n1 Kakao p.", category: "Shakes", diet: null, dish_sauce: null, timing_minutes: 7, post_type: "Bar", image_url: "/assets/images/wake-up.png" },
    ];

    let inserted = 0;
    for (const r of recipes) {
      try {
        await pool.query(
          `INSERT INTO recipes (id, name, dish_base, instructions, category, diet, dish_sauce, timing_minutes, post_type, image_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (id) DO NOTHING`,
          [r.id, r.name, r.dish_base, r.instructions ?? "", r.category, r.diet, r.dish_sauce, r.timing_minutes, r.post_type ?? "", r.image_url]
        );
        inserted++;
      } catch (rowErr: any) {
        log(`Skipping recipe "${r.name}": ${rowErr.message}`, "seed");
      }
    }

    log(`Seeded ${inserted} recipes`, "seed");
  } catch (err: any) {
    log(`Recipe seed skipped: ${err.message}`, "seed");
  }
}

(async () => {
  await registerRoutes(httpServer, app);
  await ensureSeedData();
  await ensureSeedRecipes();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      
      // Start the task notification scheduler
      startTaskNotificationScheduler();
    },
  );
})();
