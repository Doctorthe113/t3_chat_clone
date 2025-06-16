import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export async function GET(request: NextRequest) {
    const prisma = new PrismaClient();
    const messageId = request.nextUrl.searchParams.get("messageId") as string;

    await prisma.messages.delete({
        where: {
            id: messageId,
        },
    });

    prisma.$disconnect();

    return NextResponse.json({ status: 200 });
}
