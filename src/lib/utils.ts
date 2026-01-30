import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function extractNameFromUrl(url: string): string {
    if (!url) return "Custom Repo";
    try {
        // Extract owner from github.com/owner/repo or gitee.com/owner/repo
        const match = url.match(/(?:github\.com|gitee\.com)\/([^\/\s\?#]+)/i);
        if (match && match[1]) {
            const name = match[1];
            // Capitalize first letter
            return name.charAt(0).toUpperCase() + name.slice(1);
        }
    } catch (e) {
        console.error("Failed to parse URL:", e);
    }
    return "Custom Repo";
}
