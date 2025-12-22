export class ApiError extends Error {
	code: string;
	type?: string;
	statusCode: number;

	constructor(message: string, code: string, statusCode: number, type?: string) {
		super(message);
		this.name = "ApiError";
		this.code = code;
		this.statusCode = statusCode;
		this.type = type;

		Object.setPrototypeOf(this, ApiError.prototype);
	}
}
