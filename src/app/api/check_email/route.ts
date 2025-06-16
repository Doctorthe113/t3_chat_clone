// app/api/check-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
    const email = request.nextUrl.searchParams.get("email");

    if (typeof email !== "string" || !email) {
        return NextResponse.json(
            { message: "Email is required." },
            {
                status: 400,
            }
        );
    }

    try {
        const user = await prisma.user.findUnique({
            // findUnique for unique 'email'
            where: { email: email },
        });
        return NextResponse.json({ exists: !!user }, { status: 200 });
    } catch (error) {
        console.error("Database error checking email:", error);
        return NextResponse.json(
            { message: "Internal server error." },
            {
                status: 500,
            }
        );
    } finally {
        await prisma.$disconnect();
    }
}
