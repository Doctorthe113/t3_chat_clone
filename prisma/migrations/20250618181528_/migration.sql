-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "author" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "file" TEXT NOT NULL DEFAULT '',
    "chatroomId" TEXT NOT NULL
);
INSERT INTO "new_Messages" ("author", "chatroomId", "content", "file", "id") SELECT "author", "chatroomId", "content", coalesce("file", '') AS "file", "id" FROM "Messages";
DROP TABLE "Messages";
ALTER TABLE "new_Messages" RENAME TO "Messages";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
