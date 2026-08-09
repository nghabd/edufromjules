export function getAvatarUrl(userId: string, image?: string | null) {
	if (!image) return null;
	return `/api/users/${userId}/avatar`;
}
