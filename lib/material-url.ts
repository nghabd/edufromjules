type MaterialWithStorage = {
	id: string;
	type: string;
	url: string;
	storageKey?: string | null;
	storagePath?: string | null;
};

const fileBackedTypes = new Set([
	"PDF",
	"VIDEO",
	"IMAGE",
	"DOCUMENT",
	"PRESENTATION",
]);

export function getMaterialDeliveryUrl(material: MaterialWithStorage) {
	if (
		fileBackedTypes.has(material.type) &&
		(material.storageKey || material.storagePath)
	) {
		return `/api/materials/${material.id}/file`;
	}

	return material.url;
}
