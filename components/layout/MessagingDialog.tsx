"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { DefaultAccountAvatar } from "@/components/layout/DefaultAccountAvatar";
import { useRealtimeQueryInvalidation } from "@/components/realtime/useRealtimeQueryInvalidation";
import { REALTIME_EVENTS } from "@/lib/realtime-events";

type Contact = {
	id: string;
	name?: string | null;
	email: string;
	role: string;
	image?: string | null;
};

type Message = {
	id: string;
	body: string;
	senderId: string;
	recipientId: string;
	createdAt: string;
	sender: Contact;
};

type MessagingDialogProps = {
	currentUserId?: string;
};

export function MessagingDialog({ currentUserId }: MessagingDialogProps) {
	const queryClient = useQueryClient();
	const [isOpen, setIsOpen] = useState(false);
	const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
	const [messageBody, setMessageBody] = useState("");

	useRealtimeQueryInvalidation({
		events: [REALTIME_EVENTS.messageCreated],
		queryKeys: [
			["message-contacts"],
			["message-unread"],
			["messages", selectedContactId],
		],
		enabled: isOpen,
	});

	useRealtimeQueryInvalidation({
		events: [REALTIME_EVENTS.messageCreated],
		queryKeys: [["message-unread"]],
	});

	const { data: contactsData } = useQuery<{ contacts: Contact[] }>({
		queryKey: ["message-contacts"],
		queryFn: async () => (await axios.get("/api/message-contacts")).data,
		enabled: isOpen,
	});

	const contacts = useMemo(() => contactsData?.contacts ?? [], [contactsData]);
	const selectedContact = useMemo(
		() => contacts.find((contact) => contact.id === selectedContactId) ?? null,
		[contacts, selectedContactId],
	);

	const { data: messagesData } = useQuery<{ messages: Message[] }>({
		queryKey: ["messages", selectedContactId],
		queryFn: async () =>
			(await axios.get(`/api/messages?userId=${selectedContactId}`)).data,
		enabled: isOpen && Boolean(selectedContactId),
		refetchInterval: isOpen && selectedContactId ? 60_000 : false,
	});

	const { data: unreadData } = useQuery<{ unreadCount: number }>({
		queryKey: ["message-unread"],
		queryFn: async () => (await axios.get("/api/message-unread")).data,
		refetchInterval: 120_000,
	});

	useEffect(() => {
		if (!messagesData) return;
		void queryClient.invalidateQueries({ queryKey: ["message-unread"] });
	}, [messagesData, queryClient]);

	const sendMessage = useMutation({
		mutationFn: async () =>
			axios.post("/api/messages", {
				recipientId: selectedContactId,
				body: messageBody,
			}),
		onSuccess: () => {
			setMessageBody("");
			void queryClient.invalidateQueries({
				queryKey: ["messages", selectedContactId],
			});
			void queryClient.invalidateQueries({ queryKey: ["message-unread"] });
		},
		onError: (error: unknown) => {
			const message = axios.isAxiosError(error)
				? error.response?.data?.message
				: null;
			toast.error(typeof message === "string" ? message : "Message failed");
		},
	});

	const submitMessage = (event: FormEvent) => {
		event.preventDefault();
		if (!selectedContactId || !messageBody.trim()) return;
		sendMessage.mutate();
	};

	const unreadCount = unreadData?.unreadCount ?? 0;

	return (
		<>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="relative h-9 w-9 p-0"
				onClick={() => setIsOpen(true)}
			>
				<MessageCircle className="h-4 w-4" />
				{unreadCount > 0 && (
					<span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white">
						{unreadCount > 9 ? "9+" : unreadCount}
					</span>
				)}
			</Button>
			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogContent className="max-w-4xl p-0">
					<DialogHeader className="border-b border-border px-5 py-4">
						<DialogTitle>Messages</DialogTitle>
						<DialogDescription>
							Direct messaging is enabled across roles. Pharmacist-to-pharmacist
							messaging is blocked.
						</DialogDescription>
					</DialogHeader>
					<div className="grid h-[70vh] min-h-[440px] grid-cols-[240px_1fr]">
						<aside className="border-r border-border bg-muted/20">
							<div className="space-y-1 p-3">
								{contacts.length === 0 ? (
									<p className="px-2 py-6 text-center text-sm text-muted-foreground">
										No contacts available.
									</p>
								) : (
									contacts.map((contact) => (
										<button
											key={contact.id}
											type="button"
											onClick={() => setSelectedContactId(contact.id)}
											className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${
												selectedContactId === contact.id
													? "bg-primary text-primary-foreground"
													: "hover:bg-background"
											}`}
										>
											<DefaultAccountAvatar
												label={contact.name || contact.email}
												image={contact.image}
											/>
											<span className="min-w-0">
												<span className="block truncate font-medium">
													{contact.name || contact.email}
												</span>
												<span className="block truncate text-xs opacity-75">
													{contact.role.toLowerCase()}
												</span>
											</span>
										</button>
									))
								)}
							</div>
						</aside>
						<section className="grid min-w-0 grid-rows-[auto_1fr_auto]">
							<div className="border-b border-border px-4 py-3">
								{selectedContact ? (
									<p className="text-sm font-semibold">
										{selectedContact.name || selectedContact.email}
									</p>
								) : (
									<p className="text-sm text-muted-foreground">
										Select a contact
									</p>
								)}
							</div>
							<div className="space-y-3 overflow-y-auto p-4">
								{(messagesData?.messages ?? []).map((message) => {
									const mine = message.senderId === currentUserId;
									return (
										<div
											key={message.id}
											className={`flex ${mine ? "justify-end" : "justify-start"}`}
										>
											<div
												className={`max-w-[72%] rounded-md px-3 py-2 text-sm ${
													mine
														? "bg-primary text-primary-foreground"
														: "bg-muted"
												}`}
											>
												<p className="whitespace-pre-wrap break-words">
													{message.body}
												</p>
												<p className="mt-1 text-[10px] opacity-70">
													{new Date(message.createdAt).toLocaleString()}
												</p>
											</div>
										</div>
									);
								})}
							</div>
							<form
								onSubmit={submitMessage}
								className="flex gap-2 border-t border-border p-3"
							>
								<Input
									value={messageBody}
									onChange={(event) => setMessageBody(event.target.value)}
									placeholder={
										selectedContact
											? "Type a message"
											: "Select a contact first"
									}
									disabled={!selectedContact}
								/>
								<Button
									type="submit"
									disabled={!selectedContact || !messageBody.trim()}
								>
									<Send className="h-4 w-4" />
								</Button>
							</form>
						</section>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
