"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DeleteVoiceButtonProps {
    voiceId: string;
    voiceName: string;
    onDeleteSuccess?: (voiceId: string) => void;
}

export function DeleteVoiceButton({ voiceId, voiceName, onDeleteSuccess }: DeleteVoiceButtonProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/voices/${voiceId}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                throw new Error("Failed to delete voice");
            }

            toast({
                title: "Voice Deleted",
                description: `Successfully deleted "${voiceName}".`,
            });

            router.refresh();

            if (onDeleteSuccess) {
                onDeleteSuccess(voiceId);
            }
        } catch (error) {
            toast({
                title: "Delete Failed",
                description: "There was a problem deleting the voice clone. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={isDeleting}
                    className="text-muted-foreground border-border hover:text-destructive hover:border-destructive/50"
                    title={`Delete ${voiceName}`}
                >
                    {isDeleting ? "..." : <Trash2 className="h-4 w-4" />}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Voice Clone?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete the voice clone "{voiceName}"? This action cannot be undone. Any stories or videos currently using this voice will still keep the generated audio, but you won't be able to generate new audio with this voice.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {isDeleting ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
