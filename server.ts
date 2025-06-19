import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { generate, generate_title } from "@/lib/generate";
import generateUUID from "@/lib/randomUUID";
import { PrismaClient } from "@prisma/client";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = dev ? 3000 : 3002;
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
    file?: string;
};

const convertMessageToContent = (message: Message, provider: string): any => {
    const contentParts: any[] = [
        {
            type: "text",
            text: message.message,
        },
    ];

    if (message.file) {
        // Extract MIME type from the base64 URL
        const mimeMatch = message.file.match(/^data:(.*?);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : "";

        if (provider === "openai") {
            if (mimeType === "application/pdf") {
                contentParts.push({
                    type: "file",
                    file: {
                        filename: "file.pdf",
                        file_data: message.file,
                    },
                });
            } else if (mimeType.startsWith("image/")) {
                contentParts.push({
                    type: "file", // As requested, wrapped in 'file' type for images too
                    image_url: {
                        url: message.file,
                    },
                });
            }
            // For OpenAI, if file is present but not PDF or image, it will not be added to contentParts.
        } else if (provider === "google") {
            // For Google, the same structure is applied for both PDF and image
            contentParts.push({
                type: "file",
                image_url: {
                    url: message.file,
                },
            });
        }
        // If the provider is neither "openai" nor "google",
        // or if it's OpenAI but the file type is not recognized as PDF/image,
        // the file will not be included in the content parts, strictly following the new rules.
    }

    return {
        role: message.user as "user" | "assistant",
        content: contentParts,
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
                    nickname,
                    CustomApiKey
                ) => {
                    let messageSent = false;
                    let message = "";
                    const resultId = generateUUID();

                    // saves the intial message to the database before sending
                    if (user !== null) {
                        const oldMessagesNotInDb = {
                            id: data[data.length - 1].id,
                            content: data[data.length - 1].message,
                            author: data[data.length - 1].user,
                            file: data[data.length - 1].file,
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
                        const response = await generate(
                            data.map((message) =>
                                convertMessageToContent(message, provider)
                            ),
                            provider,
                            model,
                            thinkingEffort,
                            systemInstruction,
                            nickname,
                            CustomApiKey
                        );

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
                        console.log(error);
                        io.to(room).emit(
                            "error",
                            "Error generating the content, refresh the page"
                        );
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
