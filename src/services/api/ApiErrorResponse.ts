export interface ApiErrorInnerError {
	code: string;
	message: string;
	type?: string;
}

export interface ApiErrorDetail {
	code: string;
	message: string;
	innererror?: ApiErrorInnerError;
}

export interface ApiErrorResponse {
	error: ApiErrorDetail;
}
