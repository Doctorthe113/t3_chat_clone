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
    Sparkles,
    Trash,
    Trash2,
} from "lucide-react";
//@ts-ignore
import { dracula as dark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { CustomTooltip } from "@/components/ui/customTooltip";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    const [apiKey, setApiKey] = useState("");
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

        if (textarea.value.trim() === "") {
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
    const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];

        if (!file) {
            return;
        }

        const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

        if (file.size > MAX_FILE_SIZE_BYTES) {
            handleError("File size exceeds 10MB limit.");
            e.target.value = ""; // Clear the input
            return;
        }

        if (
            !file.type.startsWith("image/") &&
            file.type !== "application/pdf"
        ) {
            handleError("Unsupported file type.");
            e.target.value = ""; // Clear the input
            return;
        }

        try {
            const base64 = await encodeFileToBase64(file);
            if (base64) {
                setInputFile(base64.base64);
            }
        } catch (error) {
            console.error("Error encoding file to base64:", error);
            handleError("Failed to process file.");
            e.target.value = ""; // Clear the input
        }
    };

    // error handler
    const handleError = (error: any) => {
        setIsGenerating(false);
        toast(error, { className: "!text-sidebar !bg-destructive" });
    };

    // capitalize first letter
    const capitalizeFirstLetter = (string: string) => {
        if (!string) {
            return "";
        }
        return string.charAt(0).toUpperCase() + string.slice(1);
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
        socket.on("error", handleError);
        socket.emit("join", roomId);

        setCustomConfigs({
            systemInstruction: localStorage.getItem("systemPrompt") || "",
            nickname: localStorage.getItem("nickname") || "",
        });

        setModel(JSON.parse(localStorage.getItem("model") as string) || model);
        setApiKey(localStorage.getItem("apiKey") || "");
        setIsLoaded(true);

        document.getElementById("chat-text-area")?.focus();

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("message", recieve_message);
            socket.off("generate", () => setIsGenerating(true));
            socket.off("edit", recieved_edit_message);
            socket.off("error", handleError);
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
                    <div
                        className={`flex w-full justify-center h-full items-center transition-all duration-1000 fade-in`}
                    >
                        <Card className="w-fit min-w-lg p-4 bg-transparent border-none shadow-none">
                            <h1 className="text-2xl font-bold text-primary font-serif">
                                How can I help you
                                <span className="font-cursive font-normal text-3xl italic">
                                    {user?.id
                                        ? `, ${capitalizeFirstLetter(
                                              user?.name
                                          )}?`
                                        : ""}
                                </span>
                                {user?.id ? "" : "?"}
                            </h1>
                            <Tabs defaultValue="Casual">
                                <TabsList className="!bg-transparent w-full">
                                    <TabsTrigger value="Casual">
                                        Casual
                                    </TabsTrigger>
                                    <TabsTrigger value="Creative">
                                        Creative
                                    </TabsTrigger>
                                    <TabsTrigger value="Code">Code</TabsTrigger>
                                    <TabsTrigger value="Scientific">
                                        Scientific
                                    </TabsTrigger>
                                </TabsList>
                                <TabsContent value="Casual">
                                    <div className="flex gap-2 items-center text-muted-foreground mb-2.5">
                                        <Button
                                            onMouseDown={update_textarea}
                                            variant="link"
                                            className="p-0 m-0 text-left flex justify-start grow text-muted-foreground"
                                        >
                                            Rank countries by GDP in the year
                                            2022
                                        </Button>
                                    </div>
                                    <div className="flex gap-2 items-center text-muted-foreground mb-2.5">
                                        <Button
                                            onMouseDown={update_textarea}
                                            variant="link"
                                            className="p-0 m-0 text-left flex justify-start grow text-muted-foreground"
                                        >
                                            Plan a weekend trip to the beach
                                        </Button>
                                    </div>
                                    <div className="flex gap-2 items-center text-muted-foreground mb-2.5">
                                        <Button
                                            onMouseDown={update_textarea}
                                            variant="link"
                                            className="p-0 m-0 text-left flex justify-start grow text-muted-foreground"
                                        >
                                            What's the weather like today?
                                        </Button>
                                    </div>
                                    <div className="flex gap-2 items-center text-muted-foreground mb-2.5">
                                        <Button
                                            onMouseDown={update_textarea}
                                            variant="link"
                                            className="p-0 m-0 text-left flex justify-start grow text-muted-foreground"
                                        >
                                            Suggest a good movie to watch
                                        </Button>
                                    </div>
                                </TabsContent>
                                <TabsContent value="Creative">
                                    <div className="flex gap-2 items-center text-muted-foreground mb-2.5">
                                        <Button
                                            onMouseDown={update_textarea}
                                            variant="link"
                                            className="p-0 m-0 text-left flex justify-start grow text-muted-foreground"
                                        >
                                            Write me a poem about love
                                        </Button>
                                    </div>
                                    <div className="flex gap-2 items-center text-muted-foreground mb-2.5">
                                        <Button
                                            onMouseDown={update_textarea}
                                            variant="link"
                                            className="p-0 m-0 text-left flex justify-start grow text-muted-foreground"
                                        >
                                            Write me a story about a brave
                                            warrior
                                        </Button>
                                    </div>
                                    <div className="flex gap-2 items-center text-muted-foreground mb-2.5">
                                        <Button
                                            onMouseDown={update_textarea}
                                            variant="link"
                                            className="p-0 m-0 text-left flex justify-start grow text-muted-foreground"
                                        >
                                            Compose a song about autumn leaves
                                        </Button>
                                    </div>
                                    <div className="flex gap-2 items-center text-muted-foreground mb-2.5">
                                        <Button
                                            onMouseDown={update_textarea}
                                            variant="link"
                                            className="p-0 m-0 text-left flex justify-start grow text-muted-foreground"
                                        >
                                            Generate a fictional creature
                                            description
                                        </Button>
                                    </div>
                                </TabsContent>
                                <TabsContent value="Code">
                                    <div className="flex gap-2 items-center text-muted-foreground mb-2.5">
                                        <Button
                                            onMouseDown={update_textarea}
                                            variant="link"
                                            className="p-0 m-0 text-left flex justify-start grow text-muted-foreground"
                                        >
                                            Write a Python function for
                                            quicksort
                                        </Button>
                                    </div>
                                    <div className="flex gap-2 items-center text-muted-foreground mb-2.5">
                                        <Button
                                            onMouseDown={update_textarea}
                                            variant="link"
                                            className="p-0 m-0 text-left flex justify-start grow text-muted-foreground"
                                        >
                                            Explain CSS Flexbox layout
                                        </Button>
                                    </div>
                                    <div className="flex gap-2 items-center text-muted-foreground mb-2.5">
                                        <Button
                                            onMouseDown={update_textarea}
                                            variant="link"
                                            className="p-0 m-0 text-left flex justify-start grow text-muted-foreground"
                                        >
                                            How to connect to a MySQL database
                                            in Node.js
                                        </Button>
                                    </div>
                                    <div className="flex gap-2 items-center text-muted-foreground mb-2.5">
                                        <Button
                                            onMouseDown={update_textarea}
                                            variant="link"
                                            className="p-0 m-0 text-left flex justify-start grow text-muted-foreground"
                                        >
                                            Debug a common JavaScript error
                                        </Button>
                                    </div>
                                </TabsContent>
                                <TabsContent value="Scientific">
                                    <div className="flex gap-2 items-center text-muted-foreground mb-2.5">
                                        <Button
                                            onMouseDown={update_textarea}
                                            variant="link"
                                            className="p-0 m-0 text-left flex justify-start grow text-muted-foreground"
                                        >
                                            Tell about impacts of shipment and
                                            aviation on global warming
                                        </Button>
                                    </div>
                                    <div className="flex gap-2 items-center text-muted-foreground mb-2.5">
                                        <Button
                                            onMouseDown={update_textarea}
                                            variant="link"
                                            className="p-0 m-0 text-left flex justify-start grow text-muted-foreground"
                                        >
                                            Explain low level network
                                            architecture in *unix systems
                                        </Button>
                                    </div>
                                    <div className="flex gap-2 items-center text-muted-foreground mb-2.5">
                                        <Button
                                            onMouseDown={update_textarea}
                                            variant="link"
                                            className="p-0 m-0 text-left flex justify-start grow text-muted-foreground"
                                        >
                                            Describe the process of
                                            photosynthesis
                                        </Button>
                                    </div>
                                    <div className="flex gap-2 items-center text-muted-foreground mb-2.5">
                                        <Button
                                            onMouseDown={update_textarea}
                                            variant="link"
                                            className="p-0 m-0 text-left flex justify-start grow text-muted-foreground"
                                        >
                                            What are black holes and how do they
                                            form?
                                        </Button>
                                    </div>
                                </TabsContent>
                            </Tabs>
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
                                        width={200}
                                        onError={(e: any) => {
                                            e.target.onerror = null;
                                            e.target.src =
                                                "https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Ftse3.mm.bing.net%2Fth%3Fid%3DOIP.6sQOJxBJ3JVcQBYBKwzwOQHaHa%26r%3D0%26pid%3DApi&f=1&ipt=de3920beabeda48fd4b85de1718eb8a1d9de57295707f3a589c18f27743ee27d&ipo=images";
                                        }}
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
                    <div className="max-h-24 h-fit w-18 bg-background mr-auto relative group/item">
                        <img
                            src={inputFile}
                            alt=""
                            width={200}
                            onError={(e: any) => {
                                e.target.onerror = null;
                                e.target.src =
                                    "https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Ftse3.mm.bing.net%2Fth%3Fid%3DOIP.6sQOJxBJ3JVcQBYBKwzwOQHaHa%26r%3D0%26pid%3DApi&f=1&ipt=de3920beabeda48fd4b85de1718eb8a1d9de57295707f3a589c18f27743ee27d&ipo=images";
                            }}
                            className="w-full"
                        />
                        <Button
                            className="absolute top-0 right-0 h-full w-full hidden group-hover/item:flex justify-center items-center"
                            variant={"destructive"}
                            size="icon"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                setInputFile("");
                            }}
                        >
                            <Trash2 />
                        </Button>
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
                        accept="image/*,application/pdf"
                        className="hidden"
                        disabled={!isConnected || isGenerating || !!inputFile}
                        onChange={handleFileInput}
                    />
                    <CustomTooltip text="Upload a pdf or image upto 10MB">
                        <Label
                            htmlFor="file-input"
                            className="border bg-input/30 flex items-center cursor-pointer rounded-lg mr-auto h-8 px-4 py-2 has-[>svg]:px-3 text-sm gap-2"
                        >
                            Upload
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
