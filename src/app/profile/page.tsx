import { auth } from "@/lib/auth";
import ProfileInterface from "./profileInterface";
import { headers } from "next/headers";
import { PrismaClient } from "@prisma/client";

export default async function Profile() {
    const session = await auth.api.getSession({ headers: await headers() });
    const prisma = new PrismaClient();

    const chatrooms = (
        await prisma.user.findUnique({
            where: {
                id: session?.user?.id,
            },
            include: {
                chatrooms: true,
            },
        })
    )?.chatrooms;

    await prisma.$disconnect();

    return (
        <div className="min-h-svh h-fit w-svw flex justify-center">
            <ProfileInterface
                user={session?.user}
                oldChatrooms={chatrooms as any}
            />
        </div>
    );
}
