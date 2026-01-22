import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import {
    User,
    Camera,
    Mail,
    Shield,
    Calendar,
    Loader2,
    Pencil,
    Check,
    X,
    AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function Profile() {
    const { user, refreshUser } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Username editing state
    const [isEditingUsername, setIsEditingUsername] = useState(false);
    const [newUsername, setNewUsername] = useState("");
    const [usernameError, setUsernameError] = useState("");
    const [isCheckingUsername, setIsCheckingUsername] = useState(false);

    // Initialize newUsername when user loads or when editing starts
    useEffect(() => {
        if (user && isEditingUsername) {
            setNewUsername(user.username);
        }
    }, [user, isEditingUsername]);

    const { mutate: updateProfile, isPending } = useMutation({
        mutationFn: async (data: { profilePicture?: string; username?: string }) => {
            const res = await fetch(`/api/users/${user?.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to update profile");
            }
            return res.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
            refreshUser?.();
            if (variables.username) {
                toast({
                    title: "Username Updated",
                    description: "Your username has been changed successfully."
                });
                setIsEditingUsername(false);
            } else {
                toast({
                    title: "Profile Updated",
                    description: "Your profile picture has been updated successfully."
                });
            }
        },
        onError: (error: Error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive"
            });
        }
    });

    // Check if username already exists
    const checkUsernameExists = async (username: string): Promise<boolean> => {
        if (!username || username === user?.username) return false;

        try {
            const res = await fetch(`/api/users/check-username?username=${encodeURIComponent(username)}`, {
                credentials: 'include',
            });
            if (!res.ok) return false;
            const data = await res.json();
            return data.exists;
        } catch {
            return false;
        }
    };

    const handleUsernameChange = async (value: string) => {
        setNewUsername(value);
        setUsernameError("");

        // Basic validation
        if (value.length < 3) {
            setUsernameError("Username must be at least 3 characters");
            return;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(value)) {
            setUsernameError("Username can only contain letters, numbers, and underscores");
            return;
        }

        // If same as current, no need to check
        if (value === user?.username) {
            return;
        }

        // Check if username exists (debounced would be better, but keeping it simple)
        setIsCheckingUsername(true);
        const exists = await checkUsernameExists(value);
        setIsCheckingUsername(false);

        if (exists) {
            setUsernameError("This username is already taken");
        }
    };

    const handleSaveUsername = () => {
        if (usernameError || !newUsername || newUsername === user?.username) {
            if (newUsername === user?.username) {
                setIsEditingUsername(false);
            }
            return;
        }
        updateProfile({ username: newUsername });
    };

    const handleCancelUsernameEdit = () => {
        setIsEditingUsername(false);
        setNewUsername(user?.username || "");
        setUsernameError("");
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast({
                title: "Invalid File",
                description: "Please select an image file.",
                variant: "destructive"
            });
            return;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            toast({
                title: "File Too Large",
                description: "Please select an image smaller than 2MB.",
                variant: "destructive"
            });
            return;
        }

        setIsUploading(true);

        // Convert to base64 for storage
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            updateProfile({ profilePicture: base64String });
            setIsUploading(false);
        };
        reader.onerror = () => {
            toast({
                title: "Error",
                description: "Failed to read the file.",
                variant: "destructive"
            });
            setIsUploading(false);
        };
        reader.readAsDataURL(file);
    };

    const handleRemovePhoto = () => {
        updateProfile({ profilePicture: "" });
    };

    if (!user) return null;

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'superadmin':
                return 'bg-red-100 text-red-700 border-red-200';
            case 'teacher':
                return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'student':
                return 'bg-green-100 text-green-700 border-green-200';
            default:
                return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'superadmin':
                return 'System Administrator';
            case 'teacher':
                return 'Teacher';
            case 'student':
                return 'Student';
            default:
                return role;
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold font-display text-gray-900">My Profile</h1>
                <p className="text-muted-foreground mt-1">
                    View and manage your account information.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Profile Picture Card */}
                <Card className="md:col-span-1">
                    <CardHeader className="text-center">
                        <CardTitle>Profile Picture</CardTitle>
                        <CardDescription>Click to change your photo</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-4">
                        <div className="relative group">
                            <Avatar className="h-32 w-32 border-4 border-primary/10 shadow-lg">
                                <AvatarImage
                                    src={(user as any).profilePicture || undefined}
                                    alt={user.fullName}
                                    className="object-cover"
                                />
                                <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-bold">
                                    {getInitials(user.fullName)}
                                </AvatarFallback>
                            </Avatar>

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isPending || isUploading}
                                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                            >
                                {(isPending || isUploading) ? (
                                    <Loader2 className="h-8 w-8 text-white animate-spin" />
                                ) : (
                                    <Camera className="h-8 w-8 text-white" />
                                )}
                            </button>
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isPending || isUploading}
                            >
                                <Camera className="h-4 w-4 mr-2" />
                                Change Photo
                            </Button>
                            {(user as any).profilePicture && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleRemovePhoto}
                                    disabled={isPending || isUploading}
                                    className="text-destructive hover:text-destructive"
                                >
                                    Remove
                                </Button>
                            )}
                        </div>

                        <p className="text-xs text-muted-foreground text-center">
                            Supported formats: JPG, PNG, GIF<br />
                            Maximum size: 2MB
                        </p>
                    </CardContent>
                </Card>

                {/* Profile Information Card */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Account Information</CardTitle>
                        <CardDescription>Your personal details and role</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Full Name */}
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <User className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Full Name</p>
                                <p className="text-lg font-semibold">{user.fullName}</p>
                            </div>
                        </div>

                        {/* Username - Editable */}
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                                <Mail className="h-5 w-5 text-secondary-foreground" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm text-muted-foreground">Username</p>
                                {isEditingUsername ? (
                                    <div className="space-y-2 mt-1">
                                        <div className="flex items-center gap-2">
                                            <Input
                                                value={newUsername}
                                                onChange={(e) => handleUsernameChange(e.target.value)}
                                                placeholder="Enter new username"
                                                className={`max-w-xs ${usernameError ? 'border-destructive' : ''}`}
                                                disabled={isPending}
                                            />
                                            {isCheckingUsername && (
                                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                            )}
                                        </div>
                                        {usernameError && (
                                            <div className="flex items-center gap-1 text-sm text-destructive">
                                                <AlertCircle className="h-3 w-3" />
                                                {usernameError}
                                            </div>
                                        )}
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                onClick={handleSaveUsername}
                                                disabled={isPending || !!usernameError || isCheckingUsername || !newUsername}
                                            >
                                                {isPending ? (
                                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                                ) : (
                                                    <Check className="h-4 w-4 mr-1" />
                                                )}
                                                Save
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={handleCancelUsernameEdit}
                                                disabled={isPending}
                                            >
                                                <X className="h-4 w-4 mr-1" />
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <p className="text-lg font-semibold">{user.username}</p>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => setIsEditingUsername(true)}
                                        >
                                            <Pencil className="h-3 w-3" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Role */}
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                                <Shield className="h-5 w-5 text-secondary-foreground" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Role</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge
                                        variant="outline"
                                        className={`${getRoleBadgeColor(user.role)} font-medium`}
                                    >
                                        {getRoleLabel(user.role)}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        {/* Account Created */}
                        {user.createdAt && (
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                                    <Calendar className="h-5 w-5 text-secondary-foreground" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Account Created</p>
                                    <p className="text-lg font-semibold">
                                        {new Date(user.createdAt).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
