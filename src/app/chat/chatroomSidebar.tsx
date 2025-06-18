"use client";

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { socket } from "@/lib/socket";
import { PlusCircle, Trash, User } from "lucide-react";
import { usePathname } from "next/navigation";
import { warn } from "console";
import { CustomTooltip } from "@/components/ui/customTooltip";

type Chatrooms = {
    id: string;
    name: string;
    description: string;
};

export default function ChatroomSidebar({
    user,
    isNew,
    oldChatrooms,
}: {
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
    isNew: boolean;
    oldChatrooms: Chatrooms[];
}) {
    const [chatrooms, setChatrooms] = useState<Chatrooms[]>(oldChatrooms);
    const [currentChatroomId, setCurrentChatroomId] = useState(
        usePathname().split("/").pop() as string
    );
    const userId = user?.id;

    const delete_room = async (e: any, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            const res = await fetch(`/api/delete_room?roomId=${id}`);
            if (res.status !== 200) {
                throw new Error("Failed to delete room");
            }
            if (res.status === 200) {
                console.log("Room deleted successfully");
                window.location.href = "/chat";
            }
        } catch (e) {}
    };

    useEffect(() => {
        if (!userId) {
            return;
        }

        const getChatrooms = async () => {
            const res = await fetch(`/api/get_chatrooms?userId=${userId}`);
            const chatroomsRes = await res.json();
            setChatrooms(chatroomsRes.chatrooms);
        };

        if (isNew) {
            console.warn("New chatroom");

            if (socket.connected) {
                onConnect();
            }

            function onConnect() {
                socket.io.engine.on("upgrade", () => {});
            }

            socket.emit("join", `sidebar-${userId}`);

            socket.on("title", (roomId) => {
                setCurrentChatroomId(roomId);
                getChatrooms();
                socket.off("title");
            });
        }

        return () => {
            socket.off("title");
        };
    }, []);

    return (
        <Sidebar variant="inset" collapsible="offcanvas" className="pb-0">
            <SidebarHeader className="p-0 rounded-lg h-10 flex justify-center items-center">
                <SidebarMenuItem className="list-none p-0">
                    <Link
                        className="font-custom text-2xl text-primary hover:underline"
                        href="/"
                    >
                        Nocturne Chat
                    </Link>
                </SidebarMenuItem>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup className="m-0 pb-0">
                    <SidebarMenu className="border-1 rounded-lg">
                        <Button
                            variant={"default"}
                            className="hover:cursor-pointer"
                            onMouseDown={() => {
                                false;
                                window.location.href = "/chat";
                            }}
                        >
                            New Chat <PlusCircle className="h-full" />
                        </Button>
                    </SidebarMenu>
                </SidebarGroup>
                <SidebarGroup>
                    <SidebarGroupLabel>Old messages</SidebarGroupLabel>
                    <SidebarMenu className="overflow-x-clip">
                        {chatrooms?.map((chatroom) => (
                            <SidebarMenuButton
                                key={chatroom.id}
                                className={`${
                                    currentChatroomId === chatroom.id
                                        ? "bg-input/30"
                                        : ""
                                }  hover:bg-input/50 hover:text-foreground relative px-2 m-0 group/item active:bg-transparent transition-transform duration 100 py-0`}
                            >
                                <Link
                                    href={`/chat/${chatroom.id}`}
                                    prefetch={true}
                                    className="whitespace-nowrap overflow-hidden h-full w-full overflow-ellipsis hover:no-underline flex items-center"
                                >
                                    <span className="whitespace-nowrap overflow-hidden overflow-ellipsis">
                                        {chatroom.name}
                                    </span>
                                </Link>
                                <CustomTooltip text="Delete room?">
                                    <Button
                                        className="absolute -right-6 group-hover/item:right-1 group-hover/item:opacity-100 opacity-0 size-6 bg-sidebar transition-[right,opacity] duration-250"
                                        variant="destructive"
                                        onClick={(e) =>
                                            delete_room(e, chatroom.id)
                                        }
                                    >
                                        <Trash />
                                    </Button>
                                </CustomTooltip>
                            </SidebarMenuButton>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter className="py-4 border-b-0 rounded-b-none flex justify-center items-center m-0 min-h-24">
                {user ? (
                    <CustomTooltip text="Profile/settings">
                        <Link
                            href={`/profile`}
                            prefetch={true}
                            className="p-2 m-0 h-full w-full flex items-center hover:no-underline hover:bg-input/50 rounded-lg"
                        >
                            <div className="flex items-start w-full h-fit gap-2 rounded-lg">
                                {user?.image ? (
                                    <img
                                        src={user?.image as string}
                                        alt=""
                                        width={64}
                                        height={64}
                                        className="size-10 rounded-lg overflow-clip"
                                    />
                                ) : (
                                    <User className="size-10 rounded-lg border-1 overflow-clip" />
                                )}
                                <div className="flex h-full flex-col items-center">
                                    <span className="w-full text-primary">
                                        {user?.name}
                                    </span>
                                    <span className="text-xs w-full overflow-ellipsis text-wrap">
                                        {user?.email}
                                    </span>
                                </div>
                            </div>
                        </Link>
                    </CustomTooltip>
                ) : (
                    <Link
                        href={`/login`}
                        className="p-0 m-0 h-fit w-full flex flex-col items-center hover:bg-input/50 hover:no-underline rounded-lg"
                    >
                        <span className="hover:underline text-primary">
                            Login or Signup
                        </span>
                        <span className="text-xs text-muted-foreground text-center !hover:no-underline !no-underline">
                            to save your messages and access more features
                        </span>
                    </Link>
                )}
            </SidebarFooter>
        </Sidebar>
    );
}
