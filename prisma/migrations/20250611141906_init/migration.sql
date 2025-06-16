-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "chatroomId" TEXT NOT NULL
);
INSERT INTO "new_Messages" ("author", "chatroomId", "content", "id") SELECT "author", "chatroomId", "content", "id" FROM "Messages";
DROP TABLE "Messages";
ALTER TABLE "new_Messages" RENAME TO "Messages";
CREATE UNIQUE INDEX "Messages_id_key" ON "Messages"("id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
