import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { generate, generate_title } from "@/lib/generate";
import generateUUID from "@/lib/randomUUID";
import { PrismaClient } from "@prisma/client";
import { OpenAI } from "openai/client";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
const app = next({
    dev: dev,
    hostname: hostname,
    port: port,
    turbopack: false,
});
const handler = app.getRequestHandler();

type Message = {
    id: string;
    user: string;
    message: string;
};

const convertMessageToContent = (
    message: Message
): OpenAI.Chat.Completions.ChatCompletionMessageParam => {
    return {
        content: message.message,
        role: message.user as any,
    };
};

app.prepare()
    .then(() => {
        console.log("app.prepare() resolved successfully.");
        const httpServer = createServer(handler);
        const io = new Server(httpServer);
        const prisma = new PrismaClient();

        io.on("connection", (socket) => {
            // allows user to see a specific room, rooms are public
            socket.on("join", (room) => {
                socket.join(room);
            });

            // disconnect from the room
            socket.on("disconnect", () => {});

            // listen to incoming messages from the client
            socket.on(
                "message",
                async (
                    data: Message[],
                    room,
                    user,
                    provider,
                    model,
                    thinkingEffort,
                    systemInstruction,
                    CustomApiKey
                ) => {
                    let messageSent = false;
                    let message = "";
                    const resultId = generateUUID();
                    const response = await generate(
                        data.map(convertMessageToContent),
                        provider,
                        model,
                        thinkingEffort,
                        systemInstruction,
                        CustomApiKey
                    );

                    // saves the intial message to the database before sending
                    if (user !== null) {
                        const oldMessagesNotInDb = {
                            id: data[data.length - 1].id,
                            content: data[data.length - 1].message,
                            author: data[data.length - 1].user,
                            chatroomId: room,
                        };

                        const generatedMessageTemplate = {
                            id: resultId,
                            content: message,
                            author: "assistant",
                            chatroomId: room,
                        };
                        try {
                            await prisma.messages.createMany({
                                data: [
                                    oldMessagesNotInDb,
                                    generatedMessageTemplate,
                                ],
                            });
                        } catch (error) {
                            console.error("Error inserting messages:", error);
                        }
                    }

                    // sends the ai content and edits the message as it generates
                    try {
                        //@ts-ignore
                        for await (const chunk of response) {
                            message += chunk.choices[0].delta?.content || "";

                            if (!messageSent) {
                                io.to(room).emit("message", [
                                    ...data,
                                    {
                                        id: resultId,
                                        user: "assistant",
                                        message: message,
                                    },
                                ]);
                                messageSent = true;
                            } else {
                                io.to(room).emit("edit", {
                                    id: resultId,
                                    user: "assistant",
                                    message: message,
                                });
                            }
                        }
                    } catch (error) {
                        console.error("Error sending message:", error);
                    }

                    // for updating data to the database
                    if (user === null) {
                        return;
                    }

                    try {
                        // updates the message content
                        await prisma.messages.upsert({
                            where: { id: resultId },
                            update: {
                                content: message,
                            },
                            create: {
                                id: resultId,
                                content: message,
                                author: "assistant",
                                chatroomId: room,
                            },
                        });

                        // adds the user to the room
                        await prisma.chatrooms.upsert({
                            where: { id: room },
                            update: {},
                            create: {
                                id: room,
                                userId: user,
                            },
                        });
                    } catch (error) {
                        console.error("Error inserting messages:", error);
                    }

                    // generates the title for the room
                    if (data.length == 1) {
                        const chatTitle = await generate_title(
                            data[data.length - 1].message
                        );

                        try {
                            await prisma.chatrooms.update({
                                where: { id: room },
                                data: { name: chatTitle },
                            });
                        } catch {}

                        io.to(`sidebar-${user}`).emit("title", room);
                    }
                }
            );
        });

        httpServer
            .once("error", (err) => {
                console.error("HTTP Server Error:", err); // Added prefix
                process.exit(1);
            })
            .listen(port, () => {
                console.log(`> Ready on http://${hostname}:${port}`);
            });
    })
    .catch((err) => {
        console.error("Error during app.prepare():", err); // Catch specific errors from app.prepare
        process.exit(1);
    });
