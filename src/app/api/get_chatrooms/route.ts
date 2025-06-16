import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export async function GET(request: NextRequest) {
    const prisma = new PrismaClient();
    const userId = request.nextUrl.searchParams.get("userId") as string;

    const chatrooms = (
        await prisma.user.findUnique({
            where: {
                id: userId,
            },
            include: {
                chatrooms: true,
            },
        })
    )?.chatrooms;

    prisma.$disconnect();

    return NextResponse.json({ chatrooms }, { status: 200 });
}
