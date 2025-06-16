"use client";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { authClient } from "@/lib/auth-client";

// zod schema
const formSchema = z.object({
    email: z.string().email(),
    password: z
        .string()
        .min(8, {
            message: "Password must be at least 8 characters long",
        })
        .max(64, {
            message: "Password must be at most 64 characters long",
        }),
});

export default function Signin() {
    // react hook form
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    // on submit handler
    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        await authClient.signIn.email(
            {
                email: data.email,
                password: data.password,
            },
            {
                onRequest: (ctx) => {
                    //show loading
                },
                onSuccess: (ctx) => {
                    window.location.href = "/chat";
                },
                onError: (ctx) => {
                    form.setError("password", {
                        message: ctx.error.message,
                    });
                },
            }
        );
    };

    return (
        <div className="flex h-svh w-svw items-center justify-center">
            <Card className="p-4 rounded-lg">
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-6"
                    >
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
                        <div className="flex justify-end gap-2">
                            <Button
                                type="reset"
                                variant={"link"}
                                onClick={() =>
                                    (window.location.href = "/signup")
                                }
                            >
                                Don't have an account?
                            </Button>
                            <Button
                                type="submit"
                                disabled={form.formState.isSubmitting}
                                className=""
                            >
                                {form.formState.isSubmitting
                                    ? "Logging in..."
                                    : "Login"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </Card>
        </div>
    );
}
