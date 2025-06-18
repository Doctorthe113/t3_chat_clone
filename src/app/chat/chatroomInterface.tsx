"use client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import generateUUID from "@/lib/randomUUID";
import { socket } from "@/lib/socket";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
//@ts-ignore
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { ModelSelectorDialog } from "@/components/modelSelectorDialog";
import { Card } from "@/components/ui/card";
import { Label } from "@radix-ui/react-label";
import { Quantum } from "ldrs/react";
import "ldrs/react/Quantum.css";
import {
    CornerDownLeft,
    Lightbulb,
    MoveRight,
    Sparkles,
    Trash,
} from "lucide-react";
//@ts-ignore
import { dracula as dark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { CustomTooltip } from "@/components/ui/customTooltip";

type Message = {
    id: string;
    user: string;
    message: string;
    file?: string;
};

export default function ChatroomInterface({
    roomId,
    user,
    oldMessages = [],
}: {
    roomId: string | undefined;
    user:
        | {
              id: string;
              name: string;
              emailVerified: boolean;
              email: string;
              createdAt: Date;
              updatedAt: Date;
              image?: string | null | undefined | undefined;
          }
        | undefined;
    oldMessages: Message[];
}) {
    const [currentRoomId, setCurrentRoomId] = useState(roomId);
    const [lastScrolledMessageId, setLastScrolledMessageId] = useState("");
    const [messages, setMessages] = useState<Message[]>(oldMessages);
    const [isConnected, setIsConnected] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [inputFile, setInputFile] = useState("");
    const [apiKey, setApiKey] = useState(localStorage.getItem("apiKey"));
    const [model, setModel] = useState({
        name: "gemini-2.5-flash-preview-05-20",
        provider: "gemini",
        thinkingBudget: "none",
    });
    const [customConfigs, setCustomConfigs] = useState({
        systemInstruction: "",
        nickname: "",
    });
    const messageContainerRef = useRef<HTMLDivElement>(null);

    // sends the message
    const send_message = (e: any) => {
        e.preventDefault();

        if (!isConnected || isGenerating) {
            return;
        }

        const textarea = document.getElementById(
            "chat-text-area"
        ) as HTMLTextAreaElement;

        if (textarea.value === "") {
            return;
        }

        // generates room id if undefined and genetates message id
        const roomId = currentRoomId || generateUUID();
        const uuid = generateUUID();

        // sets the roomId and "soft" navigates to the room
        if (currentRoomId === undefined) {
            setCurrentRoomId(roomId);
            window.history.replaceState(
                {
                    ...window.history.state,
                    as: `/chat/${roomId}`,
                    url: `/chat/${roomId}`,
                },
                "",
                `/chat/${roomId}`
            );
            socket.emit("join", roomId);
        }

        // creates the message
        const message = {
            id: uuid,
            user: "user",
            message: textarea.value,
            file: inputFile || undefined,
        };

        // adds the message to the state
        setIsGenerating(true);
        setMessages([...messages, message]);
        setInputFile("");

        // sends the message via websocket
        socket.emit(
            "message",
            [...messages, message],
            roomId,
            user?.id,
            model.provider,
            model.name,
            model.thinkingBudget,
            customConfigs.systemInstruction,
            customConfigs.nickname,
            apiKey
        );

        // resets the textarea
        textarea.value = "";
        textarea.style.height = "3rem";
    };

    // recieves the first message via websocket
    const recieve_message = (data: Message[]) => {
        setIsGenerating(false);
        setMessages(data);
    };

    // updates the messages via edit
    const recieved_edit_message = (data: Message) => {
        setMessages((messages) =>
            messages.map((message) => {
                if (message.id === data.id) {
                    return data;
                }
                return message;
            })
        );
    };

    // remove messages
    const remove_message = async (id: string) => {
        try {
            const res = await fetch(`/api/delete_message?messageId=${id}`);
            if (res.status !== 200) {
                throw new Error("Failed to delete message");
            }
            if (res.status === 200) {
                console.log("Message deleted successfully");
                setMessages((messages) =>
                    messages.filter((message) => message.id !== id)
                );
            }
        } catch (e) {}
    };

    // update textarea/templates
    const update_textarea = (e: any) => {
        const textarea = document.getElementById(
            "chat-text-area"
        ) as HTMLTextAreaElement;

        textarea.value = e.target.innerHTML;
    };

    // turn file into base64 url string
    const encodeFileToBase64 = async (
        file: File
    ): Promise<{ name: string; base64: string } | null> => {
        const maxSizeBytes = 10 * 1024 * 1024; // 10 MB

        if (!file || file.size >= maxSizeBytes) {
            return null;
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
                resolve({
                    name: file.name,
                    base64: reader.result as string, // FileReader.result can be string or ArrayBuffer
                });
            };

            reader.onerror = (error: ProgressEvent<FileReader>) => {
                reject(error);
            };

            reader.readAsDataURL(file);
        });
    };

    // handleFileInput
    const handleFileInput = async (e: any) => {
        const file = e.target.files[0];
        const base64: any = await encodeFileToBase64(file);
        if (base64) {
            setInputFile(base64.base64);
        }
    };

    // saves model information in the local storage
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem("model", JSON.stringify(model));
        }
    }, [model]);

    // Autoscroll effect, idfk how to do it better, if you know, pleaseeee let me know
    useEffect(() => {
        if (!messageContainerRef.current) return;

        let timer: NodeJS.Timeout;
        const containerComputedStyle = getComputedStyle(
            messageContainerRef.current
        );
        const latestMessage = messages[messages.length - 1];
        let lastUserMessageId: string;
        messages.forEach((message) => {
            if (message.user === "user") {
                lastUserMessageId = message.id;
            }
        });

        if (lastScrolledMessageId) {
            (
                document.getElementById(
                    `message-${lastScrolledMessageId}`
                ) as HTMLDivElement
            ).style.minHeight = "auto";
        }

        if (latestMessage) {
            timer = setTimeout(() => {
                if (!messageContainerRef.current) return;

                if (latestMessage.user === "user") {
                    const loadingIndicator = document.getElementById(
                        `loading-indicator`
                    ) as HTMLDivElement;

                    const latestMessageElement = document.getElementById(
                        `message-${latestMessage.id}`
                    ) as HTMLDivElement;

                    loadingIndicator.style.minHeight = `${
                        messageContainerRef.current.offsetHeight -
                        parseFloat(containerComputedStyle.paddingBottom) -
                        parseFloat(containerComputedStyle.paddingTop) -
                        latestMessageElement.offsetHeight
                    }px`;

                    latestMessageElement.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                    });
                } else if (latestMessage.user === "assistant") {
                    const latestMessageElement = document.getElementById(
                        `message-${latestMessage.id}`
                    ) as HTMLDivElement;

                    const lastUserMessageElement = document.getElementById(
                        `message-${lastUserMessageId}`
                    ) as HTMLDivElement;

                    latestMessageElement.style.minHeight = `${
                        messageContainerRef.current.offsetHeight -
                        parseFloat(containerComputedStyle.paddingBottom) -
                        parseFloat(containerComputedStyle.paddingTop) -
                        lastUserMessageElement.offsetHeight
                    }px`;

                    lastUserMessageElement.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                    });

                    setLastScrolledMessageId(latestMessage.id);
                }
            }, 50);
        } else {
        }
        return () => clearTimeout(timer);
    }, [messages.length]);

    // main useEffect
    useEffect(() => {
        if (socket.connected) {
            onConnect();
        }

        function onConnect() {
            setIsConnected(true);

            socket.io.engine.on("upgrade", (transport) => {});
        }

        function onDisconnect() {
            setIsConnected(false);
        }

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("message", recieve_message);
        socket.on("edit", recieved_edit_message);
        socket.emit("join", roomId);

        document.getElementById("chat-text-area")?.focus();

        setCustomConfigs({
            systemInstruction: localStorage.getItem("systemPrompt") || "",
            nickname: localStorage.getItem("nickname") || "",
        });

        setModel(JSON.parse(localStorage.getItem("model") as string) || model);

        setIsLoaded(true);

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("message", recieve_message);
            socket.off("generate", () => setIsGenerating(true));
            socket.off("edit", recieved_edit_message);
        };
    }, []);

    return (
        <div className="flex flex-col grow min-h-0 w-full items-center px-1 overflow-clip relative">
            <div
                className="grow flex flex-col max-w-3xl w-full gap-0 justify-start overflow-y-scroll min-h-0 scroll-smooth text-sm transition-all duration-100 px-1 mb-28"
                id="recieved-messages"
                ref={messageContainerRef}
            >
                {messages.length === 0 && (
                    <div className="flex w-full justify-center h-full items-center">
                        <Card className="w-fit p-4 bg-sidebar/50 border-none">
                            <h1 className="text-xl font-bold text-primary">
                                How can I help you
                                {user?.id ? `, ${user?.name}` : ""}?
                            </h1>
                            <div className="flex gap-2 items-center text-muted-foreground">
                                <MoveRight className="size-4" />
                                <Button
                                    onMouseDown={update_textarea}
                                    variant="link"
                                    className="p-0 m-0 text-left flex justify-start border-b-1 grow text-muted-foreground"
                                >
                                    Write me a poem about love
                                </Button>
                            </div>
                            <div className="flex gap-2 items-center text-muted-foreground">
                                <MoveRight className="size-4" />
                                <Button
                                    onMouseDown={update_textarea}
                                    variant="link"
                                    className="p-0 m-0 text-left flex justify-start border-b-1 grow text-muted-foreground"
                                >
                                    Write me a story about a brave warrior
                                </Button>
                            </div>
                            <div className="flex gap-2 items-center text-muted-foreground">
                                <MoveRight className="size-4" />
                                <Button
                                    onMouseDown={update_textarea}
                                    variant="link"
                                    className="p-0 m-0 text-left flex justify-start border-b-1 grow text-muted-foreground"
                                >
                                    Tell about impacts of shipment and aviation
                                    on global warming
                                </Button>
                            </div>
                            <div className="flex gap-2 items-center text-muted-foreground">
                                <MoveRight className="size-4" />
                                <Button
                                    onMouseDown={update_textarea}
                                    variant="link"
                                    className="p-0 m-0 text-left flex justify-start border-b-1 grow text-muted-foreground"
                                >
                                    Explain low level network architecture in
                                    *unix systems
                                </Button>
                            </div>
                        </Card>
                    </div>
                )}
                {messages.map((message, index) => {
                    return (
                        <div
                            id={`message-${message.id}`}
                            key={index}
                            className={`w-full px-2 flex flex-col group ${
                                message.user === "user"
                                    ? "ml-auto text-right items-end"
                                    : ""
                            }`}
                        >
                            {!!message.file && (
                                <div
                                    className={`flex flex-col overflow-clip rounded-lg ${
                                        message.user === "user"
                                            ? "items-end"
                                            : "items-start"
                                    }`}
                                >
                                    <img
                                        src={message.file}
                                        alt={message.message}
                                        className="w-20 max-h-24 object-contain"
                                    />
                                </div>
                            )}
                            <div
                                id="markdown-content"
                                className={`rounded-lg p-2 leading-loose ${
                                    message.user === "user"
                                        ? "bg-input/30 py-2 !w-fit max-w-6/7"
                                        : ""
                                }`}
                            >
                                <Markdown
                                    children={message.message}
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        code(props) {
                                            const {
                                                children,
                                                className,
                                                node,
                                                ...rest
                                            } = props;
                                            const match = /language-(\w+)/.exec(
                                                className || ""
                                            );
                                            return match ? (
                                                <SyntaxHighlighter
                                                    {...rest}
                                                    children={String(
                                                        children
                                                    ).replace(/\n$/, "")}
                                                    language={match[1]}
                                                    style={dark}
                                                />
                                            ) : (
                                                <code
                                                    {...rest}
                                                    className={className}
                                                >
                                                    {children}
                                                </code>
                                            );
                                        },
                                    }}
                                ></Markdown>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 gap-2 flex transition-all duration-300">
                                <Button
                                    className="size-6 text-destructive !hover:bg-destructive"
                                    variant={"destructive"}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        remove_message(message.id);
                                    }}
                                >
                                    <Trash />
                                </Button>
                            </div>
                        </div>
                    );
                })}
                {isGenerating ? (
                    <div
                        className="w-full px-2 flex gap-2 text-sm bg-transparent"
                        id="loading-indicator"
                    >
                        <Quantum
                            size="25"
                            speed="1.75"
                            color="var(--color-accent)"
                        />
                    </div>
                ) : null}
            </div>
            <div className="h-max w-[calc(100%-1rem)] max-w-3xl bg-sidebar/50 backdrop-blur-lg border-primary/50 border-2 border-b-0 rounded-lg rounded-b-none p-2 mt-2 mx-1 flex-col flex items-center justify-between absolute bottom-0">
                {inputFile && (
                    <div className="max-h-24 h-fit w-18 bg-background mr-auto">
                        <img src={inputFile} alt="" className="w-full" />
                    </div>
                )}
                <Textarea
                    id="chat-text-area"
                    className="bg-transparent h-12 border-0 max-h-56 shadow-none mb-2"
                    placeholder="Type a message..."
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault(); // Prevent default Enter (new line)
                            send_message(e); // Manually trigger send_message
                        }
                    }}
                />
                <div className="w-full flex justify-end gap-2">
                    <input
                        id="file-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={!isConnected || isGenerating || !!inputFile}
                        onChange={handleFileInput}
                    />
                    <CustomTooltip text="Upload an image upto 10MB">
                        <Label
                            htmlFor="file-input"
                            className="border bg-input/30 flex items-center cursor-pointer rounded-lg mr-auto h-8 px-4 py-2 has-[>svg]:px-3 text-sm gap-2"
                        >
                            Image Upload
                        </Label>
                    </CustomTooltip>
                    <span className="flex items-center justify-center">
                        {model.thinkingBudget === "none" ||
                        model.thinkingBudget === undefined ? (
                            <Sparkles className="size-4" />
                        ) : (
                            <Lightbulb className="size-4" />
                        )}
                        <ModelSelectorDialog
                            currentModel={model.name}
                            setCurrentModel={setModel}
                        />
                    </span>
                    <Button
                        className="rounded-lg h-8"
                        onMouseDown={send_message}
                        disabled={!isConnected || isGenerating}
                    >
                        Send <CornerDownLeft className="size-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
