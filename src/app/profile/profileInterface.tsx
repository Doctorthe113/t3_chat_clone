"use client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { literal, z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, Trash, User } from "lucide-react";
import { useForm } from "react-hook-form";
import Cookies from "js-cookie";
import { DarkModeSwitch } from "@/components/ui/darkmodeSwitch";
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { useDropzone } from "react-dropzone";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

type User =
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

type Chatrooms = {
    id: string;
    name: string;
    description: string;
};

export default function ProfileInterface({
    user,
    oldChatrooms,
}: {
    user: User;
    oldChatrooms: Chatrooms[];
}) {
    const [chatrooms, setChatrooms] = useState<Chatrooms[]>(oldChatrooms);
    const [avatarUrl, setAvatarUrl] = useState(user?.image);
    const [username, setUsername] = useState(user?.name);
    const [isFfmpegLoaded, setIsFfmpegLoaded] = useState(false);
    const [isNewAvatar, setIsNewAvatar] = useState(false);
    const [isNewAvatarSaving, setIsNewAvatarSaving] = useState(false);
    const ffmpegRef = useRef<FFmpeg | null>(null);
    const router = useRouter();

    const accountSchema = z
        .object({
            username: z
                .string()
                .min(3, "Username must be at least 2 characters.")
                .max(50, "Username must be at most 16 characters.")
                .optional(),
            currentPassword: z.string().optional().or(z.literal("")),
            newPassword: z
                .string()
                .min(8, "Password must be at least 8 characters long")
                .max(64, "Password must be at most 64 characters long")
                .optional()
                .or(z.literal("")),
        })
        .refine(
            (data) => !(data.currentPassword === "" && data.newPassword !== ""),
            {
                message: "Old password must be provided",
                path: ["currentPassword"],
            }
        )
        .refine(
            (data) =>
                data.currentPassword === "" ||
                data.currentPassword !== data.newPassword,
            {
                message: "Passwords shouldn't match",
                path: ["newPassword"],
            }
        );

    const accountForm = useForm<z.infer<typeof accountSchema>>({
        resolver: zodResolver(accountSchema),
        defaultValues: {
            username: user?.name,
            currentPassword: "",
            newPassword: "",
        },
    });

    const customizationSchema = z.object({
        nickname: z.string().optional(),
        borderRadius: z.number().optional(),
        customCssVariables: z.string().optional(),
    });

    const customizationForm = useForm<z.infer<typeof customizationSchema>>({
        resolver: zodResolver(customizationSchema),
        defaultValues: {
            nickname: "",
            borderRadius: 4,
            customCssVariables: "",
        },
    });

    const templateCssVars = `
    --background: #181825;
    --foreground: #cdd6f4;
    --card: #1e1e2e;
    --card-foreground: #cdd6f4;`
        .trim()
        .replaceAll("    ", "");

    const apiSchema = z.object({
        apiKey: z.string().optional(),
        systemPrompt: z.string().optional(),
    });

    const apiForm = useForm<z.infer<typeof apiSchema>>({
        resolver: zodResolver(apiSchema),
        defaultValues: {
            apiKey: "",
            systemPrompt: "",
        },
    });

    const onAccountUpdate = async (data: z.infer<typeof accountSchema>) => {
        if (data.currentPassword && data.newPassword) {
            try {
                await authClient.changePassword({
                    currentPassword: data.currentPassword,
                    newPassword: data.newPassword,
                });
                accountForm.reset();
            } catch (e) {
                accountForm.setError("newPassword", {
                    message: `Something went wrong ${e}`,
                });
            }
        }

        if (data.username) {
            try {
                await authClient.updateUser({ name: data.username });
                setUsername(data.username);
            } catch (e) {
                accountForm.setError("username", {
                    message: `Something went wrong ${e}`,
                });
            }
        }
    };

    const onAvatarUpdate = async () => {
        try {
            setIsNewAvatarSaving(true);
            await authClient.updateUser({ image: avatarUrl });
            setIsNewAvatarSaving(false);
        } catch (e) {}
    };

    const onCustomizationUpdate = (
        data: z.infer<typeof customizationSchema>
    ) => {
        localStorage.setItem("nickname", data.nickname as string);
        Cookies.set("borderRadius", `${data.borderRadius}` as string, {
            expires: 365,
        });
        Cookies.set("themeCssVars", data.customCssVariables as string, {
            expires: 365,
        });
    };

    const onCustomizationReset = () => {
        localStorage.removeItem("nickname");
        Cookies.remove("borderRadius");
        Cookies.remove("themeCssVars");
    };

    const onApiUpdate = async (data: z.infer<typeof apiSchema>) => {
        localStorage.setItem("apiKey", data.apiKey as string);
        localStorage.setItem("systemPrompt", data.systemPrompt as string);
    };

    const onApiReset = () => {
        localStorage.removeItem("apiKey");
        localStorage.removeItem("systemPrompt");
    };
    const uuidV7ToDate = (uuidv7String: string) => {
        const cleanUuid = uuidv7String.replace(/-/g, "");
        const timestampHex = cleanUuid.substring(0, 12);

        // Convert the hexadecimal timestamp to a BigInt (to handle 48 bits correctly)
        const timestampMs = parseInt(timestampHex, 16);

        const date = new Date(timestampMs);

        // Return only the time part in the local timezone
        return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    };

    const deleteRoom = async (e: any, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            const res = await fetch(`/api/delete_room?roomId=${id}`);
            if (res.status !== 200) {
                throw new Error("Failed to delete room");
            }
            if (res.status === 200) {
                setChatrooms((chatrooms) =>
                    chatrooms.filter((room) => room.id !== id)
                );
            }
        } catch (e) {}
    };

    const onDrop = useCallback(
        async (acceptedFiles: File[]) => {
            const file = acceptedFiles[0];

            if (!file.type.startsWith("image")) {
                return;
            }

            const fileExt = file.type.split("/")[1];

            const ffmpeg = ffmpegRef.current;
            await ffmpeg?.writeFile(`input.${fileExt}`, await fetchFile(file));
            await ffmpeg?.exec([
                "-i",
                `input.${fileExt}`, // Input file in the virtual file system
                "-vf",
                `scale='if(gt(iw,ih),-1,${200})':'if(gt(iw,ih),${200},-1)', crop=${200}:${200}`,
                "-c:v",
                "libwebp",
                "-q:v",
                "75",
                "-y", // Overwrite output file in the virtual file system
                "avatar.webp",
            ]);
            const data = await ffmpeg?.readFile("avatar.webp");

            //@ts-ignore
            const buffer = Buffer.from(data);
            const base64String = buffer.toString("base64");
            const newAvatarDataUrl = `data:image/webp;base64,${base64String}`;

            setAvatarUrl(newAvatarDataUrl);
            setIsNewAvatar(true);
        },
        [ffmpegRef]
    );

    // drag and drop
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
    });

    useEffect(() => {
        async function loadFFmpeg() {
            const ffmpeg = new FFmpeg();
            ffmpegRef.current = ffmpeg;

            await ffmpeg.load();

            console.log("FFmpeg loaded");
            setIsFfmpegLoaded(true);
        }

        if (typeof window !== "undefined" && !ffmpegRef.current) {
            try {
                loadFFmpeg();
            } catch (e) {}
        }
    }, []);

    return (
        <div className="h-full w-full max-w-3xl flex gap-4 justify-center pt-40">
            <Card className="w-64 h-fit flex flex-col items-center gap-3 bg-transparent border-0 shadow-none py-0 px-4">
                <Button
                    variant={"link"}
                    className="mb-10 flex items-center hover:cursor-pointer"
                    onClick={() => router.back()}
                >
                    <ChevronLeft /> Go back
                </Button>
                <div
                    {...getRootProps()}
                    className="flex items-center justify-center"
                >
                    <Input
                        {...getInputProps()}
                        disabled={!isFfmpegLoaded}
                        accept="image/*"
                    />
                    {isDragActive ? (
                        <Label
                            className={`
                                                ${
                                                    !isFfmpegLoaded
                                                        ? "cursor-progress"
                                                        : "cursor-pointer"
                                                }
                                            border-2 border-dashed size-30 rounded-xl flex justify-center items-center text-wrap break-words text-center text-sm animate-pulse`}
                        >
                            {isFfmpegLoaded
                                ? "Drop the files here ..."
                                : "Wait until FFmpeg is loaded"}
                        </Label>
                    ) : (
                        <Label className="border-1 size-30 rounded-xl cursor-pointer overflow-clip">
                            <img
                                className={`${
                                    !isFfmpegLoaded
                                        ? "cursor-progress"
                                        : "cursor-pointer"
                                }  object-cover`}
                                src={avatarUrl as string}
                                alt=""
                            />
                        </Label>
                    )}
                </div>

                <h2 className="text-lg font-bold text-primary">{username}</h2>
                <p className="text-sm text-foreground">{user?.email}</p>
                <p className="text-xs text-muted-foreground">{user?.id}</p>
                {isNewAvatar && (
                    <Button variant={"default"} onClick={onAvatarUpdate}>
                        {isNewAvatarSaving ? "Saving..." : "Update"}
                    </Button>
                )}
            </Card>
            <div>
                <Tabs defaultValue="account">
                    <TabsList>
                        <TabsTrigger value="account">Account</TabsTrigger>
                        <TabsTrigger value="customizations">
                            Customizations
                        </TabsTrigger>
                        <TabsTrigger value="api">API</TabsTrigger>
                        <TabsTrigger value="history">History</TabsTrigger>
                        <TabsTrigger value="contact">Contacts</TabsTrigger>
                    </TabsList>
                    <TabsContent value="account">
                        <Card className="rounded-lg p-6 min-w-lg">
                            <CardHeader className="p-0">
                                <CardTitle>Account</CardTitle>
                                <CardDescription className="text-sm">
                                    Make changes to your account here. You can
                                    change your username and update your
                                    password.
                                </CardDescription>
                            </CardHeader>
                            <Form {...accountForm}>
                                <form
                                    onSubmit={accountForm.handleSubmit(
                                        onAccountUpdate
                                    )}
                                    className="space-y-6 mt-6"
                                >
                                    <FormField
                                        control={accountForm.control}
                                        name="username"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Username</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="johndoe123"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={accountForm.control}
                                        name="currentPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    Old Password
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="password"
                                                        placeholder="********"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={accountForm.control}
                                        name="newPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    New Password
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="password"
                                                        placeholder="********"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormDescription>
                                                    Make sure your password is
                                                    at least 8 characters long.
                                                    Changing password will log
                                                    you out everywhere else.
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="flex gap-2">
                                        <Button
                                            type="submit"
                                            disabled={
                                                accountForm.formState
                                                    .isSubmitting
                                            }
                                            className=""
                                        >
                                            {accountForm.formState.isSubmitting
                                                ? "Updating..."
                                                : "Save"}
                                        </Button>
                                    </div>
                                </form>
                            </Form>
                        </Card>
                    </TabsContent>
                    <TabsContent value="customizations">
                        <Card className="rounded-lg p-6 min-w-lg">
                            <CardHeader className="p-0">
                                <CardTitle>Custom preferences</CardTitle>
                                <CardDescription className="text-sm">
                                    If you have any preferences you want to
                                    change, do it below and click save. These
                                    are locally saved. Refresh the page for the
                                    effects to take place.
                                </CardDescription>
                            </CardHeader>
                            <Form {...customizationForm}>
                                <form
                                    onSubmit={customizationForm.handleSubmit(
                                        onCustomizationUpdate
                                    )}
                                    className="space-y-6 mt-6"
                                >
                                    <FormField
                                        control={customizationForm.control}
                                        name="nickname"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    Nickname, AI would address
                                                    you by
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="Pookie bear"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormDescription>
                                                    You can pass other
                                                    information about you
                                                    followed by your name as
                                                    well. Example:{" "}
                                                    <code className="text-xs">
                                                        John; Age 22; Profession
                                                        Engineer
                                                    </code>
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    {/* <FormField
                                        control={customizationForm.control}
                                        name="borderRadius"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    Base corner/border radius
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="4"
                                                        {...field}
                                                        onChange={(e) => {
                                                            field.onChange(
                                                                Number(
                                                                    e.target
                                                                        .value
                                                                )
                                                            );
                                                        }}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    /> */}
                                    <FormField
                                        control={customizationForm.control}
                                        name="customCssVariables"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    Custom theme
                                                </FormLabel>
                                                <div className="flex w-full justify-between items-center border p-2 rounded-md dark:bg-input/30 bg-transparent">
                                                    <span className="text-sm">
                                                        Dark mode
                                                    </span>
                                                    <DarkModeSwitch />
                                                </div>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder={
                                                            templateCssVars
                                                        }
                                                        className="dark:bg-input/30 h-24 bg-transparent"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormDescription>
                                                    This replaces both dark and
                                                    light mode theme with above
                                                    styles. It uses shadcn
                                                    variables. Check{" "}
                                                    <a
                                                        className="dark:text-accent text-primary underline"
                                                        href="https://tweakcn.com/editor/theme"
                                                    >
                                                        Tweakcn
                                                    </a>{" "}
                                                    for inspirations. Only copy
                                                    the variables from{" "}
                                                    <code>:root</code> class.
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="flex gap-2">
                                        <Button
                                            type="submit"
                                            disabled={
                                                customizationForm.formState
                                                    .isSubmitting
                                            }
                                        >
                                            {customizationForm.formState
                                                .isSubmitting
                                                ? "Saving..."
                                                : "Save"}
                                        </Button>
                                        <Button
                                            type="reset"
                                            variant={"outline"}
                                            onClick={onCustomizationReset}
                                        >
                                            Reset
                                        </Button>
                                    </div>
                                </form>
                            </Form>
                        </Card>
                    </TabsContent>
                    <TabsContent value="api">
                        <Card className="rounded-lg p-6 min-w-lg">
                            <CardHeader className="p-0">
                                <CardTitle>API</CardTitle>
                                <CardDescription className="text-sm">
                                    Add your own Open AI(or any other provider
                                    compatible with Open AI api) api keys here
                                    and custom system prompt here. They are
                                    stored locally via cookies.
                                </CardDescription>
                            </CardHeader>
                            <Form {...apiForm}>
                                <form
                                    onSubmit={apiForm.handleSubmit(onApiUpdate)}
                                    className="space-y-6 mt-6"
                                >
                                    <FormField
                                        control={apiForm.control}
                                        name="apiKey"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>API key</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="sk-************************"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={apiForm.control}
                                        name="systemPrompt"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    System prompt
                                                </FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        id="chat-text-area"
                                                        placeholder={
                                                            "You are a helpful assistant."
                                                        }
                                                        className="dark:bg-input/30 max-h-24 bg-transparent"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="flex gap-2">
                                        <Button
                                            type="submit"
                                            disabled={
                                                apiForm.formState.isSubmitting
                                            }
                                            className=""
                                        >
                                            {apiForm.formState.isSubmitting
                                                ? "Updating..."
                                                : "Save"}
                                        </Button>
                                        <Button
                                            type="reset"
                                            variant={"outline"}
                                            onClick={onApiReset}
                                        >
                                            Reset
                                        </Button>
                                    </div>
                                </form>
                            </Form>
                        </Card>
                    </TabsContent>
                    <TabsContent value="contact">
                        <Card className="rounded-lg p-6 min-w-lg">
                            <CardHeader className="p-0">
                                <CardTitle>Contact me</CardTitle>
                            </CardHeader>
                        </Card>
                    </TabsContent>
                    <TabsContent value="history">
                        <Card className="rounded-lg p-6 min-w-lg">
                            <CardHeader className="p-0">
                                <CardTitle>Your message room history</CardTitle>
                            </CardHeader>
                            <Table>
                                <TableCaption>
                                    A list of your recent message rooms.
                                </TableCaption>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="font-bold w-[100px]">
                                            Time
                                        </TableHead>
                                        <TableHead className="font-bold">
                                            Name
                                        </TableHead>
                                        <TableHead className="text-right font-bold">
                                            Delete?
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="text-xs">
                                    {chatrooms.map((room) => (
                                        <TableRow>
                                            <TableCell>
                                                {uuidV7ToDate(room.id)}
                                            </TableCell>
                                            <TableCell>{room.name}</TableCell>
                                            <TableCell className="text-right flex justify-end">
                                                <Button
                                                    className="size-6"
                                                    variant={"destructive"}
                                                    onClick={(e) => {
                                                        deleteRoom(e, room.id);
                                                    }}
                                                >
                                                    <Trash />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
