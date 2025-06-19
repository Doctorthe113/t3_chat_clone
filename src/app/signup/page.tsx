"use client";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useDebouncedCallback } from "use-debounce";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { authClient } from "@/lib/auth-client";

// zod schema
const formSchema = z
    .object({
        username: z
            .string()
            .min(2, {
                message: "Username must be at least 2 characters long",
            })
            .max(32, {
                message: "Username must be at most 16 characters long",
            }),
        email: z.string().email(),
        password: z
            .string()
            .min(8, {
                message: "Password must be at least 8 characters long",
            })
            .max(64, {
                message: "Password must be at most 64 characters long",
            }),
        confirmPassword: z
            .string()
            .min(8, {
                message: "Password must be at least 8 characters long",
            })
            .max(64, {
                message: "Password must be at most 64 characters long",
            }),
        avatar: z.string().url().optional(), // base64 data url
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    });

export default function Signin() {
    const [avatarUrl, setAvatarUrl] = useState<string>(
        "https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fstatic.vecteezy.com%2Fsystem%2Fresources%2Fpreviews%2F005%2F544%2F718%2Foriginal%2Fprofile-icon-design-free-vector.jpg&f=1&nofb=1&ipt=95142ee8f497ba42f1cc741ac1cc84ad2524b2e7c00b5ffed8faef1850a9e014"
    );
    const [isFfmpegLoaded, setIsFfmpegLoaded] = useState(false);
    const ffmpegRef = useRef<FFmpeg | null>(null);

    // react hook form
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            username: "",
            email: "",
            password: "",
            confirmPassword: "",
        },
    });

    // watched fields
    const watchedUsername = form.watch("username");
    const watchedEmail = form.watch("email");

    // check for existing username and email
    const checkUsernameAvailability = useCallback(
        async (username: string) => {
            // Only check if username meets minimum length for API call
            if (username.length < 2) {
                form.clearErrors("username");
                return;
            }

            try {
                const response = await fetch(
                    `/api/check_username?username=${username}`
                );
                const data = await response.json();

                if (data.exists) {
                    form.setError(
                        "username",
                        {
                            type: "manual",
                            message: "This username is already taken.",
                        },
                        { shouldFocus: true }
                    );
                } else {
                    form.clearErrors("username");
                }
            } catch (error) {
                console.error("Error checking username:", error);
            }
        },
        [form]
    );

    const debouncedCheckUsername = useDebouncedCallback(() => {
        if (watchedUsername) {
            checkUsernameAvailability(watchedUsername);
            const tempAvatarUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${watchedUsername}&backgroundColor=c0aede,d1d4f9,ffd5dc,ffdfbf&eyebrows=default,defaultNatural,flatNatural,frownNatural,raisedExcited,raisedExcitedNatural,unibrowNatural,upDown,upDownNatural&eyes=closed,default,eyeRoll,happy,hearts,side,squint,surprised,wink,winkWacky,xDizzy,cry`;

            setAvatarUrl(tempAvatarUrl);
        }
    }, 1000);

    const checkEmailAvailability = useCallback(
        async (email: string) => {
            // Only check if email is likely valid (contains @) to avoid premature API calls
            if (!email.includes("@") || email.length < 5) {
                // Basic sanity check before API call
                form.clearErrors("email");
                return;
            }

            try {
                const response = await fetch(`/api/check_email?email=${email}`);
                const data = await response.json();

                if (data.exists) {
                    form.setError(
                        "email",
                        {
                            type: "manual",
                            message: "This email is already registered.",
                        },
                        { shouldFocus: true }
                    );
                } else {
                    form.clearErrors("email");
                }
            } catch (error) {
                console.error("Error checking email:", error);
            }
        },
        [form]
    );

    const debouncedCheckEmail = useDebouncedCallback(() => {
        if (watchedEmail) {
            checkEmailAvailability(watchedEmail);
        }
    }, 1000);

    // on submit handler
    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        await authClient.signUp.email(
            {
                email: data.email,
                password: data.password,
                name: data.username,
                image: avatarUrl,
            },
            {
                onRequest: (ctx) => {
                    //show loading
                },
                onSuccess: (ctx) => {
                    window.location.href = "/chat";
                },
                onError: (ctx) => {
                    alert(ctx.error.message);
                },
            }
        );
    };

    // on drop and avatar process
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
        },
        [form, ffmpegRef]
    );

    // drag and drop
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
    });

    // Effect to trigger debounced username check when username changes
    useEffect(() => {
        debouncedCheckUsername();
    }, [watchedUsername, debouncedCheckUsername]);

    // Effect to trigger debounced email check when email changes
    useEffect(() => {
        debouncedCheckEmail();
    }, [watchedEmail, debouncedCheckEmail]);

    // for loading ffmpeg
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
        <div className="flex h-svh w-svw items-center justify-center">
            <Card className="p-4 rounded-lg">
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-6"
                    >
                        <FormItem>
                            <FormControl>
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
                                                src={avatarUrl}
                                                alt=""
                                            />
                                        </Label>
                                    )}
                                </div>
                            </FormControl>
                        </FormItem>
                        <FormField
                            control={form.control}
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
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="email"
                                            placeholder="john.doe123@example.com"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Password</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="password"
                                            placeholder="********"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Make sure your password is at least 8
                                        characters long.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="confirmPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Confirm Password</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="password"
                                            placeholder="********"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Make sure your password is at least 8
                                        characters long.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex justify-end gap-2">
                            <Button
                                type="reset"
                                variant={"link"}
                                onClick={() =>
                                    (window.location.href = "/login")
                                }
                            >
                                Already got an account?
                            </Button>
                            <Button
                                type="submit"
                                disabled={form.formState.isSubmitting}
                                className=""
                            >
                                {form.formState.isSubmitting
                                    ? "Signing Up..."
                                    : "Sign Up"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </Card>
        </div>
    );
}
