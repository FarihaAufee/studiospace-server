// One-off verification: legacy collections untouched, no temp studio left.
// Read-only.
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const client = new MongoClient(process.env.MONGODB_URL);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME);

  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    console.log(`${col.name}: ${await db.collection(col.name).countDocuments()} docs`);
  }

  await client.close();
}

main().catch((err) => {
  console.error("Inspect failed:", err.message);
  process.exit(1);
});
