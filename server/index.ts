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

async function ensureSeedCleaningTasks() {
  try {
    const { rows } = await pool.query("SELECT COUNT(*) AS count FROM cleaning_tasks");
    if (parseInt(rows[0].count, 10) >= 130) return;

    // Look up production restaurant IDs by name
    const rResult = await pool.query("SELECT id, name FROM restaurants");
    const idMap: Record<string, string> = {};
    for (const row of rResult.rows) {
      if (row.name === "Restaurant Immortl") idMap["IMMORTL"] = row.id;
      if (row.name === "Restaurant Mini Pavillion") idMap["MINI"] = row.id;
    }
    if (!idMap["IMMORTL"] || !idMap["MINI"]) {
      log("Cleaning seed skipped: restaurants not found yet", "seed"); return;
    }

    log("Seeding missing cleaning tasks…", "seed");

    const tasks = [
      { id: "2510ab93-9621-47d5-a0e1-7dcf861fa19e", r: "MINI", day: "Friday", station: "Bar", task: "Clean back storage" },
      { id: "023f371d-b1cb-4357-ac00-46fe791a8950", r: "MINI", day: "Friday", station: "Bar", task: "Clean behind coffee & milk shelf" },
      { id: "d08511d3-d835-453f-9d18-ee06e4f22141", r: "MINI", day: "Friday", station: "Bar", task: "Clean coffee holders" },
      { id: "2b4661be-64ae-43ec-aed8-71df80658041", r: "MINI", day: "Monday", station: "Bar", task: "Clean and disinfect all monitors (iPad & Uber tablet)" },
      { id: "156688f4-a79a-4519-91c6-c9bef43e821a", r: "MINI", day: "Monday", station: "Bar", task: "Clean and replace powder and spice containers" },
      { id: "d8cfb688-a37e-410d-ab42-dcbd32d49c73", r: "MINI", day: "Monday", station: "Bar", task: "Clean coffee holders" },
      { id: "4ee54cd4-13c1-46cd-a4d1-c365f152612c", r: "MINI", day: "Saturday", station: "Bar", task: "Clean and descale dishwasher" },
      { id: "dd5b8a97-5993-4ecd-84d1-300835394249", r: "MINI", day: "Saturday", station: "Bar", task: "Clean display case from inside" },
      { id: "a4843b6f-30a6-4aa7-9f68-e0a06117b822", r: "MINI", day: "Saturday", station: "Bar", task: "Clean under display case" },
      { id: "e3ce472b-15b8-449e-801a-2df3e38da64e", r: "MINI", day: "Sunday", station: "Bar", task: "Clean behind trash bin" },
      { id: "4d459bbc-5361-472d-a3a9-7310281a0324", r: "MINI", day: "Sunday", station: "Bar", task: "Clean small black shelf" },
      { id: "ccd41115-2fcc-40bc-953e-472fa3a43aa0", r: "MINI", day: "Sunday", station: "Bar", task: "Clean trash bin inside & outside" },
      { id: "7ee85a6d-14ec-498b-a380-d244d02b177e", r: "MINI", day: "Thursday", station: "Bar", task: "Clean behind fridge drawers" },
      { id: "bfb36929-4084-413a-bf27-45e2edab47b1", r: "MINI", day: "Thursday", station: "Bar", task: "Clean fridge drawers inside & outside" },
      { id: "9a6e35c5-fd9a-4fbe-9ad5-443743770cd8", r: "MINI", day: "Thursday", station: "Bar", task: "Clean shelves under coffee machine & microwave" },
      { id: "1b2c624d-b857-42d8-8c55-dc666d9cb045", r: "MINI", day: "Tuesday", station: "Bar", task: "Clean behind freezer" },
      { id: "7dd4058d-6539-444a-864c-6fe0eef1de07", r: "MINI", day: "Tuesday", station: "Bar", task: "Clean coffee shelves" },
      { id: "8444e603-200d-4c8e-b458-a886d96947aa", r: "MINI", day: "Tuesday", station: "Bar", task: "Clean freezer inside & outside" },
      { id: "3116f683-6a2f-4927-9c2d-421d3e40079c", r: "MINI", day: "Wednesday", station: "Bar", task: "Clean back shelf" },
      { id: "6c971467-7451-448e-8e42-c8939ff77859", r: "MINI", day: "Wednesday", station: "Bar", task: "Clean side glass shelf" },
      { id: "a2c36f1a-a1b6-4ae8-b661-3cfaefdd4624", r: "MINI", day: "Wednesday", station: "Bar", task: "Clean under glass shelf" },
      { id: "254a72a9-2b9e-4050-b5f2-28c5d7851d6f", r: "MINI", day: "Friday", station: "Kitchen", task: "Empty and clean drawers 5 and 6 in the front kitchen" },
      { id: "6fa16198-40f1-47c9-9f50-a1cb8bb3608f", r: "MINI", day: "Friday", station: "Kitchen", task: "Empty and clean inside and outside Freezer 3 in back storage" },
      { id: "2441ebbb-9e19-4c81-b6cb-c2981655bb28", r: "MINI", day: "Monday", station: "Kitchen", task: "Clean and rearrange all shelves and drawers in back kitchen" },
      { id: "7974d120-c326-464b-a361-4592053113b6", r: "MINI", day: "Monday", station: "Kitchen", task: "Pour boiling water into all sinks at end of shift" },
      { id: "dba5da8c-e89f-4149-8ded-0351b92e292e", r: "MINI", day: "Saturday", station: "Kitchen", task: "Clean drinks storage and re-arrange empty crates (sweep/mop all mice faeces)" },
      { id: "8229e5ae-0a33-4076-ac04-345e85c9a538", r: "MINI", day: "Saturday", station: "Kitchen", task: "Clean outside and organize inside Fridges 1, 2 & Freezer 1" },
      { id: "8a843c94-8cb6-4a30-a03e-e085b457122a", r: "MINI", day: "Sunday", station: "Kitchen", task: "Clean fridges 4 and 5 in the back storage" },
      { id: "548f3982-1f95-4bf5-8465-d39faa132824", r: "MINI", day: "Sunday", station: "Kitchen", task: "Deep clean baking/conduction oven using the oven cleaner" },
      { id: "3c09dec9-eb2a-44f9-b4fb-bbe4b1cb47b4", r: "MINI", day: "Thursday", station: "Kitchen", task: "Clean behind cooling drawer fridges 1, 2, 3 & 4" },
      { id: "193d6bac-9cfd-418b-9f8a-0b1e414aa0f4", r: "MINI", day: "Thursday", station: "Kitchen", task: "Empty and clean drawers 1, 2, 3, 4 in the front kitchen" },
      { id: "65e79c17-9c7c-4ebd-b5b0-aeb32bd7d99d", r: "MINI", day: "Tuesday", station: "Kitchen", task: "Clean and organise trolley inbetween fridge 2 and freezer 1" },
      { id: "bee4999f-47bb-437d-b371-6108fc2d2aa2", r: "MINI", day: "Tuesday", station: "Kitchen", task: "Scrub floor behind the fridge 2 and freezer 1" },
      { id: "3e73c93e-ffdd-4440-9f7d-dda3d41dd73f", r: "MINI", day: "Wednesday", station: "Kitchen", task: "Clean ventilation above conduction oven and fridges" },
      { id: "2a322a46-b8b9-40d0-881c-ee3910a31f4e", r: "MINI", day: "Wednesday", station: "Kitchen", task: "Scrub floor behind the fridge 1 and oven" },
      { id: "800057a1-2bab-4d65-b73b-385ee6a3b2e6", r: "MINI", day: "Friday", station: "Service", task: "Clean side bar shelf & refill" },
      { id: "a7d02ebd-90b0-40d4-a0f3-91f9f252d6e2", r: "MINI", day: "Friday", station: "Service", task: "Vacuum all chairs & sofas" },
      { id: "ff201c3c-b32a-4b0a-80c4-10d2f2c7c9c8", r: "MINI", day: "Friday", station: "Service", task: "Wipe menu cards (front & back) and sort" },
      { id: "d64dfbea-d5eb-42c6-b3df-6ab5692e45cb", r: "MINI", day: "Monday", station: "Service", task: "Clean children's chairs" },
      { id: "e3a62d37-1656-41dc-9fe2-bb701d49f196", r: "MINI", day: "Monday", station: "Service", task: "Vacuum all chairs & sofas" },
      { id: "9273364a-c0b7-46ed-a8a0-5c43ccf65a0b", r: "MINI", day: "Monday", station: "Service", task: "Water plants in bar area" },
      { id: "25ae20ce-16cc-4436-a458-b2c0e692e00a", r: "MINI", day: "Saturday", station: "Service", task: "Clean behind empty bottles area" },
      { id: "7db0cf94-3a6d-4d6f-bb59-71bd1712061b", r: "MINI", day: "Saturday", station: "Service", task: "Clean drinks fridge inside & outside" },
      { id: "783ca011-7bca-4250-b2d5-656267f30681", r: "MINI", day: "Saturday", station: "Service", task: "Disinfect all monitors, EC devices & phones" },
      { id: "541d9819-1e57-4688-9ab8-426ed454cb71", r: "MINI", day: "Sunday", station: "Service", task: "Clean display case from outside" },
      { id: "3c5cc66d-4a6c-4cc8-9d19-d7a410771ac9", r: "MINI", day: "Sunday", station: "Service", task: "Clean reservation signs" },
      { id: "07237dbf-ba99-4d39-ba69-5b7d01bda1f9", r: "MINI", day: "Sunday", station: "Service", task: "Tidy up, refill & wipe service station" },
      { id: "d0dc5a0b-3c96-4434-8ec5-cc809c89ba9d", r: "MINI", day: "Thursday", station: "Service", task: "Clean under table covers" },
      { id: "c92a108a-d4a8-4179-9d26-3bc7a3dd1d6e", r: "MINI", day: "Thursday", station: "Service", task: "Refill salt & pepper, clean containers & cruets" },
      { id: "b89dec9f-718f-4a47-a7af-ccf1704a7f04", r: "MINI", day: "Thursday", station: "Service", task: "Wipe chairs & table legs" },
      { id: "7dc7b705-7a8c-4b83-82a8-1d80d42f7842", r: "MINI", day: "Tuesday", station: "Service", task: "Clean bar spoon container" },
      { id: "bc440aab-1212-4b1b-9152-88b4c092cd9a", r: "MINI", day: "Tuesday", station: "Service", task: "Clean cookie/sugar/honey containers" },
      { id: "42a993f9-0196-4faa-a123-44e69a733e06", r: "MINI", day: "Tuesday", station: "Service", task: "Clean straws & containers" },
      { id: "a439fbbd-56ad-4dc4-81dd-9c7bf45d9c3c", r: "MINI", day: "Wednesday", station: "Service", task: "Clean display case from outside" },
      { id: "b8cba6d4-e539-483b-9712-5a852bc87c82", r: "MINI", day: "Wednesday", station: "Service", task: "Clean iPad storage area" },
      { id: "dc0a403f-3a09-400c-b73a-a22f30d5bc65", r: "MINI", day: "Wednesday", station: "Service", task: "Vacuum all chairs & sofas" },
      { id: "2f2c686e-6179-4f88-b530-a07a9582b588", r: "IMMORTL", day: "Friday", station: "Bar", task: "Cake display" },
      { id: "632436b1-aecf-4923-9e88-d7dab2e4f6ef", r: "IMMORTL", day: "Friday", station: "Bar", task: "Clean all cupboards" },
      { id: "95604943-3752-4a19-8241-57b3968301af", r: "IMMORTL", day: "Friday", station: "Bar", task: "Employee bathroom" },
      { id: "d08e6aa4-59a5-49c7-9c99-6c7d6f5e9c31", r: "IMMORTL", day: "Friday", station: "Bar", task: "Over sink" },
      { id: "4932c549-5350-4de1-b49e-31327f554017", r: "IMMORTL", day: "Monday", station: "Bar", task: "Cake display" },
      { id: "19b56b32-731d-4a00-9538-52ff494ad1e8", r: "IMMORTL", day: "Monday", station: "Bar", task: "Clear food residue off shelves" },
      { id: "29cca546-6f9b-489c-9996-6de70cb62cad", r: "IMMORTL", day: "Monday", station: "Bar", task: "Cupboards and counters" },
      { id: "6f7ab821-6f2a-478e-a629-f859d5162e52", r: "IMMORTL", day: "Monday", station: "Bar", task: "Deep clean dishwasher" },
      { id: "6dc6e744-196c-47e8-8e50-21c9f0741ffe", r: "IMMORTL", day: "Monday", station: "Bar", task: "Employee bathroom" },
      { id: "297ad1d2-512c-4680-9eef-906b4695493f", r: "IMMORTL", day: "Monday", station: "Bar", task: "Over the sinks" },
      { id: "4a422464-a239-4f8f-840e-c256c465ad9f", r: "IMMORTL", day: "Monday", station: "Bar", task: "Trash bin throw away" },
      { id: "74615f85-b454-4113-9d8f-efc31e3439b6", r: "IMMORTL", day: "Monday", station: "Bar", task: "Wipe water dispenser" },
      { id: "c56edd12-b9bb-4d8d-a08a-5db7cf1dfb5f", r: "IMMORTL", day: "Saturday", station: "Bar", task: "Around & under glass & cups" },
      { id: "240bb66f-f577-4442-85bf-1b4b2add4f59", r: "IMMORTL", day: "Saturday", station: "Bar", task: "Clean behind trash" },
      { id: "922483de-bc1e-4d56-987d-d1440ab6dfe0", r: "IMMORTL", day: "Saturday", station: "Bar", task: "Clear food residue off shelves" },
      { id: "f3887c26-08e4-485b-9471-3207609da537", r: "IMMORTL", day: "Saturday", station: "Bar", task: "Trash bin throw away" },
      { id: "f4b5b409-f40b-4fae-9423-54a919c8bb99", r: "IMMORTL", day: "Saturday", station: "Bar", task: "Wipe water dispenser" },
      { id: "e1d33fec-d5ae-4030-bd33-f557d40c78ba", r: "IMMORTL", day: "Sunday", station: "Bar", task: "Clear food residue off shelves" },
      { id: "6e7afe45-f520-4849-9e9d-412345f3d0d7", r: "IMMORTL", day: "Sunday", station: "Bar", task: "Sort and clean shelves" },
      { id: "10ed7040-72de-4bb5-8463-08c97d541a7f", r: "IMMORTL", day: "Sunday", station: "Bar", task: "Trash bin throw away" },
      { id: "e5507f27-7e30-4895-b78b-d1b2ac8d2581", r: "IMMORTL", day: "Sunday", station: "Bar", task: "Wipe water dispenser" },
      { id: "04b14caa-bccb-44c6-995e-99716952d124", r: "IMMORTL", day: "Thursday", station: "Bar", task: "Clear food residue off shelves" },
      { id: "89569d2e-f25f-41e0-b938-6763407f2f2d", r: "IMMORTL", day: "Thursday", station: "Bar", task: "Deep clean dishwasher" },
      { id: "4481e885-68ff-4c04-b8e1-1e86c30df812", r: "IMMORTL", day: "Thursday", station: "Bar", task: "Shelf under coffee machine" },
      { id: "ad36f6a2-2e57-44f1-a497-48ac7d5cf353", r: "IMMORTL", day: "Thursday", station: "Bar", task: "Trash bin throw away" },
      { id: "c29e061e-e093-478f-a4c3-28b6cfc13c6e", r: "IMMORTL", day: "Thursday", station: "Bar", task: "Windows in front of bar" },
      { id: "f91c2399-ea84-4f73-aec1-2c86d34eebc5", r: "IMMORTL", day: "Thursday", station: "Bar", task: "Wipe water dispenser" },
      { id: "19e3e039-169c-4a40-93fc-e0acaed02740", r: "IMMORTL", day: "Tuesday", station: "Bar", task: "Clear food residue off shelves" },
      { id: "6a4e17d5-026b-4ddf-beba-b53404b78a43", r: "IMMORTL", day: "Tuesday", station: "Bar", task: "Deep clean fridge" },
      { id: "790e18eb-2b0c-4ae6-a1a3-6dd03c10b3fa", r: "IMMORTL", day: "Tuesday", station: "Bar", task: "Defrost & clean freezer" },
      { id: "0d1e28e8-2529-46c9-8044-31818e1d5992", r: "IMMORTL", day: "Tuesday", station: "Bar", task: "Sort & clean shelves" },
      { id: "8a8f5527-f22a-4d42-bb1f-30f306739e88", r: "IMMORTL", day: "Tuesday", station: "Bar", task: "Trash bin throw away" },
      { id: "92473411-6580-4cb8-ab50-2e4dfc14ae3e", r: "IMMORTL", day: "Tuesday", station: "Bar", task: "Wipe water dispenser" },
      { id: "4d484954-2c46-4cd6-946f-a1eaefeaa0c3", r: "IMMORTL", day: "Wednesday", station: "Bar", task: "Clean behind the trash" },
      { id: "50989a2b-5b8b-4e50-812a-9523819c7026", r: "IMMORTL", day: "Wednesday", station: "Bar", task: "Clear food residue off shelves" },
      { id: "d5fdec04-08d1-4144-a0f8-05eabcdf9dce", r: "IMMORTL", day: "Wednesday", station: "Bar", task: "Counters and shelf by the window" },
      { id: "3de6e8ed-82ab-4375-846d-f131afc2ad87", r: "IMMORTL", day: "Wednesday", station: "Bar", task: "On top & under coffee machine" },
      { id: "83514415-6fbd-4e7d-90b5-333ccc7eba1b", r: "IMMORTL", day: "Wednesday", station: "Bar", task: "Trash bin throw away" },
      { id: "dedafc4d-9362-4983-9eda-3625e785d478", r: "IMMORTL", day: "Wednesday", station: "Bar", task: "Under & top of red bull fridge" },
      { id: "3070dea1-4b1a-4a99-aea4-70b73c136c0c", r: "IMMORTL", day: "Wednesday", station: "Bar", task: "Wipe water dispenser" },
      { id: "cfe9979c-b3fc-4d62-85e1-47114f950827", r: "IMMORTL", day: "Friday", station: "Kitchen", task: "Clean walls" },
      { id: "c5e85ac4-c339-4e9f-8d30-79f8d90fc7e0", r: "IMMORTL", day: "Friday", station: "Kitchen", task: "Clear food residue off counters" },
      { id: "fe4410f9-ddb5-4a90-bc29-bf4a86c27c54", r: "IMMORTL", day: "Friday", station: "Kitchen", task: "Refill handwash station and employee bathroom" },
      { id: "9dbb050f-85fc-430e-b046-fa135cb7d117", r: "IMMORTL", day: "Friday", station: "Kitchen", task: "Reorganize storage room" },
      { id: "a04f2752-2777-43b4-bd1c-c063e4ab0d44", r: "IMMORTL", day: "Friday", station: "Kitchen", task: "Scrub and mop floor" },
      { id: "c9c49826-51cc-490b-8ec4-9cac15953391", r: "IMMORTL", day: "Friday", station: "Kitchen", task: "Throw away all trash" },
      { id: "920b5a4b-1be8-40a1-9e7b-233476b5dd19", r: "IMMORTL", day: "Monday", station: "Kitchen", task: "Clear food residue off counters" },
      { id: "271440f2-e98c-4653-bc15-672911a53f09", r: "IMMORTL", day: "Monday", station: "Kitchen", task: "Refill handwash station and employee bathroom" },
      { id: "68bf3456-d2ba-47a5-b6d1-7ee01f111df1", r: "IMMORTL", day: "Monday", station: "Kitchen", task: "Scrub and mop floor" },
      { id: "bf59a20b-136d-4c16-b679-9de5de2cd5ea", r: "IMMORTL", day: "Monday", station: "Kitchen", task: "Ventilation & shaft over rice cooker" },
      { id: "b61c8d9e-f1dd-43fa-a8c9-1f01c677dbd7", r: "IMMORTL", day: "Saturday", station: "Kitchen", task: "Clear food residue off counters" },
      { id: "2c9dc3c6-0c85-471b-98e1-497337278354", r: "IMMORTL", day: "Saturday", station: "Kitchen", task: "Scrub and mop floor" },
      { id: "78330020-8486-4654-b60f-83671b30efaf", r: "IMMORTL", day: "Saturday", station: "Kitchen", task: "Throw away all trash" },
      { id: "aa21b56b-525e-4f54-87f8-9ad40f422e8b", r: "IMMORTL", day: "Saturday", station: "Kitchen", task: "Ventilation over rice cooker" },
      { id: "2ed72c60-fea5-4f45-aeae-848937c0d5c0", r: "IMMORTL", day: "Sunday", station: "Kitchen", task: "All windows" },
      { id: "156f6d3b-5a20-4016-8533-6059b359f5e4", r: "IMMORTL", day: "Sunday", station: "Kitchen", task: "Behind all counters and shelves" },
      { id: "f17dc24f-1316-41c1-b42a-78f112d02236", r: "IMMORTL", day: "Sunday", station: "Kitchen", task: "Clear food residue off counters" },
      { id: "66cf1560-30ca-491a-9548-3c9fa8787d16", r: "IMMORTL", day: "Sunday", station: "Kitchen", task: "Scrub and mop floor" },
      { id: "261e7de5-02f5-4fde-8393-fb0b970172f9", r: "IMMORTL", day: "Sunday", station: "Kitchen", task: "Scrub both ovens" },
      { id: "6e29979f-c062-4981-8c94-fa92043a379c", r: "IMMORTL", day: "Sunday", station: "Kitchen", task: "Throw away all trash" },
      { id: "678c068f-46f2-4207-ae91-56dca1299fb3", r: "IMMORTL", day: "Thursday", station: "Kitchen", task: "All windows" },
      { id: "b4442cf4-9de4-4cb9-9053-682ed5d79a08", r: "IMMORTL", day: "Thursday", station: "Kitchen", task: "Clear food residue off counters" },
      { id: "e97cfb04-80aa-489c-9e38-9379ce578771", r: "IMMORTL", day: "Thursday", station: "Kitchen", task: "Scrub and mop floor" },
      { id: "1fa302a3-e610-426f-986a-ca3c78e505cf", r: "IMMORTL", day: "Thursday", station: "Kitchen", task: "Sort/clean shelves" },
      { id: "fd1b9b56-3199-46fe-82c2-7ea27ab46eec", r: "IMMORTL", day: "Thursday", station: "Kitchen", task: "Throw away all trash" },
      { id: "ae65b430-9515-4edc-bca9-caae4bf55309", r: "IMMORTL", day: "Tuesday", station: "Kitchen", task: "Clean and sort fridge" },
      { id: "c6459cfa-cd3c-4f6d-a02b-36cdc5c45008", r: "IMMORTL", day: "Tuesday", station: "Kitchen", task: "Clear food residue off counters" },
      { id: "09932aea-7060-4ec7-bfdc-fa52b9e2714b", r: "IMMORTL", day: "Tuesday", station: "Kitchen", task: "Scrub and mop floor" },
      { id: "a99345f2-7a72-4277-a015-836597c65154", r: "IMMORTL", day: "Tuesday", station: "Kitchen", task: "Sort and clean shelves" },
      { id: "1ea620b5-d1f2-43fe-bbe6-2687cd881803", r: "IMMORTL", day: "Tuesday", station: "Kitchen", task: "Throw away all trash" },
      { id: "3afa15f9-d8e5-433a-acc1-74a91cdb3d9c", r: "IMMORTL", day: "Wednesday", station: "Kitchen", task: "Clean hand wash station" },
      { id: "2d245a91-f455-414b-8ddb-9243d00a65fd", r: "IMMORTL", day: "Wednesday", station: "Kitchen", task: "Clear food residue off counters" },
      { id: "eb782c95-89ee-4e1d-a6a4-9f0d61d3af26", r: "IMMORTL", day: "Wednesday", station: "Kitchen", task: "Defrost freezer" },
      { id: "00b725df-16fc-4f85-a038-7a48a07339a4", r: "IMMORTL", day: "Wednesday", station: "Kitchen", task: "Scrub and mop floor" },
      { id: "eabc5c95-38ea-4af9-9581-f6ea13e60a57", r: "IMMORTL", day: "Wednesday", station: "Kitchen", task: "Throw away all trash" },
      { id: "9a14535d-0562-4ffd-b596-b1d95a652b77", r: "IMMORTL", day: "Friday", station: "Service", task: "Clean all pictures and mirrors" },
      { id: "f2fc7aa8-ee63-432b-a4de-fd88069f56dc", r: "IMMORTL", day: "Friday", station: "Service", task: "Clean lounge seats" },
      { id: "7567947c-2a5e-47ab-ad67-457a2f12b4c9", r: "IMMORTL", day: "Monday", station: "Service", task: "Clean table stands" },
      { id: "1983533d-0491-4ac0-9fc1-046c5a2c2bee", r: "IMMORTL", day: "Monday", station: "Service", task: "Reorganise the storage room" },
      { id: "c18a3a0a-a7b1-43ad-8d6e-53f178e65db3", r: "IMMORTL", day: "Saturday", station: "Service", task: "Dust all furniture surfaces" },
      { id: "0d7a0de4-1e88-459c-a108-1a2af29714c6", r: "IMMORTL", day: "Thursday", station: "Service", task: "Clean windows" },
      { id: "fee6def8-5c8e-42e7-844a-48d8c6631246", r: "IMMORTL", day: "Tuesday", station: "Service", task: "Dust all furniture" },
      { id: "6cd775ad-07cc-4c11-acf4-9c1412509f06", r: "IMMORTL", day: "Wednesday", station: "Service", task: "Refill salt/pepper shakers" },
      { id: "1b5cc1a3-81b2-43d2-b422-7e58a06355ec", r: "IMMORTL", day: "Wednesday", station: "Service", task: "Water plants" },
    ];

    let inserted = 0;
    for (const t of tasks) {
      try {
        await pool.query(
          `INSERT INTO cleaning_tasks (id, restaurant_id, day, is_active, station, task)
           VALUES ($1, $2, $3, true, $4, $5)
           ON CONFLICT (id) DO NOTHING`,
          [t.id, idMap[t.r], t.day, t.station, t.task]
        );
        inserted++;
      } catch (rowErr: any) {
        log(`Skipping cleaning task "${t.task}": ${rowErr.message}`, "seed");
      }
    }

    log(`Seeded ${inserted} cleaning tasks`, "seed");
  } catch (err: any) {
    log(`Cleaning seed skipped: ${err.message}`, "seed");
  }
}

(async () => {
  await registerRoutes(httpServer, app);
  await ensureSeedData();
  await ensureSeedRecipes();
  await ensureSeedCleaningTasks();

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
