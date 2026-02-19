export type Toast = { id: number; message: string };

let toasts = $state<Toast[]>([]);
let errorTitle = $state<string | null>(null);
let errorDetail = $state<string | null>(null);

let _id = 0;

function success(message: string) {
	const id = ++_id;
	toasts = [...toasts, { id, message }];
	setTimeout(() => {
		toasts = toasts.filter((t) => t.id !== id);
	}, 3000);
}

function error(title: string, detail: string) {
	errorTitle = title;
	errorDetail = detail;
}

function clearError() {
	errorTitle = null;
	errorDetail = null;
}

export const feedbackStore = {
	get toasts() {
		return toasts;
	},
	get errorTitle() {
		return errorTitle;
	},
	get errorDetail() {
		return errorDetail;
	},
	success,
	error,
	clearError
};
