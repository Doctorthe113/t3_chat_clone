-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Chatrooms" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'Untitled',
    "userId" TEXT NOT NULL,
    CONSTRAINT "Chatrooms_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Chatrooms" ("id", "userId") SELECT "id", "userId" FROM "Chatrooms";
DROP TABLE "Chatrooms";
ALTER TABLE "new_Chatrooms" RENAME TO "Chatrooms";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
