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

async function ensureSeedInventory() {
  try {
    const { rows } = await pool.query("SELECT COUNT(*) AS count FROM inventory_items");
    if (parseInt(rows[0].count, 10) >= 220) return;

    const rResult = await pool.query("SELECT id, name FROM restaurants");
    const idMap: Record<string, string> = {};
    for (const row of rResult.rows) {
      if (row.name === "Restaurant Immortl") idMap["IMMORTL"] = row.id;
      if (row.name === "Restaurant Mini Pavillion") idMap["MINI"] = row.id;
    }
    if (!idMap["IMMORTL"] || !idMap["MINI"]) {
      log("Inventory seed skipped: restaurants not found yet", "seed"); return;
    }

    log("Seeding missing inventory items…", "seed");

    const items = [
      // MINI — Freezer
      { id:"3739efc0-1106-446d-96c1-167b67eac27d", r:"MINI", item:"Bagels", storage:"Freezer", unit:"bag", threshold:0.50 },
      { id:"dadf1a24-1e2b-4330-87ff-36ed54394d1a", r:"MINI", item:"Chicken", storage:"Freezer", unit:"pcs", threshold:3.00 },
      { id:"220a0e45-f6d0-403d-bb38-9a2205b82acd", r:"MINI", item:"Crispy chicken", storage:"Freezer", unit:"Bags", threshold:2.00 },
      { id:"36b0f05c-a767-4dc6-9061-e25d412fde73", r:"MINI", item:"Croissants", storage:"Freezer", unit:"pack", threshold:1.00 },
      { id:"4b09fa69-b4c1-44cd-aebc-75bb2fd1c450", r:"MINI", item:"Edamame", storage:"Freezer", unit:"packs", threshold:6.00 },
      { id:"21ee2f95-d7a5-4e76-a491-b5bff3c40d20", r:"MINI", item:"Falafel", storage:"Freezer", unit:"pack", threshold:1.00 },
      { id:"7757194e-cc72-4ea2-b74f-21e22e460f19", r:"MINI", item:"Frozen Acai", storage:"Freezer", unit:"box", threshold:0.50 },
      { id:"ac46e902-2d2e-4783-bf09-7d2855bb2585", r:"MINI", item:"Frozen Dragon fruit", storage:"Freezer", unit:"box", threshold:1.00 },
      { id:"0f2e5987-3471-4a71-a99e-8bb22f0e1692", r:"MINI", item:"Frozen Mango", storage:"Freezer", unit:"boxes", threshold:2.00 },
      { id:"beb0ea07-0088-411d-9fe2-90c6d3b11003", r:"MINI", item:"Frozen Strawberries", storage:"Freezer", unit:"packs", threshold:2.00 },
      { id:"7196ac82-d39e-4705-b4a2-01c695e58569", r:"MINI", item:"Guacamole", storage:"Freezer", unit:"packs", threshold:2.00 },
      { id:"84f56549-107f-47cf-bb3d-fdcb45bd897c", r:"MINI", item:"Ice Cubes", storage:"Freezer", unit:"packs", threshold:2.00 },
      { id:"330320bc-a6af-4058-ba77-eaed0810d5c6", r:"MINI", item:"Ice cream", storage:"Freezer", unit:"Box", threshold:0.50 },
      { id:"5ad45c90-2c23-42f3-977d-d84bfd131308", r:"MINI", item:"NewYork Cheesecake", storage:"Freezer", unit:"packs", threshold:2.00 },
      { id:"3c7a8630-d806-4eb6-bfba-d68cbe0853ce", r:"MINI", item:"Vegan chicken", storage:"Freezer", unit:"Pack", threshold:1.00 },
      { id:"96d60bce-acb4-41b0-ac52-56a9f4cd7ec4", r:"MINI", item:"Vegan crispy chicken", storage:"Freezer", unit:"bag", threshold:0.50 },
      { id:"91b9b108-bb57-4872-817c-3185cf2198d8", r:"MINI", item:"Waffles", storage:"Freezer", unit:"bag", threshold:0.50 },
      // MINI — Fridge
      { id:"1b156c63-54a6-4cf1-9402-5f40e2fd0eed", r:"MINI", item:"Beet root salad", storage:"Fridge", unit:"bottle", threshold:0.50 },
      { id:"ef206f1e-0032-4beb-a39e-959bf954dab1", r:"MINI", item:"Blueberries", storage:"Fridge", unit:"box", threshold:0.50 },
      { id:"fdb8f769-ad5e-4a06-a7d3-97888a50a6d1", r:"MINI", item:"Bulgur salat", storage:"Fridge", unit:"Packs", threshold:2.00 },
      { id:"c852547f-be38-46cd-943b-0a0b812a1880", r:"MINI", item:"Carrots", storage:"Fridge", unit:"packs", threshold:2.00 },
      { id:"1e8b4530-b3d8-42e9-98ae-cf32f9b5256c", r:"MINI", item:"Cream cheese", storage:"Fridge", unit:"Packs", threshold:2.00 },
      { id:"28ce1bed-6f21-41fb-91f7-a1222056e6c4", r:"MINI", item:"Cucumber", storage:"Fridge", unit:"box", threshold:0.50 },
      { id:"110cfb94-378b-4fb8-984e-f064e925e181", r:"MINI", item:"Feta", storage:"Fridge", unit:"block", threshold:1.00 },
      { id:"50139916-2650-4370-9071-954042b13756", r:"MINI", item:"Grapes", storage:"Fridge", unit:"box", threshold:0.50 },
      { id:"0d8b924f-ad2b-4d30-91d9-f3c7f0ae8c0b", r:"MINI", item:"Ice berg Salat", storage:"Fridge", unit:"heads", threshold:4.00 },
      { id:"1dd4237e-3977-4449-ac19-3ca2ec82e637", r:"MINI", item:"Joghurt", storage:"Fridge", unit:"packs", threshold:4.00 },
      { id:"af1eb393-ff0f-4c64-8aca-72c0ec1ab741", r:"MINI", item:"Mascarpone", storage:"Fridge", unit:"pack", threshold:1.00 },
      { id:"8d137c29-6270-427a-9a02-ab88a7ac4cc3", r:"MINI", item:"Mint leaves", storage:"Fridge", unit:"boxes", threshold:3.00 },
      { id:"42933d51-5e11-4f1d-bcf8-2dec58fab88e", r:"MINI", item:"Mozzarella Balls", storage:"Fridge", unit:"box", threshold:0.50 },
      { id:"86250174-6726-456d-a535-3f1e026ae3e4", r:"MINI", item:"Pepperoni", storage:"Fridge", unit:"box", threshold:0.50 },
      { id:"1b22d4cb-6608-4e9d-98ea-44bf793e46d2", r:"MINI", item:"Pesto", storage:"Fridge", unit:"bottle", threshold:1.00 },
      { id:"a943ce73-5f40-40f4-b35a-779a5f7ab04a", r:"MINI", item:"Raspberries", storage:"Fridge", unit:"box", threshold:0.50 },
      { id:"41d10cf5-3b77-4438-be99-2248b40a7b69", r:"MINI", item:"Raucherlachs", storage:"Fridge", unit:"packs", threshold:3.00 },
      { id:"1079d871-ed93-40e1-b253-0fb40ae625a9", r:"MINI", item:"Red Hummus", storage:"Fridge", unit:"Packs", threshold:2.00 },
      { id:"0b8e5dfc-2b45-4653-8115-f56f9ce52808", r:"MINI", item:"Rucola", storage:"Fridge", unit:"Box", threshold:1.00 },
      { id:"9abe4c3b-de7c-441a-ba10-f1ffb1544426", r:"MINI", item:"Salmon", storage:"Fridge", unit:"pack", threshold:1.00 },
      { id:"ffcc9a29-6e04-408e-9f27-352f26e671ab", r:"MINI", item:"Spinach", storage:"Fridge", unit:"Box", threshold:1.00 },
      { id:"5badf6da-d86b-4f8c-a012-c3e1c9688f80", r:"MINI", item:"Spring Onions", storage:"Fridge", unit:"pieces", threshold:2.00 },
      { id:"3e174f8f-3267-4f5b-a13b-a020efa756a3", r:"MINI", item:"Sprossen", storage:"Fridge", unit:"pack", threshold:1.00 },
      { id:"1ccfb595-3235-4e1f-9e55-89b2f733530f", r:"MINI", item:"Tomato Sauce", storage:"Fridge", unit:"pack", threshold:1.00 },
      { id:"f81b70e9-b4a4-4f99-97a9-f14492228acf", r:"MINI", item:"Tomatoes", storage:"Fridge", unit:"box", threshold:0.50 },
      { id:"82ed6dd6-35ad-461c-ac5c-212d4a4ac2bd", r:"MINI", item:"Vegan Mayonnaise", storage:"Fridge", unit:"pack", threshold:0.50 },
      // MINI — Shelves
      { id:"8243bfd2-0477-40a8-80cf-c6fc9254b664", r:"MINI", item:"Agave Dicksaft", storage:"Shelves", unit:"bottles", threshold:2.00 },
      { id:"f4c7f9de-23f1-4967-89a3-b149de4749fb", r:"MINI", item:"Almonds", storage:"Shelves", unit:"pack", threshold:1.00 },
      { id:"d263ab6c-0855-4c86-9833-4a18e0f8425e", r:"MINI", item:"Aluminium Foil", storage:"Shelves", unit:"rolls", threshold:5.00 },
      { id:"ec65341c-17f3-43c3-b0eb-ac9cf3277cac", r:"MINI", item:"Apfel Essig", storage:"Shelves", unit:"bottle", threshold:1.00 },
      { id:"36cbcf83-813e-4960-9b65-dbcd438e0a90", r:"MINI", item:"Apples", storage:"Shelves", unit:"crate", threshold:0.50 },
      { id:"679e4acf-3e4c-4a41-afa6-3e0bf3568d94", r:"MINI", item:"Avocado", storage:"Shelves", unit:"boxes", threshold:2.00 },
      { id:"6593bf1b-3cb8-4758-b901-8e9e5bdef08d", r:"MINI", item:"Baking paper", storage:"Shelves", unit:"rolls", threshold:5.00 },
      { id:"5c4e3002-dfff-4dbc-b0bd-cbb69e1a1614", r:"MINI", item:"Baking powder", storage:"Shelves", unit:"pack", threshold:0.50 },
      { id:"887215fb-32fa-4c64-a0dd-d9683547fa80", r:"MINI", item:"Banana", storage:"Shelves", unit:"box", threshold:0.50 },
      { id:"a5579963-bae0-4dff-bb36-10698df2ed18", r:"MINI", item:"Barbecue Sauce", storage:"Shelves", unit:"pack", threshold:1.00 },
      { id:"7f74d1ef-645b-4c45-8d7d-223701d74497", r:"MINI", item:"Brown Sugar", storage:"Shelves", unit:"packs", threshold:2.00 },
      { id:"96c49d77-58f0-4a8b-861d-fe52c6f9ec27", r:"MINI", item:"Chia seeds", storage:"Shelves", unit:"pack", threshold:0.50 },
      { id:"2f93df30-b558-47ff-9859-657354d46722", r:"MINI", item:"Chimichuri powder", storage:"Shelves", unit:"pack", threshold:1.00 },
      { id:"71f16b92-f811-4f7f-a8ce-207b48e87543", r:"MINI", item:"Chocolate syrup", storage:"Shelves", unit:"bottle", threshold:1.00 },
      { id:"6412dca3-ef80-4b1a-a23a-b2c77d24d489", r:"MINI", item:"Coconut milk", storage:"Shelves", unit:"packs", threshold:4.00 },
      { id:"f65efd83-7cdc-417d-8006-ce89285fd6c6", r:"MINI", item:"Dill", storage:"Shelves", unit:"pack", threshold:0.50 },
      { id:"df3dbf03-1352-4e00-965b-4da0bb50ea1e", r:"MINI", item:"Dish soap", storage:"Shelves", unit:"container", threshold:0.50 },
      { id:"236c810f-e980-4f56-9de9-61aab02bb4e6", r:"MINI", item:"Disinfectant spray", storage:"Shelves", unit:"container", threshold:0.50 },
      { id:"307d4aa3-490a-4967-8358-9d0c83038fa4", r:"MINI", item:"Eggs", storage:"Shelves", unit:"packs", threshold:3.00 },
      { id:"3146c0c2-d58a-4811-9560-7fec0a828e0d", r:"MINI", item:"Essig", storage:"Shelves", unit:"bottles", threshold:3.00 },
      { id:"c1ae587c-e7f0-4649-976c-66dfe5fa17f5", r:"MINI", item:"Flour", storage:"Shelves", unit:"packs", threshold:3.00 },
      { id:"e75f01c7-71a0-482b-bb0b-694e313e1523", r:"MINI", item:"Garlic", storage:"Shelves", unit:"packs", threshold:2.00 },
      { id:"34e221a5-95d9-4b9f-9a4f-1ee5d7229dd1", r:"MINI", item:"Ginger", storage:"Shelves", unit:"crate", threshold:0.50 },
      { id:"fbe0eb72-b616-4205-99c8-e03a989e8139", r:"MINI", item:"Gloves", storage:"Shelves", unit:"box", threshold:1.00 },
      { id:"f97911c2-d289-4495-8663-7a41628215f6", r:"MINI", item:"Honey", storage:"Shelves", unit:"bottles", threshold:2.00 },
      { id:"f6c1d63d-6a47-4989-b3d3-352f1a4f0b9c", r:"MINI", item:"Kokos Barista Milk", storage:"Shelves", unit:"pack", threshold:1.00 },
      { id:"f9d849df-1bbe-4b01-8c3d-b1b7bdd54a62", r:"MINI", item:"Kokos Rapeln", storage:"Shelves", unit:"pack", threshold:1.00 },
      { id:"36d0362c-b08f-4f49-a08e-b0e265d82f0f", r:"MINI", item:"Laktosfrei Milk", storage:"Shelves", unit:"pack", threshold:1.00 },
      { id:"0c10895c-64de-472c-ac1b-b114fb822ad0", r:"MINI", item:"Lemon", storage:"Shelves", unit:"crate", threshold:0.50 },
      { id:"30a16370-4510-4281-9682-d282fd8e212e", r:"MINI", item:"Lime", storage:"Shelves", unit:"crate", threshold:0.50 },
      { id:"d3568dd7-b5bb-4ffe-9fed-0138e46335da", r:"MINI", item:"Mandeln", storage:"Shelves", unit:"pack", threshold:1.00 },
      { id:"646433a0-fcca-4575-a274-073dd4e3de2a", r:"MINI", item:"Mango Chilli Sauce", storage:"Shelves", unit:"bottles", threshold:3.00 },
      { id:"c5fae9dd-01a1-43c3-96fb-bfa6cd86b411", r:"MINI", item:"Mixed Nuts", storage:"Shelves", unit:"Packs", threshold:3.00 },
      { id:"77b1b2f8-feef-4d72-8fc8-921c75f0389a", r:"MINI", item:"Nutella", storage:"Shelves", unit:"pack", threshold:0.50 },
      { id:"b0841aad-3f58-4c0e-9b28-93a66b7cfc08", r:"MINI", item:"Oat Milk", storage:"Shelves", unit:"pack", threshold:1.00 },
      { id:"d3f32fb9-3c54-4fd3-95f6-c2bf7a8d548d", r:"MINI", item:"Oats", storage:"Shelves", unit:"box", threshold:0.50 },
      { id:"2d7460cd-dca7-4bc1-be0b-6cb37edd8ae9", r:"MINI", item:"Olive Oil", storage:"Shelves", unit:"bottles", threshold:3.00 },
      { id:"5915c63e-d093-4bf3-b2bd-25e1f738f87a", r:"MINI", item:"Onions", storage:"Shelves", unit:"bag", threshold:1.00 },
      { id:"c2ceb749-bba1-4c6b-9157-1fe68d407333", r:"MINI", item:"Oranges", storage:"Shelves", unit:"crate", threshold:0.50 },
      { id:"78b7303c-6539-4d3c-a4d3-82dd4fbb9b6d", r:"MINI", item:"Oregano", storage:"Shelves", unit:"pack", threshold:0.50 },
      { id:"98950514-7eec-4a76-90cc-399cf4a750a1", r:"MINI", item:"Paprika powder", storage:"Shelves", unit:"pack", threshold:1.00 },
      { id:"dc9be4d9-1558-43c0-85f7-5f7c09cf73c4", r:"MINI", item:"Peanut butter", storage:"Shelves", unit:"pack", threshold:0.50 },
      { id:"79168884-2870-4f95-a325-cf6964d3c737", r:"MINI", item:"Pfeffer", storage:"Shelves", unit:"pack", threshold:0.50 },
      { id:"084c3d01-c267-4ad1-be09-20c82f854da8", r:"MINI", item:"Pistachio", storage:"Shelves", unit:"packs", threshold:2.00 },
      { id:"1c583b04-7713-4654-bfb5-a8c2b68553b3", r:"MINI", item:"Pistachio grains", storage:"Shelves", unit:"pack", threshold:0.50 },
      { id:"cb800740-467d-4c14-83d4-30d5ce3de486", r:"MINI", item:"Plantains", storage:"Shelves", unit:"box", threshold:0.50 },
      { id:"23023c8a-2613-4794-87fa-b640391d9f23", r:"MINI", item:"Quinoa", storage:"Shelves", unit:"packs", threshold:3.00 },
      { id:"4c2b185a-c388-49ab-8c7d-6787591591af", r:"MINI", item:"Roasted onions", storage:"Shelves", unit:"packs", threshold:3.00 },
      { id:"808911f3-14dc-4e53-91c7-ca55fabd9d19", r:"MINI", item:"Salt", storage:"Shelves", unit:"packs", threshold:3.00 },
      { id:"3e53b019-f5f1-4fa4-86f9-4bbc451a5b99", r:"MINI", item:"Sauce cup (to go)", storage:"Shelves", unit:"pcs", threshold:4.00 },
      { id:"02bbf1cb-8df8-42b1-9d62-976015b895f7", r:"MINI", item:"Sauce cup cover (to go)", storage:"Shelves", unit:"pcs", threshold:4.00 },
      { id:"df514a60-e417-40b4-9b77-5420e5f234b2", r:"MINI", item:"Sesame oil", storage:"Shelves", unit:"bottle", threshold:1.00 },
      { id:"4742cf90-e3b8-4fe9-b14f-36e19b678ba1", r:"MINI", item:"Sesame seeds", storage:"Shelves", unit:"pack", threshold:0.50 },
      { id:"d9200ca3-f904-4052-85bb-18e81107ce5c", r:"MINI", item:"Soja sauce", storage:"Shelves", unit:"bottle", threshold:1.00 },
      { id:"391f27c7-b29a-4dc9-b6f5-0de70b67bd63", r:"MINI", item:"Sunflower Oil", storage:"Shelves", unit:"bottles", threshold:3.00 },
      { id:"897672c0-646f-4225-b4b0-ebc39021cb75", r:"MINI", item:"Sushi Rice", storage:"Shelves", unit:"pack", threshold:0.50 },
      { id:"d51837a5-9540-4809-a61f-d667c27f89cb", r:"MINI", item:"Sweet Potatoes", storage:"Shelves", unit:"box", threshold:0.50 },
      { id:"766fd5bd-efb4-413d-a88e-d3b791cbaecb", r:"MINI", item:"Sweet corn", storage:"Shelves", unit:"pack", threshold:0.50 },
      { id:"b4777dae-88f1-4513-b484-1e727f1a495c", r:"MINI", item:"Teriyaki sauce", storage:"Shelves", unit:"bottles", threshold:2.00 },
      { id:"6af983dd-0606-4d18-a0c6-2cbd9709e0a3", r:"MINI", item:"Tissue Rolls", storage:"Shelves", unit:"pack", threshold:0.50 },
      { id:"ab5566cd-cdf9-468a-96f7-9f480f62a3f5", r:"MINI", item:"To go bowl covers", storage:"Shelves", unit:"pcs", threshold:3.00 },
      { id:"4eb8373d-6a5d-41e1-8c05-db679429974c", r:"MINI", item:"To go bowls", storage:"Shelves", unit:"pcs", threshold:1.00 },
      { id:"c5059c0c-5316-421f-bd30-57186fb2c29b", r:"MINI", item:"To go cup holders", storage:"Shelves", unit:"pcs", threshold:2.00 },
      { id:"f3c92cfa-c093-4bae-aa81-ef4aafc99760", r:"MINI", item:"To go cups", storage:"Shelves", unit:"pcs", threshold:2.00 },
      { id:"0a434eec-b9dd-4425-ae7b-710302eb3d66", r:"MINI", item:"To go straws", storage:"Shelves", unit:"pcs", threshold:1.00 },
      { id:"7024fc51-f6ba-452c-aa78-372f2d2582f8", r:"MINI", item:"Tortilla Chips", storage:"Shelves", unit:"packs", threshold:3.00 },
      { id:"d5688930-abde-4e36-92b8-558b8a2c997c", r:"MINI", item:"Trash bag", storage:"Shelves", unit:"bunch", threshold:1.00 },
      { id:"1f3a6dde-edb1-43fb-ae95-6ddb638a6d3e", r:"MINI", item:"Vanilla essence", storage:"Shelves", unit:"bottle", threshold:0.50 },
      { id:"e66ce899-d745-4070-a6f7-5cc09cfa1418", r:"MINI", item:"Vollkorn Brot", storage:"Shelves", unit:"packs", threshold:4.00 },
      { id:"a1be04ae-5c99-4a58-83e3-7fe83ee86399", r:"MINI", item:"White Sugar", storage:"Shelves", unit:"packs", threshold:3.00 },
      { id:"79a99954-9756-439a-9d00-8c7785ebffd6", r:"MINI", item:"Wraps", storage:"Shelves", unit:"box", threshold:1.00 },
      // IMMORTL — Freezer
      { id:"b9d0174a-16b1-4d9c-b2e6-b15f124d5256", r:"IMMORTL", item:"Bagels", storage:"Freezer", unit:"bag", threshold:0.50 },
      { id:"eb4b2bda-c2c6-4530-a2fb-2f94339fee5b", r:"IMMORTL", item:"Chicken", storage:"Freezer", unit:"pcs", threshold:3.00 },
      { id:"8b816f5a-8eae-4a19-8bb9-3155a4c7292c", r:"IMMORTL", item:"Crispy chicken", storage:"Freezer", unit:"Bags", threshold:2.00 },
      { id:"8e86356c-df60-4802-8083-4d03e1500405", r:"IMMORTL", item:"Croissants", storage:"Freezer", unit:"pack", threshold:1.00 },
      { id:"9ae0fe23-ac0e-4fdf-bda9-5f53611e2fe0", r:"IMMORTL", item:"Edamame", storage:"Freezer", unit:"packs", threshold:6.00 },
      { id:"4550f10f-7f42-4d9e-8086-3234bb5d9e6a", r:"IMMORTL", item:"Falafel", storage:"Freezer", unit:"pack", threshold:1.00 },
      { id:"491a1c71-62f5-4dd5-9ca9-439bbb77b162", r:"IMMORTL", item:"Frozen Acai", storage:"Freezer", unit:"box", threshold:0.50 },
      { id:"29469ccd-2d05-4a80-bf14-deba57476a4c", r:"IMMORTL", item:"Frozen Dragon fruit", storage:"Freezer", unit:"box", threshold:1.00 },
      { id:"17ba0b89-8a52-4bfc-8a61-c1839902e109", r:"IMMORTL", item:"Frozen Mango", storage:"Freezer", unit:"boxes", threshold:2.00 },
      { id:"ada235fd-7684-47df-8e49-135bfc555b79", r:"IMMORTL", item:"Frozen Strawberries", storage:"Freezer", unit:"packs", threshold:2.00 },
      { id:"ee5db59f-52a7-4cb4-ab22-a31abbfbe67d", r:"IMMORTL", item:"Guacamole", storage:"Freezer", unit:"packs", threshold:2.00 },
      { id:"fa583b04-9c37-438e-9212-5154d9976141", r:"IMMORTL", item:"Ice Cubes", storage:"Freezer", unit:"packs", threshold:2.00 },
      { id:"cffd6b03-f3e5-44b3-bd67-37538598346e", r:"IMMORTL", item:"Ice cream", storage:"Freezer", unit:"Box", threshold:0.50 },
      { id:"47b270d4-2671-4b70-a814-dc33e6cf3df0", r:"IMMORTL", item:"NewYork Cheesecake", storage:"Freezer", unit:"packs", threshold:2.00 },
      { id:"4e1995fc-5525-4b0b-aaad-db6f494b04d9", r:"IMMORTL", item:"Vegan chicken", storage:"Freezer", unit:"Pack", threshold:1.00 },
      { id:"c963ff4d-9aa1-4bff-87bf-137dd565acb3", r:"IMMORTL", item:"Vegan crispy chicken", storage:"Freezer", unit:"bag", threshold:0.50 },
      { id:"2b1531b0-72af-4278-a722-4bd7b556af99", r:"IMMORTL", item:"Waffles", storage:"Freezer", unit:"bag", threshold:0.50 },
      // IMMORTL — Fridge
      { id:"143d274e-5089-49f7-b446-78948e152779", r:"IMMORTL", item:"Beet root salad", storage:"Fridge", unit:"bottle", threshold:0.50 },
      { id:"9c1f863b-d8c7-4943-8bef-a627c3fdc003", r:"IMMORTL", item:"Blueberries", storage:"Fridge", unit:"box", threshold:0.50 },
      { id:"622dec5b-8540-4c0b-b3b4-7c217dc63fb0", r:"IMMORTL", item:"Bulgur salat", storage:"Fridge", unit:"Packs", threshold:2.00 },
      { id:"ac8019c6-6ed8-43df-9819-9a2fb93f13a6", r:"IMMORTL", item:"Carrots", storage:"Fridge", unit:"packs", threshold:2.00 },
      { id:"eabcc7ae-a95f-4556-b67f-dff8b19a79eb", r:"IMMORTL", item:"Cream cheese", storage:"Fridge", unit:"Packs", threshold:2.00 },
      { id:"8469004d-efc9-4d11-ab83-29130f508ee0", r:"IMMORTL", item:"Cucumber", storage:"Fridge", unit:"box", threshold:0.50 },
      { id:"ddd5e601-33f9-4f5a-8ca6-4bd28826af6e", r:"IMMORTL", item:"Feta", storage:"Fridge", unit:"block", threshold:1.00 },
      { id:"8bbb53b4-7086-42f0-8733-3e37cc9ac64a", r:"IMMORTL", item:"Grapes", storage:"Fridge", unit:"box", threshold:0.50 },
      { id:"0b952e7c-8794-46ca-8900-41c291e9e075", r:"IMMORTL", item:"Ice berg Salat", storage:"Fridge", unit:"heads", threshold:4.00 },
      { id:"4f5ff070-a61f-46a5-9a31-635ffe9c5884", r:"IMMORTL", item:"Joghurt", storage:"Fridge", unit:"packs", threshold:4.00 },
      { id:"75e40dd8-386d-4573-9c0f-c9613c5b54f1", r:"IMMORTL", item:"Mascarpone", storage:"Fridge", unit:"pack", threshold:1.00 },
      { id:"3f30ed23-708a-4d47-accb-9718639ad38a", r:"IMMORTL", item:"Mint leaves", storage:"Fridge", unit:"boxes", threshold:3.00 },
      { id:"0932fa69-b46c-43af-b5b8-7aa8e9afabca", r:"IMMORTL", item:"Mozzarella Balls", storage:"Fridge", unit:"box", threshold:0.50 },
      { id:"dea7422b-3b22-4c13-a3c6-7e2e227a9c31", r:"IMMORTL", item:"Pepperoni", storage:"Fridge", unit:"box", threshold:0.50 },
      { id:"a63230a5-82a8-480e-bfc1-71c8c0470e90", r:"IMMORTL", item:"Pesto", storage:"Fridge", unit:"bottle", threshold:1.00 },
      { id:"63871ca3-ae89-4813-8a08-a81d03daab6b", r:"IMMORTL", item:"Raspberries", storage:"Fridge", unit:"box", threshold:0.50 },
      { id:"1dca8cef-b8f0-4ca1-9bb5-9294b533ca3c", r:"IMMORTL", item:"Raucherlachs", storage:"Fridge", unit:"packs", threshold:3.00 },
      { id:"f93916e7-ab36-4951-a9ff-b9f90601701a", r:"IMMORTL", item:"Red Hummus", storage:"Fridge", unit:"Packs", threshold:2.00 },
      { id:"33fe206e-65b7-4545-b005-b01ddfc61ff9", r:"IMMORTL", item:"Rucola", storage:"Fridge", unit:"Box", threshold:1.00 },
      { id:"f29cf801-21ee-45d4-a3ea-4ba43c297f4a", r:"IMMORTL", item:"Salmon", storage:"Fridge", unit:"pack", threshold:1.00 },
      { id:"56f42e34-34f2-4228-b754-a93a4411c443", r:"IMMORTL", item:"Spinach", storage:"Fridge", unit:"Box", threshold:1.00 },
      { id:"9c33463c-274b-4d47-821f-41f321f7a514", r:"IMMORTL", item:"Spring Onions", storage:"Fridge", unit:"pieces", threshold:2.00 },
      { id:"9b154717-426d-4ad9-a6a8-4beb45d4311c", r:"IMMORTL", item:"Sprossen", storage:"Fridge", unit:"pack", threshold:1.00 },
      { id:"fcc9d3e0-f54f-4fa1-b59f-69923b9217ed", r:"IMMORTL", item:"Tomato Sauce", storage:"Fridge", unit:"pack", threshold:1.00 },
      { id:"9891c506-7d38-4957-a43d-9cc6ff5564f7", r:"IMMORTL", item:"Tomatoes", storage:"Fridge", unit:"box", threshold:0.50 },
      { id:"f544147b-44c1-43db-b7f8-be1173006f65", r:"IMMORTL", item:"Vegan Mayonnaise", storage:"Fridge", unit:"pack", threshold:0.50 },
      // IMMORTL — Shelves
      { id:"55f8202b-f970-4043-8ec0-5247c7b8603a", r:"IMMORTL", item:"Agave Dicksaft", storage:"Shelves", unit:"bottles", threshold:2.00 },
      { id:"8b0e3f13-50ff-4db7-bfd2-bb03e8255a70", r:"IMMORTL", item:"Almonds", storage:"Shelves", unit:"pack", threshold:1.00 },
      { id:"05baa6cd-35ab-4b79-acda-7c9e9d2c3344", r:"IMMORTL", item:"Aluminium Foil", storage:"Shelves", unit:"rolls", threshold:5.00 },
      { id:"198ef702-9e42-47f5-a415-e38798f48dff", r:"IMMORTL", item:"Apfel Essig", storage:"Shelves", unit:"bottle", threshold:1.00 },
      { id:"3b95aea9-229a-471f-b821-3e7237d971f2", r:"IMMORTL", item:"Apples", storage:"Shelves", unit:"crate", threshold:0.50 },
      { id:"c11ec8d4-8c30-4c70-8e7f-2c58a2755d92", r:"IMMORTL", item:"Avocado", storage:"Shelves", unit:"boxes", threshold:2.00 },
      { id:"c429a235-826d-474d-bc87-2181347fdb77", r:"IMMORTL", item:"Baking paper", storage:"Shelves", unit:"rolls", threshold:5.00 },
      { id:"dfccdebe-c890-432d-a6ed-56a6ab6c729f", r:"IMMORTL", item:"Baking powder", storage:"Shelves", unit:"pack", threshold:0.50 },
      { id:"79ed667b-c0a2-4092-9a11-6e6cbd961f88", r:"IMMORTL", item:"Banana", storage:"Shelves", unit:"box", threshold:0.50 },
      { id:"211e2a8c-b32b-40d9-8782-aee426f14254", r:"IMMORTL", item:"Barbecue Sauce", storage:"Shelves", unit:"pack", threshold:1.00 },
      { id:"c0cf1b69-f4db-4113-971f-809f80b0603e", r:"IMMORTL", item:"Brown Sugar", storage:"Shelves", unit:"packs", threshold:2.00 },
      { id:"ebd5310e-ef0d-4395-9326-4fb0de2df1bf", r:"IMMORTL", item:"Chia seeds", storage:"Shelves", unit:"pack", threshold:0.50 },
      { id:"a9d63b2e-092c-407b-a4fc-f2b3894ff05e", r:"IMMORTL", item:"Chimichuri powder", storage:"Shelves", unit:"pack", threshold:1.00 },
      { id:"38ff70ec-d788-497d-b3e0-ad5c483a8333", r:"IMMORTL", item:"Chocolate syrup", storage:"Shelves", unit:"bottle", threshold:1.00 },
      { id:"62ea077f-b237-475a-90ef-a39c266e04af", r:"IMMORTL", item:"Coconut milk", storage:"Shelves", unit:"packs", threshold:4.00 },
      { id:"7e2497d6-3f3b-4b04-849f-64f3dc8d3241", r:"IMMORTL", item:"Dill", storage:"Shelves", unit:"pack", threshold:0.50 },
      { id:"7bc6a8da-91e0-4dfa-8a9f-4f20629731c2", r:"IMMORTL", item:"Dish soap", storage:"Shelves", unit:"container", threshold:0.50 },
      { id:"abc69609-95fd-4c0e-a0ad-d9ece61ca24b", r:"IMMORTL", item:"Disinfectant spray", storage:"Shelves", unit:"container", threshold:0.50 },
      { id:"34ef48be-160f-4226-aafd-42259e228091", r:"IMMORTL", item:"Eggs", storage:"Shelves", unit:"packs", threshold:3.00 },
      { id:"6389f7fb-56f4-4eea-8b98-29e4627c53a4", r:"IMMORTL", item:"Essig", storage:"Shelves", unit:"bottles", threshold:3.00 },
      { id:"4513d46f-cd62-4efd-a8b8-bba1f3661bf2", r:"IMMORTL", item:"Flour", storage:"Shelves", unit:"packs", threshold:3.00 },
      { id:"754801c9-07b1-47a4-ab73-ef0346331728", r:"IMMORTL", item:"Garlic", storage:"Shelves", unit:"packs", threshold:2.00 },
      { id:"0712e3b4-4fce-4676-bc7c-bd5b208161e7", r:"IMMORTL", item:"Ginger", storage:"Shelves", unit:"crate", threshold:0.50 },
      { id:"8752b3d9-4652-4c4b-8fc7-159cdd78f989", r:"IMMORTL", item:"Gloves", storage:"Shelves", unit:"box", threshold:1.00 },
      { id:"78a29170-06ad-443b-a03c-3d95b5ddbd1b", r:"IMMORTL", item:"Honey", storage:"Shelves", unit:"bottles", threshold:2.00 },
      { id:"db09270f-ed75-46f2-9c08-77d98761df6c", r:"IMMORTL", item:"Kokos Barista Milk", storage:"Shelves", unit:"pack", threshold:1.00 },
      { id:"048d4901-5810-4798-8639-d56fa6763e12", r:"IMMORTL", item:"Kokos Rapeln", storage:"Shelves", unit:"pack", threshold:1.00 },
      { id:"f6222159-b5db-4f83-b96a-058b3bf85dbc", r:"IMMORTL", item:"Laktosfrei Milk", storage:"Shelves", unit:"pack", threshold:1.00 },
      { id:"51edf798-e8d6-40c0-81b9-28c3e0f6b621", r:"IMMORTL", item:"Lemon", storage:"Shelves", unit:"crate", threshold:0.50 },
      { id:"dc3b4ed1-0739-4036-b58d-b495e7f27948", r:"IMMORTL", item:"Lime", storage:"Shelves", unit:"crate", threshold:0.50 },
      { id:"9678780b-de24-4825-ac4f-5bf1f480ce8a", r:"IMMORTL", item:"Mandeln", storage:"Shelves", unit:"pack", threshold:1.00 },
      { id:"3dc302c4-3422-4884-bb6b-bf49a432c6f7", r:"IMMORTL", item:"Mango Chilli Sauce", storage:"Shelves", unit:"bottles", threshold:3.00 },
      { id:"0b5ede58-b7c1-41ec-88d1-62c47b93e4f2", r:"IMMORTL", item:"Mixed Nuts", storage:"Shelves", unit:"Packs", threshold:3.00 },
      { id:"7029c388-0e0f-46d3-8e58-91777c610e1e", r:"IMMORTL", item:"Nutella", storage:"Shelves", unit:"pack", threshold:0.50 },
      { id:"f21f7f01-a96c-40e8-9719-158c48016a25", r:"IMMORTL", item:"Oat Milk", storage:"Shelves", unit:"pack", threshold:1.00 },
      { id:"8e1e020d-48b4-4761-932d-8384de215e62", r:"IMMORTL", item:"Oats", storage:"Shelves", unit:"box", threshold:0.50 },
      { id:"723699e9-5a5d-4085-8329-26c5bda1e6ed", r:"IMMORTL", item:"Olive Oil", storage:"Shelves", unit:"bottles", threshold:3.00 },
      { id:"8b0ff84c-e45e-4f7a-ae36-44b4e63d0a40", r:"IMMORTL", item:"Onions", storage:"Shelves", unit:"bag", threshold:1.00 },
      { id:"32ccc6be-1838-4270-969c-4434ad45f49c", r:"IMMORTL", item:"Oranges", storage:"Shelves", unit:"crate", threshold:0.50 },
      { id:"0cd76ed6-f32e-4f7e-a075-e990ab728f08", r:"IMMORTL", item:"Oregano", storage:"Shelves", unit:"pack", threshold:0.50 },
      { id:"da069815-b6e9-4a6c-b32c-b3c413c54f5a", r:"IMMORTL", item:"Paprika powder", storage:"Shelves", unit:"pack", threshold:1.00 },
      { id:"7bfb8fd6-16cf-4763-a157-c60524b2fa0a", r:"IMMORTL", item:"Peanut butter", storage:"Shelves", unit:"pack", threshold:0.50 },
      { id:"cdabda9d-a779-4462-aa4a-b80b3f560310", r:"IMMORTL", item:"Pfeffer", storage:"Shelves", unit:"pack", threshold:0.50 },
      { id:"86646bcf-b782-4332-ac64-564a67aff3a4", r:"IMMORTL", item:"Pistachio", storage:"Shelves", unit:"packs", threshold:2.00 },
      { id:"c7ace771-82fe-406b-b128-dd83345a63b2", r:"IMMORTL", item:"Pistachio grains", storage:"Shelves", unit:"pack", threshold:0.50 },
      { id:"f9b17577-25a9-4a24-959a-95b7fcc0e7ac", r:"IMMORTL", item:"Plantains", storage:"Shelves", unit:"box", threshold:0.50 },
      { id:"802a31a7-b28f-4965-8b65-befb1a428f68", r:"IMMORTL", item:"Quinoa", storage:"Shelves", unit:"packs", threshold:3.00 },
      { id:"3d2599d4-6af4-4bf6-83b5-272bbff700a9", r:"IMMORTL", item:"Roasted onions", storage:"Shelves", unit:"packs", threshold:3.00 },
      { id:"4ca8e209-3c8b-4544-b026-56d019e8cad8", r:"IMMORTL", item:"Salt", storage:"Shelves", unit:"packs", threshold:3.00 },
      { id:"94aef677-8c6c-4f02-8dfe-906312b4d9e6", r:"IMMORTL", item:"Sauce cup (to go)", storage:"Shelves", unit:"pcs", threshold:4.00 },
      { id:"cc60768d-294f-46c5-b0bf-cc3251bc2762", r:"IMMORTL", item:"Sauce cup cover (to go)", storage:"Shelves", unit:"pcs", threshold:4.00 },
      { id:"4aaad9c2-9433-4e72-88cb-d104ac34a76e", r:"IMMORTL", item:"Sesame oil", storage:"Shelves", unit:"bottle", threshold:1.00 },
      { id:"34521fd2-0c2d-4eb7-b703-0f8ea6c7ec15", r:"IMMORTL", item:"Sesame seeds", storage:"Shelves", unit:"pack", threshold:0.50 },
      { id:"eb8134cf-588a-4e8c-bb1e-686b8147314d", r:"IMMORTL", item:"Soja sauce", storage:"Shelves", unit:"bottle", threshold:1.00 },
      { id:"04155a0f-14de-49b4-839f-1a8771b677e4", r:"IMMORTL", item:"Sunflower Oil", storage:"Shelves", unit:"bottles", threshold:3.00 },
      { id:"cc1f2830-9aad-4b59-8157-9d4a39c1a43d", r:"IMMORTL", item:"Sushi Rice", storage:"Shelves", unit:"pack", threshold:0.50 },
      { id:"285faa36-7d8b-487f-b881-3f505ae2916d", r:"IMMORTL", item:"Sweet Potatoes", storage:"Shelves", unit:"box", threshold:0.50 },
      { id:"61340dca-2008-48bd-ae3b-400d9b57667c", r:"IMMORTL", item:"Sweet corn", storage:"Shelves", unit:"pack", threshold:0.50 },
      { id:"eecac40f-0e34-47c8-bcc3-e2946c9812aa", r:"IMMORTL", item:"Teriyaki sauce", storage:"Shelves", unit:"bottles", threshold:2.00 },
      { id:"4426fc9b-3501-4542-8702-75d353c51858", r:"IMMORTL", item:"Tissue Rolls", storage:"Shelves", unit:"pack", threshold:0.50 },
      { id:"92e34afb-18f6-44ba-9f03-c3353203c52f", r:"IMMORTL", item:"To go bowl covers", storage:"Shelves", unit:"pcs", threshold:3.00 },
      { id:"56b2a5d2-5d24-4b3c-b213-0c3244a06ddb", r:"IMMORTL", item:"To go bowls", storage:"Shelves", unit:"pcs", threshold:1.00 },
      { id:"04e595a2-9159-4473-a218-b0fe43f92065", r:"IMMORTL", item:"To go cup holders", storage:"Shelves", unit:"pcs", threshold:2.00 },
      { id:"c0256891-a5ac-461d-ada4-a4736621b631", r:"IMMORTL", item:"To go cups", storage:"Shelves", unit:"pcs", threshold:2.00 },
      { id:"853a2570-8d07-4782-9f65-03f3e8dad131", r:"IMMORTL", item:"To go straws", storage:"Shelves", unit:"pcs", threshold:1.00 },
      { id:"7d3e2963-fbe8-4454-ae45-3ec4ca5034c1", r:"IMMORTL", item:"Tortilla Chips", storage:"Shelves", unit:"packs", threshold:3.00 },
      { id:"ec90ff11-24ca-49d7-8309-99d3bf71c4dc", r:"IMMORTL", item:"Trash bag", storage:"Shelves", unit:"bunch", threshold:1.00 },
      { id:"ff8b0dc3-32c8-415d-a2f0-dcdbc3423d93", r:"IMMORTL", item:"Vanilla essence", storage:"Shelves", unit:"bottle", threshold:0.50 },
      { id:"537de7de-9e53-4264-8f94-71e1ac4b04d8", r:"IMMORTL", item:"Vollkorn Brot", storage:"Shelves", unit:"packs", threshold:4.00 },
      { id:"98ac1fbd-ada2-4f66-8b82-7939ec2e67d3", r:"IMMORTL", item:"White Sugar", storage:"Shelves", unit:"packs", threshold:3.00 },
      { id:"d246adda-168c-4836-aa82-432a6793707f", r:"IMMORTL", item:"Wraps", storage:"Shelves", unit:"box", threshold:1.00 },
    ];

    let inserted = 0;
    for (const t of items) {
      try {
        await pool.query(
          `INSERT INTO inventory_items (id, restaurant_id, item, storage, unit, quantity, low_stock_threshold)
           VALUES ($1, $2, $3, $4, $5, 0, $6)
           ON CONFLICT (id) DO NOTHING`,
          [t.id, idMap[t.r], t.item, t.storage, t.unit, t.threshold]
        );
        inserted++;
      } catch (rowErr: any) {
        log(`Skipping inventory item "${t.item}": ${rowErr.message}`, "seed");
      }
    }

    log(`Seeded ${inserted} inventory items`, "seed");
  } catch (err: any) {
    log(`Inventory seed skipped: ${err.message}`, "seed");
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
  await ensureSeedInventory();
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
