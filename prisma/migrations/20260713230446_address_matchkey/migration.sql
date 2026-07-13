-- Address dedup key (issue #57).
--
-- Splits dedup from display: `matchKey` is a lossy, case/whitespace-insensitive
-- key (uniqued) while street/city/state/zip now preserve the user's ORIGINAL
-- casing. Replaces the old UNIQUE(street, city, state, zip), whose enforcement
-- relied on Title-Casing the display fields and mangled acronyms/directionals
-- ("123 NW 5th Ave" -> "123 Nw 5th Ave", "PO Box 12" -> "Po Box 12").
--
-- PRODUCTION DATA HANDLING -- this is NOT a purely-additive migration:
--   1. `matchKey` is NOT NULL with no default, so it is BACKFILLED for every
--      existing row from the stored fields:
--        lower(trim(street))||'|'||lower(trim(city))||'|'||lower(trim(state))||'|'||lower(trim(zip))
--      This reproduces the key the app now computes (server/utils/address.ts:
--      addressMatchKey). Rows written under #16 are already whitespace-collapsed
--      and Title-Cased, and lower() erases the Title-Case, so the backfilled key
--      matches what a fresh upsert of the same address would produce.
--   2. The new UNIQUE(matchKey) replaces UNIQUE(street, city, state, zip). Any
--      pre-existing rows that collapse to the SAME matchKey (legacy duplicates
--      predating #16) would violate it, so we DE-DUPE first: repoint every FK
--      (client.homeAddressId, ride.pickupAddressId, ride.dropoffAddressId) onto
--      the surviving row -- the lowest id per matchKey -- and keep only that row.
--      On a post-#16 DB the rows are already case-folded-unique, so the de-dupe
--      and FK repoint are no-ops. Collision risk on real data is therefore low;
--      it is handled here purely to keep the migration safe on any older dump.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- 1. Repoint FKs from duplicate addresses onto the survivor (MIN id per key),
--    so dropping the duplicate rows below cannot orphan a client or ride.
UPDATE "client"
SET "homeAddressId" = (
    SELECT MIN(a2."id") FROM "address" a2
    WHERE lower(trim(a2."street"))||'|'||lower(trim(a2."city"))||'|'||lower(trim(a2."state"))||'|'||lower(trim(a2."zip"))
        = (SELECT lower(trim(a1."street"))||'|'||lower(trim(a1."city"))||'|'||lower(trim(a1."state"))||'|'||lower(trim(a1."zip"))
           FROM "address" a1 WHERE a1."id" = "client"."homeAddressId")
);

UPDATE "ride"
SET "pickupAddressId" = (
    SELECT MIN(a2."id") FROM "address" a2
    WHERE lower(trim(a2."street"))||'|'||lower(trim(a2."city"))||'|'||lower(trim(a2."state"))||'|'||lower(trim(a2."zip"))
        = (SELECT lower(trim(a1."street"))||'|'||lower(trim(a1."city"))||'|'||lower(trim(a1."state"))||'|'||lower(trim(a1."zip"))
           FROM "address" a1 WHERE a1."id" = "ride"."pickupAddressId")
)
WHERE "pickupAddressId" IS NOT NULL;

UPDATE "ride"
SET "dropoffAddressId" = (
    SELECT MIN(a2."id") FROM "address" a2
    WHERE lower(trim(a2."street"))||'|'||lower(trim(a2."city"))||'|'||lower(trim(a2."state"))||'|'||lower(trim(a2."zip"))
        = (SELECT lower(trim(a1."street"))||'|'||lower(trim(a1."city"))||'|'||lower(trim(a1."state"))||'|'||lower(trim(a1."zip"))
           FROM "address" a1 WHERE a1."id" = "ride"."dropoffAddressId")
)
WHERE "dropoffAddressId" IS NOT NULL;

-- 2. Rebuild the table with matchKey; keep one backfilled row per matchKey.
CREATE TABLE "new_address" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "matchKey" TEXT NOT NULL
);
INSERT INTO "new_address" ("id", "street", "city", "state", "zip", "matchKey")
SELECT "id", "street", "city", "state", "zip",
       lower(trim("street"))||'|'||lower(trim("city"))||'|'||lower(trim("state"))||'|'||lower(trim("zip"))
FROM "address"
WHERE "id" IN (
    SELECT MIN("id") FROM "address"
    GROUP BY lower(trim("street"))||'|'||lower(trim("city"))||'|'||lower(trim("state"))||'|'||lower(trim("zip"))
);
DROP TABLE "address";
ALTER TABLE "new_address" RENAME TO "address";
CREATE UNIQUE INDEX "address_matchKey_key" ON "address"("matchKey");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
