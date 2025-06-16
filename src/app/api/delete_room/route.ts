import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export async function GET(request: NextRequest) {
    const prisma = new PrismaClient();
    const messageId = request.nextUrl.searchParams.get("roomId") as string;

    try {
        await prisma.chatrooms.delete({
            where: {
                id: messageId,
            },
        });

        await prisma.messages.deleteMany({
            where: {
                chatroomId: messageId,
            },
        });
        return NextResponse.json({ status: 200 });
    } catch (e) {
        return NextResponse.json({ error: e, status: 500 });
    } finally {
        prisma.$disconnect();
    }
}
