PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
);
INSERT INTO _prisma_migrations VALUES('f3af4b3c-162b-4182-8472-ee16a94db187','6f5294039dea26c84504235bdc51e6ae3253aa7e9e8a439179d2ff14658a7b2c',1767469182697,'20260103193519',NULL,NULL,1767469182473,1);
CREATE TABLE IF NOT EXISTS "session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expiresAt" DATETIME NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO session VALUES('4m69zlCkGSIpsFH7mNvL1uiBTf8B927A','2025-12-30T08:34:11.449+00:00','tS9T2oEgIrazgjDZdh4BF48Z9PjNQAEU','2025-12-23T08:34:11.450+00:00','2025-12-23T08:34:11.450+00:00','47.186.43.193','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36','1731c000-72e0-469e-8f8b-ad73860e85e8');
INSERT INTO session VALUES('Zjb4Ok0mUxXXGCWRL6q7E2i5c5e56yVQ','2025-12-30T18:57:16.797+00:00','xmsQeu4XffSupuDPHUWTk4ifNBrRzltw','2025-12-23T18:57:16.798+00:00','2025-12-23T18:57:16.798+00:00','70.119.74.38','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0','b1ddafda-3ac3-48d2-baed-3fe36c1e7b87');
INSERT INTO session VALUES('rXYGicQpURQlHhFJKsBQY0GfAxEzLNNT','2025-12-30T19:04:42.328+00:00','70nImFZZWVPCr3PafUX9unVhaCuWpFFL','2025-12-23T19:04:42.328+00:00','2025-12-23T19:04:42.328+00:00','47.187.207.43','Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36','9c84f658-9bc8-48ab-989c-67240f9628d6');
INSERT INTO session VALUES('l7gy1lYPiCUqmztYExQPI15IVT4UjYXj','2025-12-30T22:23:39.918+00:00','zy4AKrBCDjzlgXYimfmG64PtyVDXMga1','2025-12-23T22:23:39.918+00:00','2025-12-23T22:23:39.918+00:00','47.186.43.193','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','1731c000-72e0-469e-8f8b-ad73860e85e8');
INSERT INTO session VALUES('U7VRCMDcUQoInrjf690RcAN3M2DmVh3H','2026-01-09T22:37:59.423+00:00','318Jsj46m7hsHHpYTEoCF3HriUhgURQu','2025-12-27T23:00:32.989+00:00','2026-01-02T22:37:59.423+00:00','47.186.43.193','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','1731c000-72e0-469e-8f8b-ad73860e85e8');
INSERT INTO session VALUES('wjlP8v1uUbb2F8rDg3Zk86bevldyjg1c','2026-01-16T15:08:54.946+00:00','Vd6lDdJ1qGj0mMCheac759z5G4xDQz7W','2026-01-02T19:35:36.561+00:00','2026-01-09T15:08:54.946+00:00','70.119.74.38','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0','b1ddafda-3ac3-48d2-baed-3fe36c1e7b87');
INSERT INTO session VALUES('zTiwdEe4B34yUBxQnHLw683fKz7tbxf0','2026-01-30T14:54:15.587+00:00','OBldUNPoAF4SzIngZofoi2x35woO4CPh','2026-01-23T14:54:15.588+00:00','2026-01-23T14:54:15.588+00:00','70.119.74.38','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0','b1ddafda-3ac3-48d2-baed-3fe36c1e7b87');
INSERT INTO session VALUES('ZYFBR0NoxlP9bRVyrXaFqJytw8xXkxMG','2026-02-05T22:31:01.554+00:00','Fai2Oc8m9tPTixov0GETR8DQEaXKarsN','2026-01-24T00:09:18.746+00:00','2026-01-29T22:31:01.554+00:00','47.186.43.193','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36','1731c000-72e0-469e-8f8b-ad73860e85e8');
INSERT INTO session VALUES('h3sFJZHUBfIPsmcUW0sU5Cjhp2y43Hg2','2026-02-13T20:56:17.532+00:00','HLnTXPoel6fjdpVe0Pu8HirKKKkOmuPX','2026-02-06T20:56:17.532+00:00','2026-02-06T20:56:17.532+00:00','70.119.74.38','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0','b1ddafda-3ac3-48d2-baed-3fe36c1e7b87');
INSERT INTO session VALUES('hwCVX0guf9OxIdVqhKwakDyTNGYGC6DJ','2026-02-14T18:28:22.053+00:00','LjzB7nUFTSZjfBeMO0bEYo896dMLL6Hq','2026-02-07T18:28:22.053+00:00','2026-02-07T18:28:22.053+00:00','47.186.43.193','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36','1731c000-72e0-469e-8f8b-ad73860e85e8');
CREATE TABLE IF NOT EXISTS "verification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE TABLE IF NOT EXISTS "client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "homeAddressId" TEXT NOT NULL,
    CONSTRAINT "client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "client_homeAddressId_fkey" FOREIGN KEY ("homeAddressId") REFERENCES "address" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO client VALUES('4bdbbe9e-0169-49fd-b3ad-484a57e49e3e','bc033aff-c776-43c4-a19c-bbc4e8c5410c','5943e056-a7e3-447c-901a-c031f869bc67');
INSERT INTO client VALUES('c2928564-83a8-4b09-a85b-c9e6d03209e0','86e2b027-5a5a-4fb2-81d9-57ff4bd60c18','c369302b-f239-4268-a8e3-7b2054926aa5');
INSERT INTO client VALUES('b3499815-4c5c-4b59-b0ca-85ad9f0da075','a24d5f29-ccd1-4b5e-aa17-77594b91d540','12f19a32-34ff-416e-94ff-46eeb6b20c8f');
INSERT INTO client VALUES('a1ed20a4-0fb2-4fee-949e-a2d10d64caf5','e4a540b5-b4fc-4682-af98-8bdcadc922a9','79a641f5-0b08-42c0-ab4e-300fb78e1654');
INSERT INTO client VALUES('4eb3858d-8592-49ea-b362-231ff1c5a14d','d33dd667-fa56-45db-ac53-db0c38189099','645c5c8f-5da7-451c-9a49-99d9030f5c6a');
INSERT INTO client VALUES('cb0119b0-5511-4430-b01c-db8dae36feb6','b1ddafda-3ac3-48d2-baed-3fe36c1e7b87','a93a343a-49cc-4fd9-8599-beab0159f5db');
INSERT INTO client VALUES('a4ab3e55-4bd7-458e-8ded-be7c45c34240','099bd8c1-dd8a-44c3-a0ae-6ce5dcfa0b75','c245159f-e24c-4170-864b-a963f6ba2a1d');
INSERT INTO client VALUES('5a0429eb-face-400d-b9cf-8086fe928c5f','9ce208e1-17f3-454b-a15e-f56dae072239','914aee24-6cc8-4198-9803-f63bd420f041');
INSERT INTO client VALUES('6f00abe0-e848-4b5e-bf3e-f39738868cc9','04098bbc-3ee6-413e-8d23-568769d9804c','0b6f0f3c-4476-4a04-b4ef-52b8d732684f');
INSERT INTO client VALUES('02f2442d-691b-4bd4-b5cd-b2bfef1f440a','30120f48-50e0-47b4-a25f-085157f7f9c0','d61bceef-8c86-4de7-b792-8244f91f364f');
INSERT INTO client VALUES('5745e4a1-6be6-4985-a5f5-22afce54c1ea','cb4ee03c-0a9d-4ecf-b5a8-b81597be9fce','86a75d3e-8c96-4137-bfc2-b085e469f16d');
INSERT INTO client VALUES('e56dd486-e6c6-4a67-8edb-9d015595e3ba','9042e673-b2bc-4ee6-a57f-7441e1311ca1','05fa8dd6-930e-456c-9239-496352e8a498');
CREATE TABLE IF NOT EXISTS "address" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL
);
INSERT INTO address VALUES('5943e056-a7e3-447c-901a-c031f869bc67','1501 H Avenue','Plano','TX','75074');
INSERT INTO address VALUES('219a7978-fb32-4ab6-aa81-df466deb53c4','2831 E President George Bush Hwy','Richardson','TX','75082');
INSERT INTO address VALUES('61ee73e2-86c1-4240-afd9-b937765dbfff','9 Cowboys Way','Frisco','TX','75034');
INSERT INTO address VALUES('c369302b-f239-4268-a8e3-7b2054926aa5','4413 Eldorado Dr.','Plano','TX','75093');
INSERT INTO address VALUES('12f19a32-34ff-416e-94ff-46eeb6b20c8f','3201 Erwin Drive','Plano','TX','75074');
INSERT INTO address VALUES('79a641f5-0b08-42c0-ab4e-300fb78e1654','600 Independence Pkwy  #2418 (4th Flr)','Plano','TX','75075');
INSERT INTO address VALUES('645c5c8f-5da7-451c-9a49-99d9030f5c6a','4517 Newcombe Dr','Plano','TX','75093');
INSERT INTO address VALUES('a93a343a-49cc-4fd9-8599-beab0159f5db','309 Terra Verde Ln','McKinney','TX','75069');
INSERT INTO address VALUES('c245159f-e24c-4170-864b-a963f6ba2a1d','6016 Pinto Ct','Plano','TX','75023');
INSERT INTO address VALUES('f996641e-c2ca-43bd-af3a-5e9ea73a3641','440 coit rd','plano','tx','75075');
INSERT INTO address VALUES('914aee24-6cc8-4198-9803-f63bd420f041','945 Goodwin Dr','Plano','TX','75023');
INSERT INTO address VALUES('0b6f0f3c-4476-4a04-b4ef-52b8d732684f','6532 Osage Trail','Plano','TX','75093');
INSERT INTO address VALUES('d61bceef-8c86-4de7-b792-8244f91f364f','8400 Angels Dr.  #214','Plano','TX','75093');
INSERT INTO address VALUES('41cfe931-80d9-494f-a755-b2c391890994','4825 Alliance Blvd','Plano','TX','75093');
INSERT INTO address VALUES('e252a75a-c161-42af-a936-c8300707c441','1110 Cottonwood Lane  #110','Irving','TX','75038');
INSERT INTO address VALUES('86a75d3e-8c96-4137-bfc2-b085e469f16d','2505 Dunwick Dr','Plano','TX','75023');
INSERT INTO address VALUES('368ca5c5-29a8-4a04-878a-034c530fb712','4716 Alliance Blvd','Plano','TX','75093');
INSERT INTO address VALUES('30a15982-7abf-4194-830c-150c9278e6e8','4708 Allliance Blvd','Plano','TX','75093');
INSERT INTO address VALUES('05fa8dd6-930e-456c-9239-496352e8a498','1305 Edgefield Dr','Plano','TX','75075');
INSERT INTO address VALUES('b3e16b98-52fc-4380-b5c5-a179326f1bc7','4708 Alliance Blvd','Plano','TX','75093');
INSERT INTO address VALUES('facc3fb9-4783-4f9e-82a5-99ecf5139cc8','3151 15th St','Plano','TX','75075');
INSERT INTO address VALUES('2281aec9-7d6b-4806-a890-f3e7d84c8852','3151 15th ST','Plano','TX','75075');
CREATE TABLE IF NOT EXISTS "ride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "clientId" TEXT NOT NULL,
    "volunteerId" TEXT,
    "pickupDisplay" TEXT NOT NULL,
    "dropoffDisplay" TEXT NOT NULL,
    "pickupAddressId" TEXT,
    "dropoffAddressId" TEXT,
    "scheduledTime" DATETIME NOT NULL,
    "totalRideTime" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ride_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ride_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "volunteer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ride_pickupAddressId_fkey" FOREIGN KEY ("pickupAddressId") REFERENCES "address" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ride_dropoffAddressId_fkey" FOREIGN KEY ("dropoffAddressId") REFERENCES "address" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO ride VALUES('2ceba038-40d6-45bf-b952-f7be731386a0','COMPLETED','4bdbbe9e-0169-49fd-b3ad-484a57e49e3e','c79e086e-7536-4f8f-b6bb-47dd3aa734f1','1501 H Ave, Plano, TX 75074','Methodist Richardson Medical Center, Richardson, TX','5943e056-a7e3-447c-901a-c031f869bc67','219a7978-fb32-4ab6-aa81-df466deb53c4','2025-12-24T08:07:06.469+00:00',1.0,'Martha has a walker. Please pull into the circular drive.','2025-12-23T08:07:06.471+00:00','2025-12-23T08:26:21.397+00:00');
INSERT INTO ride VALUES('854a7411-173d-49d9-b0d8-d07ad51f6ee3','COMPLETED','4bdbbe9e-0169-49fd-b3ad-484a57e49e3e',NULL,'1501 H Ave, Plano, TX 75074','9 Cowboys Way, Frisco, TX 75034','5943e056-a7e3-447c-901a-c031f869bc67','61ee73e2-86c1-4240-afd9-b937765dbfff','2025-12-22T08:07:06.481+00:00',NULL,'Ride completed successfully. Client was on time.','2025-12-23T08:07:06.483+00:00','2025-12-23T08:07:06.483+00:00');
INSERT INTO ride VALUES('fd606c3f-1af1-4eb9-9a91-f6b250fb864a','ASSIGNED','4bdbbe9e-0169-49fd-b3ad-484a57e49e3e','326db587-0372-44aa-b3e5-13d6a65979ec','1501 H Avenue, Plano, TX 75074','9 Cowboys Way, Frisco, TX 75034','5943e056-a7e3-447c-901a-c031f869bc67','61ee73e2-86c1-4240-afd9-b937765dbfff','2025-12-23T15:00:00.000+00:00',NULL,'some notes','2025-12-23T19:00:27.850+00:00','2025-12-23T19:06:54.797+00:00');
INSERT INTO ride VALUES('0199f545-60e7-474d-961f-34327ca87ea8','CREATED','6f00abe0-e848-4b5e-bf3e-f39738868cc9',NULL,'6532 Osage Trail, Plano, TX 75093','4825 Alliance Blvd, Plano, TX 75093','0b6f0f3c-4476-4a04-b4ef-52b8d732684f','41cfe931-80d9-494f-a755-b2c391890994','2026-01-23T16:00:00.000+00:00',0.0,'','2026-01-23T15:32:01.755+00:00','2026-01-23T15:34:43.607+00:00');
INSERT INTO ride VALUES('edbfe14b-ca59-4cf1-a103-a6bb0bde2e9b','CREATED','6f00abe0-e848-4b5e-bf3e-f39738868cc9',NULL,'6532 Osage Trail, Plano, TX 75093','4825 Alliance Blvd, Plano, TX 75093','0b6f0f3c-4476-4a04-b4ef-52b8d732684f','41cfe931-80d9-494f-a755-b2c391890994','2026-01-27T20:00:00.000+00:00',0.0,'','2026-01-23T15:33:14.689+00:00','2026-01-23T15:35:07.218+00:00');
INSERT INTO ride VALUES('bb35c68a-1859-4322-8c62-08dd51908558','CREATED','6f00abe0-e848-4b5e-bf3e-f39738868cc9',NULL,'6532 Osage Trail, Plano, TX 75093','4825 Alliance Blvd, Plano, TX 75093','0b6f0f3c-4476-4a04-b4ef-52b8d732684f','41cfe931-80d9-494f-a755-b2c391890994','2026-01-30T17:00:00.000+00:00',NULL,'','2026-01-23T15:46:10.084+00:00','2026-01-23T15:46:10.084+00:00');
INSERT INTO ride VALUES('ab4b5bbc-212c-4944-a92c-67ec8d65fd7f','CREATED','6f00abe0-e848-4b5e-bf3e-f39738868cc9',NULL,'6532 Osage Trail, Plano, TX 75093','4825 Alliance Blvd, Plano, TX 75093','0b6f0f3c-4476-4a04-b4ef-52b8d732684f','41cfe931-80d9-494f-a755-b2c391890994','2026-02-03T20:00:00.000+00:00',NULL,'','2026-01-23T15:46:51.736+00:00','2026-01-23T15:46:51.736+00:00');
INSERT INTO ride VALUES('a65b9bae-207d-42b6-bc2a-8f103805a2f8','CREATED','6f00abe0-e848-4b5e-bf3e-f39738868cc9',NULL,'6532 Osage Trail, Plano, TX 75093','4825 Alliance Blvd, Plano, TX 75093','0b6f0f3c-4476-4a04-b4ef-52b8d732684f','41cfe931-80d9-494f-a755-b2c391890994','2026-02-06T17:00:00.000+00:00',NULL,'','2026-01-23T15:47:32.941+00:00','2026-01-23T15:47:32.941+00:00');
INSERT INTO ride VALUES('02a3efcf-2e1d-4697-9c07-f8a3f46298e7','CREATED','6f00abe0-e848-4b5e-bf3e-f39738868cc9',NULL,'6532 Osage Trail, Plano, TX 75093','4825 Alliance Blvd, Plano, TX 75093','0b6f0f3c-4476-4a04-b4ef-52b8d732684f','41cfe931-80d9-494f-a755-b2c391890994','2026-02-10T20:00:00.000+00:00',NULL,'','2026-01-23T15:47:58.165+00:00','2026-01-23T15:47:58.165+00:00');
INSERT INTO ride VALUES('2bc3c857-bd63-4d24-ad70-8ab637654f24','CREATED','6f00abe0-e848-4b5e-bf3e-f39738868cc9',NULL,'6532 Osage Trail, Plano, TX 75093','4825 Alliance Blvd, Plano, TX 75093','0b6f0f3c-4476-4a04-b4ef-52b8d732684f','41cfe931-80d9-494f-a755-b2c391890994','2026-02-13T16:00:00.000+00:00',NULL,'','2026-01-23T15:48:22.348+00:00','2026-01-23T15:48:22.348+00:00');
INSERT INTO ride VALUES('0760e4bb-8788-4846-8ec7-0e16c6f4d3e6','CREATED','6f00abe0-e848-4b5e-bf3e-f39738868cc9',NULL,'6532 Osage Trail, Plano, TX 75093','4825 Alliance Blvd, Plano, TX 75093','0b6f0f3c-4476-4a04-b4ef-52b8d732684f','41cfe931-80d9-494f-a755-b2c391890994','2026-02-17T20:00:00.000+00:00',NULL,'','2026-01-23T15:48:43.384+00:00','2026-01-23T15:48:43.384+00:00');
INSERT INTO ride VALUES('fb7d7aa0-241c-4124-a716-2a581c83e8cd','CREATED','6f00abe0-e848-4b5e-bf3e-f39738868cc9',NULL,'6532 Osage Trail, Plano, TX 75093','4825 Alliance Blvd, Plano, TX 75093','0b6f0f3c-4476-4a04-b4ef-52b8d732684f','41cfe931-80d9-494f-a755-b2c391890994','2026-02-20T17:00:00.000+00:00',NULL,'','2026-01-23T15:49:09.057+00:00','2026-01-23T15:49:09.057+00:00');
INSERT INTO ride VALUES('281f1c68-4620-4432-8ccf-1f4b0d841bef','CREATED','6f00abe0-e848-4b5e-bf3e-f39738868cc9',NULL,'6532 Osage Trail, Plano, TX 75093','4825 Alliance Blvd, Plano, TX 75093','0b6f0f3c-4476-4a04-b4ef-52b8d732684f','41cfe931-80d9-494f-a755-b2c391890994','2026-02-24T20:00:00.000+00:00',NULL,'','2026-01-23T15:49:40.908+00:00','2026-01-23T15:49:40.908+00:00');
INSERT INTO ride VALUES('ffd50a9e-0f16-4f3e-847a-ad0df1f7168d','CREATED','6f00abe0-e848-4b5e-bf3e-f39738868cc9',NULL,'6532 Osage Trail, Plano, TX 75093','4825 Alliance Blvd, Plano, TX 75093','0b6f0f3c-4476-4a04-b4ef-52b8d732684f','41cfe931-80d9-494f-a755-b2c391890994','2026-02-27T16:00:00.000+00:00',NULL,'','2026-01-23T15:50:02.749+00:00','2026-01-23T15:50:02.749+00:00');
INSERT INTO ride VALUES('78a3511f-8489-41ae-ba43-ce732b2c6668','CREATED','a4ab3e55-4bd7-458e-8ded-be7c45c34240',NULL,'6016 Pinto Ct, Plano, TX 75023','1110 Cottonwood Lane  #110, Irving, TX 75038','c245159f-e24c-4170-864b-a963f6ba2a1d','e252a75a-c161-42af-a936-c8300707c441','2026-01-28T17:00:00.000+00:00',NULL,'','2026-01-23T15:58:04.739+00:00','2026-01-23T15:58:04.739+00:00');
INSERT INTO ride VALUES('6b3609ef-5527-4244-9da7-2658d271d603','CREATED','5745e4a1-6be6-4985-a5f5-22afce54c1ea',NULL,'2505 Dunwick Dr, Plano, TX 75023','4716 Alliance Blvd, Plano, TX 75093','86a75d3e-8c96-4137-bfc2-b085e469f16d','368ca5c5-29a8-4a04-878a-034c530fb712','2026-02-02T16:45:00.000+00:00',NULL,'','2026-01-23T16:01:25.891+00:00','2026-01-23T16:01:25.891+00:00');
INSERT INTO ride VALUES('09ca571f-71f2-4de7-92f4-8d28816ccb8d','CREATED','c2928564-83a8-4b09-a85b-c9e6d03209e0',NULL,'4413 Eldorado Dr., Plano, TX 75093','4708 Allliance Blvd, Plano, TX 75093','c369302b-f239-4268-a8e3-7b2054926aa5','30a15982-7abf-4194-830c-150c9278e6e8','2026-02-03T13:15:00.000+00:00',NULL,'','2026-01-23T16:02:33.721+00:00','2026-01-23T16:02:33.721+00:00');
INSERT INTO ride VALUES('74378def-7df6-495e-8416-a04f42635464','CREATED','e56dd486-e6c6-4a67-8edb-9d015595e3ba',NULL,'1305 Edgefield Dr, Plano, TX 75075','4708 Alliance Blvd, Plano, TX 75093','05fa8dd6-930e-456c-9239-496352e8a498','b3e16b98-52fc-4380-b5c5-a179326f1bc7','2026-02-04T18:00:00.000+00:00',NULL,'','2026-01-23T16:06:12.626+00:00','2026-01-23T16:06:12.626+00:00');
INSERT INTO ride VALUES('d60d02b9-dad7-45bb-91de-0f5271d399cb','CREATED','a1ed20a4-0fb2-4fee-949e-a2d10d64caf5',NULL,'600 Independence Pkwy  #2418 (4th Flr), Plano, TX 75075','3151 15th St, Plano, TX 75075','79a641f5-0b08-42c0-ab4e-300fb78e1654','facc3fb9-4783-4f9e-82a5-99ecf5139cc8','2026-02-06T15:00:00.000+00:00',NULL,'Pickup at 8:40am','2026-02-06T21:05:49.367+00:00','2026-02-06T21:05:49.367+00:00');
INSERT INTO ride VALUES('44eafb2a-85ba-4dba-9319-146646552e7b','CREATED','a1ed20a4-0fb2-4fee-949e-a2d10d64caf5',NULL,'600 Independence Pkwy  #2418 (4th Flr), Plano, TX 75075','3151 15th ST, Plano, TX 75075','79a641f5-0b08-42c0-ab4e-300fb78e1654','2281aec9-7d6b-4806-a890-f3e7d84c8852','2026-02-12T15:00:00.000+00:00',NULL,'Pickup at 8:40.  Appt. duration about 1 hour','2026-02-06T21:07:14.450+00:00','2026-02-06T21:07:14.450+00:00');
CREATE TABLE IF NOT EXISTS "sent_reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rideId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sent_reminder_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "ride" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CLIENT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO user VALUES('1731c000-72e0-469e-8f8b-ad73860e85e8','Tushar Wani','reachtusharwani@gmail.com',1,'469-235-9513','ADMIN','2025-12-23T08:07:06.383+00:00','2025-12-23T08:25:12.205+00:00');
INSERT INTO user VALUES('2a9ba53e-286e-4857-ad56-b35134414f9e','UTD_Tushar Wani','tmw220003@utdallas.edu',1,NULL,'ADMIN','2025-12-23T08:07:06.395+00:00','2025-12-23T08:07:06.395+00:00');
INSERT INTO user VALUES('bc033aff-c776-43c4-a19c-bbc4e8c5410c','Martha Jenkins','martha@example.com',0,'972-555-0101','CLIENT','2025-12-23T08:07:06.427+00:00','2025-12-23T08:07:06.427+00:00');
INSERT INTO user VALUES('c34fbe4c-9527-4f1d-b7b4-0fb06076cc74','Bob Tester','bob@example.com',0,'469-555-0202','VOLUNTEER','2025-12-23T08:07:06.445+00:00','2025-12-23T08:07:06.445+00:00');
INSERT INTO user VALUES('cbca9d43-a7d6-4a4b-984d-789b5d9aa89d','TW-NPTS','tushar.wani@npts.tech',1,NULL,'VOLUNTEER','2025-12-23T08:07:06.458+00:00','2025-12-23T08:07:06.458+00:00');
INSERT INTO user VALUES('b1ddafda-3ac3-48d2-baed-3fe36c1e7b87','Jane Oestreich','michelle.owen@wellctr.org',1,'9729775125','ADMIN','2025-12-23T08:24:50.148+00:00','2026-01-02T21:40:24.816+00:00');
INSERT INTO user VALUES('9c84f658-9bc8-48ab-989c-67240f9628d6','Vinay Tambe','vtambe1975@gmail.com',1,'2147042091','VOLUNTEER','2025-12-23T19:03:44.382+00:00','2025-12-23T19:04:42.315+00:00');
INSERT INTO user VALUES('993e3ca8-70c1-413c-8ca7-55bbeb666cae','Janene Ludlow','wjludlow@verizon.net',0,'5126804249','VOLUNTEER','2026-01-02T20:55:07.574+00:00','2026-01-02T20:55:07.574+00:00');
INSERT INTO user VALUES('844fc2c8-b3f6-4902-b034-31c75c058de0','Shauna Buraczyk','srburaczyk@gmail.com',0,'9725482118','VOLUNTEER','2026-01-02T20:55:37.204+00:00','2026-01-02T20:55:37.204+00:00');
INSERT INTO user VALUES('91ec7b6c-e686-4ae7-a48d-8d7dec20b156','Sherry Schlager','sschlager47@gmail.com',0,'9207503300','VOLUNTEER','2026-01-02T20:56:03.598+00:00','2026-01-23T15:27:58.109+00:00');
INSERT INTO user VALUES('49b7aafb-1771-40ec-9a87-46a81fa9443b','Michelle Thornton','michellethornton2@gmail.com',0,'9729740364','VOLUNTEER','2026-01-02T20:56:29.794+00:00','2026-01-02T20:56:29.794+00:00');
INSERT INTO user VALUES('93886985-ab47-4c45-a082-dab1ba5d3983','Bridtnhy Arroyo','bridtnhyarroyo@gmail.com',0,'4695586808','VOLUNTEER','2026-01-02T20:57:00.366+00:00','2026-01-02T20:57:00.366+00:00');
INSERT INTO user VALUES('1834ca79-9c0f-41a0-aee9-79eeb2f2284e','Kathleen Savage','kms_75074@yahoo.com',0,'9722160401','VOLUNTEER','2026-01-02T20:57:27.103+00:00','2026-01-02T20:57:27.103+00:00');
INSERT INTO user VALUES('f9aea7fc-9f35-4b72-aeed-ccf269b50340','Diane Skibba','dskibba2@yahoo.com',0,'2146360619','VOLUNTEER','2026-01-02T20:58:07.090+00:00','2026-01-02T20:58:07.090+00:00');
INSERT INTO user VALUES('230cbc23-66a4-41bb-b32e-0cc2a24d9108','John Egan','johnj.dallas@yahoo.com',0,'9729848953','VOLUNTEER','2026-01-02T20:58:36.429+00:00','2026-01-02T20:58:36.429+00:00');
INSERT INTO user VALUES('6332e46c-909c-4ae8-a1dc-905327467f7f','Dennis Chinloy','dennischinloy@yahoo.com',0,'2149270970','VOLUNTEER','2026-01-02T20:59:09.484+00:00','2026-01-23T15:27:43.191+00:00');
INSERT INTO user VALUES('276431c0-190a-43b2-be4c-601c21dbeafe','Diane Miya','dmiya4207@tx.rr.com',0,'9729783782','VOLUNTEER','2026-01-02T20:59:46.523+00:00','2026-01-02T20:59:46.523+00:00');
INSERT INTO user VALUES('d27285d9-2340-4a50-9d1e-0084291a8906','Joanne Arseth','joanneaarseth7@gmail.com',0,'5719261504','VOLUNTEER','2026-01-02T21:00:19.525+00:00','2026-01-02T21:00:19.525+00:00');
INSERT INTO user VALUES('f098589d-88dc-4287-91c9-698c3ad63a93','Kelly Loy','yellowrose333@verizon.net',0,'2147700406','VOLUNTEER','2026-01-02T21:00:56.550+00:00','2026-01-02T21:00:56.550+00:00');
INSERT INTO user VALUES('603631a6-a70e-46d9-9a59-d665f478880d','Whitney Lamb','wslamb@flash.net',0,'9728164936','VOLUNTEER','2026-01-02T21:01:20.941+00:00','2026-01-02T21:01:20.941+00:00');
INSERT INTO user VALUES('8f770939-844a-4615-afa1-6f78a5c14980','Sherri Lynn Waters','sherri.waters@att.net',0,'4692260438','VOLUNTEER','2026-01-02T21:01:56.536+00:00','2026-01-02T21:01:56.536+00:00');
INSERT INTO user VALUES('65c27601-3d41-4173-a63e-e97597382cbd','Meg Belanger','megbelanger1@gmail.com',0,'2145971907','VOLUNTEER','2026-01-02T21:02:52.648+00:00','2026-01-02T21:02:52.648+00:00');
INSERT INTO user VALUES('d181eba8-ee18-4ccb-8b29-8c4af1621662','Ann Chinloy','dnachinloy@verizon.net',0,'2143347540','VOLUNTEER','2026-01-02T21:03:22.253+00:00','2026-01-23T15:27:36.547+00:00');
INSERT INTO user VALUES('64caa65a-83ac-48d2-a3c3-2b1b8627281e','Kelly Hayley','k_hayley@yahoo.com',0,'2145784724','VOLUNTEER','2026-01-02T21:03:51.440+00:00','2026-01-02T21:03:51.440+00:00');
INSERT INTO user VALUES('be7d91c2-11b4-41cd-8acd-61fcda20fba0','Allen Skwarek','bigal1413@gmail.com',0,'9724231014','VOLUNTEER','2026-01-02T21:04:17.744+00:00','2026-02-06T21:06:15.816+00:00');
INSERT INTO user VALUES('b476f178-70b1-4d1a-88dd-8bfe0bdf2097','Jeff Carter','jeff.carter1@verizon.net',0,'2146861487','VOLUNTEER','2026-01-02T21:04:50.777+00:00','2026-01-02T21:04:50.777+00:00');
INSERT INTO user VALUES('de42df50-9bf3-4d94-aad8-f4d6d38ea0c5','Michael Granata','mgwslx2@flash.net',0,'2147086265','VOLUNTEER','2026-01-02T21:05:21.373+00:00','2026-01-02T21:05:21.373+00:00');
INSERT INTO user VALUES('1791c7dd-2813-47db-b8ea-a8e3ac90a766','Paula Smith','paulaspatchworks@hotmail.com',0,'3103675487','VOLUNTEER','2026-01-02T21:20:07.305+00:00','2026-01-02T21:20:07.305+00:00');
INSERT INTO user VALUES('86e2b027-5a5a-4fb2-81d9-57ff4bd60c18','Deborah Dana','vegansoapkitchen@gmail.com',0,'9725334751','CLIENT','2026-01-02T21:35:35.906+00:00','2026-01-02T21:35:35.906+00:00');
INSERT INTO user VALUES('a24d5f29-ccd1-4b5e-aa17-77594b91d540','William Kimberlin','royk1@att.net',0,'2147079734','CLIENT','2026-01-02T21:36:59.910+00:00','2026-01-02T21:36:59.910+00:00');
INSERT INTO user VALUES('e4a540b5-b4fc-4682-af98-8bdcadc922a9','Mona Cole','faycz57@msn.com',0,'2533128841','CLIENT','2026-01-02T21:38:00.149+00:00','2026-01-02T21:38:00.149+00:00');
INSERT INTO user VALUES('d33dd667-fa56-45db-ac53-db0c38189099','Anneli Fuller','akfgosox@gmail.com',0,'9729850452','CLIENT','2026-01-02T21:39:11.677+00:00','2026-01-02T21:39:11.677+00:00');
INSERT INTO user VALUES('099bd8c1-dd8a-44c3-a0ae-6ce5dcfa0b75','Georgia Bargmann','georgiabarg@yahoo.com',0,'8327551044','CLIENT','2026-01-02T21:45:58.423+00:00','2026-01-02T21:45:58.423+00:00');
INSERT INTO user VALUES('1dac222f-d8e7-43c8-ae39-00d9c722ea4d','new test client',NULL,0,'3333333333','CLIENT','2026-01-03T19:44:15.288+00:00','2026-01-03T19:44:15.288+00:00');
INSERT INTO user VALUES('9ce208e1-17f3-454b-a15e-f56dae072239','Elvira Miller','veramiller2153@gmail.com',0,'9724234901','CLIENT','2026-01-23T15:22:51.371+00:00','2026-01-23T15:22:51.371+00:00');
INSERT INTO user VALUES('04098bbc-3ee6-413e-8d23-568769d9804c','Ahn Nguyen','nguyen-tuetahn@gmail.com',0,'4697588488','CLIENT','2026-01-23T15:24:06.790+00:00','2026-01-23T15:24:06.790+00:00');
INSERT INTO user VALUES('43544d45-ebe6-4fbd-a031-5d16decbeff4','Jennifer Bennett','sunshine071080@gmail.com',0,'9186062454','VOLUNTEER','2026-01-23T15:24:55.314+00:00','2026-01-23T15:24:55.314+00:00');
INSERT INTO user VALUES('30120f48-50e0-47b4-a25f-085157f7f9c0','Todd Brewster','todd@conversationswithtodd.com',0,'2149124721','CLIENT','2026-01-23T15:25:45.854+00:00','2026-01-23T15:25:45.854+00:00');
INSERT INTO user VALUES('74d85647-cbef-4375-93c2-8ac28aee8674','Teri Titus','terititus@ebby.com',0,'2145324548','VOLUNTEER','2026-01-23T15:26:18.520+00:00','2026-01-23T15:26:18.520+00:00');
INSERT INTO user VALUES('cb4ee03c-0a9d-4ecf-b5a8-b81597be9fce','Bruce Bayless','brucebaylesscpa@yahoo.com',0,'4696496475','CLIENT','2026-01-23T16:00:09.363+00:00','2026-01-23T16:00:09.363+00:00');
INSERT INTO user VALUES('9042e673-b2bc-4ee6-a57f-7441e1311ca1','Dorriece Shuptrine','dorreice2@gmail.com',0,'9723427657','CLIENT','2026-01-23T16:05:10.739+00:00','2026-01-23T16:05:10.739+00:00');
CREATE TABLE IF NOT EXISTS "volunteer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "notificationSettings" JSONB,
    CONSTRAINT "volunteer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO volunteer VALUES('c79e086e-7536-4f8f-b6bb-47dd3aa734f1','cbca9d43-a7d6-4a4b-984d-789b5d9aa89d','AVAILABLE','{"push":true,"email":false}');
INSERT INTO volunteer VALUES('326db587-0372-44aa-b3e5-13d6a65979ec','9c84f658-9bc8-48ab-989c-67240f9628d6','AVAILABLE',NULL);
INSERT INTO volunteer VALUES('6c2f48a4-23f9-4976-9f31-e929f76a6753','993e3ca8-70c1-413c-8ca7-55bbeb666cae','AVAILABLE',NULL);
INSERT INTO volunteer VALUES('bb191cff-55c3-44c2-a8b6-036d992e3a45','844fc2c8-b3f6-4902-b034-31c75c058de0','AVAILABLE',NULL);
INSERT INTO volunteer VALUES('8ce8b4de-cb9a-4f69-aa50-af7cf7b4062f','91ec7b6c-e686-4ae7-a48d-8d7dec20b156','UNAVAILABLE',NULL);
INSERT INTO volunteer VALUES('1576d629-ab38-4c73-af73-f57a1471c9db','49b7aafb-1771-40ec-9a87-46a81fa9443b','AVAILABLE',NULL);
INSERT INTO volunteer VALUES('acc4bc8e-0927-48fd-ba5c-7c4cdb95244d','93886985-ab47-4c45-a082-dab1ba5d3983','AVAILABLE',NULL);
INSERT INTO volunteer VALUES('5c40a332-d131-4e8a-913e-c629e5507f00','1834ca79-9c0f-41a0-aee9-79eeb2f2284e','AVAILABLE',NULL);
INSERT INTO volunteer VALUES('66f672d5-cf23-4a01-8c78-85e5a355d748','f9aea7fc-9f35-4b72-aeed-ccf269b50340','AVAILABLE',NULL);
INSERT INTO volunteer VALUES('92866134-1af1-49bc-a069-6b4c23c4effa','230cbc23-66a4-41bb-b32e-0cc2a24d9108','AVAILABLE',NULL);
INSERT INTO volunteer VALUES('fb474002-96bd-421f-bef7-08d9eb1573be','6332e46c-909c-4ae8-a1dc-905327467f7f','UNAVAILABLE',NULL);
INSERT INTO volunteer VALUES('3a711fb9-2a4e-423b-972a-0cb8d4140be9','276431c0-190a-43b2-be4c-601c21dbeafe','AVAILABLE',NULL);
INSERT INTO volunteer VALUES('9496e067-5746-43ba-a314-ed3e3d906c13','d27285d9-2340-4a50-9d1e-0084291a8906','AVAILABLE',NULL);
INSERT INTO volunteer VALUES('448ee0d6-8cd7-4834-890b-3370ddd5806c','f098589d-88dc-4287-91c9-698c3ad63a93','AVAILABLE',NULL);
INSERT INTO volunteer VALUES('b0b4d0e0-06e4-463d-adbb-f57e0da3eec4','603631a6-a70e-46d9-9a59-d665f478880d','AVAILABLE',NULL);
INSERT INTO volunteer VALUES('8e6fc54c-79ff-4a2c-9fd3-cad192952cb0','8f770939-844a-4615-afa1-6f78a5c14980','AVAILABLE',NULL);
INSERT INTO volunteer VALUES('e2cb44dc-3302-4d1c-bba0-017af8fe6735','65c27601-3d41-4173-a63e-e97597382cbd','AVAILABLE',NULL);
INSERT INTO volunteer VALUES('8aefa143-3630-4027-ab40-7c5844f89bc5','d181eba8-ee18-4ccb-8b29-8c4af1621662','UNAVAILABLE',NULL);
INSERT INTO volunteer VALUES('68c0ad33-a272-4796-b46b-c71e96db6715','64caa65a-83ac-48d2-a3c3-2b1b8627281e','AVAILABLE',NULL);
INSERT INTO volunteer VALUES('b0b6538a-1f70-4302-bf49-821343ab1d3d','be7d91c2-11b4-41cd-8acd-61fcda20fba0','UNAVAILABLE',NULL);
INSERT INTO volunteer VALUES('c061a5b7-79c4-44d8-82dd-17013fd0510b','b476f178-70b1-4d1a-88dd-8bfe0bdf2097','AVAILABLE',NULL);
INSERT INTO volunteer VALUES('93a537bd-e22a-47fe-958c-88b08dd7d8b6','de42df50-9bf3-4d94-aad8-f4d6d38ea0c5','AVAILABLE',NULL);
INSERT INTO volunteer VALUES('4e2495de-6e9c-4d15-b407-649621c66085','1791c7dd-2813-47db-b8ea-a8e3ac90a766','AVAILABLE',NULL);
INSERT INTO volunteer VALUES('67003d59-d3a6-42d2-8fca-3c75c835b082','43544d45-ebe6-4fbd-a031-5d16decbeff4','AVAILABLE',NULL);
INSERT INTO volunteer VALUES('9f2429c3-a7bf-4df8-8456-926c9c3c8467','74d85647-cbef-4375-93c2-8ac28aee8674','AVAILABLE',NULL);
CREATE TABLE IF NOT EXISTS "reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "volunteerId" TEXT NOT NULL,
    "minutesBefore" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'email',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "reminder_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "volunteer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO reminder VALUES('886fd1cb-8e56-46f1-8e5f-daedf01be2c8','326db587-0372-44aa-b3e5-13d6a65979ec',1440,'email','2025-12-23T19:05:59.242+00:00','2025-12-23T19:05:59.242+00:00');
INSERT INTO reminder VALUES('92012a4b-3a0d-482d-a764-d7a53c72765e','326db587-0372-44aa-b3e5-13d6a65979ec',120,'email','2025-12-23T19:05:59.242+00:00','2025-12-23T19:05:59.242+00:00');
INSERT INTO reminder VALUES('e1057380-8698-4723-b25c-99af8b6e758f','326db587-0372-44aa-b3e5-13d6a65979ec',60,'email','2025-12-23T19:05:59.242+00:00','2025-12-23T19:05:59.242+00:00');
INSERT INTO reminder VALUES('9209a9bb-ef0f-46b5-8a27-1a1d1212ceba','c79e086e-7536-4f8f-b6bb-47dd3aa734f1',1440,'email','2025-12-23T19:10:59.476+00:00','2025-12-23T19:10:59.476+00:00');
INSERT INTO reminder VALUES('cc47c9bc-2dbe-4349-820a-053f5a7e47f7','c79e086e-7536-4f8f-b6bb-47dd3aa734f1',180,'email','2025-12-23T19:10:59.476+00:00','2025-12-23T19:10:59.476+00:00');
CREATE INDEX "session_userId_idx" ON "session"("userId");
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");
CREATE UNIQUE INDEX "client_userId_key" ON "client"("userId");
CREATE UNIQUE INDEX "address_street_city_state_zip_key" ON "address"("street", "city", "state", "zip");
CREATE UNIQUE INDEX "sent_reminder_rideId_type_key" ON "sent_reminder"("rideId", "type");
CREATE UNIQUE INDEX "user_phone_key" ON "user"("phone");
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
CREATE UNIQUE INDEX "volunteer_userId_key" ON "volunteer"("userId");


CREATE TABLE IF NOT EXISTS "notification_template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "notification_template_name_key" ON "notification_template"("name");

INSERT INTO "notification_template" VALUES('t1_ride_created', 'RIDE_CREATED', 'New Ride Available: {{pickup}} to {{dropoff}}', '<p>Hi {{name}},</p><p>A new ride is available on {{date}} at {{time}}.</p><p><strong>Pickup:</strong> {{pickup}}</p><p><strong>Dropoff:</strong> {{dropoff}}</p>', 1, '2026-02-08T00:00:00.000+00:00', '2026-02-08T00:00:00.000+00:00');
INSERT INTO "notification_template" VALUES('t2_ride_assigned', 'RIDE_ASSIGNED', 'You have been assigned to a ride', '<p>Hi {{name}},</p><p>You have successfully signed up for a ride on {{date}} at {{time}}.</p><p><strong>Client:</strong> {{client}}</p><p><strong>Pickup:</strong> {{pickup}}</p><p><strong>Dropoff:</strong> {{dropoff}}</p>', 1, '2026-02-08T00:00:00.000+00:00', '2026-02-08T00:00:00.000+00:00');
INSERT INTO "notification_template" VALUES('t3_ride_reminder', 'RIDE_REMINDER', 'Reminder: Upcoming Ride with {{client}}', '<p>Hi {{name}},</p><p>This is a reminder for your ride tomorrow at {{time}}.</p><p><strong>Client:</strong> {{client}}</p><p><strong>Pickup:</strong> {{pickup}}</p><p><strong>Dropoff:</strong> {{dropoff}}</p>', 1, '2026-02-08T00:00:00.000+00:00', '2026-02-08T00:00:00.000+00:00');
INSERT INTO "notification_template" VALUES('t4_ride_cancelled', 'RIDE_CANCELLED', 'Ride Cancelled', '<p>Hi {{name}},</p><p>The ride scheduled for {{date}} has been cancelled.</p>', 1, '2026-02-08T00:00:00.000+00:00', '2026-02-08T00:00:00.000+00:00');
INSERT INTO "notification_template" VALUES('t5_ride_completed', 'RIDE_COMPLETED', 'Thank you for completing the ride', '<p>Hi {{name}},</p><p>Thank you for volunteering! The ride with {{client}} has been marked as completed.</p>', 1, '2026-02-08T00:00:00.000+00:00', '2026-02-08T00:00:00.000+00:00');

COMMIT;