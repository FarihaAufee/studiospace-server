import { MongoClient } from 'mongodb';

let client = null;
let db = null;

/**
 * Connects to MongoDB once and caches the client.
 * Uses MONGODB_URL and MONGODB_DB_NAME from the .env file.
 * Matches the original behavior: a failed connection is logged,
 * but the process keeps running (requests will fail until the DB is reachable).
 */
export async function connectToMongoDB() {
  if (db) return db;

  try {
    const uri = process.env.MONGODB_URL;
    const dbName = process.env.MONGODB_DB_NAME;

    if (!uri) {
      throw new Error('MONGODB_URL is missing from the .env file');
    }
    if (!dbName) {
      throw new Error('MONGODB_DB_NAME is missing from the .env file');
    }

    client = new MongoClient(uri);
    await client.connect();
    await client.db(dbName).command({ ping: 1 });

    db = client.db(dbName);
    await ensureStudiosCollection(db);
    console.log(`You successfully connected to MongoDB! DB: ${db.databaseName}`);
    return db;
  } catch (err) {
    console.dir(err, { depth: null });
    return null;
  }
}

/**
 * Ensures the studios collection exists and indexes the fields that the
 * list endpoint filters and sorts on. createCollection() only throws for
 * "NamespaceExists", which also confirms the collection is present.
 */
async function ensureStudiosCollection(db) {
  const collectionName =
    process.env.MONGODB_STUDIOS_COLLECTION || 'studios';

  try {
    await db.createCollection(collectionName);
  } catch (err) {
    // NamespaceExists == collection already created; safe to continue.
    if (err?.codeName !== 'NamespaceExists') throw err;
  }

  const indexes = [
    { key: { createdAt: -1, _id: -1 }, name: 'createdAt_desc__id_desc' },
    { key: { category: 1 }, name: 'category_asc' },
    { key: { location: 1 }, name: 'location_asc' },
    { key: { hourlyRate: 1 }, name: 'hourlyRate_asc' },
  ];

  for (const { key, name } of indexes) {
    await db.collection(collectionName).createIndex(key, { name });
  }
}

/**
 * Returns any collection by name. Throws a clean error if the DB is not
 * connected yet, which the global error handler turns into a 503.
 */
function getCollection(name, envKey, fallbackName) {
  if (!db) {
    throw Object.assign(new Error('Database not connected yet'), { statusCode: 503 });
  }
  return db.collection(process.env[envKey] || fallbackName);
}

/**
 * Returns the studios collection. The collection name can be overridden
 * via MONGODB_STUDIOS_COLLECTION in the .env file (defaults to "studios").
 */
export function getStudiosCollection() {
  return getCollection('studios', 'MONGODB_STUDIOS_COLLECTION', 'studios');
}

/**
 * Returns the bookings collection. Creates no indexes or schema anywhere yet —
 * it only exposes the existing database. The name can be overridden via
 * MONGODB_BOOKINGS_COLLECTION in the .env file (defaults to "bookings").
 */
export function getBookingsCollection() {
  return getCollection('bookings', 'MONGODB_BOOKINGS_COLLECTION', 'bookings');
}

/**
 * Returns the Better Auth `user` collection. Reserved for the future Better
 * Auth integration — profile endpoints read/update display fields from here
 * while Better Auth keeps ownership of the document. NOT created proactively;
 * Better Auth's MongoDB adapter creates it when auth goes live.
 * Name can be overridden via MONGODB_USERS_COLLECTION (defaults to "user").
 */
export function getUserCollection() {
  return getCollection('user', 'MONGODB_USERS_COLLECTION', 'user');
}
