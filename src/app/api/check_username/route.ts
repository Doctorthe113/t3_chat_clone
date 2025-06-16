// app/api/check-username/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
    const username = request.nextUrl.searchParams.get("username");

    if (typeof username !== "string" || !username) {
        return NextResponse.json({ message: "Username is required." }, {
            status: 400,
        });
    }

    try {
        const user = await prisma.user.findUnique({ // findFirst for non-unique 'name'
            where: { name: username },
        });
        console.log(user);

        return NextResponse.json({ exists: !!user }, { status: 200 });
    } catch (error) {
        console.error("Database error checking username:", error);
        return NextResponse.json({ message: "Internal server error." }, {
            status: 500,
        });
    } finally {
        await prisma.$disconnect();
    }
}
