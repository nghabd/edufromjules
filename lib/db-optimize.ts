/**
 * Database Optimization Utilities
 * Provides optimized query patterns and performance best practices
 */

import { prisma } from "./prisma";

/**
 * Batch load user data with caching
 */
export async function loadUserWithRelations(
	userId: string,
	options: {
		includeCourses?: boolean;
		includeProgress?: boolean;
		includeQuizAttempts?: boolean;
	} = {},
) {
	return prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			email: true,
			name: true,
			role: true,
			emailVerified: true,
			image: true,
			groupId: true,
			...(options.includeCourses && {
				courseAssignments: {
					select: {
						course: {
							select: {
								id: true,
								title: true,
								description: true,
								thumbnail: true,
							},
						},
					},
				},
			}),
			...(options.includeProgress && {
				progress: {
					select: {
						materialId: true,
						progress: true,
						completed: true,
						lastAccessed: true,
					},
				},
			}),
			...(options.includeQuizAttempts && {
				quizAttempts: {
					select: {
						id: true,
						quiz: { select: { id: true, title: true } },
						score: true,
						passed: true,
						startedAt: true,
					},
					orderBy: { startedAt: "desc" },
					take: 10,
				},
			}),
		},
	});
}

/**
 * Load course with optimized relations
 */
export async function loadCourseWithRelations(
	courseId: string,
	options: {
		includeTopics?: boolean;
		includeGroups?: boolean;
		includeAssignments?: boolean;
	} = {},
) {
	return prisma.course.findUnique({
		where: { id: courseId },
		select: {
			id: true,
			title: true,
			description: true,
			category: true,
			thumbnail: true,
			createdAt: true,
			updatedAt: true,
			...(options.includeTopics && {
				topics: {
					select: {
						id: true,
						title: true,
						description: true,
						order: true,
						duration: true,
						materials: {
							select: {
								id: true,
								title: true,
								type: true,
								order: true,
							},
							orderBy: { order: "asc" },
						},
					},
					orderBy: { order: "asc" },
				},
			}),
			...(options.includeGroups && {
				groups: {
					select: {
						id: true,
						name: true,
						description: true,
						_count: {
							select: { pharmacists: true },
						},
					},
				},
			}),
			...(options.includeAssignments && {
				assignments: {
					select: {
						id: true,
						pharmacist: {
							select: {
								id: true,
								name: true,
								email: true,
							},
						},
						status: true,
						dueDate: true,
						createdAt: true,
					},
					orderBy: { createdAt: "desc" },
				},
			}),
		},
	});
}

/**
 * Load material with metadata efficiently
 */
export async function loadMaterialWithMetadata(materialId: string) {
	return prisma.material.findUnique({
		where: { id: materialId },
		select: {
			id: true,
			type: true,
			title: true,
			url: true,
			storageKey: true,
			fileSize: true,
			contentType: true,
			duration: true,
			order: true,
			isPublished: true,
			uploadedAt: true,
			topic: {
				select: {
					id: true,
					title: true,
					courseId: true,
				},
			},
			mediaMetadata: {
				select: {
					fileSize: true,
					contentType: true,
					width: true,
					height: true,
					duration: true,
					pages: true,
					format: true,
				},
			},
		},
	});
}

/**
 * Get user progress for materials efficiently
 */
export async function getUserMaterialProgress(
	userId: string,
	materialIds: string[],
) {
	if (materialIds.length === 0) return [];

	return prisma.userProgress.findMany({
		where: {
			userId,
			materialId: { in: materialIds },
		},
		select: {
			materialId: true,
			progress: true,
			completed: true,
			completionStatus: true,
			lastAccessed: true,
			timeSpent: true,
		},
	});
}

/**
 * Get quiz results with pagination
 */
export async function getQuizResults(
	quizId: string,
	options: { skip?: number; take?: number } = {},
) {
	const skip = options.skip || 0;
	const take = options.take || 20;

	const [attempts, total] = await Promise.all([
		prisma.quizAttempt.findMany({
			where: { quizId },
			select: {
				id: true,
				user: {
					select: {
						id: true,
						name: true,
						email: true,
					},
				},
				score: true,
				passed: true,
				startedAt: true,
				completedAt: true,
				attemptNumber: true,
			},
			orderBy: { startedAt: "desc" },
			skip,
			take,
		}),
		prisma.quizAttempt.count({ where: { quizId } }),
	]);

	return {
		attempts,
		total,
		hasMore: skip + take < total,
		pages: Math.ceil(total / take),
	};
}

/**
 * Get course progress for user
 */
export async function getCourseProgress(userId: string, courseId: string) {
	const [materials, completed] = await Promise.all([
		prisma.material.count({
			where: {
				topic: {
					courseId,
				},
			},
		}),
		prisma.userProgress.count({
			where: {
				userId,
				completed: true,
				material: {
					topic: {
						courseId,
					},
				},
			},
		}),
	]);

	return {
		total: materials,
		completed,
		percentage: materials > 0 ? Math.round((completed / materials) * 100) : 0,
	};
}

/**
 * Get user group with statistics
 */
export async function getGroupWithStats(groupId: string) {
	const group = await prisma.group.findUnique({
		where: { id: groupId },
		select: {
			id: true,
			name: true,
			description: true,
			supervisor: {
				select: {
					id: true,
					name: true,
					email: true,
				},
			},
			pharmacists: {
				select: {
					id: true,
					name: true,
					email: true,
				},
			},
			courses: {
				select: { id: true },
			},
		},
	});

	if (!group) return null;

	return {
		...group,
		_count: {
			pharmacists: group.pharmacists.length,
			courses: group.courses.length,
		},
	};
}

/**
 * Get course assignments with status
 */
export async function getCourseAssignments(courseId: string, status?: string) {
	return prisma.courseAssignment.findMany({
		where: {
			courseId,
			...(status && { status }),
		},
		select: {
			id: true,
			pharmacist: {
				select: {
					id: true,
					name: true,
					email: true,
				},
			},
			assignedBy: {
				select: {
					name: true,
				},
			},
			status: true,
			dueDate: true,
			createdAt: true,
		},
		orderBy: { createdAt: "desc" },
	});
}

/**
 * Get media access logs efficiently
 */
export async function getMediaAccessLogs(
	materialId: string,
	options: { skip?: number; take?: number } = {},
) {
	const skip = options.skip || 0;
	const take = options.take || 50;

	return prisma.mediaAccess.findMany({
		where: { materialId },
		select: {
			id: true,
			user: {
				select: {
					name: true,
					email: true,
				},
			},
			accessType: true,
			duration: true,
			accessedAt: true,
			completedAt: true,
		},
		orderBy: { accessedAt: "desc" },
		skip,
		take,
	});
}

/**
 * Batch update user progress
 */
export async function batchUpdateProgress(
	updates: Array<{
		userId: string;
		materialId: string;
		progress: number;
	}>,
) {
	if (updates.length === 0) return;

	return prisma.$transaction(
		updates.map((update) =>
			prisma.userProgress.upsert({
				where: {
					userId_materialId: {
						userId: update.userId,
						materialId: update.materialId,
					},
				},
				update: {
					progress: update.progress,
					lastAccessed: new Date(),
				},
				create: {
					userId: update.userId,
					materialId: update.materialId,
					progress: update.progress,
				},
			}),
		),
	);
}

/**
 * Get database health check
 */
export async function checkDatabaseHealth() {
	try {
		await prisma.$queryRaw`SELECT 1`;
		return {
			healthy: true,
			timestamp: new Date(),
		};
	} catch (error) {
		return {
			healthy: false,
			error: (error as Error).message,
			timestamp: new Date(),
		};
	}
}
